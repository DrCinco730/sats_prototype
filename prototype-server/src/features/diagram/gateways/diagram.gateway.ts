// prototype-server/src/features/diagram/gateways/diagram.gateway.ts

import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { DiagramService } from '../services/diagram.service';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as time from 'lib0/time';

// مجموعة ألوان متناسقة
const COLORS = [
  "#3B82F6", // أزرق
  "#F59E0B", // برتقالي
  "#10B981", // أخضر
  "#8B5CF6", // بنفسجي
  "#EC4899", // وردي
  "#06B6D4", // أزرق فاتح
  "#F43F5E", // أحمر
  "#84CC16", // أخضر ليموني
  "#6366F1", // أرجواني
];

// أنواع الرسائل المدعومة من Yjs
const YJS_MESSAGE_SYNC = 0;
const YJS_MESSAGE_AWARENESS = 1;
const YJS_MESSAGE_AUTH = 2;
const YJS_MESSAGE_QUERY_AWARENESS = 3;
type MessageHandler = (decoder: decoding.Decoder, encoder: encoding.Encoder, doc: any, client?: any) => any;

// معالجات الرسائل
const messageHandlers: { [key: number]: MessageHandler } = {};


messageHandlers[YJS_MESSAGE_SYNC] = (
    decoder,
    encoder,
    doc,
    socket
) => {
  encoding.writeVarUint(encoder, YJS_MESSAGE_SYNC);
  const syncMessageType = syncProtocol.readSyncMessage(
      decoder,
      encoder,
      doc,
      socket
  );
  return syncMessageType;
};

messageHandlers[YJS_MESSAGE_AWARENESS] = (
    decoder,
    encoder,
    awareness
) => {
  const awarenessUpdate = decoding.readVarUint8Array(decoder);
  awarenessProtocol.applyAwarenessUpdate(
      awareness,
      awarenessUpdate,
      null
  );
};

messageHandlers[YJS_MESSAGE_QUERY_AWARENESS] = (
    decoder,
    encoder,
    awareness
) => {
  encoding.writeVarUint(encoder, YJS_MESSAGE_AWARENESS);
  encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(
          awareness,
          Array.from(awareness.getStates().keys())
      )
  );
};

@WebSocketGateway({
  cors: {
    origin: '*',  // في بيئة الإنتاج، قم بتحديد المصادر المسموح بها
    methods: ['GET', 'POST'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  },
})
export class DiagramGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  constructor(private readonly diagramService: DiagramService) {}

  @WebSocketServer()
  server: Server;

  // مخازن البيانات
  private activeUsers: Map<string, Map<string, any>> = new Map(); // diagramId -> { userId -> userInfo }
  private yjsDocs: Map<string, Y.Doc> = new Map(); // diagramId -> Y.Doc
  private awarenessStates: Map<string, awarenessProtocol.Awareness> = new Map(); // diagramId -> Awareness
  private diagramSockets: Map<string, Map<string, Socket>> = new Map(); // diagramId -> { userId -> socket }
  private lastUpdateTime: Map<string, number> = new Map(); // diagramId -> timestamp
  private saveInterval: Map<string, NodeJS.Timeout> = new Map(); // diagramId -> intervalId
  private pendingSaves: Map<string, boolean> = new Map(); // diagramId -> hasPendingSave

  // فترة التوقف بين عمليات الحفظ (بالمللي ثانية)
  private readonly SAVE_THROTTLE = 5000;

  afterInit() {
    console.log('Diagram Gateway initialized');
  }

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  /**
   * معالج انضمام المستخدم للمخطط
   */
  @SubscribeMessage('joinDiagram')
  async handleJoin(
      @MessageBody() payload: { diagramId: string; userId: string; username?: string },
      @ConnectedSocket() client: Socket,
  ) {
    const { diagramId, userId, username } = payload;

    console.log(`User ${userId} (${username || 'Unknown'}) joining diagram ${diagramId}`);

    // حفظ معلومات المستخدم في Socket
    client.data = { diagramId, userId, username };

    // إضافة المستخدم إلى غرفة المخطط
    await client.join(diagramId);

    // إعداد مخزن مستخدمي المخطط إذا لم يكن موجوداً
    if (!this.activeUsers.has(diagramId)) {
      this.activeUsers.set(diagramId, new Map());
      this.diagramSockets.set(diagramId, new Map());
    }

    // الحصول على مخزن مستخدمي المخطط ومخزن Sockets
    const diagramUsers = this.activeUsers.get(diagramId);
    const sockets = this.diagramSockets.get(diagramId);

    if (!diagramUsers || !sockets) {
      client.emit('error', { message: 'Failed to setup diagram environment' });
      return;
    }

    // تخصيص لون للمستخدم بناءً على موقعه في القائمة
    const userColor = COLORS[diagramUsers.size % COLORS.length];

    // تخزين معلومات المستخدم
    diagramUsers.set(userId, {
      id: userId,
      name: username || 'Unknown User',
      color: userColor,
      socketId: client.id,
      lastActive: Date.now()
    });

    // تخزين Socket المستخدم
    sockets.set(userId, client);

    // إضافة المستخدم كمشارك في المخطط (في قاعدة البيانات)
    await this.diagramService.joinCollaborators(diagramId, userId);

    // إعداد الإنترفال لحفظ المخطط إذا لم يكن موجوداً
    if (!this.saveInterval.has(diagramId)) {
      this.setupSaveInterval(diagramId);
    }

    // إعداد مستند Yjs إذا لم يكن موجوداً
    this.setupYjsDocument(diagramId);

    // إضافة المستخدم إلى حالة الوعي
    const awareness = this.awarenessStates.get(diagramId);
    if (awareness) {
      awareness.setLocalState({
        userId,
        username: username || 'Unknown User',
        color: userColor,
        cursor: null
      });
    }

    // إرسال قائمة المستخدمين النشطين إلى جميع المستخدمين
    this.broadcastActiveUsers(diagramId);

    // إعلام المستخدمين الآخرين بانضمام المستخدم الجديد
    this.server.to(diagramId).except(client.id).emit('user_joined', {
      userId,
      username,
      color: userColor
    });

    // جلب أحدث نسخة من المخطط وإرسالها إلى المستخدم الجديد
    try {
      const currentDiagram = await this.diagramService.findById(diagramId);
      if (currentDiagram && currentDiagram.json) {
        // إرسال النسخة الحالية إلى المستخدم الجديد فقط
        client.emit('current_diagram', currentDiagram);
      }
    } catch (error) {
      console.error("Error fetching current diagram:", error);
      client.emit('error', { message: 'Failed to load diagram' });
    }
  }

  /**
   * إعداد مستند Yjs ومكونات الوعي
   */
  private setupYjsDocument(diagramId: string) {
    // التحقق مما إذا كان المستند موجوداً بالفعل
    if (this.yjsDocs.has(diagramId)) {
      return;
    }

    // إنشاء مستند Yjs جديد
    const doc = new Y.Doc();
    this.yjsDocs.set(diagramId, doc);

    // إنشاء كائن الوعي (Awareness)
    const awareness = new awarenessProtocol.Awareness(doc);
    this.awarenessStates.set(diagramId, awareness);

    // تعيين معالج تحديثات الوعي
    awareness.on('update', ({ added, updated, removed }) => {
      const changedClients = added.concat(updated).concat(removed);

      // إنشاء تحديث الوعي
      const awarenessUpdate = awarenessProtocol.encodeAwarenessUpdate(
          awareness,
          changedClients
      );

      // إرسال تحديث الوعي للمستخدمين المتصلين بالمخطط
      this.broadcastAwarenessUpdate(diagramId, awarenessUpdate);
    });

    // تعيين معالج تحديثات المستند
    doc.on('update', (update, origin) => {
      // تجاهل التحديثات من النظام نفسه
      if (origin === 'server') {
        return;
      }

      // تعيين علامة لحفظ المستند
      this.pendingSaves.set(diagramId, true);
      this.lastUpdateTime.set(diagramId, Date.now());

      // إرسال التحديث لجميع المستخدمين المتصلين بالمخطط
      this.broadcastDocumentUpdate(diagramId, update);
    });

    // محاولة تحميل البيانات من قاعدة البيانات
    this.loadDocumentFromDatabase(diagramId, doc);
  }

  /**
   * تحميل المستند من قاعدة البيانات
   */
  private async loadDocumentFromDatabase(diagramId: string, doc: Y.Doc) {
    try {
      const diagram = await this.diagramService.findById(diagramId);
      if (diagram && diagram.json) {
        // تحليل JSON إلى كائن JavaScript
        const diagramData = JSON.parse(diagram.json);

        // تحديث الخريطة المشتركة في مستند Yjs
        const sharedMap = doc.getMap('diagram');

        if (diagramData.nodes && diagramData.nodes.length > 0) {
          sharedMap.set('nodes', diagramData.nodes);
        }

        if (diagramData.edges && diagramData.edges.length > 0) {
          sharedMap.set('edges', diagramData.edges);
        }

        console.log(`Loaded diagram ${diagramId} from database`);
      }
    } catch (error) {
      console.error(`Error loading diagram ${diagramId} from database:`, error);
    }
  }

  /**
   * إعداد فاصل زمني لحفظ المخطط
   */
  private setupSaveInterval(diagramId: string) {
    // إنشاء فاصل زمني لحفظ المخطط
    const intervalId = setInterval(() => {
      this.saveDocumentIfNeeded(diagramId);
    }, this.SAVE_THROTTLE);

    // تخزين معرف الفاصل الزمني
    this.saveInterval.set(diagramId, intervalId);
  }

  /**
   * حفظ المستند في قاعدة البيانات إذا كان هناك تغييرات معلقة
   */
  private async saveDocumentIfNeeded(diagramId: string) {
    // التحقق مما إذا كان هناك تغييرات معلقة
    if (!this.pendingSaves.get(diagramId)) {
      return;
    }

    // التحقق من وجود مستند Yjs
    const doc = this.yjsDocs.get(diagramId);
    if (!doc) {
      return;
    }

    try {
      // استخراج البيانات من مستند Yjs
      const sharedMap = doc.getMap('diagram');
      const nodes = sharedMap.get('nodes') || [];
      const edges = sharedMap.get('edges') || [];

      // تحويل البيانات إلى JSON
      const jsonData = JSON.stringify({ nodes, edges });

      // حفظ البيانات في قاعدة البيانات
      await this.diagramService.update(diagramId, jsonData);

      // إعادة تعيين علامة التغييرات المعلقة
      this.pendingSaves.set(diagramId, false);

      console.log(`Saved diagram ${diagramId} to database`);
    } catch (error) {
      console.error(`Error saving diagram ${diagramId} to database:`, error);
    }
  }

  /**
   * إرسال تحديث الوعي لجميع المستخدمين المتصلين بالمخطط
   */
  private broadcastAwarenessUpdate(diagramId: string, awarenessUpdate: Uint8Array) {
    // الحصول على سوكتات المخطط
    const sockets = this.diagramSockets.get(diagramId);
    if (!sockets) {
      return;
    }

    // إنشاء رسالة تحديث الوعي
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, YJS_MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(encoder, awarenessUpdate);
    const message = encoding.toUint8Array(encoder);

    // إرسال الرسالة لجميع المستخدمين
    for (const socket of sockets.values()) {
      socket.emit('yjs_update', {
        diagramId,
        data: Array.from(message) // تحويل إلى مصفوفة عادية لنقلها عبر Socket.IO
      });
    }
  }

  /**
   * إرسال تحديث المستند لجميع المستخدمين المتصلين بالمخطط
   */
  private broadcastDocumentUpdate(diagramId: string, update: Uint8Array) {
    // الحصول على سوكتات المخطط
    const sockets = this.diagramSockets.get(diagramId);
    if (!sockets) {
      return;
    }

    // إنشاء رسالة تحديث المستند
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, YJS_MESSAGE_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    const message = encoding.toUint8Array(encoder);

    // إرسال الرسالة لجميع المستخدمين
    for (const socket of sockets.values()) {
      socket.emit('yjs_update', {
        diagramId,
        data: Array.from(message) // تحويل إلى مصفوفة عادية لنقلها عبر Socket.IO
      });
    }
  }

  /**
   * معالج تحديث المخطط (الطريقة القديمة - للتوافق مع العملاء القدامى)
   */
  @SubscribeMessage('updateDiagram')
  async handleUpdate(
      @MessageBody() payload: { diagramId: string; json: string },
      @ConnectedSocket() client: Socket,
  ) {
    const { diagramId, json } = payload;

    try {
      // تحليل JSON لفحص محتواه
      const diagramData = JSON.parse(json);

      // التحقق من أن المخطط ليس فارغًا
      const hasNodes = diagramData.nodes && diagramData.nodes.length > 0;
      const hasEdges = diagramData.edges && diagramData.edges.length > 0;

      if (!hasNodes && !hasEdges) {
        console.log("Received empty diagram update - ignoring");
        return;
      }

      console.log(`Updating diagram ${diagramId} with ${diagramData.nodes?.length || 0} nodes and ${diagramData.edges?.length || 0} edges`);

      // جلب المخطط الحالي للمقارنة
      const currentDiagram = await this.diagramService.findById(diagramId);
      if (currentDiagram && currentDiagram.json) {
        const currentData = JSON.parse(currentDiagram.json);

        // إذا كان المخطط الحالي يحتوي على عناصر أكثر من التحديث، تحقق قبل التحديث
        if (
            currentData.nodes &&
            diagramData.nodes &&
            currentData.nodes.length > diagramData.nodes.length &&
            currentData.nodes.length > 0
        ) {
          console.log("Warning: New update has fewer nodes than current diagram");
        }
      }

      // تحديث مستند Yjs
      const doc = this.yjsDocs.get(diagramId);
      if (doc) {
        const sharedMap = doc.getMap('diagram');

        // التحديث باستخدام ميزة المعاملات
        doc.transact(() => {
          if (diagramData.nodes) {
            sharedMap.set('nodes', diagramData.nodes);
          }

          if (diagramData.edges) {
            sharedMap.set('edges', diagramData.edges);
          }
        }, 'server');
      }

      // تحديث المخطط في قاعدة البيانات
      const diagram = await this.diagramService.update(diagramId, json);

      // إرسال التحديث إلى جميع المستخدمين الآخرين (الطريقة القديمة)
      this.server.to(diagramId).except(client.id).emit('diagramUpdated', diagram);

    } catch (error) {
      console.error("Error updating diagram:", error);
      client.emit('error', { message: 'Failed to update diagram' });
    }
  }

  /**
   * معالج لرسائل Yjs
   */
  @SubscribeMessage('yjs_sync')
  handleYjsSync(
      @MessageBody() payload: { diagramId: string; data: number[] },
      @ConnectedSocket() client: Socket,
  ) {
    const { diagramId, data } = payload;

    try {
      // الحصول على المستند والوعي
      const doc = this.yjsDocs.get(diagramId);
      const awareness = this.awarenessStates.get(diagramId);

      if (!doc || !awareness) {
        // إنشاء المستند والوعي إذا لم يكونا موجودين
        this.setupYjsDocument(diagramId);
        return;
      }

      // تحويل المصفوفة إلى Uint8Array
      const binaryData = new Uint8Array(data);

      // فك تشفير الرسالة
      const decoder = decoding.createDecoder(binaryData);
      const encoder = encoding.createEncoder();
      const messageType = decoding.readVarUint(decoder);

      // معالجة الرسالة حسب نوعها
      switch (messageType) {
        case YJS_MESSAGE_SYNC:
          messageHandlers[YJS_MESSAGE_SYNC](decoder, encoder, doc, client);
          break;

        case YJS_MESSAGE_AWARENESS:
          messageHandlers[YJS_MESSAGE_AWARENESS](decoder, encoder, awareness);
          break;

        case YJS_MESSAGE_QUERY_AWARENESS:
          messageHandlers[YJS_MESSAGE_QUERY_AWARENESS](decoder, encoder, awareness);
          break;
      }

      // إرسال الرد إذا كان هناك بيانات
      if (encoding.length(encoder) > 1) {
        const responseData = encoding.toUint8Array(encoder);
        client.emit('yjs_update', {
          diagramId,
          data: Array.from(responseData)
        });
      }
    } catch (error) {
      console.error('Error handling YJS sync:', error);
      client.emit('error', { message: 'Failed to process YJS message' });
    }
  }

  /**
   * معالج لتحديثات سحب العناصر في الوقت الفعلي
   */
  @SubscribeMessage('node_drag')
  handleNodeDrag(
      @MessageBody() payload: { diagramId: string; userId: string; nodeId: string; position: any },
      @ConnectedSocket() client: Socket,
  ) {
    const { diagramId, nodeId, position } = payload;

    // إرسال تحديث السحب إلى جميع المستخدمين الآخرين
    this.server.to(diagramId).except(client.id).emit('node_drag_update', {
      nodeId,
      position,
    });
  }

  /**
   * معالج لتحديثات المؤشر
   */
  @SubscribeMessage('cursor_move')
  handleCursorMove(
      @MessageBody() payload: { diagramId: string; userId: string; cursor: any },
      @ConnectedSocket() client: Socket,
  ) {
    const { diagramId, userId, cursor } = payload;

    // الحصول على معلومات المستخدم
    const diagramUsers = this.activeUsers.get(diagramId);
    if (!diagramUsers) {
      return;
    }

    const userInfo = diagramUsers.get(userId);
    if (!userInfo) {
      return;
    }

    // تحديث آخر نشاط للمستخدم
    userInfo.lastActive = Date.now();

    // تحديث حالة الوعي إذا كان متاحاً
    const awareness = this.awarenessStates.get(diagramId);
    if (awareness) {
      const state = awareness.getLocalState();
      awareness.setLocalState({
        ...state,
        cursor,
        username: userInfo.name,
        color: userInfo.color,
        userId
      });
      return;
    }

    // طريقة الاحتياط (fallback) إذا لم يكن الوعي متاحاً
    const username = userInfo.name || 'Unknown User';

    // إرسال تحديث الموقع إلى باقي المستخدمين
    this.server.to(diagramId).except(client.id).emit('cursor_update', {
      userId,
      cursor,
      username,
    });
  }

  /**
   * معالج للتفاعلات
   */
  @SubscribeMessage('send_reaction')
  handleReaction(
      @MessageBody() payload: { diagramId: string; userId: string; reaction: any },
      @ConnectedSocket() client: Socket,
  ) {
    const { diagramId, userId, reaction } = payload;

    // التحقق من صحة بيانات التفاعل
    if (!reaction || !reaction.point || !reaction.value) {
      console.warn('Received invalid reaction data:', reaction);
      return;
    }

    // الحصول على معلومات المستخدم
    const diagramUsers = this.activeUsers.get(diagramId);
    if (!diagramUsers) {
      return;
    }

    const userInfo = diagramUsers.get(userId);

    // إضافة معلومات المستخدم إلى التفاعل
    const enhancedReaction = {
      ...reaction,
      userId,
      username: userInfo?.name || 'Unknown User',
      color: userInfo?.color || '#3B82F6'
    };

    // إرسال التفاعل إلى جميع المستخدمين
    this.server.to(diagramId).emit('reaction_received', {
      userId,
      reaction: enhancedReaction
    });

    console.log(`User ${userId} sent reaction ${reaction.value} in diagram ${diagramId}`);
  }

  /**
   * معالج لطلب المستخدمين النشطين
   */
  @SubscribeMessage('get_active_users')
  handleGetActiveUsers(
      @ConnectedSocket() client: Socket,
  ) {
    const { diagramId } = client.data || {};
    if (!diagramId) {
      return;
    }

    // إرسال قائمة المستخدمين النشطين إلى المستخدم الطالب
    this.sendActiveUsersToClient(diagramId, client);
  }

  /**
   * إرسال قائمة المستخدمين النشطين إلى عميل محدد
   */
  private sendActiveUsersToClient(diagramId: string, client: Socket) {
    const diagramUsers = this.activeUsers.get(diagramId);
    if (!diagramUsers) {
      client.emit('active_users', { users: [] });
      return;
    }

    const users = Array.from(diagramUsers.values());
    client.emit('active_users', { users });
  }

  /**
   * إرسال قائمة المستخدمين النشطين إلى جميع المستخدمين
   */
  private broadcastActiveUsers(diagramId: string) {
    const diagramUsers = this.activeUsers.get(diagramId);
    if (!diagramUsers) {
      return;
    }

    const users = Array.from(diagramUsers.values());
    this.server.to(diagramId).emit('active_users', { users });
  }

  /**
   * معالج انفصال المستخدم
   */
  async handleDisconnect(client: Socket) {
    const { diagramId, userId } = client.data || {};
    if (!diagramId || !userId) {
      return;
    }

    console.log(`User ${userId} disconnected from diagram ${diagramId}`);

    // إزالة المستخدم من قائمة المستخدمين النشطين
    const diagramUsers = this.activeUsers.get(diagramId);
    const sockets = this.diagramSockets.get(diagramId);

    if (diagramUsers) {
      diagramUsers.delete(userId);

      // إزالة Socket المستخدم
      if (sockets) {
        sockets.delete(userId);
      }

      // إزالة المستخدم من حالة الوعي
      const awareness = this.awarenessStates.get(diagramId);
      const clientIdMap = new Map();
      clientIdMap.set(client, client.id);
      if(awareness) {
        awarenessProtocol.removeAwarenessStates(
            awareness,
            Array.from(clientIdMap.keys()),
            'disconnect'
        );
      }

      // إذا لم يعد هناك مستخدمين نشطين، قم بتنظيف الموارد
      if (diagramUsers.size === 0) {
        this.cleanupDiagramResources(diagramId);
      } else {
        // إعلام باقي المستخدمين بانفصال المستخدم
        this.server.to(diagramId).emit('user_disconnected', { userId });

        // تحديث قائمة المستخدمين النشطين
        this.broadcastActiveUsers(diagramId);
      }
    }
  }

  /**
   * تنظيف موارد المخطط عندما لا يعود هناك مستخدمون نشطون
   */
  private async cleanupDiagramResources(diagramId: string) {
    console.log(`Cleaning up resources for diagram ${diagramId}`);

    // حفظ المخطط قبل التنظيف
    await this.saveDocumentIfNeeded(diagramId);

    // إزالة الفاصل الزمني للحفظ
    const intervalId = this.saveInterval.get(diagramId);
    if (intervalId) {
      clearInterval(intervalId);
      this.saveInterval.delete(diagramId);
    }

    // إزالة المستخدمين النشطين
    this.activeUsers.delete(diagramId);
    this.diagramSockets.delete(diagramId);

    // إزالة علامات الحفظ
    this.pendingSaves.delete(diagramId);
    this.lastUpdateTime.delete(diagramId);

    // إزالة مستند Yjs والوعي
    const doc = this.yjsDocs.get(diagramId);
    if (doc) {
      doc.destroy();
      this.yjsDocs.delete(diagramId);
    }

    const awareness = this.awarenessStates.get(diagramId);
    if (awareness) {
      awareness.destroy();
      this.awarenessStates.delete(diagramId);
    }
  }
}