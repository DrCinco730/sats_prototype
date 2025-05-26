// src/app/users/[user_id]/diagrams/[diagram_id]/hooks/useYjsProvider.tsx

import { useState, useEffect, useRef } from 'react';
// استيراد yjs بشكل صحيح
import * as Y from 'yjs';
// استيراد البروتوكولات من حزمها الخاصة
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
// استيراد مكونات lib0 من حزمها الخاصة
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { WebsocketProvider } from 'y-websocket';
import { useDiagramSocket } from './useDiagramSocket';

export function useYjsProvider(diagramId: string, userId: string) {
    const [doc, setDoc] = useState<Y.Doc | null>(null);
    const [provider, setProvider] = useState<any | null>(null);
    const [sharedMap, setSharedMap] = useState<Y.Map<any> | null>(null);
    const [awareness, setAwareness] = useState<any | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const socket = useDiagramSocket();

    // مرجع للمزود لتجنب مشاكل الاستخدام المبكر
    const providerRef = useRef<any>(null);

    useEffect(() => {
        if (!diagramId || !userId) return;

        console.log(`Initializing Yjs provider for diagram ${diagramId}`);

        // إنشاء مستند Yjs جديد
        const yDoc = new Y.Doc();

        // طبقة مخصصة لتوصيل WebsocketProvider بالـ Socket.IO
        class CustomWebsocketProvider {
            private doc: Y.Doc;
            private awareness: any;
            private callbacks: Map<string, Set<Function>>;

            constructor(doc: Y.Doc) {
                this.doc = doc;
                // إنشاء كائن الوعي (Awareness) باستخدام awarenessProtocol
                this.awareness = new awarenessProtocol.Awareness(doc);
                this.callbacks = new Map();

                // إعداد معالجات أحداث الوعي
                this.awareness.on('update', this.handleAwarenessUpdate.bind(this));

                // إعداد معالج لتحديثات المستند
                doc.on('update', this.handleDocUpdate.bind(this));
            }

            // معالج تحديثات الوعي
            handleAwarenessUpdate(changes: { added: Iterable<unknown> | ArrayLike<unknown>; updated: Iterable<unknown> | ArrayLike<unknown>; }, origin: string) {
                if (origin === 'remote') return; // تجاهل التحديثات الواردة من الشبكة

                // إنشاء تحديث الوعي
                const encoder = encoding.createEncoder();
                encoding.writeVarUint(encoder, 1); // messageAwareness
                encoding.writeVarUint8Array(
                    encoder,
                    awarenessProtocol.encodeAwarenessUpdate(
                        this.awareness,
                        Array.from(changes.added).concat(Array.from(changes.updated))
                    )
                );

                // إرسال التحديث عبر Socket.IO
                if (socket) {
                    socket.emit('yjs_sync', {
                        diagramId,
                        data: Array.from(encoding.toUint8Array(encoder))
                    });
                }
            }

            // معالج تحديثات المستند
            handleDocUpdate(update: Uint8Array<ArrayBufferLike>, origin: string) {
                if (origin === 'remote') return; // تجاهل التحديثات الواردة من الشبكة

                // إنشاء رسالة مزامنة
                const encoder = encoding.createEncoder();
                encoding.writeVarUint(encoder, 0); // messageSync
                syncProtocol.writeUpdate(encoder, update);

                // إرسال التحديث عبر Socket.IO
                if (socket) {
                    socket.emit('yjs_sync', {
                        diagramId,
                        data: Array.from(encoding.toUint8Array(encoder))
                    });
                }
            }

            // معالجة الرسائل الواردة
            processMessage(message: Uint8Array) {
                const decoder = decoding.createDecoder(message);
                const encoder = encoding.createEncoder();
                const messageType = decoding.readVarUint(decoder);

                switch (messageType) {
                    case 0: // messageSync
                        syncProtocol.readSyncMessage(
                            decoder,
                            encoder,
                            this.doc,
                            null
                        );
                        break;

                    case 1: // messageAwareness
                        awarenessProtocol.applyAwarenessUpdate(
                            this.awareness,
                            decoding.readVarUint8Array(decoder),
                            'remote'
                        );
                        break;
                }

                return encoder;
            }

            // الاشتراك في الأحداث
            on(event: string, callback: Function) {
                if (!this.callbacks.has(event)) {
                    this.callbacks.set(event, new Set());
                }
                this.callbacks.get(event)?.add(callback);

                if (event === 'status') {
                    // استدعاء مباشر بحالة الاتصال الحالية
                    callback({ status: socket?.connected ? 'connected' : 'disconnected' });
                }
            }

            // إلغاء الاشتراك من الأحداث
            off(event: string, callback: Function) {
                const callbacks = this.callbacks.get(event);
                if (callbacks) {
                    callbacks.delete(callback);
                }
            }

            // طلب مزامنة
            sync() {
                // إرسال طلب مزامنة
                const encoder = encoding.createEncoder();
                encoding.writeVarUint(encoder, 0); // messageSync
                syncProtocol.writeSyncStep1(encoder, this.doc);

                if (socket) {
                    socket.emit('yjs_sync', {
                        diagramId,
                        data: Array.from(encoding.toUint8Array(encoder))
                    });
                }
            }

            // تدمير المزود
            destroy() {
                this.doc.off('update', this.handleDocUpdate);
                this.awareness.off('update', this.handleAwarenessUpdate);
                this.callbacks.clear();
            }
        }

        // إنشاء مزود مخصص
        const customProvider = new CustomWebsocketProvider(yDoc);
        providerRef.current = customProvider;

        // إعداد الخريطة المشتركة
        const yMap = yDoc.getMap('diagram');

        // الاستماع لأحداث الاتصال من Socket.IO
        const handleConnect = () => {
            setIsConnected(true);
            // طلب مزامنة عند إعادة الاتصال
            customProvider.sync();
        };

        const handleDisconnect = () => {
            setIsConnected(false);
        };

        if (socket) {
            socket.on('connect', handleConnect);
            socket.on('disconnect', handleDisconnect);

            // تعيين الحالة الأولية
            setIsConnected(socket.connected);
        }

        // تحديث الحالة
        setDoc(yDoc);
        setProvider(customProvider);
        setSharedMap(yMap);
        setAwareness(customProvider.awareness);

        // إرسال طلب مزامنة أولي
        customProvider.sync();

        // تنظيف الموارد عند إلغاء تحميل المكون
        return () => {
            if (socket) {
                socket.off('connect', handleConnect);
                socket.off('disconnect', handleDisconnect);
            }

            customProvider.destroy();
            yDoc.destroy();
        };
    }, [diagramId, userId, socket]);

    // استخدام المرجع للمزود إذا لم يتم تحديث الحالة بعد
    const currentProvider = provider || providerRef.current;

    return {
        doc,
        provider: currentProvider,
        sharedMap,
        awareness,
        isConnected
    };
}