// src/app/users/[user_id]/diagrams/[diagram_id]/components/Canvas.tsx

"use client";

import React, { useRef, useCallback, useState, useEffect } from "react";
import {
    ReactFlow,
    addEdge,
    useNodesState,
    useEdgesState,
    Controls,
    useReactFlow,
    Background,
    Edge,
    Node,
} from "@xyflow/react";
import { v4 as uuid } from "uuid";
import { debounce } from "lodash";

import "@xyflow/react/dist/style.css";

import Sidebar from "./Sidebar";
import { useDnD } from "../hooks/useDnD";
import CustomNode from "./CustomNode";
import LiveCursors from "./LiveCursors";
import { CursorMode, ReactionProvider, useReaction } from "../hooks/useReaction";
import useInterval from "../hooks/useInterval";
import FlyingReactions from "./FlyingReaction";
import ReactionSelector from "./ReactionSelector";
import ActiveUsers from "./ActiveUsers";
import { useUserColors } from "../hooks/useUserColors";

// Yjs imports
import { YjsProviderComponent, useYjsProvider } from "../hooks/useYjsProvider";
import { useAwareness } from "../hooks/useAwareness";
import { nodesToArray, edgesToArray, arrayToNodesMap, arrayToEdgesMap } from "../utils/diagramConverter";

import "../styles/index.css";
import "../styles/xy-theme.css";
import "../styles/reactions.css";

const getId = () => uuid();
const nodeTypes: {[key: string]: any} = {
    custom: CustomNode,
};

const CanvasWithProviders = ({
                                 initialDiagram,
                                 diagramId,
                                 userId,
                             }:any) => {
    return (
        <YjsProviderComponent diagramId={diagramId} userId={userId}>
            <ReactionProvider>
                <CanvasContent
                    initialDiagram={initialDiagram}
                    diagramId={diagramId}
                    userId={userId}
                />
            </ReactionProvider>
        </YjsProviderComponent>
    );
};

function CanvasContent({
                           initialDiagram,
                           diagramId,
                           userId,
                       }:any) {
    const [localNodesChanged, setLocalNodesChanged] = useState<boolean>(false);
    const [localEdgesChanged, setLocalEdgesChanged] = useState<boolean>(false);
    const [showReactionSelector, setShowReactionSelector] = useState<boolean>(false);

    const reactFlowWrapper = useRef<HTMLDivElement | null>(null);
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const { screenToFlowPosition } = useReactFlow();
    const [type] = useDnD();
    const [cursor, setCursor] = useState({ x: 0, y: 0 });

    // استخدام Yjs
    const { nodes: yNodes, edges: yEdges, reactions: yReactions } = useYjsProvider();

    // استخدام الوعي (Awareness)
    const { updateCursor, sendReaction, activeUsers } = useAwareness();

    // استخدام سياق التفاعلات
    const { cursorState, setCursorState } = useReaction();

    // تحميل البيانات الأولية
    useEffect(() => {
        // تجنب استخدام البيانات الأولية إذا كانت الـ yNodes تحتوي على بيانات بالفعل
        if (yNodes.size === 0 && initialDiagram) {
            try {
                // تحويل من التنسيق القديم JSON إلى مخطط Yjs
                if (initialDiagram.nodes && initialDiagram.nodes.length > 0) {
                    initialDiagram.nodes.forEach((node:any) => {
                        const { id, ...nodeData } = node;
                        yNodes.set(id, nodeData);
                    });
                }

                if (initialDiagram.edges && initialDiagram.edges.length > 0) {
                    initialDiagram.edges.forEach((edge:any) => {
                        const { id, ...edgeData } = edge;
                        yEdges.set(id, edgeData);
                    });
                }
            } catch (error) {
                console.error("Error loading initial diagram:", error);
            }
        }
    }, [initialDiagram, yNodes, yEdges]);

    // الاستماع لتغييرات العقد من Yjs
    useEffect(() => {
        // التحويل الأولي من Yjs إلى ReactFlow
        setNodes(nodesToArray(yNodes));

        const handleYNodesUpdate = () => {
            // تجنب التحديث إذا كانت التغييرات محلية
            if (localNodesChanged) {
                setLocalNodesChanged(false);
                return;
            }

            // تحويل من Yjs إلى ReactFlow
            setNodes(nodesToArray(yNodes));
        };

        // إضافة مستمع للتغييرات
        yNodes.observe(handleYNodesUpdate);

        // تنظيف عند إزالة المكون
        return () => {
            yNodes.unobserve(handleYNodesUpdate);
        };
    }, [yNodes, setNodes, localNodesChanged]);

    // الاستماع لتغييرات الروابط من Yjs
    useEffect(() => {
        // التحويل الأولي من Yjs إلى ReactFlow
        setEdges(edgesToArray(yEdges));

        const handleYEdgesUpdate = () => {
            // تجنب التحديث إذا كانت التغييرات محلية
            if (localEdgesChanged) {
                setLocalEdgesChanged(false);
                return;
            }

            // تحويل من Yjs إلى ReactFlow
            setEdges(edgesToArray(yEdges));
        };

        // إضافة مستمع للتغييرات
        yEdges.observe(handleYEdgesUpdate);

        // تنظيف عند إزالة المكون
        return () => {
            yEdges.unobserve(handleYEdgesUpdate);
        };
    }, [yEdges, setEdges, localEdgesChanged]);

    // حفظ تغييرات المخطط من ReactFlow إلى Yjs
    const saveToYjs = useCallback(
        debounce((newNodes: Node[], newEdges: Edge[]) => {
            setLocalNodesChanged(true);
            setLocalEdgesChanged(true);

            // تحويل من ReactFlow إلى Yjs
            arrayToNodesMap(newNodes, yNodes);
            arrayToEdgesMap(newEdges, yEdges);
        }, 500),
        [yNodes, yEdges]
    );

    // تحديث Yjs عند تغيير العقد أو الروابط في ReactFlow
    useEffect(() => {
        if (nodes.length > 0 || edges.length > 0) {
            saveToYjs(nodes, edges);
        }
    }, [nodes, edges, saveToYjs]);

    const onConnect = useCallback(
        (params: any) => {
            const newEdge = {
                ...params,
                id: getId(),
                type: 'default',
            };
            setEdges((eds: Edge[]) => addEdge(newEdge, eds));
        },
        [setEdges]
    );

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
    }, []);

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();

            if (!type) {
                return;
            }

            const position = screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });
            const newNode: Node = {
                id: getId(),
                type,
                position,
                data: {label: `${type} node`},
                style: {background: "#0a0a0a"},
            };

            setNodes((nds: Node[]) => nds.concat(newNode));
        },
        [screenToFlowPosition, type, setNodes]
    );

    // معالج حدث سحب العقدة (في الوقت الحقيقي)
    const onNodeDrag = useCallback((event: React.MouseEvent, node: Node) => {
        // تحديث موقع العقدة في Yjs مباشرة خلال السحب
        const currentNodeData = yNodes.get(node.id);
        if (currentNodeData) {
            yNodes.set(node.id, {
                ...currentNodeData,
                position: node.position,
                positionAbsolute: (node as any).positionAbsolute
            });
        }
    }, [yNodes]);

    const handlePointerMove = useCallback(
        (event: React.PointerEvent) => {
            if (!reactFlowWrapper.current) return;

            // حساب إحداثيات المؤشر بالنسبة لمستعرض المستخدم
            const bounds = reactFlowWrapper.current.getBoundingClientRect();
            const x = event.clientX - bounds.left;
            const y = event.clientY - bounds.top;

            // تحديث موقع المؤشر المحلي
            setCursor({ x, y });

            // تحديث موقع المؤشر في Awareness
            updateCursor(x, y);
        },
        [updateCursor]
    );

    const handlePointerLeave = useCallback(() => {
        // إخفاء المؤشر عند مغادرة المنطقة
        updateCursor(-1000, -1000);
    }, [updateCursor]);

    const handlePointerDown = useCallback(() => {
        // إرسال تفاعل إذا كان المؤشر في وضع التفاعل
        if (cursorState.mode === CursorMode.Reaction) {
            sendReaction(cursorState.reaction);
            setCursorState({
                ...cursorState,
                isPressed: true,
            });
        }
    }, [cursorState, sendReaction, setCursorState]);

    const handlePointerUp = useCallback(() => {
        if (cursorState.mode === CursorMode.Reaction) {
            setCursorState({
                ...cursorState,
                isPressed: false,
            });
        }
    }, [cursorState, setCursorState]);

    // حذف التفاعلات القديمة
    useInterval(() => {
        // ملاحظة: تمت إزالة هذا المنطق لأنه يتم التعامل معه في useAwareness
    }, 1000);

    // معالجة أحداث لوحة المفاتيح
    useEffect(() => {
        const onKeyUp = (e: KeyboardEvent) => {
            if (e.key === "e") {
                setShowReactionSelector(true);
            } else if (e.key === "Escape") {
                setShowReactionSelector(false);
                setCursorState({
                    mode: CursorMode.Hidden,
                });
            }
        };

        window.addEventListener("keyup", onKeyUp);

        return () => {
            window.removeEventListener("keyup", onKeyUp);
        };
    }, [setCursorState]);

    return (
        <div
            className="dndflow"
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
        >
            <ActiveUsers />
            <div className="reactflow-wrapper" ref={reactFlowWrapper}>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    nodeTypes={nodeTypes}
                    onNodeDrag={onNodeDrag}
                    fitView
                    style={{backgroundColor: "#0a0a0a"}}
                >
                    <Controls />
                    <Background />
                    <LiveCursors />
                    <FlyingReactions />

                    {showReactionSelector && (
                        <ReactionSelector onClose={() => setShowReactionSelector(false)} />
                    )}
                </ReactFlow>
            </div>
            <Sidebar />
        </div>
    );
}

export default function Canvas(props: {
    initialDiagram: any;
    diagramId: string;
    userId: string;
}) {
    return <CanvasWithProviders {...props} />;
}