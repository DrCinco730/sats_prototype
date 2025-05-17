import Link from "next/link";

export default function Home() {
  return (
    <div className="h-screen flex items-center justify-center">
      <Link
        href="/users"
        className="py-2 px-4 bg-gray-800 text-white font-semibold rounded-lg shadow-md hover:bg-gray-900 focus:outline-none">
        Go to Users
      </Link>
    </div>
  );
}
