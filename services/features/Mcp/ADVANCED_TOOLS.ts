/**
 * Allowlist of MCP tool ids that are NOT exposed in the simplified
 * admin UI mode. The MCP execution gate (`modeEnforcement.ts`)
 * consults this set to refuse calls from users sitting in
 * `simplified`.
 *
 * Selection rule (per `docs/features/platform/admin-ui-modes.md`):
 *   - Anything that mutates infra-shaped state (feature flags,
 *     schema regen, lockout reset, ISR revalidate) — power-user only.
 *   - Inventory sync — same; advanced operators-only.
 *   - Theme writes — simplified mode picks themes through the
 *     guided onboarding flow, never via raw MCP.
 *   - Audit log read is left out of the gate: it's a read-only
 *     diagnostic and harmless to surface in either mode.
 *
 * Read-only catalog reads (`*.list`, `*.get`, analytics queries) are
 * intentionally absent — the simplified surface still benefits from
 * an AI client being able to summarise what's there.
 */

export const ADVANCED_ONLY_TOOLS: ReadonlySet<string> = new Set<string>([
    // site / infra mutations
    'site.revalidate',
    'site.regenerateSchema',
    'site.setFeatureFlag',
    'site.clearFeatureFlag',
    'site.setLayoutMode',
    'auth.resetLockouts',
    // inventory writes (sync runs across every adapter)
    'inventory.syncDelta',
    // theme writes
    'theme.setActive',
    'theme.update',
    // page-tree structural mutations
    'section.delete',
    // whole-site replace — never expose in simplified mode
    'bundle.import',
    'bundle.export',
]);
