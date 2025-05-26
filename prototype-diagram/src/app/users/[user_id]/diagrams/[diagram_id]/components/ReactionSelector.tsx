// src/app/users/[user_id]/diagrams/[diagram_id]/components/ReactionSelector.tsx
import React from "react";
import { useAwareness } from "../hooks/useAwareness";

export default function ReactionSelector({ onClose }: { onClose: () => void }) {
    const { sendReaction } = useAwareness();

    const handleSelect = (reaction: string) => {
        sendReaction(reaction);
        onClose();
    };

    return (
        <div
            className="reaction-selector absolute bottom-20 left-0 right-0 mx-auto w-fit transform rounded-full bg-white px-2"
            onPointerMove={(e) => e.stopPropagation()}
        >
            <ReactionButton reaction="👍" onSelect={handleSelect} />
            <ReactionButton reaction="🔥" onSelect={handleSelect} />
            <ReactionButton reaction="😍" onSelect={handleSelect} />
            <ReactionButton reaction="👀" onSelect={handleSelect} />
            <ReactionButton reaction="😱" onSelect={handleSelect} />
            <ReactionButton reaction="🙁" onSelect={handleSelect} />
        </div>
    );
}

function ReactionButton({
                            reaction,
                            onSelect,
                        }: {
    reaction: string;
    onSelect: (reaction: string) => void;
}) {
    return (
        <button
            className="reaction-button transform select-none p-2 text-xl transition-transform hover:scale-150 focus:scale-150 focus:outline-none"
            onPointerDown={() => onSelect(reaction)}
        >
            {reaction}
        </button>
    );
}