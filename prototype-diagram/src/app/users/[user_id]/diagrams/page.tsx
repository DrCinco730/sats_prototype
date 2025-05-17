import {getDiagrams} from "@/server/diagrams";
import DiagramGridItem from "./components/DiagramGridItem";

export default async function Page({
  params,
}: {
  params: Promise<{diagram_id: string; user_id: string}>;
}) {
  const {user_id} = await params;
  const diagrams: Diagram[] = await getDiagrams();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {diagrams.map((diagram: Diagram) => (
        <DiagramGridItem key={diagram.id} userId={user_id} diagram={diagram} />
      ))}
    </div>
  );
}
