import {getUsers} from "@/server/users";
import UserListItem from "./components/UserListItem";

export default async function Page() {
  const users: User[] = await getUsers();

  return (
    <ul>
      {users.map((user: User) => (
        <UserListItem key={user.id} user={user} />
      ))}
    </ul>
  );
}
