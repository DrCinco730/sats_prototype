// src/app/users/[user_id]/diagrams/[diagram_id]/components/ActiveUsers.tsx

import React from "react";
import { useAwareness } from "../hooks/useAwareness";

export default function ActiveUsers() {
    const { activeUsers } = useAwareness();

    // عرض فقط عندما يكون هناك مستخدمون نشطون
    if (Object.keys(activeUsers).length === 0) return null;

    return (
        <div className="active-users-wrapper">
            <div className="active-users-container">
                {Object.values(activeUsers).map((user) => (
                    <div
                        key={user.id}
                        className="active-user-avatar"
                        style={{
                            backgroundColor: user.color,
                            zIndex: 1000,
                        }}
                        title={user.name}
                    >
                        {user.name.charAt(0).toUpperCase()}
                    </div>
                ))}
            </div>
        </div>
    );
}