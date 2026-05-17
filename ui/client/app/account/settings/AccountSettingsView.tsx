'use client';
/**
 * Client view for `/account/settings` — module-compose pass 2026-05-17.
 *
 * Renders the `account-settings` system page (single locked
 * `AccountSettingsLayout` block) and forwards the SSR-resolved
 * `{me, activeTab, hiddenTabs, enabled}` shape through the
 * SystemPageDispatch `pageProps` channel. The locked smart wrapper
 * reads from `pageProps` so there's no client refetch flash.
 */
import React from 'react';
import {ConfigProvider} from 'antd';
import {useT} from 'next-i18next/client';
import staticTheme from '@client/features/Themes/themeConfig';
import {type ISystemPageSnapshot} from '@client/lib/systemPage/loadSystemPage';
import SystemPageDispatch from '@client/lib/systemPage/SystemPageDispatch';
import type {AccountSettingsTab} from '@client/components/AccountSettings/types';
import type {IUser} from '@interfaces/IUser';

interface AccountSettingsViewProps {
    systemPage: ISystemPageSnapshot | null;
    me: IUser;
    activeTab: AccountSettingsTab;
    hiddenTabs: AccountSettingsTab[];
    enabled: boolean;
}

const AccountSettingsView: React.FC<AccountSettingsViewProps> = ({systemPage, me, activeTab, hiddenTabs, enabled}) => {
    const {t} = useT('translation');
    const {t: tApp} = useT('app');
    const pageProps = {me, activeTab, hiddenTabs, enabled};
    return (
        <ConfigProvider theme={staticTheme}>
            <div data-testid="page-account-settings">
                {systemPage
                    ? <SystemPageDispatch systemKey="account-settings" sections={systemPage.defaultSections} t={t} tApp={tApp} pageProps={pageProps}/>
                    : null}
            </div>
        </ConfigProvider>
    );
};

export default AccountSettingsView;
