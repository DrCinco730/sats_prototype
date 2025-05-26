// src/app/users/[user_id]/diagrams/[diagram_id]/components/LiveCursors.tsx
import React, { useEffect } from "react";
import { useAwareness } from "../hooks/useAwareness";
import Cursor from "./Cursor";

export default function LiveCursors() {
    const { activeUsers } = useAwareness();

    return (
        <div className="live-cursors-container">
            {Object.entries(activeUsers).map(([userId, userData]) => (
                userData.cursor && (
                    <Cursor
                        key={userId}
                        color={userData.color}
                        x={userData.cursor.x}
                        y={userData.cursor.y}
                        username={userData.name}
                    />
                )
            ))}
        </div>
    );
}