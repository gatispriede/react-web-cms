import {McpTool} from '../types';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {defineTool} from './_shared';

export const imageList: McpTool = defineTool({
    // SAFE: not a GraphQL mutation
    name: 'image.list',
    description: 'Lists uploaded images. Returns name, URL (use as-is in content fields), tags, and dimensions. Always call this before setting any image field — never guess paths.',
    scopes: ['read:content'],
    inputSchema: {
        type: 'object',
        properties: {
            tags: {type: 'string', description: 'Filter by tag keyword. Omit or pass "" to list all.'},
        },
    },
}, async (args) => {
    try {
        const images = await getMongoConnection().getImages({tags: args.tags ?? ''});
        return images;
    } catch (err) {
        return {ok: false, error: String((err as Error).message || err)};
    }
});

export const IMAGE_TOOLS: McpTool[] = [imageList];
