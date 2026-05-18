'use client';
/**
 * Client view for `/account/orders` — App Router migration, Batch 5.
 */
import React from 'react';
import {ConfigProvider} from 'antd';
import {useT} from 'next-i18next/client';
import staticTheme from '@client/features/Themes/themeConfig';
import {type ISystemPageSnapshot} from '@client/lib/systemPage/loadSystemPage';
import SystemPageDispatch from '@client/lib/systemPage/SystemPageDispatch';

interface AccountOrdersViewProps {
    systemPage: ISystemPageSnapshot | null;
}

const AccountOrdersView: React.FC<AccountOrdersViewProps> = ({systemPage}) => {
    const {t} = useT('translation');
    const {t: tApp} = useT('app');
    return (
        <ConfigProvider theme={staticTheme}>
            <main data-testid="page-account-orders" style={{maxWidth: 880, margin: '0 auto', padding: '32px 20px 80px'}}>
                {systemPage
                    ? <SystemPageDispatch systemKey="account-orders" sections={systemPage.defaultSections} t={t} tApp={tApp}/>
                    : null}
            </main>
        </ConfigProvider>
    );
};

export default AccountOrdersView;
