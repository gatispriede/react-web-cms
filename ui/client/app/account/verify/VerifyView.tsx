'use client';
/**
 * Client view for `/account/verify` — module-compose pass 2026-05-17.
 * Renders the `account-verify` system page (single locked
 * `CustomerVerifyConfirm` block). Token + callbackUrl flow through
 * the smart wrapper via `useSearchParams()`.
 */
import React from 'react';
import {ConfigProvider} from 'antd';
import {useT} from 'next-i18next/client';
import staticTheme from '@client/features/Themes/themeConfig';
import {type ISystemPageSnapshot} from '@client/lib/systemPage/loadSystemPage';
import SystemPageDispatch from '@client/lib/systemPage/SystemPageDispatch';

interface VerifyViewProps {
    systemPage: ISystemPageSnapshot | null;
}

const VerifyView: React.FC<VerifyViewProps> = ({systemPage}) => {
    const {t} = useT('translation');
    const {t: tApp} = useT('app');
    return (
        <ConfigProvider theme={staticTheme}>
            <main
                data-testid="page-account-verify"
                style={{minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: '#f5f5f5'}}
            >
                <div style={{width: '100%', maxWidth: 420, background: '#fff', padding: 24, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.08)'}}>
                    {systemPage
                        ? <SystemPageDispatch systemKey="account-verify" sections={systemPage.defaultSections} t={t} tApp={tApp}/>
                        : null}
                </div>
            </main>
        </ConfigProvider>
    );
};

export default VerifyView;
