// prototype-server/src/features/yjs/yjs.service.ts
import { Injectable, Logger } from '@nestjs/common';
import * as Y from 'yjs';
import { DiagramService } from '../diagram/services/diagram.service';
import { getYDoc, WSSharedDoc, docs } from './yjs.utils';

@Injectable()
export class YjsService {
    private readonly logger = new Logger(YjsService.name);

    constructor(private readonly diagramService: DiagramService) {
        // إعداد فترة زمنية لحفظ المستندات المعدلة في قاعدة البيانات
        setInterval(() => {
            this.saveModifiedDocuments();
        }, 30000); // كل 30 ثانية
    }

    /**
     * حفظ المستندات المعدلة في قاعدة البيانات
     */
    private async saveModifiedDocuments(): Promise<void> {
        for (const [diagramId, doc] of docs.entries()) {
            if (doc.conns.size > 0) { // إذا كان هناك اتصالات نشطة
                try {
                    await this.saveDiagramToDatabase(diagramId, doc);
                } catch (error) {
                    this.logger.error(`Failed to save diagram ${diagramId}:`, error);
                }
            }
        }
    }

    /**
     * حفظ المخطط في قاعدة البيانات
     */
    private async saveDiagramToDatabase(diagramId: string, doc: WSSharedDoc): Promise<void> {
        // تحويل وثيقة Yjs إلى JSON
        const json = this.convertDocToJson(doc);
        if (!json) return;

        try {
            await this.diagramService.update(diagramId, json);
            this.logger.debug(`Saved diagram ${diagramId} to database`);
        } catch (error) {
            this.logger.error(`Error saving diagram ${diagramId} to database:`, error);
        }
    }

    /**
     * تحويل وثيقة Yjs إلى JSON
     */
    private convertDocToJson(doc: WSSharedDoc): string | null {
        try {
            const yNodes:any = doc.getMap('nodes');
            const yEdges:any = doc.getMap('edges');

            // التحقق من وجود محتوى
            if (yNodes.size === 0 && yEdges.size === 0) {
                return null;
            }

            // تحويل العقد والحواف إلى مصفوفات
            const nodes:any = [];
            const edges:any = [];

            yNodes.forEach((value, key) => {
                nodes.push({
                    id: key,
                    ...JSON.parse(JSON.stringify(value)) // تحويل كائن Yjs إلى كائن JavaScript عادي
                });
            });

            yEdges.forEach((value, key) => {
                edges.push({
                    id: key,
                    ...JSON.parse(JSON.stringify(value)) // تحويل كائن Yjs إلى كائن JavaScript عادي
                });
            });

            return JSON.stringify({ nodes, edges });
        } catch (error) {
            this.logger.error('Error converting doc to JSON:', error);
            return null;
        }
    }

    /**
     * تحميل بيانات المخطط من قاعدة البيانات إلى وثيقة Yjs
     */
    async loadDiagramIntoDoc(diagramId: string, doc: WSSharedDoc): Promise<void> {
        try {
            const diagram = await this.diagramService.findById(diagramId);
            if (diagram && diagram.json) {
                // تحليل JSON
                const data = JSON.parse(diagram.json);

                // تحميل العقد
                if (data.nodes && Array.isArray(data.nodes)) {
                    const yNodes = doc.getMap('nodes');
                    for (const node of data.nodes) {
                        const { id, ...nodeData } = node;
                        yNodes.set(id, nodeData);
                    }
                }

                // تحميل الحواف
                if (data.edges && Array.isArray(data.edges)) {
                    const yEdges = doc.getMap('edges');
                    for (const edge of data.edges) {
                        const { id, ...edgeData } = edge;
                        yEdges.set(id, edgeData);
                    }
                }

                this.logger.debug(`Loaded diagram ${diagramId} into Yjs document`);
            }
        } catch (error) {
            this.logger.error(`Error loading diagram ${diagramId} into Yjs document:`, error);
        }
    }

    /**
     * الحصول على مستند Yjs حسب الاسم
     */
    getDocument(docName: string): WSSharedDoc {
        return getYDoc(docName);
    }
}