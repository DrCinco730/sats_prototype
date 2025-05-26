// prototype-server/src/features/yjs/yjs.gateway.ts
import { Injectable, Logger } from '@nestjs/common';
import {
    WebSocketGateway,
    OnGatewayConnection,
    OnGatewayDisconnect,
    WebSocketServer
} from '@nestjs/websockets';
import { Server } from 'ws';
import { setupWSConnection } from './yjs.utils';
import { YjsService } from './yjs.service';

@WebSocketGateway({ path: '/yjs-ws' })
@Injectable()
export class YjsGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly logger = new Logger(YjsGateway.name);

    @WebSocketServer()
    server: Server;

    constructor(private readonly yjsService: YjsService) {}

    async handleConnection(client: any, request: any): Promise<void> {
        this.logger.debug(`Client connected: ${request.url}`);

        // استخراج معرف المخطط من URL
        const url = new URL(request.url, `http://${request.headers.host}`);
        const pathSegments = url.pathname.split('/').filter(Boolean);
        const docName = pathSegments[0]; // استخدام الجزء الأول من المسار كاسم المستند

        // إعداد اتصال WebSocket
        setupWSConnection(client, { url: `/${docName}` }, { docName });

        // تحميل بيانات المخطط من قاعدة البيانات
        const doc = this.yjsService.getDocument(docName);
        await this.yjsService.loadDiagramIntoDoc(docName, doc);
    }

    handleDisconnect(client: any): void {
        this.logger.debug('Client disconnected');
        // معالجة قطع الاتصال تتم بالفعل في setupWSConnection
    }
}