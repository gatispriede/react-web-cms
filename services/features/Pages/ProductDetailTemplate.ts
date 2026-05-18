/**
 * Phase 1.C — products-as-composable-page sub-jump B.
 *
 * `ProductDetailTemplate` is the default section layout for a
 * warehouse-derived **leaf product page** (`IPage.source === 'product'`,
 * `IPage.productId` bound).
 *
 * Transactional sections (ProductDetailHero — the Buy CTA lives here;
 * ProductSpecTable — the spec sheet) are `locked: true` so an operator
 * can't accidentally delete the things that let the page actually sell
 * a product. The ProductDescription + ProductRelated sections ship
 * unlocked so operators can replace them with custom marketing copy or
 * curated cross-sell logic.
 *
 * `Reviews` + `ContactForm` are not auto-injected — they're surfaced via
 * `{includeReviews, includeContactForm}` flags on the input so the
 * operator (or the worker, reading off `IProduct.source === 'reservation-only'`
 * per W7b) can switch them on per-product.
 *
 * Pure function over the input descriptor — easy to unit-test +
 * snapshot.
 */
import {EItemType} from '@enums/EItemType';
import type {ISection} from '@interfaces/ISection';
import type {IItem} from '@interfaces/IItem';

export interface ProductDetailTemplateInput {
    /** Bound product id — stamped into every section's content so the
     *  renderer's `<ProductContext>` can fetch the product once and
     *  thread it through to the children. */
    productId: string;
    /** Adapter id — for debugging + the per-product audit log. */
    adapterId: string;
    /** Add an opt-in Reviews module. Default false. */
    includeReviews?: boolean;
    /** Add a ContactForm — used when the product is reservation-only
     *  (no Buy CTA in the hero) or checkout is disabled site-wide. */
    includeContactForm?: boolean;
}

const I18N = {
    lockReason: 'section.locked.product-detail',
};

let counter = 0;
const newId = (kind: string): string => `pdtpl-${kind}-${++counter}-${Date.now().toString(36)}`;

const item = (type: EItemType, content: Record<string, unknown>): IItem => ({
    type,
    content: JSON.stringify(content),
});

/**
 * Build the canonical section list for a leaf product page.
 *
 * Section order:
 *   1. ProductDetailHero — gallery + title + price + Buy CTA + VAT badge   (locked)
 *   2. ProductSpecTable — auto-generated from `IProduct.attributes`        (locked)
 *   3. ProductDescription — RichText auto-bound to `product.description`   (unlocked)
 *   4. ProductRelated — Product mode=related                               (unlocked)
 *   5. Reviews — optional, opt-in
 *   6. ContactForm — optional, opt-in (reservation-only path)
 */
export function buildProductDetailTemplate(input: ProductDetailTemplateInput): ISection[] {
    const sections: ISection[] = [];

    sections.push({
        id: newId('hero'),
        type: 1,
        content: [item(EItemType.ProductDetailHero, {
            productId: input.productId,
            adapterId: input.adapterId,
            showBuyCta: true,
            showVatBadge: true,
        })],
        locked: true,
        lockReason: I18N.lockReason,
    });

    sections.push({
        id: newId('spec'),
        type: 1,
        content: [item(EItemType.ProductSpecTable, {
            productId: input.productId,
            // Renderer auto-extracts every key in `IProduct.attributes`
            // and resolves the label via i18n (`product.spec.{key}`),
            // falling back to humanised key.
            autoFromAttributes: true,
        })],
        locked: true,
        lockReason: I18N.lockReason,
    });

    sections.push({
        id: newId('description'),
        type: 1,
        // Unlocked — operators can replace the auto-bound description
        // with their own RichText body.
        content: [item(EItemType.ProductDescription, {
            productId: input.productId,
            autoBindTo: 'product.description',
        })],
    });

    sections.push({
        id: newId('related'),
        type: 1,
        content: [item(EItemType.Product, {
            mode: 'related',
            products: {
                source: 'related-to',
                productId: input.productId,
                limit: 4,
            },
            showBuyCta: true,
            showPrice: true,
        })],
    });

    if (input.includeReviews) {
        sections.push({
            id: newId('reviews'),
            type: 1,
            content: [item(EItemType.Text, {
                value: '[Reviews]',
                placeholder: 'reviews',
                productId: input.productId,
            })],
        });
    }

    if (input.includeContactForm) {
        sections.push({
            id: newId('contact'),
            type: 1,
            content: [item(EItemType.InquiryForm, {
                topics: [],
                fields: [],
                productId: input.productId,
                presetSubject: `Reservation inquiry — ${input.productId}`,
            })],
        });
    }

    return sections;
}

/** Stable fingerprint of the template shape — see CategoryTemplate. */
export function fingerprintProductDetailTemplate(sections: ISection[]): string {
    return sections.map(s => {
        const types = (s.content ?? []).map(c => c.type ?? 'unknown').join('+');
        return `${types}:${s.locked ? 'L' : 'u'}`;
    }).join('|');
}
