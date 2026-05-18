'use client';
/**
 * Client view for `/welcome` — App Router migration, Batch 6.
 */
import React from 'react';
import {ConfigProvider} from 'antd';
import {useT} from 'next-i18next/client';
import staticTheme from '@client/features/Themes/themeConfig';
import {type ISystemPageSnapshot} from '@client/lib/systemPage/loadSystemPage';
import SystemPageDispatch from '@client/lib/systemPage/SystemPageDispatch';

const WelcomeView: React.FC<{systemPage: ISystemPageSnapshot | null}> = ({systemPage}) => {
    const {t} = useT('translation');
    const {t: tApp} = useT('app');
    return (
        <ConfigProvider theme={staticTheme}>
            <main id="main" data-testid="page-welcome">
                {systemPage
                    ? <SystemPageDispatch systemKey="marketing-landing" sections={systemPage.defaultSections} t={t} tApp={tApp}/>
                    : null}
            </main>
        </ConfigProvider>
    );
};

export default WelcomeView;
