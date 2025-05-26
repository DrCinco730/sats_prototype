// src/app/users/[user_id]/diagrams/[diagram_id]/components/FlyingReaction.tsx

import React, { useEffect, useState } from "react";
import "../styles/reactions.css";
import { useAwareness } from "../hooks/useAwareness";
import { useYjsProvider } from "../hooks/useYjsProvider";

type Point = {
    x: number;
    y: number;
};

type ReactionData = {
    emoji: string;
    point: Point;
    timestamp: number;
    userId: string;
};

export default function FlyingReactions() {
    const { activeUsers } = useAwareness();
    const { reactions } = useYjsProvider();
    const [localReactions, setLocalReactions] = useState<ReactionData[]>([]);

    // استخراج التفاعلات من awareness للمستخدمين
    useEffect(() => {
        const newReactions: ReactionData[] = [];

        Object.values(activeUsers).forEach(user => {
            if (user.reaction && user.cursor &&
                Date.now() - user.reaction.timestamp < 3000) {
                newReactions.push({
                    emoji: user.reaction.emoji,
                    point: user.cursor,
                    timestamp: user.reaction.timestamp,
                    userId: user.id
                });
            }
        });

        setLocalReactions(newReactions);
    }, [activeUsers]);

    // استخراج التفاعلات من yjs array
    useEffect(() => {
        const handleReactionsUpdate = () => {
            // يمكن أن نقوم بتحديث التفاعلات الإضافية من مصفوفة Yjs هنا إذا كنا نخزنها
        };

        reactions.observe(handleReactionsUpdate);
        return () => {
            reactions.unobserve(handleReactionsUpdate);
        };
    }, [reactions]);

    // إزالة التفاعلات القديمة
    useEffect(() => {
        const interval = setInterval(() => {
            setLocalReactions(prev =>
                prev.filter(r => Date.now() - r.timestamp < 3000)
            );
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    return (
        <>
            {localReactions.map((reaction) => (
                <SingleFlyingReaction
                    key={`${reaction.userId}-${reaction.timestamp}`}
                    point={reaction.point}
                    value={reaction.emoji}
                    timestamp={reaction.timestamp}
                />
            ))}
        </>
    );
}

// مكون تفاعل منفرد
function SingleFlyingReaction({ point, timestamp, value }: {
    point: Point;
    timestamp: number;
    value: string;
}) {
    return (
        <div
            className="pointer-events-none absolute select-none z-[9000]"
            style={{
                left: point.x,
                top: point.y,
                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
            }}
        >
            <div
                className="disappear text-2xl"
                style={{
                    animation: `goUp${timestamp % 3} 2s, fadeOut 2s`,
                }}
            >
                <div
                    style={{
                        animation: `leftRight${timestamp % 3} 0.3s alternate infinite ease-in-out`,
                        transform: "translate(-50%, -50%)",
                    }}
                >
                    {value}
                </div>
            </div>
        </div>
    );
}