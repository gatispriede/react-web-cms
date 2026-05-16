'use client';
/**
 * Client view for `/checkout/shipping` — App Router migration, Batch 5.
 */
import React from 'react';
import {ConfigProvider} from 'antd';
import {useT} from 'next-i18next/client';
import staticTheme from '@client/features/Themes/themeConfig';
import {type ISystemPageSnapshot} from '@client/lib/systemPage/loadSystemPage';
import SystemPageDispatch from '@client/lib/systemPage/SystemPageDispatch';
import CheckoutShell from '@client/components/Checkout/CheckoutShell';

interface ShippingStepViewProps {
    systemPage: ISystemPageSnapshot | null;
}

const ShippingStepView: React.FC<ShippingStepViewProps> = ({systemPage}) => {
    const {t} = useT('common');
    const {t: tApp} = useT('app');
    return (
        <ConfigProvider theme={staticTheme}>
            <CheckoutShell testId="page-checkout-shipping">
                <div style={{background: '#fff', borderRadius: 8, padding: 24, boxShadow: '0 1px 2px rgba(0,0,0,0.04)'}}>
                    {systemPage
                        ? <SystemPageDispatch systemKey="checkout-shipping" sections={systemPage.defaultSections} t={t} tApp={tApp}/>
                        : null}
                </div>
            </CheckoutShell>
        </ConfigProvider>
    );
};

export default ShippingStepView;
