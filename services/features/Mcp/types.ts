import type {McpScope} from '@interfaces/IMcp';
import type {AuditService} from '@services/features/Audit/AuditService';

/**
 * Tool input schema — a hand-rolled subset of JSON Schema 2020-12. We only
 * support the shape we actually need: an object with named properties, a
 * `required` list, primitive types, arrays of primitives or objects, and a
 * boolean default. No `$ref`, no `oneOf`, no `pattern` regexes — when a tool
 * needs more, it should validate inside its handler.
 *
 * DECISION: rolling our own validator avoids pulling `ajv` (~ 200 KB) for
 * what is, in practice, "check the shape and reject anything weird".
 */
export type JSONSchemaType = 'string' | 'integer' | 'number' | 'boolean' | 'object' | 'array';

export interface JSONSchemaProp {
    type: JSONSchemaType;
    description?: string;
    enum?: readonly (string | number)[];
    minimum?: number;
    maximum?: number;
    minLength?: number;
    maxLength?: number;
    items?: JSONSchemaProp;
    properties?: Record<string, JSONSchemaProp>;
    required?: string[];
    default?: unknown;
}

export interface JSONSchemaObject {
    type: 'object';
    required?: string[];
    properties: Record<string, JSONSchemaProp>;
}

export interface McpToolContext {
    /** The MongoDBConnection facade — gives tools access to every domain service. */
    services: any;
    /** "mcp:<token-name>" — passed into `_session.email` for audit stamping. */
    actor: string;
    /** Audit service handle so the dispatcher can log every call 1:1. */
    audit: AuditService | undefined;
}

export interface McpToolResult {
    content: Array<{type: 'text'; text: string}>;
}

export interface McpTool {
    name: string;
    description: string;
    scopes: McpScope[];
    inputSchema: JSONSchemaObject;
    handler: (args: any, ctx: McpToolContext) => Promise<McpToolResult>;
}

export class McpError extends Error {
    constructor(public code: string, message: string) {
        super(message);
        this.name = 'McpError';
    }
}
