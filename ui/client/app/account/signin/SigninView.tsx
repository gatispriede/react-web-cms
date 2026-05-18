'use client';
/**
 * Client view for `/account/signin` — App Router migration, Batch 6.
 * Mechanical lift of the visible chrome from `pages/account/signin.tsx`:
 * antd `ConfigProvider` + page wrap + `<SystemPageDispatch>`.
 */
import React from 'react';
import {ConfigProvider} from 'antd';
import {useT} from 'next-i18next/client';
import staticTheme from '@client/features/Themes/themeConfig';
import {type ISystemPageSnapshot} from '@client/lib/systemPage/loadSystemPage';
import SystemPageDispatch from '@client/lib/systemPage/SystemPageDispatch';

const SigninView: React.FC<{systemPage: ISystemPageSnapshot | null}> = ({systemPage}) => {
    const {t} = useT('translation');
    const {t: tApp} = useT('app');
    return (
        <ConfigProvider theme={staticTheme}>
            <main data-testid="page-account-signin" style={{minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 20px', background: '#f5f5f5'}}>
                {systemPage
                    ? <SystemPageDispatch systemKey="account-signin" sections={systemPage.defaultSections} t={t} tApp={tApp}/>
                    : null}
            </main>
        </ConfigProvider>
    );
};

export default SigninView;
