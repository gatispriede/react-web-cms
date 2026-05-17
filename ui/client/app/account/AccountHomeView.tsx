'use client';
/**
 * Client view for `/account` — module-compose pass 2026-05-17.
 *
 * Previously rendered hand-coded profile + addresses cards from
 * `pages/account/index.tsx`. Now delegates to `SystemPageDispatch` with
 * `systemKey="account-home"`, which mounts the locked
 * `AccountDashboardGridHost` smart wrapper alongside any operator-
 * composed marketing sections.
 *
 * The bespoke sign-out + profile-summary controls that lived here moved
 * to `/account/settings` (where the rest of the profile editing lives).
 */
import React from 'react';
import {ConfigProvider} from 'antd';
import {useT} from 'next-i18next/client';
import staticTheme from '@client/features/Themes/themeConfig';
import {type ISystemPageSnapshot} from '@client/lib/systemPage/loadSystemPage';
import SystemPageDispatch from '@client/lib/systemPage/SystemPageDispatch';

interface AccountHomeViewProps {
    systemPage: ISystemPageSnapshot | null;
}

const AccountHomeView: React.FC<AccountHomeViewProps> = ({systemPage}) => {
    const {t} = useT('translation');
    const {t: tApp} = useT('app');
    return (
        <ConfigProvider theme={staticTheme}>
            <main data-testid="page-account-home" style={{maxWidth: 880, margin: '0 auto', padding: '32px 20px 80px'}}>
                {systemPage
                    ? <SystemPageDispatch systemKey="account-home" sections={systemPage.defaultSections} t={t} tApp={tApp}/>
                    : null}
            </main>
        </ConfigProvider>
    );
};

export default AccountHomeView;
