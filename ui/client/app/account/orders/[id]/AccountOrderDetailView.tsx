'use client';
/**
 * Client view for `/account/orders/[id]` — App Router migration, Batch 5.
 */
import React from 'react';
import {ConfigProvider} from 'antd';
import {useT} from 'next-i18next/client';
import staticTheme from '@client/features/Themes/themeConfig';
import {type ISystemPageSnapshot} from '@client/lib/systemPage/loadSystemPage';
import SystemPageDispatch from '@client/lib/systemPage/SystemPageDispatch';

interface AccountOrderDetailViewProps {
    systemPage: ISystemPageSnapshot | null;
}

const AccountOrderDetailView: React.FC<AccountOrderDetailViewProps> = ({systemPage}) => {
    const {t} = useT('translation');
    const {t: tApp} = useT('app');
    return (
        <ConfigProvider theme={staticTheme}>
            <main data-testid="page-account-order-detail" style={{maxWidth: 720, margin: '0 auto', padding: '32px 20px 80px'}}>
                {systemPage
                    ? <SystemPageDispatch systemKey="account-order-detail" sections={systemPage.defaultSections} t={t} tApp={tApp}/>
                    : null}
            </main>
        </ConfigProvider>
    );
};

export default AccountOrderDetailView;
