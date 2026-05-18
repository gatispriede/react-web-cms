import {McpTool} from './types';

/**
 * Page creation tool - allows admins to create new pages with module content
 */
export const pageCreateTool: McpTool = {
    name: 'page.create',
    description: 'Create a new page with module content',
    scopes: ['write:content'],
    inputSchema: {
        type: 'object',
        required: ['name', 'modules'],
        properties: {
            name: {
                type: 'string',
                description: 'Page name',
                minLength: 1,
                maxLength: 255
            },
            modules: {
                type: 'array',
                items: {
                    type: 'object',
                    required: ['type', 'content'],
                    properties: {
                        type: {
                            type: 'string',
                            enum: ['HERO', 'TEXT', 'RICH_TEXT', 'IMAGE', 'CAROUSEL', 'GALLERY', 'PROJECT_CARD', 'SKILL_PILLS', 'TIMELINE', 'SOCIAL_LINKS', 'BLOG_FEED', 'LIST', 'SERVICES', 'TESTIMONIALS', 'STATS_CARD', 'PROJECT_GRID', 'MANIFESTO', 'INQUIRY_FORM', 'DATA_MODEL', 'INFRA_TOPOLOGY', 'PIPELINE_FLOW', 'REPO_TREE', 'ARCHITECTURE_TIERS', 'STATS_STRIP', 'EMPTY'],
                            description: 'Module type'
                        },
                        content: {
                            type: 'object',
                            description: 'Module content'
                        }
                    }
                }
            }
        }
    },
    handler: async (args, ctx) => {
        // Implementation would go here
        // This is a placeholder showing the structure
        return {
            content: [{
                type: 'text',
                text: `Page "${args.name}" created with ${args.modules.length} module(s)`
            }]
        };
    }
};

/**
 * Tool registry - all available MCP tools
 */
export function buildToolRegistry(): Map<string, McpTool> {
    return new Map([
        ['page.create', pageCreateTool],
        // Add other tools here
    ]);
}
