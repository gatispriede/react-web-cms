import React from 'react';
import {useCommerceFlags} from './useCommerceFlags';
import {useCart} from '@client/features/Cart/useCart';
import {openCartDrawer} from './cartDrawerBus';

/**
 * Header cart icon + item-count badge. Returns `null` when
 * `commerce.checkoutEnabled` is off — the storefront keeps a clean
 * portfolio look until the operator flips the master switch.
 */
const CartDrawerToggle: React.FC = () => {
    const flags = useCommerceFlags();
    const {cart} = useCart();
    if (!flags.checkoutEnabled) return null;

    const count = cart.items.reduce((sum, i) => sum + (i.qty ?? 0), 0);
    return (
        <button
            type="button"
            className="cart-drawer-toggle"
            data-testid="cart-drawer-toggle"
            aria-label="Open cart"
            onClick={openCartDrawer}
        >
            <span aria-hidden="true">🛒</span>
            {count > 0 && (
                <span className="cart-drawer-toggle__badge" data-testid="cart-drawer-toggle-count">{count}</span>
            )}
        </button>
    );
};

export default CartDrawerToggle;
