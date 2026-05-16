'use client';
/**
 * Client view for `/checkout/confirmation/[id]` — App Router migration,
 * Batch 5. The `[id]` route param is read inside the dispatched modules
 * (e.g. `OrderSummary`) via `useParams()`; the view itself just renders
 * the chrome.
 */
import React from 'react';
import {ConfigProvider} from 'antd';
import {useT} from 'next-i18next/client';
import staticTheme from '@client/features/Themes/themeConfig';
import {type ISystemPageSnapshot} from '@client/lib/systemPage/loadSystemPage';
import SystemPageDispatch from '@client/lib/systemPage/SystemPageDispatch';

interface ConfirmationViewProps {
    systemPage: ISystemPageSnapshot | null;
}

const ConfirmationView: React.FC<ConfirmationViewProps> = ({systemPage}) => {
    const {t} = useT('common');
    const {t: tApp} = useT('app');
    return (
        <ConfigProvider theme={staticTheme}>
            <main data-testid="page-checkout-confirmation" style={{maxWidth: 720, margin: '0 auto', padding: '32px 20px 80px'}}>
                {systemPage
                    ? <SystemPageDispatch systemKey="checkout-confirmation" sections={systemPage.defaultSections} t={t} tApp={tApp}/>
                    : null}
            </main>
        </ConfigProvider>
    );
};

export default ConfirmationView;
