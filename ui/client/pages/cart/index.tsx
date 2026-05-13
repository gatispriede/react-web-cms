/**
 * `/cart` — system-page-backed thin loader (Phase 1.D-c).
 *
 * Renders entirely via `<SystemPageDispatch>` over the registered
 * `cart` system-page sections. The legacy hand-coded UI (line items,
 * subtotal, proceed button) moves into the locked
 * `CartLineItems` / `CartSummary` / `CartActions` modules — those
 * become responsible for binding to `useCart()` and wiring the
 * proceed CTA. Until that wiring lands the modules render their
 * placeholder shells.
 */
import React from 'react';
import Head from 'next/head';
import {ConfigProvider} from 'antd';
import {useTranslation} from 'next-i18next/pages';
import staticTheme from '@client/features/Themes/themeConfig';
import type {GetServerSideProps} from 'next';
import {gatePath} from '@client/lib/loaders/applyPublicGates';
import {loadSystemPageSnapshot, type ISystemPageSnapshot} from '@client/lib/systemPage/loadSystemPage';
import SystemPageDispatch from '@client/lib/systemPage/SystemPageDispatch';

interface CartPageProps {
    systemPage: ISystemPageSnapshot | null;
}

const CartPage: React.FC<CartPageProps> = ({systemPage}) => {
    const {t} = useTranslation('translation');
    const {t: tApp} = useTranslation('app');
    return (
        <ConfigProvider theme={staticTheme}>
            <Head><title>Your cart</title></Head>
            <main data-testid="page-cart" style={{maxWidth: 960, margin: '0 auto', padding: '32px 20px 80px'}}>
                {systemPage
                    ? <SystemPageDispatch systemKey="cart" sections={systemPage.defaultSections} t={t} tApp={tApp}/>
                    : null}
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
