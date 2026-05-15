import React, {useState} from 'react';
import {useCommerceFlags} from './useCommerceFlags';
import {useCart} from '@client/features/Cart/useCart';
import type {IProductRenderable} from '@client/modules/Product/Product.types';
import {openCartDrawer} from './cartDrawerBus';

/**
 * Buy CTA — single source of truth for the storefront's add-to-cart
 * affordance inside the Product module. Self-suppresses in three cases:
 *
 *  - `commerce.checkoutEnabled === false` (master switch off)
 *  - per-instance `showBuyCta` passed `false` by the module config
 *  - product `stockStatus === 'out-of-stock'` → renders disabled
 *
 * Clicking adds the product's primary SKU to the cart and opens the
 * cart drawer via the cart-drawer event bus.
 */
export interface BuyCtaProps {
    product: IProductRenderable;
    variant?: 'primary' | 'secondary' | 'ghost' | 'card';
    label?: string;
}

const BuyCta: React.FC<BuyCtaProps> = ({product, variant = 'primary', label}) => {
    const flags = useCommerceFlags();
    const {addItem} = useCart();
    const [busy, setBusy] = useState(false);

    if (!flags.checkoutEnabled) return null;
    const outOfStock = product.stockStatus === 'out-of-stock';

    const onClick = async () => {
        if (busy || outOfStock) return;
        setBusy(true);
        try {
            // SKU defaults to product.id when no per-variant sku is known
            // (the Product module operates at the product level).
            await addItem(product.id, product.id, 1);
            openCartDrawer();
        } catch {
            // Errors silently fall through — the cart API surfaces them
            // through its own toast path. We don't want a Buy click in a
            // grid to spam page-level notifications.
        } finally {
            setBusy(false);
        }
    };

    return (
        <button
            type="button"
            className={`buy-cta buy-cta--${variant}`}
            data-testid={`product-buy-cta-${product.slug}`}
            onClick={onClick}
            disabled={busy || outOfStock}
        >
            {outOfStock ? 'Out of stock' : (label ?? 'Buy now')}
        </button>
    );
};

export default BuyCta;
