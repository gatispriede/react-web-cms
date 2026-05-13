import React, {useEffect, useState} from 'react';
import {useCommerceFlags} from './useCommerceFlags';
import {useCart} from '@client/features/Cart/useCart';
import {subscribeCartDrawer} from './cartDrawerBus';

/**
 * Slide-out cart panel. Mounts at the top of `_app.tsx` so any page can
 * open it via the cart-drawer bus. Returns `null` when checkout is
 * disabled (no DOM, no JS subscription).
 */
const CartDrawer: React.FC = () => {
    const flags = useCommerceFlags();
    const {cart, removeItem} = useCart();
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!flags.checkoutEnabled) return;
        return subscribeCartDrawer(() => setOpen(true));
    }, [flags.checkoutEnabled]);

    if (!flags.checkoutEnabled) return null;
    return (
        <aside
            className={`cart-drawer ${open ? 'cart-drawer--open' : ''}`}
            data-testid="cart-drawer"
            aria-hidden={!open}
        >
            <div className="cart-drawer__head">
                <h2>Your cart</h2>
                <button
                    type="button"
                    className="cart-drawer__close"
                    data-testid="cart-drawer-close-btn"
                    onClick={() => setOpen(false)}
                    aria-label="Close cart"
                >×</button>
            </div>
            <ul className="cart-drawer__items">
                {cart.items.length === 0 ? (
                    <li className="cart-drawer__empty">Your cart is empty.</li>
                ) : cart.items.map(it => (
                    <li key={`${it.productId}:${it.sku}`} className="cart-drawer__item">
                        <span>{it.title ?? it.productId}</span>
                        <span>× {it.qty}</span>
                        <button
                            type="button"
                            data-testid={`cart-drawer-remove-${it.productId}`}
                            onClick={() => void removeItem(it.productId, it.sku)}
                        >Remove</button>
                    </li>
                ))}
            </ul>
            <div className="cart-drawer__foot">
                <a className="cart-drawer__checkout" href="/checkout" data-testid="cart-drawer-checkout-link">
                    Go to checkout
                </a>
            </div>
        </aside>
    );
};

export default CartDrawer;
