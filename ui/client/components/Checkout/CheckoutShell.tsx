/**
 * CheckoutShell — Amazon-style "Secure checkout" chrome shared by every
 * step page (`/checkout/address`, `/checkout/shipping`, `/checkout/payment`).
 *
 * - Slim top bar with site name + "Secure checkout" centred + cart icon
 * - Gray page background (`#eaeded`)
 * - 2-column main: left column = step content (rendered via the page's
 *   SystemPageDispatch); right column = sticky `<OrderSummary>` card
 *
 * Each step page renders its main content via SystemPageDispatch and
 * passes the result as `children`. The shell handles layout + chrome
 * once instead of duplicating it four times.
 */
import React from 'react';
import Link from 'next/link';
import {Typography} from 'antd';
import {LockOutlined, ShoppingCartOutlined} from '@ant-design/icons';
import {useCart} from '@client/features/Cart/useCart';
import {formatMoney} from '@client/lib/checkout/api';

export interface CheckoutShellProps {
    /** Step content — typically a SystemPageDispatch render or a single module. */
    children: React.ReactNode;
    /** Optional right-rail override. Defaults to a built-in order summary card. */
    rightRail?: React.ReactNode;
    /** Test-id stamped on the outer <main>; routes pass their own. */
    testId?: string;
}

const AMAZON_BG = '#eaeded';

const CheckoutShell: React.FC<CheckoutShellProps> = ({children, rightRail, testId}) => {
    return (
        <div style={{background: AMAZON_BG, minHeight: '100vh'}}>
            <header style={{background: '#fff', borderBottom: '1px solid #ddd'}}>
                <div style={{maxWidth: 1300, margin: '0 auto', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                    <Link href="/" style={{color: '#0f1111', fontWeight: 700, fontSize: 20, textDecoration: 'none'}}>Shop</Link>
                    <Typography.Text strong style={{fontSize: 18}}>
                        <LockOutlined style={{marginRight: 8, color: '#0f1111'}}/>
                        Secure checkout
                    </Typography.Text>
                    <Link href="/cart" style={{color: '#0f1111', textDecoration: 'none'}} aria-label="View cart">
                        <ShoppingCartOutlined style={{fontSize: 22}}/>
                    </Link>
                </div>
            </header>
            <main data-testid={testId} style={{maxWidth: 1300, margin: '0 auto', padding: '24px 16px 80px'}}>
                <div style={{display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 16, alignItems: 'flex-start'}}>
                    <div>{children}</div>
                    <div>{rightRail ?? <DefaultOrderSummary/>}</div>
                </div>
            </main>
        </div>
    );
};

/**
 * Inline order summary — shown in the right rail when the step page
 * doesn't pass its own. Reads live cart state via `useCart()`.
 */
const DefaultOrderSummary: React.FC = () => {
    const {cart} = useCart();
    const itemCount = cart.items.reduce((n, it) => n + it.qty, 0);
    return (
        <aside
            data-testid="checkout-shell-summary"
            style={{background: '#fff', borderRadius: 8, padding: 20, boxShadow: '0 1px 2px rgba(0,0,0,0.04)', position: 'sticky', top: 16}}
        >
            <Typography.Title level={4} style={{marginTop: 0, marginBottom: 12}}>Order Summary</Typography.Title>
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 8}}>
                <Typography.Text>Items ({itemCount}):</Typography.Text>
                <Typography.Text>{formatMoney(cart.subtotal, cart.currency)}</Typography.Text>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 8}}>
                <Typography.Text>Postage &amp; Packing:</Typography.Text>
                <Typography.Text type="secondary">Calculated at next step</Typography.Text>
            </div>
            <div style={{borderTop: '1px solid #eee', paddingTop: 12, marginTop: 12}}>
                <div style={{display: 'flex', justifyContent: 'space-between'}}>
                    <Typography.Text strong style={{fontSize: 18, color: '#B12704'}}>Order Total:</Typography.Text>
                    <Typography.Text strong style={{fontSize: 18, color: '#B12704'}}>{formatMoney(cart.subtotal, cart.currency)}</Typography.Text>
                </div>
            </div>
        </aside>
    );
};

export default CheckoutShell;
