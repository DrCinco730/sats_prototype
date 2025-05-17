import { Inject, Injectable } from '@nestjs/common';
import { Driver, Session } from 'neo4j-driver';
import { NEO4J_DRIVER, NEO4J_CONFIG } from './neo4j.constants';
import { Neo4jConfig } from './neo4j.types';

@Injectable()
export class Neo4jService {
  constructor(
    @Inject(NEO4J_DRIVER) private readonly driver: Driver,
    @Inject(NEO4J_CONFIG) private readonly config: Neo4jConfig,
  ) {}

  getSession(database?: string): Session {
    return this.driver.session({ database: database || this.config.database });
  }

  async run(cypher: string, params = {}): Promise<any[]> {
    const session = this.getSession();
    try {
      const result = await session.run(cypher, params);
      return result.records.map((r) => r.toObject());
    } finally {
      await session.close();
    }
  }
}
