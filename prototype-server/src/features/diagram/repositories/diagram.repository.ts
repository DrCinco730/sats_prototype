import { Injectable } from '@nestjs/common';
import { Neo4jService } from 'src/config/neo4j/neo4j.service';
import { Diagram } from '../entities/diagram.entity';

@Injectable()
export class DiagramRepository {
  constructor(private readonly neo4jService: Neo4jService) {}

  async list(): Promise<Diagram[]> {
    const result = await this.neo4jService.run(
      `
      MATCH (u:User)-[:OWNS]->(d:Diagram)
      OPTIONAL MATCH (u2:User)-[:COLLABORATOR_AT]->(d)
      RETURN d, u, COLLECT(u2) AS collaborators
      `,
    );
    return result.map(
      (record) =>
        ({
          ...record.d.properties,
          owner: record.u.properties,
          collaborators: record.collaborators.map(
            (c) => c.properties,
          ) as Diagram['collaborators'],
        }) as Diagram,
    );
  }

  async listUserDiagrams(userId: string): Promise<Diagram[]> {
    const result = await this.neo4jService.run(
      `MATCH (u:User {id: $userId})-[:OWNS|COLLABORATOR_AT]->(d:Diagram) RETURN d`,
      { userId },
    );
    return result.map((record) => record.d.properties as Diagram);
  }

  async findById(id: string): Promise<Diagram | null> {
    const result = await this.neo4jService.run(
      `
      MATCH (d:Diagram {id: $id})
      MATCH (d)<-[:OWNS]-(u:User)
      OPTIONAL MATCH (d)<-[:COLLABORATOR_AT]-(c:User)
      RETURN d, u, COLLECT(c) AS collaborators
      `,
      { id },
    );
    if (result.length === 0) return null;
    const { d, u, collaborators } = result[0];
    return {
      ...d.properties,
      owner: u.properties,
      collaborators: collaborators.map((d: any) => d.properties),
    } as Diagram;
  }

  async create(dto: Partial<Diagram>): Promise<Diagram> {
    const result = await this.neo4jService.run(
      `
      MATCH (u:User {id: $ownerId})
      CREATE (d:Diagram {id: randomUUID(), title: $title, ownerId: $ownerId})
      CREATE (u)-[:OWNS]->(d)
      RETURN d
      `,
      { title: dto.title, ownerId: dto.ownerId, json: dto.json },
    );
    const record = result[0].d.properties;
    return record as Diagram;
  }

  async update(
    diagramId: string,
    updates: Partial<Diagram>,
  ): Promise<Diagram | null> {
    const setClauses = Object.keys(updates)
      .map((key) => `d.${key} = $${key}`)
      .join(', ');
    const params = { diagramId, ...updates };
    const result = await this.neo4jService.run(
      `MATCH (d:Diagram {id: $diagramId}) SET ${setClauses} RETURN d`,
      params,
    );
    if (result.length === 0) return null;
    return result[0].d.properties as Diagram;
  }

  async delete(diagramId: string): Promise<boolean> {
    const result = await this.neo4jService.run(
      `
      MATCH (d:Diagram {id: $diagramId})
      MATCH (d)-[r]-()
      DELETE r
      DELETE d
      RETURN COUNT(d) AS deletedCount
      `,
      { diagramId },
    );
    return result[0].deletedCount.toNumber() > 0;
  }

  async createCollaboratorRelationship(
    diagramId: string,
    userId: string,
  ): Promise<boolean> {
    const result = await this.neo4jService.run(
      `
      MATCH (d:Diagram {id: $diagramId})
      MATCH (u:User {id: $userId})
      CREATE (u)-[:COLLABORATOR_AT]->(d)
      RETURN COUNT(u) AS createdCount
      `,
      { diagramId, userId },
    );
    return result[0].createdCount.toNumber() > 0;
  }
}
