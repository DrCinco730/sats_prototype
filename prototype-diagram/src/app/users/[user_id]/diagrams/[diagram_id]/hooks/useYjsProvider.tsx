// src/app/users/[user_id]/diagrams/[diagram_id]/hooks/useYjsProvider.tsx
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { useUserColors, COLORS } from "./useUserColors";

// تعريف نوع مزود Yjs
export type YjsProvider = {
    doc: Y.Doc;
    provider: WebsocketProvider;
    nodes: Y.Map<any>;
    edges: Y.Map<any>;
    reactions: Y.Array<any>;
    info: Y.Map<any>;
};

// إنشاء سياق React للمزود
const YjsContext = createContext<YjsProvider | null>(null);

// خصائص المزود
type YjsProviderProps = {
    children: React.ReactNode;
    userId: string;
    diagramId: string;
    url?: string;
};

// مكون المزود
export const YjsProviderComponent: React.FC<YjsProviderProps> = ({
                                                                     children,
                                                                     userId,
                                                                     diagramId,
                                                                     url = `ws://${process.env.NEXT_PUBLIC_API_URL || 'localhost:8000'}/yjs-ws`,
                                                                 }) => {
    const [provider, setProvider] = useState<YjsProvider | null>(null);
    const { getUserColor } = useUserColors();
    const userColor = getUserColor(userId);

    useEffect(() => {
        // إنشاء مستند Yjs جديد
        const doc = new Y.Doc();

        // الحصول على هياكل البيانات المشتركة
        const nodes = doc.getMap("nodes");
        const edges = doc.getMap("edges");
        const reactions = doc.getArray("reactions");
        const info = doc.getMap("info");

        // إنشاء مزود WebSocket
        const websocketProvider = new WebsocketProvider(
            url,
            diagramId,
            doc,
            { connect: true }
        );

        // إعداد الوعي (Awareness)
        websocketProvider.awareness.setLocalStateField("user", {
            id: userId,
            name: `User ${userId.substring(0, 5)}`,
            color: userColor || COLORS[0],
            colorLight: userColor ? `${userColor}33` : `${COLORS[0]}33`
        });

        // مراقبة حالة الاتصال
        websocketProvider.on('status', (event: { status: any; }) => {
            console.log(`Connection status: ${event.status}`);
        });

        // مراقبة حالة المزامنة
        websocketProvider.on('sync', (isSynced: any) => {
            console.log(`Synced: ${isSynced}`);
        });

        // إعداد المزود
        const yjsProvider: YjsProvider = {
            doc,
            provider: websocketProvider,
            nodes,
            edges,
            reactions,
            info,
        };

        setProvider(yjsProvider);

        // تنظيف عند إزالة المكون
        return () => {
            websocketProvider.disconnect();
            doc.destroy();
        };
    }, [diagramId, userId, url, userColor]);

    // عرض المكونات الفرعية فقط عندما يكون المزود جاهزًا
    if (!provider) return <div>جاري تحميل المخطط...</div>;

    return (
        <YjsContext.Provider value={provider}>{children}</YjsContext.Provider>
    );
};

// دالة Hook لاستخدام المزود
export const useYjsProvider = () => {
    const context = useContext(YjsContext);
    if (!context) {
        throw new Error("useYjsProvider يجب أن يستخدم داخل YjsProviderComponent");
    }
    return context;
};