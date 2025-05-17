import { Injectable, NotFoundException } from '@nestjs/common';
import { DiagramRepository } from '../repositories/diagram.repository';
import { Diagram } from '../entities/diagram.entity';
import { CreateDiagramDto } from '../dtos/create-diagram.dto';

@Injectable()
export class DiagramService {
  constructor(private readonly diagramRepository: DiagramRepository) {}

  async list(): Promise<Diagram[]> {
    return this.diagramRepository.list();
  }

  async listUserDiagrams(userId: string): Promise<Diagram[]> {
    return this.diagramRepository.listUserDiagrams(userId);
  }

  async findById(id: string): Promise<Diagram> {
    const diagram = await this.diagramRepository.findById(id);
    if (!diagram) throw new NotFoundException('Diagram not found');
    return diagram;
  }

  async create(dto: CreateDiagramDto): Promise<Diagram> {
    return this.diagramRepository.create(dto);
  }

  async update(diagramId: string, json: string): Promise<Diagram> {
    const diagram = await this.diagramRepository.update(diagramId, { json });
    if (!diagram) throw new NotFoundException('Diagram not found');
    return diagram;
  }

  async delete(diagramId: string): Promise<boolean> {
    const success = await this.diagramRepository.delete(diagramId);
    if (!success) throw new NotFoundException('Diagram not found');
    return success;
  }

  async joinCollaborators(diagramId: string, userId: string): Promise<boolean> {
    const diagram = await this.diagramRepository.findById(diagramId);
    if (!diagram) throw new NotFoundException('Diagram not found');

    const collaborators = diagram.collaborators || [];
    const alreadyJoined =
      collaborators.some((c) => c.id === userId) || userId === diagram.ownerId;

    if (alreadyJoined) return true;

    return this.diagramRepository.createCollaboratorRelationship(
      diagramId,
      userId,
    );
  }
}
