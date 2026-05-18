'use client';
/**
 * Client view for `/cart` — App Router migration, Batch 5. Direct lift
 * of the visible body from the former `pages/cart/index.tsx` minus the
 * `<Head>` (moved to `metadata` on the server file).
 */
import React from 'react';
import Link from 'next/link';
import {ConfigProvider} from 'antd';
import staticTheme from '@client/features/Themes/themeConfig';
import CartLineItems from '@client/modules/Checkout/CartLineItems';
import CartSummary from '@client/modules/Checkout/CartSummary';
import {EItemType} from '@enums/EItemType';

// Locked modules expect an `{item}` prop carrying the section type — we
// synthesise the minimum-shape items so the locked modules parse cleanly.
const linePlaceholderItem = {type: EItemType.CartLineItems, content: ''};
const summaryPlaceholderItem = {type: EItemType.CartSummary, content: ''};

const CartView: React.FC = () => {
    return (
        <ConfigProvider theme={staticTheme}>
            <main
                data-testid="page-cart"
                data-system-key="cart"
                style={{background: '#eaeded', minHeight: '100vh', padding: '24px 16px 80px'}}
            >
                <div
                    style={{
                        maxWidth: 1500,
                        margin: '0 auto',
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0, 1fr) 300px',
                        gap: 16,
                        alignItems: 'flex-start',
                    }}
                >
                    <CartLineItems item={linePlaceholderItem as never}/>
                    <CartSummary item={summaryPlaceholderItem as never}/>
                </div>
                <div style={{maxWidth: 1500, margin: '16px auto 0'}}>
                    <Link href="/products" style={{color: '#007185'}}>← Continue shopping</Link>
                </div>
            </main>
        </ConfigProvider>
    );
};

export default CartView;
