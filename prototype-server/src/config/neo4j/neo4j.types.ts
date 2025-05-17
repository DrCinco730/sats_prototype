export interface Neo4jConfig {
  scheme: 'neo4j' | 'bolt' | 'neo4j+s' | 'bolt+s';
  host: string;
  port: number;
  username: string;
  password: string;
  database?: string;
}
