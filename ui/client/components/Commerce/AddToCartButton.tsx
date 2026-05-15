import React, {useState} from 'react';
import {useCommerceFlags} from './useCommerceFlags';
import {useCart} from '@client/features/Cart/useCart';
import {openCartDrawer} from './cartDrawerBus';

/**
 * Inline add-to-cart button — alternate to BuyCta for product detail
 * pages. Suppressed when `commerce.checkoutEnabled` is off so the
 * existing `/products/[slug]` page renders catalogue-only without any
 * additional plumbing on the page side once the new control is adopted.
 */
export interface AddToCartButtonProps {
    productId: string;
    sku?: string;
    disabled?: boolean;
    label?: string;
}

const AddToCartButton: React.FC<AddToCartButtonProps> = ({productId, sku, disabled, label}) => {
    const flags = useCommerceFlags();
    const {addItem} = useCart();
    const [busy, setBusy] = useState(false);
    if (!flags.checkoutEnabled) return null;

    const onClick = async () => {
        if (busy) return;
        setBusy(true);
        try {
            await addItem(productId, sku ?? productId, 1);
            openCartDrawer();
        } finally {
            setBusy(false);
        }
    };
    return (
        <button
            type="button"
            className="add-to-cart-btn"
            data-testid="add-to-cart-btn"
            disabled={disabled || busy}
            onClick={onClick}
        >
            {label ?? 'Add to cart'}
        </button>
    );
};

export default AddToCartButton;
