'use client';
/**
 * Client view for `/cars` — App Router migration, Batch 5.
 *
 * Mechanical lift of the visible chrome from the former
 * `pages/cars/index.tsx`: antd `ConfigProvider` + `<main>` wrapper +
 * the single `<SystemPageDispatch systemKey="cars-index">` call. The
 * route file (`app/cars/page.tsx`) is a pure Server Component that
 * loads the system-page snapshot and hands it down.
 */
import React from 'react';
import {ConfigProvider} from 'antd';
import {useT} from 'next-i18next/client';
import staticTheme from '@client/features/Themes/themeConfig';
import {type ISystemPageSnapshot} from '@client/lib/systemPage/loadSystemPage';
import SystemPageDispatch from '@client/lib/systemPage/SystemPageDispatch';

interface CarsIndexViewProps {
    systemPage: ISystemPageSnapshot | null;
}

const CarsIndexView: React.FC<CarsIndexViewProps> = ({systemPage}) => {
    const {t} = useT('translation');
    const {t: tApp} = useT('app');
    return (
        <ConfigProvider theme={staticTheme}>
            <main data-testid="page-cars-index" style={{maxWidth: 1200, margin: '0 auto', padding: '24px 16px 80px'}}>
                {systemPage
                    ? <SystemPageDispatch systemKey="cars-index" sections={systemPage.defaultSections} t={t} tApp={tApp}/>
                    : null}
            </main>
        </ConfigProvider>
    );
};

export default CarsIndexView;
