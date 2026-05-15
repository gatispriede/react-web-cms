/**
 * Phase 1.D — thin server-side helper to load a system page by its
 * registered `systemKey`. Returns a JSON-safe snapshot the calling
 * route can render via the existing SectionContent host (out of scope
 * for the first cut) or use to enforce per-page SEO + access gate
 * decisions.
 *
 * Routes refactor: cart / checkout-* / order-by-token / account /
 * account/verify load this snapshot in their `getServerSideProps`. The
 * existing hand-coded UI continues to render below it; the system-page
 * envelope becomes the source of truth for slug + access gate + the
 * locked-section list once full SectionContent dispatch is wired in
 * a follow-up.
 */
import {systemPageRegistry} from '@services/features/Pages/SystemPageRegistry';
import type {ISection} from '@interfaces/ISection';

export interface ISystemPageSnapshot {
    systemKey: string;
    slug: string;
    titleI18nKey: string;
    accessGate: 'customer-session' | 'guest-token' | 'open' | 'admin-session';
    indexable: boolean;
    defaultSections: ISection[];
}

export function loadSystemPageSnapshot(systemKey: string): ISystemPageSnapshot | null {
    const def = systemPageRegistry.getDefinition(systemKey);
    if (!def) return null;
    return {
        systemKey: def.systemKey,
        slug: def.slug,
        titleI18nKey: def.titleI18nKey,
        accessGate: def.accessGate ?? 'open',
        indexable: def.seo?.indexable ?? false,
        defaultSections: def.defaultSections(),
    };
}
