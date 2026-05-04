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
    'module.add',
    'module.update',
    'module.remove',
    // inquiry-management writes — destructive or sends mail
    'inquiry.delete',
    'email.send',
    // whole-site replace — never expose in simplified mode
    'bundle.import',
    'bundle.export',
    // F8 — page lifecycle (structural mutations) — advanced only
    'page.update',
    'page.delete',
    'page.setParent',
    'page.reorder',
    // F8 — site-wide content writes — advanced only
    'footer.update',
    'seo.update',
    'logo.update',
    // F8 — auth surface — advanced only
    'permission.grant',
    'permission.revoke',
    'user.setRole',
    // F8 — i18n CRUD — advanced only
    'language.add',
    'language.remove',
    'language.setDefault',
    // F8 — trash — destructive restore is advanced only
    'trash.restore',
]);
