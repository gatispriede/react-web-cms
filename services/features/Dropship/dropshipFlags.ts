/**
 * Dropship feature flag registrations — scaffold step of the
 * pc-parts-dropshipping-integration roadmap item.
 *
 * Spec: docs/roadmap/storefront/pc-parts-dropshipping-integration.md
 *
 * Importing this module registers `commerce.dropshipEnabled` via the
 * standard `defineFlag()` mechanism (Phase 0c pattern). Mirrors
 * `services/features/Commerce/commerceFlags.ts`.
 *
 * Only the master switch is registered in the scaffold commit; the
 * adapter selector + per-distributor sub-flags
 * (`commerce.dropship.adapter`, `…priceSyncIntervalMinutes`,
 * `…orderPollIntervalMinutes`, `…minMarginPct`,
 * `…holdOrderOnPriceMismatch`) land in the implementation commit
 * once the operator picks a distributor.
 *
 * Default is `false` — no code path attempts to call an adapter
 * until the operator flips this on AND the chosen adapter's
 * `isConfigured()` returns true (double-gate).
 */
import {defineFlag, isBoolean, type FlagPath} from '@services/features/Seo/siteFlagDefinitions';

/** Stable, append-only list of `commerce.dropship.*` flag paths. */
export const DROPSHIP_FLAG_PATHS: readonly FlagPath[] = [
    'commerce.dropshipEnabled',
] as const;

defineFlag<boolean>({
    path: 'commerce.dropshipEnabled',
    defaultValue: false,
    typeGuard: isBoolean,
    audience: 'admin-only',
    description:
        'Master switch for dropshipping. When off (default), no order-finalize code path '
        + 'invokes a distributor adapter and no price-sync / order-polling workers run. '
        + 'Flip on only after a distributor partner account is acquired and credentials '
        + 'are configured (see docs/roadmap/storefront/pc-parts-dropshipping-integration.md '
        + '§"Operator post-merge ops"). Admin-only — the storefront does not branch on this.',
});
