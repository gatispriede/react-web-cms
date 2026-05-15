/**
 * `/cart` — Amazon-style 2-column shopping basket.
 *
 * 2026-05-15: route now renders `CartLineItems` (left) + `CartSummary`
 * (right) directly in a two-column CSS grid. The system-page snapshot
 * is still loaded so the operator-composable section registry stays
 * intact for later, but the page no longer dispatches through it —
 * Amazon-style cart UX wants a fixed two-rail layout that doesn't
 * naturally fall out of the section-stacker.
 */
import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import {ConfigProvider} from 'antd';
import staticTheme from '@client/features/Themes/themeConfig';
import type {GetServerSideProps} from 'next';
import {gatePath} from '@client/lib/loaders/applyPublicGates';
import {loadSystemPageSnapshot, type ISystemPageSnapshot} from '@client/lib/systemPage/loadSystemPage';
import CartLineItems from '@client/modules/Checkout/CartLineItems';
import CartSummary from '@client/modules/Checkout/CartSummary';
import {EItemType} from '@enums/EItemType';

interface CartPageProps {
    systemPage: ISystemPageSnapshot | null;
}

// `EItemType` carries the locked section's module type — we don't use
// the section content directly, but we synthesise minimum-shape items
// for the locked modules so they parse cleanly.
const linePlaceholderItem = {type: EItemType.CartLineItems, content: ''};
const summaryPlaceholderItem = {type: EItemType.CartSummary, content: ''};

const CartPage: React.FC<CartPageProps> = () => {
    return (
        <ConfigProvider theme={staticTheme}>
            <Head><title>Shopping Basket</title></Head>
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

const inner: GetServerSideProps = gatePath('/cart') as GetServerSideProps;
export const getServerSideProps: GetServerSideProps<CartPageProps> = async (ctx) => {
    const res = await inner(ctx);
    const systemPage = loadSystemPageSnapshot('cart');
    if ('props' in res) {
        const props = await Promise.resolve(res.props as Record<string, unknown>);
        return {...res, props: {...props, systemPage} as never};
    }
    return res as never;
};

export default CartPage;
