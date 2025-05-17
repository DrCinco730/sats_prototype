import Link from "next/link";

export default async function DiagramListItem({
  diagram,
  userId,
}: {
  diagram: Diagram;
  userId: string;
}) {
  return (
    <Link href={`/users/${userId}/diagrams/${diagram.id}`}>
      <li className="flex m-4 items-center justify-between py-3 px-4 mb-2 last:mb-0 border rounded-lg shadow-sm bg-white dark:bg-gray-700">
        <div>
          <h3 className="text-lg font-semibold">{diagram.title}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Owner: {diagram.owner?.email ?? "Unknown"}
          </p>

          {diagram.collaborators?.length ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Collaborators:{" "}
              {diagram.collaborators?.map((collaborator) => (
                <span key={collaborator.id} className="mx-1">
                  {collaborator.email}
                </span>
              ))}
            </p>
          ) : (
            ""
          )}
        </div>
      </li>
    </Link>
  );
}
