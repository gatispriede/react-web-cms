# `_shared.ts` — MCP tool hardening primitives

F8 Week-1 wrappers. Phase-2 sweep wires the 38 existing tools onto `compose(...)`; until then, this module ships behind a feature boundary so the sweep is a mechanical rename.

## Composition order

```
rate-limit  ──▶  idempotency  ──▶  audit  ──▶  error-envelope  ──▶  handler
(outermost)                                    (innermost)
```

Why:

- **rate-limit outermost** — cheap reject; don't consume idempotency-cache slots or audit rows for traffic we're rejecting.
- **idempotency next** — replays short-circuit before the audit hook fires (no double-logging a single user intent), but after rate-limit (so a flooding client can't bypass the window by reusing one key).
- **audit inside idempotency** — only real executions get audited; replays return the cached envelope.
- **error-envelope innermost** — handler throws map to `{ok: false, error: …}`; everything outside speaks the same envelope dialect.

## Usage (phase-2 sweep target shape)

```ts
import {compose} from './_shared';
import {enforceModeForTool} from '../modeEnforcement';
import type {McpTool} from '../types';

const rawHandler = async (args: any, ctx: any) => {
    await enforceModeForTool(ctx.actor, 'page.delete');
    return ctx.services.cascadeDelete({page: args.page, _session: {email: ctx.actor}});
};

export const pageDelete: McpTool = {
    name: 'page.delete',
    description: 'Delete a page (cascade-aware).',
    scopes: ['write:content'],
    idempotent: true,                         // F8 — destructive tools must opt in
    auditScope: 'page',                       // optional; defaults to tool-name prefix
    rateLimit: {maxPerMinute: 30},            // optional; default 30/min for write scopes
    inputSchema: {
        type: 'object',
        required: ['page'],
        properties: {
            page: {type: 'string', minLength: 1},
            idempotencyKey: {type: 'string'}, // F2 — F8 idempotency wrapper reads this
        },
    },
    handler: compose(rawHandler, {tool: /* see below */}),
};
```

The recommended pattern is to declare the tool object and pass `tool` into `compose` once registry construction time has all the metadata available. For tools that need the wrappers individually (e.g. tests, custom flows), `withIdempotency`, `withAudit`, `withRateLimit`, `withErrorEnvelope` are exported separately.

## Error mapping

| thrown                     | envelope code         |
|----------------------------|-----------------------|
| `RateLimitError`           | `RATE_LIMITED`        |
| `IdempotencyConflictError` | `IDEMPOTENCY_CONFLICT`|
| `FeatureRestrictedError`   | `MODE_RESTRICTED`     |
| `McpError`                 | its `code`            |
| anything else              | `INTERNAL` (logged)   |

`RATE_LIMITED` envelopes also carry `retryAfterMs` and a `hint`.

## Redaction

`redactSensitive(args)` recursively replaces field VALUES whose KEY matches `/password|secret|token|key/i` (case-insensitive) with `[REDACTED]`. Used by `withAudit` before writing to `McpToolCall`. Exported separately so tools that pre-redact for logging can reuse the same predicate.

## Drift CI

`npm run lint:mcp-schema` runs `tools/scripts/mcp-schema-drift.mjs`. Hard drift (extra/missing required args between an MCP tool and its same-named GraphQL mutation) fails the script. Soft warnings — unmapped tools, ambiguous multi-mutation matches — are non-blocking. Tools whose handler routes through a service method rather than a top-level mutation will produce a soft warning until the phase-2 sweep adds explicit `gqlMutation: '<mutationName>'` mapping hints.
