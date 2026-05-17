'use client';
/**
 * Client view for `/account/profile` — module-compose pass 2026-05-17.
 * Renders the `account-profile` system page (single locked
 * `AccountProfileForm` block). Form I/O lives in the smart wrapper at
 * `ui/client/modules/_AccountPageModules/wrappers.tsx`.
 */
import React from 'react';
import {ConfigProvider} from 'antd';
import {useT} from 'next-i18next/client';
import staticTheme from '@client/features/Themes/themeConfig';
import {type ISystemPageSnapshot} from '@client/lib/systemPage/loadSystemPage';
import SystemPageDispatch from '@client/lib/systemPage/SystemPageDispatch';

interface AccountProfileViewProps {
    systemPage: ISystemPageSnapshot | null;
}

const AccountProfileView: React.FC<AccountProfileViewProps> = ({systemPage}) => {
    const {t} = useT('translation');
    const {t: tApp} = useT('app');
    return (
        <ConfigProvider theme={staticTheme}>
            <main data-testid="page-account-profile" style={{maxWidth: 720, margin: '0 auto', padding: '32px 20px 80px'}}>
                {systemPage
                    ? <SystemPageDispatch systemKey="account-profile" sections={systemPage.defaultSections} t={t} tApp={tApp}/>
                    : null}
            </main>
        </ConfigProvider>
    );
};

export default AccountProfileView;
