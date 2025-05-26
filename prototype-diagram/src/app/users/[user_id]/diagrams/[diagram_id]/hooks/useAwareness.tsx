// src/app/users/[user_id]/diagrams/[diagram_id]/hooks/useAwareness.tsx
"use client";

import { useEffect, useState } from "react";
import { useYjsProvider } from "./useYjsProvider";

// نوع بيانات المستخدم في Awareness
export type AwarenessUser = {
    id: string;
    name: string;
    color: string;
    colorLight?: string;
};

// نوع بيانات المؤشر في Awareness
export type AwarenessCursor = {
    x: number;
    y: number;
};

// نوع بيانات المستخدم النشط المُعاد
export type ActiveUser = {
    id: string;
    name: string;
    color: string;
    colorLight?: string;
    cursor?: AwarenessCursor;
    selection?: string[];
    reaction?: {
        emoji: string;
        timestamp: number;
    };
};

/**
 * Hook للتعامل مع وعي Yjs (Awareness)
 * يستخدم لمزامنة مؤشرات المستخدمين والمستخدمين النشطين والتفاعلات
 */
export const useAwareness = () => {
    const { provider } = useYjsProvider();
    const [activeUsers, setActiveUsers] = useState<Record<string, ActiveUser>>({});

    // تحديث المؤشر
    const updateCursor = (x: number, y: number) => {
        provider.awareness.setLocalStateField("cursor", { x, y });
    };

    // إرسال تفاعل
    const sendReaction = (emoji: string) => {
        provider.awareness.setLocalStateField("reaction", {
            emoji,
            timestamp: Date.now(),
        });
    };

    // تحديث التحديد
    const updateSelection = (selectedNodeIds: string[]) => {
        provider.awareness.setLocalStateField("selection", selectedNodeIds);
    };

    // الاستماع لتغييرات الوعي
    useEffect(() => {
        const awareness = provider.awareness;

        // معالج تغييرات الوعي
        const awarenessChangeHandler = () => {
            // تحديث قائمة المستخدمين النشطين من حالة الوعي
            const states = awareness.getStates();
            const newActiveUsers: Record<string, ActiveUser> = {};

            states.forEach((state: any) => {
                if (state.user) {
                    newActiveUsers[state.user.id] = {
                        ...state.user,
                        cursor: state.cursor,
                        selection: state.selection,
                        reaction: state.reaction,
                    };
                }
            });

            setActiveUsers(newActiveUsers);
        };

        // إضافة مستمع الأحداث
        awareness.on("update", awarenessChangeHandler);

        // استدعاء أول مرة لتحديث القائمة الأولية
        awarenessChangeHandler();

        // تنظيف عند إزالة المكون
        return () => {
            awareness.off("update", awarenessChangeHandler);
        };
    }, [provider.awareness]);

    return {
        activeUsers,
        updateCursor,
        sendReaction,
        updateSelection,
    };
};