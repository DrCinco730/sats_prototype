"use client";

import React, {createContext, useContext, useEffect, useRef} from "react";
import {io, Socket} from "socket.io-client";

type DiagramSocket = Socket & {
  emitJoin: (diagramId: string, userId: string) => void;
};

const SocketContext = createContext<DiagramSocket | null>(null);

export const SocketProvider: React.FC<{
  url: string;
  children: React.ReactNode;
}> = ({url, children}) => {
  const socketRef = useRef<DiagramSocket>(
    io(url, {autoConnect: true}) as DiagramSocket
  );

  useEffect(() => {
    socketRef.current.emitJoin = (diagramId, userId) => {
      socketRef.current.emit("joinDiagram", {diagramId, userId});
    };

    return () => {
      socketRef.current.disconnect();
    };
  }, [url]);

  return (
    <SocketContext.Provider value={socketRef.current}>
      {children}
    </SocketContext.Provider>
  );
};

export const useDiagramSocket = () => {
  const socket = useContext(SocketContext);
  return socket;
};
