import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { DiagramService } from '../services/diagram.service';
import { Diagram } from '../entities/diagram.entity';
import { CreateDiagramDto } from '../dtos/create-diagram.dto';

@Controller('diagrams')
export class DiagramController {
  constructor(private readonly diagramService: DiagramService) {}

  @Get()
  async getAll(): Promise<Diagram[]> {
    return this.diagramService.list();
  }

  @Get('user/:userId')
  async getUserDiagrams(@Param('userId') userId: string): Promise<Diagram[]> {
    return this.diagramService.listUserDiagrams(userId);
  }

  @Get(':id')
  async getById(@Param('id') id: string): Promise<Diagram> {
    return this.diagramService.findById(id);
  }

  @Post()
  async create(@Body() dto: CreateDiagramDto): Promise<Diagram> {
    return this.diagramService.create(dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<{ success: boolean }> {
    return { success: await this.diagramService.delete(id) };
  }
}
