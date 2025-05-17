export const getUsers = async (): Promise<User[]> => {
  const response = await fetch(`${process.env.APP_URL}/users`);
  const json = await response.json();
  return json;
};
