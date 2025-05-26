// prototype-server/src/features/yjs/yjs.utils.ts
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as map from 'lib0/map';
import * as WebSocket from 'ws';

const wsReadyStateConnecting = 0;
const wsReadyStateOpen = 1;
const wsReadyStateClosing = 2;
const wsReadyStateClosed = 3;

const messageSync = 0;
const messageAwareness = 1;

// إنشاء فئة WSSharedDoc التي تمتد من Y.Doc
export class WSSharedDoc extends Y.Doc {
    name: string;
    conns: Map<WebSocket, Set<number>>;
    awareness: awarenessProtocol.Awareness;

    constructor(name: string, gc = true) {
        super({ gc });
        this.name = name;
        this.conns = new Map();
        this.awareness = new awarenessProtocol.Awareness(this);
        this.awareness.setLocalState(null);

        const awarenessChangeHandler = ({ added, updated, removed }, conn) => {
            const changedClients = added.concat(updated, removed);
            if (conn !== null) {
                const connControlledIDs = this.conns.get(conn);
                if (connControlledIDs !== undefined) {
                    added.forEach(clientID => { connControlledIDs.add(clientID); });
                    removed.forEach(clientID => { connControlledIDs.delete(clientID); });
                }
            }

            // broadcast awareness update
            const encoder = encoding.createEncoder();
            encoding.writeVarUint(encoder, messageAwareness);
            encoding.writeVarUint8Array(encoder,
                awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients));
            const buff = encoding.toUint8Array(encoder);
            this.conns.forEach((_, c) => {
                send(this, c, buff);
            });
        };

        this.awareness.on('update', awarenessChangeHandler);
        this.on('update', (update, origin, doc) => {
            const encoder = encoding.createEncoder();
            encoding.writeVarUint(encoder, messageSync);
            syncProtocol.writeUpdate(encoder, update);
            const message = encoding.toUint8Array(encoder);
            this.conns.forEach((_, conn) => send(this, conn, message));
        });
    }
}

// خرائط المستندات النشطة
export const docs = new Map<string, WSSharedDoc>();

/**
 * الحصول على مستند Y.Doc حسب الاسم، سواء كان في الذاكرة أو يجب إنشاؤه
 */
export const getYDoc = (docname: string, gc = true): WSSharedDoc => map.setIfUndefined(docs, docname, () => {
    const doc = new WSSharedDoc(docname, gc);
    docs.set(docname, doc);
    return doc;
});

/**
 * إرسال رسالة إلى اتصال
 */
export const send = (doc: WSSharedDoc, conn: WebSocket, m: Uint8Array) => {
    if (conn.readyState !== wsReadyStateConnecting && conn.readyState !== wsReadyStateOpen) {
        closeConn(doc, conn);
    }
    try {
        conn.send(m, (err) => { err != null && closeConn(doc, conn); });
    } catch (e) {
        closeConn(doc, conn);
    }
};

/**
 * إغلاق اتصال وإزالة معلومات الوعي
 */
export const closeConn = (doc: WSSharedDoc, conn: WebSocket) => {
    if (doc.conns.has(conn)) {
        const controlledIds = doc.conns.get(conn);
        doc.conns.delete(conn);
        if (controlledIds) {
            awarenessProtocol.removeAwarenessStates(doc.awareness, Array.from(controlledIds), null);
        }
        if (doc.conns.size === 0) {
            doc.destroy();
            docs.delete(doc.name);
        }
    }
    conn.close();
};

/**
 * الاستماع إلى رسائل من اتصال
 */
export const messageListener = (conn: WebSocket, doc: WSSharedDoc, message: Uint8Array) => {
    try {
        const encoder = encoding.createEncoder();
        const decoder = decoding.createDecoder(message);
        const messageType = decoding.readVarUint(decoder);

        switch (messageType) {
            case messageSync:
                encoding.writeVarUint(encoder, messageSync);
                syncProtocol.readSyncMessage(decoder, encoder, doc, conn);

                // إرسال الرد فقط إذا كان هناك محتوى
                if (encoding.length(encoder) > 1) {
                    send(doc, conn, encoding.toUint8Array(encoder));
                }
                break;
            case messageAwareness:
                awarenessProtocol.applyAwarenessUpdate(doc.awareness, decoding.readVarUint8Array(decoder), conn);
                break;
        }
    } catch (err) {
        console.error(err);
    }
};

const pingTimeout = 30000;

/**
 * إعداد اتصال WebSocket
 */
export const setupWSConnection = (conn: WebSocket, req: any, { docName = req.url.slice(1).split('?')[0], gc = true } = {}) => {
    conn.binaryType = 'arraybuffer';

    // الحصول على المستند أو إنشاؤه إذا لم يكن موجودًا
    const doc = getYDoc(docName, gc);
    doc.conns.set(conn, new Set());

    // الاستماع والرد على الأحداث
    conn.on('message', (message: ArrayBuffer) => messageListener(conn, doc, new Uint8Array(message)));

    // التحقق من حالة الاتصال
    let pongReceived = true;
    const pingInterval = setInterval(() => {
        if (!pongReceived) {
            if (doc.conns.has(conn)) {
                closeConn(doc, conn);
            }
            clearInterval(pingInterval);
        } else if (doc.conns.has(conn)) {
            pongReceived = false;
            try {
                conn.ping();
            } catch (e) {
                closeConn(doc, conn);
                clearInterval(pingInterval);
            }
        }
    }, pingTimeout);

    conn.on('close', () => {
        closeConn(doc, conn);
        clearInterval(pingInterval);
    });

    conn.on('pong', () => {
        pongReceived = true;
    });

    // إرسال خطوة المزامنة الأولى
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeSyncStep1(encoder, doc);
    send(doc, conn, encoding.toUint8Array(encoder));

    // إرسال حالات الوعي الحالية
    const awarenessStates = doc.awareness.getStates();
    if (awarenessStates.size > 0) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageAwareness);
        encoding.writeVarUint8Array(
            encoder,
            awarenessProtocol.encodeAwarenessUpdate(doc.awareness, Array.from(awarenessStates.keys()))
        );
        send(doc, conn, encoding.toUint8Array(encoder));
    }
};