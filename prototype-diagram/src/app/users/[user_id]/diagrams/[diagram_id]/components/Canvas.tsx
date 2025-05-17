"use client";

import React, {useRef, useCallback, useState, useEffect} from "react";
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
import {v4 as uuid} from "uuid";

import "@xyflow/react/dist/style.css";

import Sidebar from "./Sidebar";
import {useDnD} from "../hooks/useDnD";

import "../styles/index.css";
import "../styles/xy-theme.css";
import {useDiagramSocket} from "../hooks/useDiagramSocket";
import {debounce} from "lodash";
import CustomNode from "./CustomNode";

const getId = () => uuid();
const nodeTypes: {[key: string]: any} = {
  custom: CustomNode,
};

export default function Canvas({
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
  const {screenToFlowPosition} = useReactFlow();
  const [type] = useDnD();

  // Join diagram room
  useEffect(() => {
    if (!socket) return;
    socket.emit("joinDiagram", {
      diagramId,
      userId,
    });
  }, [socket, diagramId, userId]);

  // Load initial diagram
  useEffect(() => {
    if (!initialDiagram) return;
    setNodes(initialDiagram.nodes || []);
    setEdges(initialDiagram.edges || []);
    setTimeout(() => setCanEmitUpdate(true), 500);
  }, []);

  // Subscribe to diagram updates
  useEffect(() => {
    if (!socket) return;
    const handler = ({json}: any) => {
      const updatedDiagram = JSON.parse(json);
      if (!updatedDiagram) return;

      setCanEmitUpdate(false);
      setIsRemoteAnimating(true);

      setNodes(updatedDiagram.nodes || []);
      setEdges(updatedDiagram.edges || []);

      setTimeout(() => setCanEmitUpdate(true), 500);
      setTimeout(() => setIsRemoteAnimating(false), 500);
    };

    socket.on("diagramUpdated", handler);
    return () => {
      socket.off("diagramUpdated", handler);
    };
  }, []);

  // Emit diagram updates
  useEffect(() => {
    if (!socket || !canEmitUpdate) return;
    emitUpdate(diagramId, {
      nodes,
      edges,
    });
  }, [nodes, edges]);

  const emitUpdate = useCallback(
    debounce((diagramId: string, updatedDiagram: any) => {
      if (!socket) return;
      socket.emit("updateDiagram", {
        diagramId,
        json: JSON.stringify(updatedDiagram),
      });
    }, 300),
    []
  );

  const onConnect = useCallback(
    (params: any) => setEdges((eds: Edge[]) => addEdge(params, eds)),
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
    [screenToFlowPosition, type]
  );

  return (
    <div className={`dndflow ${isRemoteAnimating ? "remote-animating" : ""}`}>
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
          fitView
          style={{backgroundColor: "#0a0a0a"}}>
          <Controls />
          <Background />
        </ReactFlow>
      </div>
      <Sidebar />
    </div>
  );
}
