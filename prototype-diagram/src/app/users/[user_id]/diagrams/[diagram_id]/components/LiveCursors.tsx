// src/app/users/[user_id]/diagrams/[diagram_id]/components/LiveCursors.tsx

import React, { useEffect, useState } from "react";
import { useDiagramSocket } from "../hooks/useDiagramSocket";
import { useUserColors } from "../hooks/useUserColors";
import Cursor from "./Cursor";

type CursorData = {
    screen: { x: number; y: number };
    username?: string;
};

export default function LiveCursors({ awareness }:any) {
    const socket:any = useDiagramSocket();
    const [cursors, setCursors] = useState<Record<string, CursorData>>({});
    const { getUserColor } = useUserColors();

    // استخدام الوعي من Yjs إذا كان متاحاً
    useEffect(() => {
        if (awareness) {
            const handleAwarenessUpdate = () => {
                const states = awareness.getStates();
                // تعريف newCursors بتوقيع فهرس واضح
                const newCursors: Record<string, CursorData> = {};

                // تحويل حالات الوعي إلى كائنات مؤشر
                states.forEach((state: { userId: string | number; cursor: { screen: any; }; username: any; }, clientId: string) => {
                    // تجاهل حالة المستخدم الحالي
                    if (state.userId === socket?.data?.userId) {
                        return;
                    }

                    if (state.cursor && state.userId) {
                        // تحويل userId إلى سلسلة نصية لضمان استخدامه كمفتاح صالح
                        const userIdKey = String(state.userId);
                        newCursors[userIdKey] = {
                            screen: state.cursor.screen,
                            username: state.username || `User ${clientId.substring(0, 5)}`,
                        };
                    }
                });

                setCursors(newCursors);
            };

            // الاشتراك في تحديثات الوعي
            awareness.on('update', handleAwarenessUpdate);

            // التنظيف عند إلغاء التحميل
            return () => {
                awareness.off('update', handleAwarenessUpdate);
            };
        } else if (socket) {
            // استخدام Socket.IO كبديل إذا لم يكن الوعي متاحاً
            const handleCursorUpdate = (data: any) => {
                const { userId, cursor, username } = data;

                // تجاهل تحديثات المؤشر الخاصة بالمستخدم الحالي
                if (userId === socket.data?.userId) {
                    return;
                }

                if (!cursor) {
                    setCursors((prev) => {
                        const newCursors = { ...prev };
                        delete newCursors[userId];
                        return newCursors;
                    });
                    return;
                }

                setCursors((prev) => ({
                    ...prev,
                    [userId]: {
                        ...cursor,
                        username
                    }
                }));
            };

            const handleUserDisconnect = (data: any) => {
                const { userId } = data;
                setCursors((prev) => {
                    const newCursors = { ...prev };
                    delete newCursors[userId];
                    return newCursors;
                });
            };

            socket.on("cursor_update", handleCursorUpdate);
            socket.on("user_disconnected", handleUserDisconnect);

            return () => {
                socket.off("cursor_update", handleCursorUpdate);
                socket.off("user_disconnected", handleUserDisconnect);
            };
        }
    }, [socket, awareness]);

    return (
        <div className="live-cursors-container">
            {Object.entries(cursors).map(([userId, cursorData]) => (
                <Cursor
                    key={userId}
                    color={getUserColor(userId)}
                    x={cursorData.screen.x}
                    y={cursorData.screen.y}
                    username={cursorData.username}
                />
            ))}
        </div>
    );
}