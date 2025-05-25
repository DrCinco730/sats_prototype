// src/app/users/[user_id]/diagrams/[diagram_id]/components/FlyingReaction.tsx

import React from "react";
import "../styles/reactions.css";

type Point = {
    screen?: { x: number; y: number };
    flow?: { x: number; y: number };
    viewport?: { zoom: number; x: number; y: number };
};

type Props = {
    point: Point;
    timestamp: number;
    value: string;
};

export default function FlyingReaction({ point, timestamp, value }: Props) {
    // تحديد الموقع على الشاشة
    let x = 0, y = 0;

    // استخدام إحداثيات الشاشة مباشرة إذا كانت متوفرة
    if (point.screen) {
        x = point.screen.x;
        y = point.screen.y;
    }

    return (
        <div
            className="pointer-events-none absolute select-none z-[9000]"
            style={{
                left: x,
                top: y,
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