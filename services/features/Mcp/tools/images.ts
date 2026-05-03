import {McpTool} from '../types';
import {getMongoConnection} from '@services/infra/mongoDBConnection';

const ok = (data: unknown) => ({content: [{type: 'text' as const, text: JSON.stringify(data)}]});

export const imageList: McpTool = {
    name: 'image.list',
    description: 'Lists uploaded images. Returns name, URL (use as-is in content fields), tags, and dimensions. Always call this before setting any image field — never guess paths.',
    scopes: ['read:content'],
    inputSchema: {
        type: 'object',
        properties: {
            tags: {type: 'string', description: 'Filter by tag keyword. Omit or pass "" to list all.'},
        },
    },
    handler: async (args) => {
        try {
            const images = await getMongoConnection().getImages({tags: args.tags ?? ''});
            return ok(images);
        } catch (err) {
            return ok({ok: false, error: String((err as Error).message || err)});
        }
    },
};

export const IMAGE_TOOLS: McpTool[] = [imageList];
