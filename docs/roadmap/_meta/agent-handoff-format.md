# Agent-handoff format — how to brief an agent on a roadmap item

Roadmap items in this repo are written to be **picked up by an agent without prior context**. The format below is the contract: every active roadmap item should follow it. The format trades some prose density for sequenceable execution.

This doc is the template + sample. Use it as a checklist when writing new items.

## Goal

A self-contained agent (Claude Code, Cursor, Aider, custom) reads the roadmap item + the linked architecture references and can execute without going back to the operator for clarifications, file paths, or coding conventions. The operator's only job after handoff is review.

## The 9 sections every item must have

1. **Title + frontmatter** — `name`, `description`, optional `status` (active / parked / shipped / deferred).
2. **Goal** — one paragraph + a bulleted list of what shipping it means. No history, no apology.
3. **Why now** — context the agent shouldn't have to re-derive. Includes dependencies on already-shipped primitives + links to those primitives by file path.
4. **Design / approach** — decisions already made. Each decision answered ("we picked X because Y"), not open questions.
5. **Files to touch** — explicit list of new + modified paths. Mark which are `new`, `modify`, `delete`.
6. **Starter code** — pasted code snippets the agent can use as a base. Skeleton ServiceLoader, AdminUILoader, ViewModel, test, etc. **Required for any item touching code.**
7. **Acceptance criteria** — numbered, testable. Each criterion maps to a manual test or e2e spec the agent writes.
8. **Effort** — one of XS / S / M / L / XL per [effort legend](../README.md#effort-legend--ai-paced). Internal time-share breakdown is fine.
9. **Open questions** — only things the operator must decide. Mark with `[OPERATOR DECISION]`. Everything else gets a default value chosen in section 4.

Optional sections:
- **Dependencies + risks** — when other roadmap items must land first
- **Research backing** — link to [research-findings-2026-05-12.md](research-findings-2026-05-12.md) entries this item is based on
- **Out of scope** — explicit non-goals to prevent scope creep mid-implementation

## Starter-code library — patterns to paste from

The repository ships these patterns as ready-to-clone code. When writing a roadmap item, **paste the relevant skeleton into the item's "Starter code" section** with the slight adjustments the item needs.

### Pattern A — ServiceLoader skeleton (new backend feature)

Reference: `services/features/CustomerAuth/CustomerAuthServiceLoader.ts`

```ts
import {ServiceLoader} from '@services/infra/ServiceLoader';
import type {FeatureAuthzContribution, FeatureContext} from '@services/infra/featureManifest';
import {<Feature>Service} from './<Feature>Service';
import {isFeatureEnabled} from '@services/infra/featureFlags';

/**
 * <Feature> Loader — one-paragraph rationale of when this loads + its
 * relationship to existing features. Cite the decision date.
 */
export class <Feature>ServiceLoader extends ServiceLoader {
    readonly id = '<feature-id>';
    readonly displayName = '<Human name>';

    readonly enabled = (): boolean => isFeatureEnabled(this.id);

    buildServices(ctx: FeatureContext): Record<string, unknown> {
        return {
            <featureId>: new <Feature>Service(
                ctx.db.collection('<CollectionName>'),
                // …deps
            ),
        };
    }

    readonly schemaSDL = `extend type QueryMongo {
    <queryName>: <ReturnType>
}
extend type MutationMongo {
    <mutationName>(input: <InputType>!): String!
}`;

    readonly authz: FeatureAuthzContribution = {
        // pick the right shape — adminMutations / customerMutations / anonOpenMutations
        // + adminQueries / customerQueries / customerSessionInjected
    };

    // Optional: declare cacheVersionKeys, batchAccessors, cascadeRules,
    // resourceGated, functionalRoles, mcpToolGate.
}
```

### Pattern B — AdminUILoader skeleton (new admin pane)

Reference: `ui/admin/features/Inventory/InventoryAdminUILoader.ts`

```ts
import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import <Feature> from './<Feature>';
import <Feature>Simplified from './<Feature>Simplified'; // only if simplified-mode variant exists

export class <Feature>AdminUILoader extends AdminUILoader {
    readonly id = '<feature-id>';
    readonly displayName = '<Human name>';

    readonly adminPane: AdminPaneDescriptor = {
        id: '<section>/<feature-id>',
        title: '<Sidebar label>',
        route: '/admin/<section>/<feature-id>',
        modes: {
            simplified: <Feature>Simplified,   // optional
            advanced: <Feature>,
        },
        advancedOnly: false, // true = no simplified variant; mode dispatcher hides the pane
    };

    // Optional: itemTypeEditors for module editors registered by this feature.
}
```

### Pattern C — ClientUILoader skeleton (new public route)

```ts
import {ClientUILoader} from '@client/lib/loaders/ClientUILoader';
import <Page> from './<Page>';

export class <Feature>ClientUILoader extends ClientUILoader {
    readonly id = '<feature-id>';
    readonly displayName = '<Human name>';

    readonly publicRoutes = [
        {path: '/<route>', component: <Page>, gatePath: this.id},
    ];

    // Optional: itemTypes for the Display half of the module registry.
}
```

### Pattern D — ViewModel (admin state, VM4-compliant)

VM4 rule: **no `useState` in `ui/admin/features/**`** — see `eslint.config.mjs:156-165`. Use a ViewModel class wrapped with `observable()`.

```ts
import {observable} from '@admin/lib/observable';

/**
 * <Feature> ViewModel. Plain TS class; observable() wraps mutations and triggers
 * re-renders. All methods auto-bind.
 */
export class <Feature>ViewModel {
    // observable state
    items: <ItemType>[] = [];
    loading = false;
    error: string | null = null;

    // mutations
    async load() {
        this.loading = true;
        try {
            this.items = await this.api.list();
        } catch (err) {
            this.error = String(err);
        } finally {
            this.loading = false;
        }
    }

    constructor(private readonly api: <Feature>Api) {}
}

// In component:
// const vm = useViewModel(() => new <Feature>ViewModel(api));
```

### Pattern E — IWarehouseAdapter implementation (e.g. ss.com cars)

Reference: `services/features/Inventory/adapters/IWarehouseAdapter.ts`, `services/features/Inventory/adapters/GenericFeedAdapter.ts`.

```ts
import type {IWarehouseAdapter, FetchPage, HealthResult} from './IWarehouseAdapter';
import type {WarehouseProductRow} from '@interfaces/IInventory';

export interface SsComAdapterConfig {
    baseUrl: string;           // 'https://www.ss.com'
    language: 'lv' | 'en' | 'ru';
    paths: string[];           // ['transport/cars/audi/a4', 'transport/cars/bmw/x5', …]
    rateLimitMs: number;       // backoff between requests
    userAgent: string;
}

export class SsComCarsAdapter implements IWarehouseAdapter {
    readonly id = 'ss.com-cars';

    constructor(private readonly cfg: SsComAdapterConfig) {}

    async fetchProducts(cursor?: string): Promise<FetchPage> {
        const {pathIdx = 0, page = 1} = decodeCursor(cursor);
        const html = await this.fetchPage(this.cfg.paths[pathIdx], page);
        const rows = parseListings(html); // returns WarehouseProductRow[]
        const next = nextCursor(pathIdx, page, rows.length, this.cfg.paths.length);
        return {items: rows, nextCursor: next};
    }

    // Optional — implement only if upstream supports modified-since queries.
    // For ss.com (no API), skip and let syncDelta fall back to syncAll filtered by updatedAt.
    // async fetchProductsSince?(...): Promise<FetchPage>

    async healthCheck(): Promise<HealthResult> {
        const t0 = Date.now();
        const resp = await fetch(`${this.cfg.baseUrl}/`, {method: 'HEAD'});
        return {
            ok: resp.ok,
            latencyMs: Date.now() - t0,
            adapter: this.id,
            message: resp.ok ? undefined : `HTTP ${resp.status}`,
        };
    }

    private async fetchPage(path: string, page: number): Promise<string> {
        const url = `${this.cfg.baseUrl}/${this.cfg.language}/${path}/page${page}.html`;
        await sleep(this.cfg.rateLimitMs);
        const resp = await fetch(url, {headers: {'User-Agent': this.cfg.userAgent}});
        if (resp.status === 429 || resp.status === 503) {
            await sleep(this.cfg.rateLimitMs * 10); // back off
            return this.fetchPage(path, page);      // retry once
        }
        if (!resp.ok) throw new Error(`ss.com fetch failed: HTTP ${resp.status} ${url}`);
        return resp.text();
    }
}
```

### Pattern F — MCP tool definition (for any new mutation)

Reference: `services/features/Mcp/tools/`. Mutations gated as advanced-only via `enforceModeForTool`.

```ts
import {defineTool} from '@services/features/Mcp/tools/_shared';
import {z} from 'zod';

export const <toolId> = defineTool({
    id: '<feature>_<verb>',
    description: '<one-line description that an agent reads to decide if this tool fits>',
    inputSchema: z.object({
        // typed input
    }),
    advancedOnly: true,
    handler: async (input, ctx) => {
        // implementation; throws FeatureRestrictedError if appropriate
        return {ok: true, /* … */};
    },
});
```

### Pattern G — `data-testid` naming for new components

Per [universal requirements](../README.md#universal-requirements--every-roadmap-item):

- Static: `feature-component-role` — `themes-pane-bulk-delete-button`
- With identity: `feature-component-{id}` — `section-row-toggle-{sectionId}`
- State variant: prefer `[data-testid="…"][data-state="open"]` over compound testids
- Mode dispatcher: `themes-simplified-card-{id}` vs `themes-advanced-card-{id}`

### Pattern H — Sonner toast wrapping (new project standard)

```ts
import {toast} from 'sonner';

// optimistic mutation:
await toast.promise(
    api.saveProduct(input),
    {
        loading: 'Saving product…',
        success: 'Product saved',
        error: (err) => `Save failed: ${err.message}`,
    },
);

// destructive with undo:
toast(`Deleted "${product.title}"`, {
    action: {
        label: 'Undo',
        onClick: () => api.restoreProduct(product.id),
    },
    duration: 10_000,
});
```

### Pattern I — kbar command-palette registration

```ts
import {useRegisterActions} from 'kbar';

useRegisterActions([
    {
        id: 'publish-current',
        name: 'Publish current page',
        shortcut: ['$mod+Enter'],
        keywords: 'publish ship live',
        section: 'Document',
        perform: () => vm.publish(),
    },
], [vm]);
```

## Universal acceptance criteria (already in README)

Every item also satisfies:

1. Docs reflect the work — relevant spec doc + `shipped.md` + any architecture/runbook docs touched.
2. **MCP coverage parity for editable surfaces** — every admin-mutable field has a matching MCP tool / extension. The schema-drift CI catches GraphQL-arg drift.
3. Ship as chunks, not phases — one complete deliverable per item.
4. **`data-testid` on every interactive surface** — per the naming convention above.

## Anti-patterns

Things that flag a roadmap item as not agent-ready:

- "Phase 1 / Phase 2 / Phase 3" inside one item → split into separately-named items
- Open questions left unanswered without `[OPERATOR DECISION]` → resolve them or move to the open-questions section
- Implementation tips like "be careful with X" — instead state the invariant the agent must preserve and what test covers it
- File paths assumed but not pasted → paste them
- "Follow existing convention" without citing the file that exemplifies the convention → cite + paste a snippet
- Effort missing or "TBD" → estimate; XL gets broken down

## When to update this template

This file is the spec. Update it when:

- A new starter-code pattern emerges from a shipped item that future items will copy
- A new universal requirement lands (e.g. accessibility-baseline-by-default once that item ships)
- An anti-pattern bit us — add it to the list

Date stamp the change with a `## YYYY-MM-DD — what changed` block at the bottom.

## 2026-05-12 — initial version

Captured patterns A–I after the verification pass + research synthesis. ServiceLoader and AdminUILoader skeletons match shipped reference files. ss.com adapter pattern (E) added to support the cars-integration roadmap item.
