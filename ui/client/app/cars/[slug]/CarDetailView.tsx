'use client';
/**
 * Client view for `/cars/[slug]` — App Router migration, Batch 5.
 *
 * Lift of the visible chrome from the former `pages/cars/[slug].tsx`:
 * antd `ConfigProvider` + `<main>` wrapper + the single
 * `<SystemPageDispatch systemKey="cars-detail">` call. The locked
 * `CarDetail` smart-wrapper module reads the `[slug]` param via the
 * client router and fetches the car itself.
 */
import React from 'react';
import {ConfigProvider} from 'antd';
import {useT} from 'next-i18next/client';
import staticTheme from '@client/features/Themes/themeConfig';
import {type ISystemPageSnapshot} from '@client/lib/systemPage/loadSystemPage';
import SystemPageDispatch from '@client/lib/systemPage/SystemPageDispatch';

interface CarDetailViewProps {
    systemPage: ISystemPageSnapshot | null;
}

const CarDetailView: React.FC<CarDetailViewProps> = ({systemPage}) => {
    const {t} = useT('translation');
    const {t: tApp} = useT('app');
    return (
        <ConfigProvider theme={staticTheme}>
            <main data-testid="page-cars-detail" style={{padding: '24px 16px 80px'}}>
                {systemPage
                    ? <SystemPageDispatch systemKey="cars-detail" sections={systemPage.defaultSections} t={t} tApp={tApp}/>
                    : null}
            </main>
        </ConfigProvider>
    );
};

export default CarDetailView;
