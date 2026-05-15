// @vitest-environment jsdom
import React from 'react';
import {describe, it, expect} from 'vitest';
import {render} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import Product from './Product';
import {EItemType} from '@enums/EItemType';
import type {IProductModule, IProductRenderable} from './Product.types';

const t = ((k: string) => k) as any;

const productFixture = (id: string, overrides: Partial<IProductRenderable> = {}): IProductRenderable => ({
    id,
    slug: `slug-${id}`,
    title: `Product ${id}`,
    price: 1999,
    currency: 'EUR',
    image: 'images/p.jpg',
    attributes: {color: 'red', size: 'M'},
    ...overrides,
});

const mkItem = (content: Partial<IProductModule>) => ({
    type: EItemType.Product,
    content: JSON.stringify(content),
});

describe('Product module — mode dispatch', () => {
    const products = [productFixture('1'), productFixture('2'), productFixture('3')];

    it.each(['featured', 'grid', 'carousel', 'comparison', 'related'] as const)(
        'renders %s variant',
        (mode) => {
            const {container} = render(
                <Product item={mkItem({mode}) as any} t={t} tApp={t} products={products}/>,
            );
            expect(container.querySelector(`[data-testid="product-${mode}"]`)).not.toBeNull();
        },
    );

    it('grid renders one card per product', () => {
        const {container} = render(
            <Product item={mkItem({mode: 'grid', showBuyCta: false}) as any} t={t} tApp={t} products={products}/>,
        );
        expect(container.querySelectorAll('.product-card')).toHaveLength(3);
    });

    it('catalogue-only mode: showBuyCta=false yields zero Buy CTAs', () => {
        const {container} = render(
            <Product item={mkItem({mode: 'grid', showBuyCta: false}) as any} t={t} tApp={t} products={products}/>,
        );
        // BuyCta self-suppresses when showBuyCta is false (also gated by
        // commerce.checkoutEnabled — see BuyCta.tsx).
        expect(container.querySelector('[data-testid^="product-buy-cta"]')).toBeNull();
    });

    it('empty product list shows the variant-specific empty state', () => {
        const {container} = render(
            <Product item={mkItem({mode: 'grid'}) as any} t={t} tApp={t} products={[]}/>,
        );
        expect(container.querySelector('[data-testid="product-grid-empty"]')).not.toBeNull();
    });
});
