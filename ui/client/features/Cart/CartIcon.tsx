import React, {useState} from 'react';
import {Badge, Button} from 'antd';
import {ShoppingCartOutlined} from '@ant-design/icons';
import {useCart} from './useCart';
import CartDrawer from './CartDrawer';

/**
 * Header cart icon — shows the line-item count and opens the drawer.
 *
 * Designed to drop into the existing public-site header. Lazily fetches
 * the cart on mount via `useCart`. If the host page server-side-renders
 * the cart later, this can be lifted into a context.
 */
const CartIcon: React.FC = () => {
    const {cart} = useCart();
    const [open, setOpen] = useState(false);
    const count = cart.items.reduce((n, it) => n + it.qty, 0);
    return (
        <>
            <Badge count={count} size="small" offset={[-4, 4]}>
                <Button
                    type="text"
                    icon={<ShoppingCartOutlined style={{fontSize: 20}}/>}
                    onClick={() => setOpen(true)}
                    aria-label="Open cart"
                />
            </Badge>
            <CartDrawer open={open} onClose={() => setOpen(false)}/>
        </>
    );
};

export default CartIcon;
