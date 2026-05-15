/**
 * `/checkout/payment` — Amazon-style shell + SystemPageDispatch.
 */
import React from 'react';
import Head from 'next/head';
import {ConfigProvider} from 'antd';
import {useTranslation} from 'next-i18next/pages';
import type {GetServerSideProps} from 'next';
import staticTheme from '@client/features/Themes/themeConfig';
import {loadSystemPageSnapshot, type ISystemPageSnapshot} from '@client/lib/systemPage/loadSystemPage';
import SystemPageDispatch from '@client/lib/systemPage/SystemPageDispatch';
import CheckoutShell from '@client/components/Checkout/CheckoutShell';

const PaymentStep: React.FC<{systemPage: ISystemPageSnapshot | null}> = ({systemPage}) => {
    const {t} = useTranslation('common');
    const {t: tApp} = useTranslation('app');
    return (
        <ConfigProvider theme={staticTheme}>
            <Head><title>Payment</title></Head>
            <CheckoutShell testId="page-checkout-payment">
                <div style={{background: '#fff', borderRadius: 8, padding: 24, boxShadow: '0 1px 2px rgba(0,0,0,0.04)'}}>
                    {systemPage
                        ? <SystemPageDispatch systemKey="checkout-payment" sections={systemPage.defaultSections} t={t} tApp={tApp}/>
                        : null}
                </div>
            </CheckoutShell>
        </ConfigProvider>
    );
};

export const getServerSideProps: GetServerSideProps<{systemPage: ISystemPageSnapshot | null}> = async () => {
    const systemPage = loadSystemPageSnapshot('checkout-payment');
    return {props: {systemPage}};
};

export default PaymentStep;
