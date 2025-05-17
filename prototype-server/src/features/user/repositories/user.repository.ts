import { Injectable } from '@nestjs/common';
import { Neo4jService } from 'src/config/neo4j/neo4j.service';
import { User } from '../entities/user.entity';

@Injectable()
export class UserRepository {
  constructor(private readonly neo4jService: Neo4jService) {}

  async list(): Promise<User[]> {
    const result = await this.neo4jService.run('MATCH (u:User) RETURN u');
    return result.map((record) => record.u.properties as User);
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.neo4jService.run(
      'MATCH (u:User {email: $email}) RETURN u',
      { email },
    );
    if (result.length === 0) return null;
    return result[0].u.properties as User;
  }

  async findById(id: string): Promise<User | null> {
    const result = await this.neo4jService.run(
      'MATCH (u:User {id: $id}) RETURN u',
      { id },
    );
    if (result.length === 0) return null;
    return result[0].u.properties as User;
  }

  async create(user: Partial<User>): Promise<User> {
    const result = await this.neo4jService.run(
      'CREATE (u:User {id: randomUUID(), name: $name, email: $email}) RETURN u',
      { name: user.name, email: user.email },
    );
    const record = result[0].u.properties;
    return record as User;
  }

  async update(userId: string, updates: Partial<User>): Promise<User | null> {
    const setClauses = Object.keys(updates)
      .map((key) => `u.${key} = $${key}`)
      .join(', ');
    const params = { userId, ...updates };
    const result = await this.neo4jService.run(
      `MATCH (u:User {id: $userId}) SET ${setClauses} RETURN u`,
      params,
    );
    if (result.length === 0) return null;
    return result[0].u.properties as User;
  }

  async delete(userId: string): Promise<boolean> {
    const result = await this.neo4jService.run(
      'MATCH (u:User {id: $userId}) DELETE u RETURN COUNT(u) AS deletedCount',
      { userId },
    );
    return result[0].deletedCount.toNumber() > 0;
  }
}
