interface Diagram {
  id: string;
  ownerId: string;
  title: string;
  json: string | null;
  owner: User | null;
  collaborators: User[] | null;
}
