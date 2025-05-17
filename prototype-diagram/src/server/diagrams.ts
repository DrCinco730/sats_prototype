export const getDiagrams = async (): Promise<Diagram[]> => {
  const response = await fetch(`${process.env.APP_URL}/diagrams`);
  const json = await response.json();
  return json;
};

export const getDiagramDetails = async (id: string): Promise<Diagram> => {
  const response = await fetch(`${process.env.APP_URL}/diagrams/${id}`);
  const json = await response.json();
  return json;
};
