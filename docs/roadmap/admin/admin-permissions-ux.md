---
name: admin-permissions-ux
description: Replace per-action permission checkboxes with 4 named tiers (Full / Edit / Comment / View) + role presets + collection-scoped grants. Notion 3.0 + Webflow pattern.
research: see research-findings-2026-05-12.md §1 Permissions UX
---

# Admin permissions UX — 4 named tiers

## Goal

Replace the current per-action grant grid (where operators check 30+ admin mutation grants) with a Notion-3.0-shaped permissions UX:

- **4 named tiers** — Full / Edit / Comment / View — replacing per-action checkboxes
- **Role presets** by job (Owner / Designer / Editor / Reviewer / Viewer) selecting a tier per scope
- **Groups as default assignment unit** — assign a group to a project; individuals override with explicit "overrides inherited" indicator
- **Collection-scoped grants, not per-block** — grant at the boundary of pages, posts, products, themes — not per-field

The underlying grants engine (already shipped) supports the granular model; this is a **UX layer on top** that translates 4-tier intent → granular grants under the hood.

## Why now

- The grant engine + Q10 three-dimension grants are already shipped (`30 admin mutations grant-gated` per the changelog). Operators using them find the UX overwhelming — 30+ checkboxes is hostile.
- Pairs with [admin-empty-states-onboarding](admin-empty-states-onboarding.md) — the wizard's "invite team" step needs a sane shape to ask for; "Invite Alice as Designer for Themes" beats "tick 8 checkboxes for Alice."
- Customer-facing surfaces are landing (signup, checkout, account); operators need to grant their team access to manage them without a 1-day permission setup.

## Design

### 4 tiers — semantic mapping

| Tier | Scope of action | Example mutations |
|---|---|---|
| **Full** | All actions including delete, publish, and permission grants | `publish_*`, `delete_*`, `permission_grant`, `permission_revoke` |
| **Edit** | Create + update + restore from trash, but no delete + no publish | `create_*`, `update_*`, `trash_restore`, `bundle_export` |
| **Comment** | Add review notes / approve, no content changes | (new — comments + presence features when shipped; today behaves like View) |
| **View** | Read-only across the assigned scope | (no mutations; queries only) |

Today, "Comment" effectively maps to "View" because review / approval flows aren't shipped yet. Keep the tier in the UX so it's there when comments land — agents reading the data model understand the future state.

### Role presets — opinionated defaults

| Role | Default tiers per scope |
|---|---|
| **Owner** | Full on everything (workspace-wide) |
| **Designer** | Full on Themes + Pages; Edit on Posts + Products; View on Orders + Customers |
| **Editor** | Edit on Pages + Posts; View elsewhere |
| **Reviewer** | Comment on Pages + Posts; View elsewhere |
| **Viewer** | View on everything |
| **Custom** | Operator-defined — falls back to manual 4-tier-per-scope grid |

Presets are **starting points** — operator can adjust any tier × scope cell.

### Grant scope boundaries

Grants apply at **collection-level**, never per-field:

| Scope | Backed by |
|---|---|
| Workspace | Site-wide |
| Pages | All pages, or a specific page (and its sub-pages) |
| Posts | All posts, or a specific category |
| Products | All products, or a specific category |
| Themes | All themes |
| Orders | All orders, or "own customer's orders only" |
| Customers | All customers |
| Releases | All releases, or "releases I created" |
| Bundle | Export + import |
| Inventory | Warehouse adapter config + sync |
| MCP tools | Tool group (read tools / write tools / advanced-only tools) |
| Settings | Site identity / email config / feature flags / auth methods |

### Groups

`Group` is a new entity:

```ts
// shared/types/IGroup.ts
interface IGroup {
    id: string;
    name: string;         // 'Design team', 'Customer support'
    description?: string;
    memberUserIds: string[];
    createdAt: string;
    createdBy: string;
}
```

Grants attach to either:
- `userId` (individual)
- `groupId` (group; member inherits the group's grants)

Effective grants for a user = `union(individual grants, ⋃ group grants for each group the user is in)`.

When a user has both a group grant AND an individual grant on the same scope, the individual wins (and the UI shows an "overrides inherited" indicator next to that scope).

### Admin pane redesign

`/admin/system/permissions` — rewrite:

**List view** — table of users + groups, role badge, last activity, "manage" button. Filter by group / role / scope.

**Per-user / per-group edit view** —

```
┌─────────────────────────────────────────────────────┐
│  Alice Designer  (alice@example.com)                │
│  Role preset: [Designer ▾] · Custom  Save           │
│                                                      │
│  Inherited from group: Design Team (4 members)      │
│                                                      │
│  Permissions by scope                                │
│  ┌────────────────────────────────────────────────┐ │
│  │ Pages        Full   ◉ Edit   ○ Comment  ○ View │ │
│  │ Posts        ○ Full ◉ Edit   ○ Comment  ○ View │ │
│  │ Products     ○ Full ○ Edit   ○ Comment  ◉ View │ │
│  │ Themes       ◉ Full ○ Edit   ○ Comment  ○ View │ │
│  │ Orders       ○ Full ○ Edit   ○ Comment  ◉ View │ │
│  │ … (collapsed scopes hidden)                    │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  [+ Add per-resource grant]                          │
│                                                      │
│  ⓘ Overriding group "Design Team" on: Themes        │
└─────────────────────────────────────────────────────┘
```

Radio buttons (one per scope) instead of 30+ checkboxes. "Custom" preset stays available for fine-grained per-action grants — falls back to the existing checkbox UI but hidden behind a disclosure.

### Translation: 4-tier UX → granular grants

A `tierToGrants(scope, tier)` function expands the tier choice into the granular grants the engine consumes:

```ts
// services/features/Permissions/tierMapping.ts
const TIER_TO_GRANTS: Record<Scope, Record<Tier, GrantSpec[]>> = {
    Pages: {
        Full: [
            {resource: 'page', actions: ['create', 'update', 'delete', 'publish', 'restore']},
        ],
        Edit: [
            {resource: 'page', actions: ['create', 'update', 'restore']},
        ],
        Comment: [
            // future: comment actions; today empty (= View)
        ],
        View: [
            // queries are open by default; no grants needed
        ],
    },
    // … per scope
};

export function tierToGrants(scope: Scope, tier: Tier): GrantSpec[] {
    return TIER_TO_GRANTS[scope]?.[tier] ?? [];
}
```

`tierMapping.ts` is the operator-readable source of truth — when ops want to know "what can Editor do on Pages", they read this file.

### Audit trail

Every grant change writes to the existing `Audit` feature with `kind: 'permission.change'` + before/after JSON. Already in place; just ensure the new pane goes through the same path.

## Files to touch

- `shared/types/IGroup.ts` (new)
- `services/features/Permissions/GroupService.ts` (new) — CRUD + membership
- `services/features/Permissions/tierMapping.ts` (new) — 4-tier expansion
- `services/features/Permissions/effectiveGrants.ts` (new or extend) — compose user + group + override
- `services/features/Permissions/PermissionsServiceLoader.ts` (extend) — register Group SDL
- `ui/admin/features/Permissions/Permissions.tsx` (rewrite) — list view
- `ui/admin/features/Permissions/UserPermissionEditor.tsx` (rewrite) — radio-based tier grid
- `ui/admin/features/Permissions/GroupPermissionEditor.tsx` (new)
- `ui/admin/features/Permissions/RolePresetPicker.tsx` (new)
- `ui/admin/features/Permissions/CustomGrantDisclosure.tsx` (existing checkbox UI moved here, hidden by default)
- `services/features/Mcp/tools/permissions.ts` — extend with `group.*` and `permission.applyTier` tools
- Tests: tier-to-grants mapping unit tests; effective-grants composition with overrides; e2e (invite user → set as Designer → assigned to Design Team group → override Themes to Full → verify in audit log)

## Starter code

Effective-grants composition (already partially exists; extend with group support):

```ts
// services/features/Permissions/effectiveGrants.ts
export async function effectiveGrantsForUser(userId: string): Promise<EffectiveGrants> {
    const user = await users.get(userId);
    const groups = await groups.listForUser(userId);

    // Start with all group grants
    const groupGrants = groups.flatMap((g) => g.grants ?? []);

    // Individual grants override (per scope)
    const indiv = user.grants ?? [];
    const overrideScopes = new Set(indiv.map((g) => g.resource));

    const composed = [
        ...groupGrants.filter((g) => !overrideScopes.has(g.resource)),
        ...indiv,
    ];

    return {
        userId,
        grants: composed,
        overrides: indiv
            .filter((g) => groupGrants.some((gg) => gg.resource === g.resource))
            .map((g) => g.resource),
    };
}
```

Tier editor cell:

```tsx
function ScopeRow({scope, tier, inheritedTier, onChange}: ScopeRowProps) {
    const overriding = inheritedTier && inheritedTier !== tier;
    return (
        <tr>
            <td>{scope}</td>
            {(['Full', 'Edit', 'Comment', 'View'] as Tier[]).map((t) => (
                <td key={t}>
                    <Radio
                        checked={tier === t}
                        onChange={() => onChange(t)}
                        data-testid={`permissions-${scope}-${t}`}
                    />
                </td>
            ))}
            {overriding && (
                <td>
                    <Tag>Overrides {inheritedTier} from group</Tag>
                </td>
            )}
        </tr>
    );
}
```

## Acceptance

1. Admin pane shows the tier-grid editor by default; per-action checkbox UI is hidden under a "Custom permissions" disclosure
2. Role presets pre-populate the tier grid; switching preset updates the cells
3. Groups can be created + members added/removed
4. Assigning a group to a user gives the user the group's grants; individual grants override per-scope with visible indicator
5. Saving the tier grid persists granular grants via the existing engine (no API contract change)
6. Audit log records every grant change with before/after
7. MCP coverage: `group.create / addMember / removeMember`, `permission.applyTier(scope, tier, userId|groupId)`
8. Smoke e2e: create group "Design" → preset "Designer" → invite user to group → user can edit pages but not delete

## Effort

**L · ~5-6 hours AI.**

- Group entity + service + SDL: ~1 hour
- tier-mapping expansion + effective-grants composition: ~1 hour
- Admin pane rewrite (list + tier grid + group editor + preset picker): ~2 hours
- MCP coverage: ~30 min
- Migration of existing per-action grants → tier inference (best-effort UI hint, no destructive change): ~30 min
- Tests + e2e: ~1 hour

## Dependencies

- Existing `Permissions` feature + Q10 three-dimension grants (shipped)
- Existing `Audit` feature (shipped)

## Open questions

- **[OPERATOR DECISION]** Comment tier today = View (no comment feature shipped). Show it in the UX anyway (forward-looking) or hide until comments ship? Recommend: show with tooltip "Currently behaves like View; comments coming in a future release."
- **[OPERATOR DECISION]** Default role for a freshly-invited user — Viewer or Editor? Recommend: Viewer (least-surprise + least-blast-radius).

## Out of scope

- Two-factor / SSO / SAML — separate item once enterprise demand emerges
- Comment / approval workflows — separate item; this just reserves the tier slot
- Time-bound grants ("Alice can edit until Friday") — separate item
- API-key style service accounts — separate item
