import {JSONSchemaObject, JSONSchemaProp, McpError} from './types';

/**
 * Tiny JSON-Schema validator. Subset only — see `types.ts` for the supported
 * keywords. Throws `McpError('invalid_args', ...)` on the first failure;
 * callers map that to an MCP tool-error response.
 */
export function validateArgs(schema: JSONSchemaObject, args: unknown): Record<string, unknown> {
    if (args === null || args === undefined) args = {};
    if (typeof args !== 'object' || Array.isArray(args)) {
        throw new McpError('invalid_args', 'arguments must be an object');
    }
    const obj = args as Record<string, unknown>;
    const required = schema.required ?? [];
    for (const key of required) {
        if (obj[key] === undefined) {
            throw new McpError('invalid_args', `missing required field: ${key}`);
        }
    }
    const out: Record<string, unknown> = {};
    for (const [key, prop] of Object.entries(schema.properties)) {
        if (obj[key] === undefined) {
            if (prop.default !== undefined) out[key] = prop.default;
            continue;
        }
        out[key] = validateProp(key, prop, obj[key]);
    }
    return out;
}

function validateProp(key: string, prop: JSONSchemaProp, value: unknown): unknown {
    switch (prop.type) {
        case 'string': {
            if (typeof value !== 'string') throw new McpError('invalid_args', `${key} must be a string`);
            if (prop.minLength !== undefined && value.length < prop.minLength) {
                throw new McpError('invalid_args', `${key} must be at least ${prop.minLength} chars`);
            }
            if (prop.maxLength !== undefined && value.length > prop.maxLength) {
                throw new McpError('invalid_args', `${key} must be at most ${prop.maxLength} chars`);
            }
            if (prop.enum && !prop.enum.includes(value)) {
                throw new McpError('invalid_args', `${key} must be one of ${prop.enum.join(',')}`);
            }
            return value;
        }
        case 'integer': {
            if (typeof value !== 'number' || !Number.isInteger(value)) {
                throw new McpError('invalid_args', `${key} must be an integer`);
            }
            if (prop.minimum !== undefined && value < prop.minimum) {
                throw new McpError('invalid_args', `${key} must be >= ${prop.minimum}`);
            }
            if (prop.maximum !== undefined && value > prop.maximum) {
                throw new McpError('invalid_args', `${key} must be <= ${prop.maximum}`);
            }
            return value;
        }
        case 'number': {
            if (typeof value !== 'number' || !Number.isFinite(value)) {
                throw new McpError('invalid_args', `${key} must be a number`);
            }
            return value;
        }
        case 'boolean': {
            if (typeof value !== 'boolean') throw new McpError('invalid_args', `${key} must be a boolean`);
            return value;
        }
        case 'array': {
            if (!Array.isArray(value)) throw new McpError('invalid_args', `${key} must be an array`);
            if (prop.items) {
                return value.map((v, i) => validateProp(`${key}[${i}]`, prop.items!, v));
            }
            return value;
        }
        case 'object': {
            if (typeof value !== 'object' || value === null || Array.isArray(value)) {
                throw new McpError('invalid_args', `${key} must be an object`);
            }
            if (prop.properties) {
                const sub = value as Record<string, unknown>;
                for (const r of prop.required ?? []) {
                    if (sub[r] === undefined) throw new McpError('invalid_args', `${key}.${r} is required`);
                }
                const out: Record<string, unknown> = {};
                for (const [pk, pp] of Object.entries(prop.properties)) {
                    if (sub[pk] !== undefined) out[pk] = validateProp(`${key}.${pk}`, pp, sub[pk]);
                    else if (pp.default !== undefined) out[pk] = pp.default;
                }
                // Preserve any additional properties — tools sometimes pass through opaque blobs.
                for (const [k, v] of Object.entries(sub)) {
                    if (!(k in out) && !(k in prop.properties)) out[k] = v;
                }
                return out;
            }
            return value;
        }
        default:
            throw new McpError('invalid_args', `unsupported schema type for ${key}`);
    }
}
