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
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange
} from "@xyflow/react";
import {v4 as uuid} from "uuid";
import {debounce} from "lodash";
import * as Y from 'yjs';

import "@xyflow/react/dist/style.css";

import Sidebar from "./Sidebar";
import {useDnD} from "../hooks/useDnD";
import {useDiagramSocket} from "../hooks/useDiagramSocket";
import {useYjsProvider} from "../hooks/useYjsProvider";
import CustomNode from "./CustomNode";
import LiveCursors from "./LiveCursors";
import {CursorMode, ReactionProvider, useReaction, Point, Reaction} from "../hooks/useReaction";
import useInterval from "../hooks/useInterval";
import FlyingReaction from "./FlyingReaction";
import ReactionSelector from "./ReactionSelector";
import ActiveUsers from "./ActiveUsers";
import {useUserColors} from "../hooks/useUserColors";

import "../styles/index.css";
import "../styles/xy-theme.css";
import "../styles/reactions.css";

const getId = () => uuid();
const nodeTypes: { [key: string]: any } = {
  custom: CustomNode,
};

const CanvasWithProviders = ({
                               initialDiagram,
                               diagramId,
                               userId,
                             }: {
  initialDiagram: any;
  diagramId: string;
  userId: string;
}) => {
  return (
      <ReactionProvider>
        <CanvasContent
            initialDiagram={initialDiagram}
            diagramId={diagramId}
            userId={userId}
        />
      </ReactionProvider>
  );
};

function CanvasContent({
                         initialDiagram,
                         diagramId,
                         userId,
                       }: {
  initialDiagram: any;
  diagramId: string;
  userId: string;
}) {
  const [canEmitUpdate, setCanEmitUpdate] = useState(false);
  const [isRemoteAnimating, setIsRemoteAnimating] = useState(false);
  const socket = useDiagramSocket();
  const reactFlowWrapper = useRef<HTMLDivElement | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const reactFlowInstance = useReactFlow();
  const {screenToFlowPosition} = useReactFlow();
  const [type] = useDnD();
  const [cursor, setCursor] = useState({x: 0, y: 0});
  const {getUserColor} = useUserColors();

  // استخدام مزود Yjs
  const {
    doc,
    provider,
    sharedMap,
    awareness,
    isConnected
  } = useYjsProvider(diagramId, userId);

  // استخدام سياق التفاعلات
  const {cursorState, setCursorState, reactions, setReactions} = useReaction();

  // الانضمام إلى غرفة المخطط
  useEffect(() => {
    if (!socket) return;

    // الحصول على اسم المستخدم
    const username = `User ${Math.floor(Math.random() * 1000)}`;

    socket.emit("joinDiagram", {
      diagramId,
      userId,
      username,
    });

    // إعداد معالج للرسائل الواردة من Yjs
    socket.on("yjs_update", (data: { diagramId: string; data: number[] }) => {
      if (data.diagramId !== diagramId || !provider) return;

      // تحويل المصفوفة إلى Uint8Array
      const binaryData = new Uint8Array(data.data);

      // نشر الرسالة إلى مزود Yjs
      provider.processMessage(binaryData);
    });

    return () => {
      socket.off("yjs_update");
    };
  }, [socket, diagramId, userId, provider]);

  // تحميل بيانات المخطط الأولية والاستماع للتغييرات
  useEffect(() => {
    if (!sharedMap) return;

    // تحميل البيانات الأولية إذا كانت الخريطة المشتركة فارغة
    if (
        initialDiagram &&
        initialDiagram.nodes &&
        initialDiagram.nodes.length > 0 &&
        !sharedMap.get('nodes')
    ) {
      setCanEmitUpdate(false);
      doc?.transact(() => {
        sharedMap.set('nodes', initialDiagram.nodes);
        sharedMap.set('edges', initialDiagram.edges || []);
      });
      setTimeout(() => setCanEmitUpdate(true), 1000);
    }

    // الاستماع للتغييرات على الخريطة المشتركة
    const handleChanges = () => {
      const yNodes = sharedMap.get('nodes');
      const yEdges = sharedMap.get('edges');

      if (yNodes) {
        setIsRemoteAnimating(true);
        setNodes(yNodes);
      }

      if (yEdges) {
        setEdges(yEdges);
      }

      setTimeout(() => setIsRemoteAnimating(false), 500);
    };

    // تطبيق القيم الأولية
    handleChanges();

    // الاشتراك في التغييرات
    sharedMap.observe(handleChanges);

    return () => {
      sharedMap.unobserve(handleChanges);
    };
  }, [sharedMap, doc, initialDiagram, setNodes, setEdges]);

  // استقبال تحديثات المخطط من Socket.IO (للتوافق مع الإصدارات القديمة)
  useEffect(() => {
    if (!socket) return;

    const handleCurrentDiagram = (updatedDiagram: any) => {
      if (!updatedDiagram || !updatedDiagram.json || !sharedMap) return;

      try {
        const diagramData = JSON.parse(updatedDiagram.json);

        if (diagramData.nodes && diagramData.nodes.length > 0) {
          console.log("Received current diagram with", diagramData.nodes.length, "nodes");
          setCanEmitUpdate(false);

          // تحديث الخريطة المشتركة
          doc?.transact(() => {
            sharedMap.set('nodes', diagramData.nodes);
            if (diagramData.edges) {
              sharedMap.set('edges', diagramData.edges);
            }
          });

          setTimeout(() => setCanEmitUpdate(true), 1000);
        }
      } catch (error) {
        console.error("Error parsing current diagram:", error);
      }
    };

    socket.on("current_diagram", handleCurrentDiagram);

    const handleDiagramUpdate = (updatedDiagram: any) => {
      if (!updatedDiagram || !updatedDiagram.json || !sharedMap) return;

      try {
        const diagramData = JSON.parse(updatedDiagram.json);

        if (!(diagramData.nodes && diagramData.nodes.length > 0) &&
            !(diagramData.edges && diagramData.edges.length > 0)) {
          return;
        }

        setCanEmitUpdate(false);
        setIsRemoteAnimating(true);

        // تحديث الخريطة المشتركة
        doc?.transact(() => {
          if (diagramData.nodes) {
            sharedMap.set('nodes', diagramData.nodes);
          }
          if (diagramData.edges) {
            sharedMap.set('edges', diagramData.edges);
          }
        });

        setTimeout(() => setCanEmitUpdate(true), 500);
        setTimeout(() => setIsRemoteAnimating(false), 500);
      } catch (error) {
        console.error("Error parsing diagram update:", error);
      }
    };

    socket.on("diagramUpdated", handleDiagramUpdate);

    return () => {
      socket.off("current_diagram", handleCurrentDiagram);
      socket.off("diagramUpdated", handleDiagramUpdate);
    };
  }, [socket, sharedMap, doc, setNodes, setEdges]);

  // إرسال تحديثات المخطط إلى الخادم (للتوافق مع الإصدارات القديمة)
  useEffect(() => {
    if (!socket || !canEmitUpdate || !sharedMap) return;

    const syncToServer = debounce(() => {
      const currentNodes = sharedMap.get('nodes');
      const currentEdges = sharedMap.get('edges');

      if (currentNodes && currentNodes.length > 0) {
        socket.emit("yjs_update_document", {
          diagramId,
          json: JSON.stringify({nodes: currentNodes, edges: currentEdges}),
        });
      }
    }, 1000);

    // الاستماع للتغييرات وإرسالها للخادم
    const observer = () => {
      syncToServer();
    };

    sharedMap.observe(observer);

    return () => {
      sharedMap.unobserve(observer);
      syncToServer.cancel();
    };
  }, [socket, canEmitUpdate, diagramId, sharedMap]);

  // معالج سحب العقد (في الوقت الفعلي)
  const onNodeDrag = useCallback((event: React.MouseEvent, node: Node) => {
    if (!socket || !canEmitUpdate) return;

    // إرسال تحديث مباشر للعقدة التي يتم سحبها
    socket.emit("node_drag", {
      diagramId,
      userId,
      nodeId: node.id,
      position: node.position,
    });
  }, [socket, diagramId, userId, canEmitUpdate]);

  // معالج حركة المؤشر
  const handlePointerMove = useCallback(
      (event: React.PointerEvent) => {
        if (!reactFlowWrapper.current) return;

        // حساب إحداثيات المؤشر بالنسبة لمستعرض المستخدم
        const bounds = reactFlowWrapper.current.getBoundingClientRect();
        const x = event.clientX - bounds.left;
        const y = event.clientY - bounds.top;

        // تحديث موقع المؤشر المحلي
        setCursor({x, y});

        // تحديث حالة الوعي إذا كان متاحاً
        if (awareness) {
          const currentState = awareness.getLocalState() || {};
          awareness.setLocalState({
            ...currentState,
            userId,
            username: `User ${userId.substring(0, 5)}`,
            color: getUserColor(userId),
            cursor: {screen: {x, y}}
          });
        } else if (socket) {
          // Fallback لإرسال موقع المؤشر عبر Socket.IO
          socket.emit("cursor_move", {
            diagramId,
            userId,
            cursor: {screen: {x, y}},
          });
        }
      },
      [socket, diagramId, userId, awareness, getUserColor]
  );

  // معالج مغادرة المؤشر
  const handlePointerLeave = useCallback(() => {
    // إخفاء المؤشر عند مغادرة المنطقة
    if (awareness) {
      const currentState = awareness.getLocalState() || {};
      awareness.setLocalState({
        ...currentState,
        cursor: null
      });
    } else if (socket) {
      socket.emit("cursor_move", {
        diagramId,
        userId,
        cursor: null,
      });
    }
  }, [socket, diagramId, userId, awareness]);

  // تعديل معالجات التغييرات لتحديث الخريطة المشتركة
  const onNodesChangeWithYjs = useCallback(
      (changes: NodeChange<Node>[]) => {
        if (!sharedMap || !doc) return onNodesChange(changes);

        // تطبيق التغييرات محلياً أولاً
        const newNodes = applyNodeChanges(changes, nodes);
        setNodes(newNodes);

        // تحديث الخريطة المشتركة
        doc.transact(() => {
          sharedMap.set('nodes', newNodes);
        });
      },
      [sharedMap, doc, nodes, setNodes, onNodesChange]
  );

  const onEdgesChangeWithYjs = useCallback(
      (changes: EdgeChange<Edge>[]) => {
        if (!sharedMap || !doc) return onEdgesChange(changes);

        // تطبيق التغييرات محلياً أولاً
        const newEdges = applyEdgeChanges(changes, edges);
        setEdges(newEdges);

        // تحديث الخريطة المشتركة
        doc.transact(() => {
          sharedMap.set('edges', newEdges);
        });
      },
      [sharedMap, doc, edges, setEdges, onEdgesChange]
  );

  // معالج الاتصال
  const onConnect = useCallback(
      (params: any) => {
        if (!sharedMap || !doc) return;

        // إنشاء الحافة الجديدة
        const newEdges = addEdge(params, edges);
        setEdges(newEdges);

        // تحديث الخريطة المشتركة
        doc.transact(() => {
          sharedMap.set('edges', newEdges);
        });
      },
      [sharedMap, doc, edges, setEdges]
  );

  // معالج السحب والإفلات
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
      (event: React.DragEvent) => {
        event.preventDefault();

        if (!type || !sharedMap || !doc) {
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

        // إضافة العقدة محلياً
        setNodes((nds: Node[]) => nds.concat(newNode));

        // تحديث الخريطة المشتركة
        doc.transact(() => {
          const currentNodes = sharedMap.get('nodes') || [];
          sharedMap.set('nodes', [...currentNodes, newNode]);
        });
      },
      [screenToFlowPosition, type, sharedMap, doc, setNodes]
  );

  // معالجة أحداث لوحة المفاتيح للتفاعلات
  useEffect(() => {
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "e" || e.key === "E") {
        setCursorState({
          mode: CursorMode.ReactionSelector,
        });
      } else if (e.key === "Escape") {
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

  // حذف التفاعلات القديمة
  useInterval(() => {
    const now = Date.now();
    setReactions((prevReactions) =>
        prevReactions.filter((r) => now - r.timestamp < 4000)
    );
  }, 1000);

  // إرسال التفاعلات
  useInterval(() => {
    if (
        cursorState.mode === CursorMode.Reaction &&
        cursorState.isPressed &&
        cursor
    ) {
      // إنشاء نقطة تفاعل
      const point: Point = {
        screen: cursor,
        flow: screenToFlowPosition(cursor)
      };

      // إنشاء بيانات التفاعل
      const reaction: Reaction = {
        point,
        value: cursorState.reaction,
        timestamp: Date.now() + Math.random(),
        userId
      };

      // إضافة إلى الحالة المحلية
      setReactions((prevReactions) => [...prevReactions, reaction]);

      // إرسال إلى الخادم إذا كان Socket متاحاً
      if (socket) {
        socket.emit("send_reaction", {
          diagramId,
          userId,
          reaction
        });
      }
    }
  }, 100);

  // تعيين رمز تفاعل محدد
  const setReaction = useCallback((reaction: string) => {
    setCursorState({
      mode: CursorMode.Reaction,
      reaction,
      isPressed: false,
    });
  }, [setCursorState]);

  // معالجة ضغط المؤشر لإرسال التفاعلات
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (cursorState.mode === CursorMode.Reaction) {
      setCursorState({
        ...cursorState,
        isPressed: true,
      });

      // منع السلوك الافتراضي لتجنب التداخل مع تفاعلات المخطط
      if (cursorState.mode === CursorMode.Reaction) {
        e.stopPropagation();
      }
    }
  }, [cursorState, setCursorState]);

  // معالجة رفع المؤشر لإيقاف إرسال التفاعلات
  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (cursorState.mode === CursorMode.Reaction) {
      setCursorState({
        ...cursorState,
        isPressed: false,
      });

      // منع السلوك الافتراضي
      if (cursorState.mode === CursorMode.Reaction) {
        e.stopPropagation();
      }
    }
  }, [cursorState, setCursorState]);

  return (
      <div
          className={`dndflow ${isRemoteAnimating ? "remote-animating" : ""}`}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
      >
        <div className="connection-status">
          {isConnected ?
              <span className="status-connected">Connected</span> :
              <span className="status-disconnected">Disconnected</span>
          }
        </div>
        <ActiveUsers />
        <div className="reactflow-wrapper" ref={reactFlowWrapper}>
          <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChangeWithYjs}
              onEdgesChange={onEdgesChangeWithYjs}
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
            <LiveCursors awareness={awareness} />

            {reactions.map((reaction, index) => (
                <FlyingReaction
                    key={`reaction-${reaction.timestamp}-${reaction.userId || 'local'}-${index}`}
                    point={reaction.point}
                    timestamp={reaction.timestamp}
                    value={reaction.value}
                />
            ))}

            {cursorState.mode === CursorMode.ReactionSelector && (
                <ReactionSelector setReaction={setReaction} />
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