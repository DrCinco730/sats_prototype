import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { DiagramService } from '../services/diagram.service';

@WebSocketGateway({
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  },
})
export class DiagramGateway {
  constructor(private readonly diagramService: DiagramService) {}

  @WebSocketServer()
  server: Server;

  @SubscribeMessage('joinDiagram')
  async handleJoin(
    @MessageBody() payload: { diagramId: string; userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    console.log(payload);
    const { diagramId, userId } = payload;
    await this.diagramService.joinCollaborators(diagramId, userId);
    client.join(diagramId);
  }

  @SubscribeMessage('updateDiagram')
  async handleUpdate(
    @MessageBody() payload: { diagramId: string; json: string },
    @ConnectedSocket() client: Socket,
  ) {
    console.log(payload);
    const { diagramId, json } = payload;
    const diagram = await this.diagramService.update(diagramId, json);
    this.server.to(diagramId).except(client.id).emit('diagramUpdated', diagram);
  }
}
