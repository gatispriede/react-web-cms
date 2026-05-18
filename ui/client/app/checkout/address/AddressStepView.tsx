'use client';
/**
 * Client view for `/checkout/address` — App Router migration, Batch 5.
 *
 * Mechanical lift of the visible chrome from the former
 * `pages/checkout/address.tsx`. Wraps the dispatched `checkout-address`
 * sections in antd `ConfigProvider` + `CheckoutShell` + the cardised
 * inner panel.
 */
import React from 'react';
import {ConfigProvider} from 'antd';
import {useT} from 'next-i18next/client';
import staticTheme from '@client/features/Themes/themeConfig';
import {type ISystemPageSnapshot} from '@client/lib/systemPage/loadSystemPage';
import SystemPageDispatch from '@client/lib/systemPage/SystemPageDispatch';
import CheckoutShell from '@client/components/Checkout/CheckoutShell';

interface AddressStepViewProps {
    systemPage: ISystemPageSnapshot | null;
}

const AddressStepView: React.FC<AddressStepViewProps> = ({systemPage}) => {
    const {t} = useT('common');
    const {t: tApp} = useT('app');
    return (
        <ConfigProvider theme={staticTheme}>
            <CheckoutShell testId="page-checkout-address">
                <div style={{background: '#fff', borderRadius: 8, padding: 24, boxShadow: '0 1px 2px rgba(0,0,0,0.04)'}}>
                    {systemPage
                        ? <SystemPageDispatch systemKey="checkout-address" sections={systemPage.defaultSections} t={t} tApp={tApp}/>
                        : null}
                </div>
            </CheckoutShell>
        </ConfigProvider>
    );
};

export default AddressStepView;
