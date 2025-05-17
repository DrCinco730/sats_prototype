import Link from "next/link";

export default function UserListItem({user}: {user: User}) {
  return (
    <Link href={`/users/${user.id}/diagrams`}>
      <li className="flex m-4 items-center justify-between py-3 px-4 mb-2 last:mb-0 border rounded-lg shadow-sm bg-white dark:bg-gray-700">
        <div>
          <h3 className="text-lg font-semibold">{user.name}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {user.email}
          </p>
        </div>
      </li>
    </Link>
  );
}
