// prototype-server/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as WebSocket from 'ws';
import * as http from 'http';
import * as url from 'url';

// إنشاء WebSocket ملحق لـ Yjs
function setupYjsWebsocketServer(server: http.Server) {
  // مخازن البيانات
  const docs = new Map<string, Y.Doc>();
  const awareness = new Map<string, awarenessProtocol.Awareness>();
  const wsClients = new Map<WebSocket, { roomName: string, clientId: string }>();

  // إنشاء خادم WebSocket
  const wss = new WebSocket.Server({ noServer: true });

  // معالج اتصال جديد
  wss.on('connection', (ws: WebSocket, roomName: string, clientId: string) => {
    console.log(`New YJS WebSocket connection to room: ${roomName}, client: ${clientId}`);

    // إعداد المستند والوعي إذا لم يكونا موجودين
    let doc = docs.get(roomName);
    if (!doc) {
      doc = new Y.Doc();
      docs.set(roomName, doc);
    }

    let aw = awareness.get(roomName);
    if (!aw) {
      aw = new awarenessProtocol.Awareness(doc);
      awareness.set(roomName, aw);

      // إعداد معالج تحديثات الوعي
      aw.on('update', ({ added, updated, removed }) => {
        const changedClients = added.concat(updated).concat(removed);
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, 1); // messageAwareness
        encoding.writeVarUint8Array(
            encoder,
            awarenessProtocol.encodeAwarenessUpdate(
                aw || new awarenessProtocol.Awareness(new Y.Doc()),
                changedClients
            )
        );

        const message = encoding.toUint8Array(encoder);

        // إرسال تحديث الوعي إلى جميع العملاء في الغرفة
        wss.clients.forEach((client) => {
          const clientData = wsClients.get(client);
          if (client !== ws &&
              client.readyState === WebSocket.OPEN &&
              clientData &&
              clientData.roomName === roomName) {
            client.send(message);
          }
        });
      });
    }

    // حفظ معلومات العميل
    wsClients.set(ws, { roomName, clientId });

    // معالج الرسائل
    ws.on('message', (message: Buffer) => {
      const m = new Uint8Array(message);
      const decoder = decoding.createDecoder(m);
      const encoder = encoding.createEncoder();
      const messageType = decoding.readVarUint(decoder);

      switch (messageType) {
        case 0: // sync
          encoding.writeVarUint(encoder, 0);
          const syncMessageType = syncProtocol.readSyncMessage(decoder, encoder, doc, ws);

          // نشر التحديثات إلى جميع العملاء الآخرين
          if (syncMessageType === syncProtocol.messageYjsSyncStep2 ||
              syncMessageType === syncProtocol.messageYjsUpdate) {
            const message = encoding.toUint8Array(encoder);

            wss.clients.forEach((client) => {
              const clientData = wsClients.get(client);
              if (client !== ws &&
                  client.readyState === WebSocket.OPEN &&
                  clientData &&
                  clientData.roomName === roomName) {
                client.send(message);
              }
            });
          }
          break;

        case 1: // awareness
          const awarenessUpdate = decoding.readVarUint8Array(decoder);
          awarenessProtocol.applyAwarenessUpdate(aw, awarenessUpdate, ws);
          break;

        case 2: // auth (لا نستخدمه حالياً)
          break;

        case 3: // query awareness
          encoding.writeVarUint(encoder, 1);
          encoding.writeVarUint8Array(
              encoder,
              awarenessProtocol.encodeAwarenessUpdate(
                  aw,
                  Array.from(aw.getStates().keys())
              )
          );

          ws.send(encoding.toUint8Array(encoder));
          break;
      }

      // إرسال الرد إلى العميل المرسل
      if (encoding.length(encoder) > 1) {
        ws.send(encoding.toUint8Array(encoder));
      }
    });

    // معالج إغلاق الاتصال
    ws.on('close', () => {
      // الحصول على معلومات العميل
      const clientData = wsClients.get(ws);
      if (!clientData) return;

      const { roomName } = clientData;

      // إزالة معلومات العميل
      wsClients.delete(ws);

      // إزالة حالة الوعي للعميل
      const aw = awareness.get(roomName);
      const clientMap = new Map();
      clientMap.set(ws, true);
      if (aw) {
        awarenessProtocol.removeAwarenessStates(
            aw,
            Array.from(clientMap.keys()),
            'connection closed'
        );
      }

      // التحقق من عدم وجود عملاء آخرين في الغرفة
      let hasClientsInRoom = false;
      for (const [_, data] of wsClients.entries()) {
        if (data.roomName === roomName) {
          hasClientsInRoom = true;
          break;
        }
      }

      // إزالة المستند والوعي إذا لم يكن هناك عملاء في الغرفة
      if (!hasClientsInRoom) {
        docs.delete(roomName);
        awareness.delete(roomName);
        console.log(`Cleaned up resources for room: ${roomName}`);
      }
    });

    // إرسال الحالة الحالية للعميل الجديد
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, 0);
    syncProtocol.writeSyncStep1(encoder, doc);
    ws.send(encoding.toUint8Array(encoder));

    // إرسال معلومات الوعي للعميل الجديد
    const awarenessEncoder = encoding.createEncoder();
    encoding.writeVarUint(awarenessEncoder, 1);
    encoding.writeVarUint8Array(
        awarenessEncoder,
        awarenessProtocol.encodeAwarenessUpdate(
            aw,
            Array.from(aw.getStates().keys())
        )
    );
    ws.send(encoding.toUint8Array(awarenessEncoder));
  });

  // ترقية اتصالات HTTP إلى WebSocket
  server.on('upgrade', (request, socket, head) => {
    const pathname = url.parse(request.url || '').pathname || '';

    // التحقق من أن المسار يبدأ بـ /yjs/
    if (pathname?.startsWith('/yjs/')) {
      // استخراج معرف الغرفة ومعرف العميل من المسار
      const parts = pathname.slice(5).split('/'); // /yjs/roomName/clientId
      const roomName = parts[0];
      const clientId = parts[1] || `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, roomName, clientId);
      });
    }
  });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        forbidUnknownValues: false,
      }),
  );

  app.enableCors({
    origin: ['http://localhost:3000'], // يمكن تغييره حسب بيئة التشغيل
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    allowedHeaders: 'Content-Type, Accept',
  });

  const httpServer = await app.getHttpServer();
  await app.listen(process.env.PORT ?? 8000);
  setupYjsWebsocketServer(httpServer);
}

bootstrap();