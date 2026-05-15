/**
 * Built-in product display templates — 5 platform-shipped templates
 * seeded on first boot. Phase 1.F (product-display-templates).
 *
 * Operators may duplicate these as starting points for custom templates
 * but cannot delete them — `ProductTemplateService.delete` rejects when
 * `builtIn: true`.
 *
 * Section composition:
 *   - Each section is a single-column wrap (`type: 1`) containing one
 *     module via `IItem.type` (the EItemType string enum).
 *   - The transactional ProductDetailHero on the Standard / Quick-buy
 *     templates is `locked: true` — operators can edit content but cannot
 *     remove the section from a leaf product page.
 *   - `editedBy`/`editedAt` on sections are intentionally omitted — the
 *     service stamps those during the upsert-or-cascade flow.
 */

import {EItemType} from '@enums/EItemType';
import type {IProductTemplate} from '@interfaces/IProductTemplate';
import type {ISection} from '@interfaces/ISection';
import guid from '@utils/guid';

const epoch = '1970-01-01T00:00:00.000Z';

const mkSection = (
    itemType: EItemType,
    opts: {locked?: boolean; lockReason?: string; defaultContent?: string} = {},
): ISection => ({
    id: guid(),
    type: 1,
    content: [{
        id: guid(),
        type: itemType as unknown as string,
        style: 'default',
        content: opts.defaultContent ?? '{}',
    } as any],
    ...(opts.locked ? {locked: true, lockReason: opts.lockReason} : {}),
});

/** "Premium" — large hero + story + large gallery + spec + related. */
const premium: IProductTemplate = {
    id: 'built-in:premium',
    name: 'Premium',
    description: 'Large hero + story + gallery. For flagship products.',
    audience: 'either',
    applicableTo: {sources: ['manual', 'warehouse']},
    sections: [
        mkSection(EItemType.ProductDetailHero, {locked: true, lockReason: 'section.locked.product-hero'}),
        mkSection(EItemType.ProductDescription),
        mkSection(EItemType.LargeGallery),
        mkSection(EItemType.ProductSpecTable),
        mkSection(EItemType.Product, {defaultContent: '{"mode":"related","showBuyCta":true}'}),
    ],
    builtIn: true,
    createdAt: epoch,
    updatedAt: epoch,
    version: 1,
};

/** "Standard" — compact hero + spec + description + related. Default fallback. */
const standard: IProductTemplate = {
    id: 'built-in:standard',
    name: 'Standard',
    description: 'Compact hero + spec table + description + related. Default fallback.',
    audience: 'either',
    applicableTo: {sources: ['manual', 'warehouse']},
    sections: [
        mkSection(EItemType.ProductDetailHero, {locked: true, lockReason: 'section.locked.product-hero'}),
        mkSection(EItemType.ProductSpecTable),
        mkSection(EItemType.ProductDescription),
        mkSection(EItemType.Product, {defaultContent: '{"mode":"related","showBuyCta":true}'}),
    ],
    builtIn: true,
    createdAt: epoch,
    updatedAt: epoch,
    version: 1,
};

/** "Quick-buy" — minimal hero with prominent CTA. */
const quickBuy: IProductTemplate = {
    id: 'built-in:quick-buy',
    name: 'Quick-buy',
    description: 'Minimal hero with prominent Buy CTA. Commodity B2C items.',
    audience: 'b2c',
    applicableTo: {sources: ['manual', 'warehouse']},
    sections: [
        mkSection(EItemType.ProductDetailHero, {
            locked: true,
            lockReason: 'section.locked.product-hero',
            defaultContent: '{"showBuyCta":true,"showVatBadge":true,"compact":true}',
        }),
        mkSection(EItemType.ProductSpecTable, {defaultContent: '{"autoFromAttributes":true,"density":"compact"}'}),
        mkSection(EItemType.Product, {defaultContent: '{"mode":"related","showBuyCta":true}'}),
    ],
    builtIn: true,
    createdAt: epoch,
    updatedAt: epoch,
    version: 1,
};

/** "Bundle" — sibling-products grid under a parent product. */
const bundle: IProductTemplate = {
    id: 'built-in:bundle',
    name: 'Bundle',
    description: 'Parent + sibling products visible inline. For bundles + kits.',
    audience: 'either',
    applicableTo: {sources: ['manual', 'warehouse']},
    sections: [
        mkSection(EItemType.ProductDetailHero, {locked: true, lockReason: 'section.locked.product-hero'}),
        mkSection(EItemType.ProductDescription),
        mkSection(EItemType.SubProductsGrid),
        mkSection(EItemType.Product, {defaultContent: '{"mode":"related","showBuyCta":true}'}),
    ],
    builtIn: true,
    createdAt: epoch,
    updatedAt: epoch,
    version: 1,
};

/** "B2B Spec Sheet" — downloadable PDF + warranty + spec table. */
const b2bSpecSheet: IProductTemplate = {
    id: 'built-in:b2b-spec-sheet',
    name: 'B2B Spec Sheet',
    description: 'Industrial spec sheet with downloadable PDF + warranty info. For company customers.',
    audience: 'b2b',
    applicableTo: {sources: ['manual', 'warehouse']},
    sections: [
        mkSection(EItemType.ProductDetailHero, {locked: true, lockReason: 'section.locked.product-hero'}),
        mkSection(EItemType.ProductSpecTable),
        mkSection(EItemType.WarrantyInfo),
        mkSection(EItemType.DownloadablePdf),
        mkSection(EItemType.Product, {defaultContent: '{"mode":"related","showBuyCta":false}'}),
    ],
    builtIn: true,
    createdAt: epoch,
    updatedAt: epoch,
    version: 1,
};

export const BUILT_IN_TEMPLATES: readonly IProductTemplate[] = [
    premium,
    standard,
    quickBuy,
    bundle,
    b2bSpecSheet,
];

export const DEFAULT_TEMPLATE_ID = 'built-in:standard';
