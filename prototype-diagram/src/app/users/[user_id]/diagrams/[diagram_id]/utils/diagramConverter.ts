// src/app/users/[user_id]/diagrams/[diagram_id]/utils/diagramConverter.ts
import { Node, Edge } from "@xyflow/react";
import * as Y from "yjs";

/**
 * تحويل العقد من Yjs Map إلى مصفوفة ReactFlow
 */
export function nodesToArray(yNodes: Y.Map<any>): Node[] {
    const nodes: Node[] = [];

    yNodes.forEach((value, key) => {
        // تحويل كائن Yjs إلى كائن JavaScript عادي
        const nodeData = JSON.parse(JSON.stringify(value));
        nodes.push({
            id: key,
            ...nodeData
        });
    });

    return nodes;
}

/**
 * تحويل الروابط من Yjs Map إلى مصفوفة ReactFlow
 */
export function edgesToArray(yEdges: Y.Map<any>): Edge[] {
    const edges: Edge[] = [];

    yEdges.forEach((value, key) => {
        // تحويل كائن Yjs إلى كائن JavaScript عادي
        const edgeData = JSON.parse(JSON.stringify(value));
        edges.push({
            id: key,
            ...edgeData
        });
    });

    return edges;
}

/**
 * تحويل مصفوفة العقد إلى Yjs Map
 */
export function arrayToNodesMap(nodes: Node[], yNodes: Y.Map<any>): void {
    // حذف العقد التي تم إزالتها
    const currentKeys = new Set(nodes.map(node => node.id));
    yNodes.forEach((_, key) => {
        if (!currentKeys.has(key)) {
            yNodes.delete(key);
        }
    });

    // تحديث أو إضافة العقد الجديدة
    nodes.forEach(node => {
        const { id, ...nodeWithoutId } = node;
        // نقارن البيانات قبل التحديث لتجنب تحديثات غير ضرورية
        const currentValue = yNodes.get(id);

        if (!currentValue || !deepEqual(currentValue, nodeWithoutId)) {
            yNodes.set(id, nodeWithoutId);
        }
    });
}

/**
 * تحويل مصفوفة الروابط إلى Yjs Map
 */
export function arrayToEdgesMap(edges: Edge[], yEdges: Y.Map<any>): void {
    // حذف الروابط التي تم إزالتها
    const currentKeys = new Set(edges.map(edge => edge.id));
    yEdges.forEach((_, key) => {
        if (!currentKeys.has(key)) {
            yEdges.delete(key);
        }
    });

    // تحديث أو إضافة الروابط الجديدة
    edges.forEach(edge => {
        const { id, ...edgeWithoutId } = edge;
        // نقارن البيانات قبل التحديث لتجنب تحديثات غير ضرورية
        const currentValue = yEdges.get(id);

        if (!currentValue || !deepEqual(currentValue, edgeWithoutId)) {
            yEdges.set(id, edgeWithoutId);
        }
    });
}

/**
 * مقارنة عميقة بين كائنين
 */
function deepEqual(obj1: any, obj2: any): boolean {
    if (obj1 === obj2) return true;

    if (typeof obj1 !== 'object' || obj1 === null ||
        typeof obj2 !== 'object' || obj2 === null) {
        return false;
    }

    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    if (keys1.length !== keys2.length) return false;

    for (const key of keys1) {
        if (!keys2.includes(key)) return false;
        if (!deepEqual(obj1[key], obj2[key])) return false;
    }

    return true;
}