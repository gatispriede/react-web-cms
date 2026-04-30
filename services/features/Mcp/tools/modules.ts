import {EItemType} from '@enums/EItemType';
import {EStyle} from '@enums/EStyle';
import {McpTool} from '../types';

const ok = (data: unknown) => ({content: [{type: 'text' as const, text: JSON.stringify(data)}]});

export const moduleListTypes: McpTool = {
    name: 'module.listTypes',
    description: 'Enumerates the registered module item types (EItemType) and the shared style enum (EStyle).',
    scopes: ['read:content'],
    inputSchema: {type: 'object', properties: {}},
    handler: async () => {
        return ok({
            itemTypes: Object.entries(EItemType).map(([k, v]) => ({key: k, value: v})),
            styles: Object.entries(EStyle).map(([k, v]) => ({key: k, value: v})),
        });
    },
};

export const MODULE_TOOLS: McpTool[] = [moduleListTypes];
