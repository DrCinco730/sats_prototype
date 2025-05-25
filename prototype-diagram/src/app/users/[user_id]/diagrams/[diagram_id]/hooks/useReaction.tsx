"use client";

import {
    createContext,
    useContext,
    useState,
    Dispatch,
    SetStateAction,
    ReactNode,
} from "react";

export enum CursorMode {
    Hidden,
    ReactionSelector,
    Reaction,
}

export type CursorState =
    | {
    mode: CursorMode.Hidden;
}
    | {
    mode: CursorMode.ReactionSelector;
}
    | {
    mode: CursorMode.Reaction;
    reaction: string;
    isPressed: boolean;
};

export type Reaction = {
    value: string;
    timestamp: number;
    point: { x: number; y: number };
};

type ReactionContextType = {
    cursorState: CursorState;
    setCursorState: Dispatch<SetStateAction<CursorState>>;
    reactions: Reaction[];
    setReactions: Dispatch<SetStateAction<Reaction[]>>;
};

const ReactionContext = createContext<ReactionContextType | null>(null);

export function ReactionProvider({ children }: { children: ReactNode }) {
    const [cursorState, setCursorState] = useState<CursorState>({
        mode: CursorMode.Hidden,
    });
    const [reactions, setReactions] = useState<Reaction[]>([]);

    return (
        <ReactionContext.Provider value={{ cursorState, setCursorState, reactions, setReactions }}>
            {children}
        </ReactionContext.Provider>
    );
}

export function useReaction() {
    const context = useContext(ReactionContext);
    if (!context) {
        throw new Error("useReaction must be used within a ReactionProvider");
    }
    return context;
}