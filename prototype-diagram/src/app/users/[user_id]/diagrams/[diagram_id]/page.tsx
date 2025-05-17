import {ReactFlowProvider} from "@xyflow/react";
import {DnDProvider} from "./hooks/useDnD";
import Canvas from "./components/Canvas";
import {getDiagramDetails} from "@/server/diagrams";
import {SocketProvider} from "./hooks/useDiagramSocket";
export default async function Page({
  params,
}: {
  params: Promise<{diagram_id: string; user_id: string}>;
}) {
  const {diagram_id, user_id} = await params;
  const diagram: Diagram = await getDiagramDetails(diagram_id);

  return (
    <ReactFlowProvider>
      <SocketProvider url={process.env.APP_URL!}>
        <DnDProvider>
          <Canvas
            initialDiagram={JSON.parse(diagram.json ?? "{}")}
            diagramId={diagram_id}
            userId={user_id}
          />
        </DnDProvider>
      </SocketProvider>
    </ReactFlowProvider>
  );
}
