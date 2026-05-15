/**
 * Phase 1.C — products-as-composable-page sub-jump B.
 *
 * `CategoryTemplate` is the default section layout for a warehouse-derived
 * **category** page (root catalogue, category, sub-category, ...
 * everything above leaf-product depth).
 *
 * Sections are emitted as plain `ISection` records with `locked: true` on
 * the structural backbone (Hero / Breadcrumb / FilterBar / ProductGrid /
 * Pagination) so an operator can't accidentally rip the page apart while
 * still being free to:
 *
 *   - reorder the locked sections
 *   - add their own sections between / around
 *   - delete the optional NewsletterCta
 *
 * The deletion guard lives in `NavigationService.removeSectionItem`
 * (Phase 0a) — `locked: true` makes the server reject removal with
 * `SECTION_LOCKED`. Edits to section *content* (e.g. the operator
 * curating which products the ProductGrid shows) are not blocked.
 *
 * `lockReason` is a literal i18n key — resolved by the admin shell
 * through the `t()` table so the operator sees a localised tooltip.
 *
 * The template is a pure function over the category descriptor — easy
 * to unit-test and snapshot. The worker calls `buildCategoryTemplate()`
 * on first insert; on re-runs, `isOperatorEdited()` decides whether to
 * patch.
 */
import {EItemType} from '@enums/EItemType';
import type {ISection} from '@interfaces/ISection';
import type {IItem} from '@interfaces/IItem';

/**
 * Descriptor the worker hands to the template. Carries everything the
 * default layout needs to render a sensible first paint without an
 * operator touching anything.
 */
export interface CategoryTemplateInput {
    /** Path segment for this category — `'cars'`, `'used'`, `'sedan'`. */
    slug: string;
    /** Human label used in the Hero + Breadcrumb. Usually slug → title-case. */
    label: string;
    /** Optional product-count badge for the Hero, e.g. `"123 cars"`. */
    countLabel?: string;
    /** Adapter id that owns this branch — stored on the auto-grid filter
     *  for downstream debugging. */
    adapterId: string;
    /** The attribute filter that selects this category's products,
     *  e.g. `{category: 'cars', subcategory: 'used'}`. Embedded into the
     *  auto-injected ProductGrid section's content so the renderer can
     *  page through the right slice. */
    filter: Record<string, string>;
    /** Whether to append a NewsletterCta — opt-in per category. */
    withNewsletter?: boolean;
}

const I18N = {
    lockReason: 'section.locked.warehouse-derived',
};

let counter = 0;
/**
 * Deterministic-ish section id generator. The real `NavigationService`
 * stamps server-side ids on insert; this default is a placeholder that
 * lets templates be diffed in tests without needing the live service.
 * The worker re-stamps once it calls `createSection`.
 */
const newId = (kind: string): string => `tpl-${kind}-${++counter}-${Date.now().toString(36)}`;

const item = (type: EItemType, content: Record<string, unknown>): IItem => ({
    type,
    content: JSON.stringify(content),
});

/**
 * Build the canonical section list for a warehouse-derived category page.
 *
 * Section order (all `locked: true` except where noted):
 *   1. Hero (compact mode) — category name + count badge
 *   2. Breadcrumb — auto-walks parent chain
 *   3. FilterBar (stub for W6b) — facet UI placeholder
 *   4. ProductGrid (Product mode=grid) — bound to `input.filter`
 *   5. Pagination — cursor-based
 *   6. NewsletterCta — optional, unlocked, opt-in per category
 */
export function buildCategoryTemplate(input: CategoryTemplateInput): ISection[] {
    const sections: ISection[] = [];

    sections.push({
        id: newId('hero'),
        type: 1,
        content: [item(EItemType.Hero, {
            headline: input.label,
            subtitle: input.countLabel ?? '',
            tagline: '',
            bgImage: {src: ''},
            accent: '',
            // Style hint — `compact` Hero variant for catalogue pages so the
            // grid below stays above the fold on modest viewports.
            style: 'compact',
        })],
        locked: true,
        lockReason: I18N.lockReason,
    });

    sections.push({
        id: newId('breadcrumb'),
        type: 1,
        content: [item(EItemType.Breadcrumb, {
            // Renderer walks the page's parent chain N-deep at request
            // time — no need to bake the trail into stored content.
            autoFromParentChain: true,
        })],
        locked: true,
        lockReason: I18N.lockReason,
    });

    sections.push({
        id: newId('filterbar'),
        type: 1,
        // FilterBar is the W6b faceted-filter system. That module hasn't
        // landed yet; we ship a placeholder PlainText pill describing the
        // intent so the section is real-shaped and the auto-grid below
        // still renders. Once W6b lands the type swaps to FilterBar and
        // the placeholder content disappears.
        content: [item(EItemType.Text, {
            value: '[Filters]',
            placeholder: 'filter-bar',
            filter: input.filter,
        })],
        locked: true,
        lockReason: I18N.lockReason,
    });

    sections.push({
        id: newId('product-grid'),
        type: 1,
        content: [item(EItemType.Product, {
            mode: 'grid',
            products: {
                source: 'warehouse-filter',
                adapterId: input.adapterId,
                filter: input.filter,
                limit: 24,
            },
            showBuyCta: true,
            showPrice: true,
            grid: {columns: 3, density: 'standard'},
        })],
        locked: true,
        lockReason: I18N.lockReason,
    });

    sections.push({
        id: newId('pagination'),
        type: 1,
        content: [item(EItemType.Pagination, {
            variant: 'load-more',
            pageSize: 24,
        })],
        locked: true,
        lockReason: I18N.lockReason,
    });

    if (input.withNewsletter) {
        // Operator-friendly: NewsletterCta is the only template section
        // that ships **unlocked** so an operator can delete it (or replace
        // the slot with something more on-brand) without an override.
        sections.push({
            id: newId('newsletter'),
            type: 1,
            content: [item(EItemType.Text, {
                value: `Subscribe to new arrivals in ${input.label}`,
                placeholder: 'newsletter-cta',
            })],
        });
    }

    return sections;
}

/**
 * Returns a stable fingerprint string identifying this template
 * shape — used by the worker's operator-edit heuristic.
 *
 * The fingerprint hashes the section types + slot positions, NOT the
 * content payloads (the operator may legitimately edit the count badge
 * or the grid filter and we want those edits preserved without flipping
 * the "operator-edited" bit).
 */
export function fingerprintCategoryTemplate(sections: ISection[]): string {
    return sections.map(s => {
        const types = (s.content ?? []).map(c => c.type ?? 'unknown').join('+');
        return `${types}:${s.locked ? 'L' : 'u'}`;
    }).join('|');
}
