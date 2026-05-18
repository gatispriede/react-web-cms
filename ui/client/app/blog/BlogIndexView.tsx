'use client';
/**
 * Client view for the blog index — App Router migration, Batch 4.
 *
 * Mechanical lift of the render body of the former `pages/blog/index.tsx`
 * into a `'use client'` component so the route file (`app/blog/page.tsx`)
 * can stay a pure Server Component that does the data fetch. `antd`
 * `ConfigProvider`, `Typography`, the `applyThemeCssVars` `useEffect`,
 * and `useTranslation` (next-i18next/client) all require the browser
 * runtime — hence the boundary.
 *
 * Wire shape matches the Pages-Router `Props` interface 1:1 so the
 * Server-Component port stays mechanical.
 */
import React, {useEffect} from 'react';
import {ConfigProvider, Typography} from 'antd';
import {useT} from 'next-i18next/client';
import staticTheme from '@client/features/Themes/themeConfig';
import {buildThemeConfig} from '@client/features/Themes/buildThemeConfig';
import {applyThemeCssVars} from '@client/features/Themes/applyThemeCssVars';
import type {IPost} from '@interfaces/IPost';
import Logo from '@client/features/Logo/Logo';
import SiteFooter from '@client/features/Footer/SiteFooter';
import type {IFooterConfig} from '@interfaces/IFooter';
import type {ISystemPageSnapshot} from '@client/lib/systemPage/loadSystemPage';
import SystemPageDispatch from '@client/lib/systemPage/SystemPageDispatch';

export interface BlogIndexViewProps {
    posts: IPost[];
    themeTokens: any | null;
    footer: IFooterConfig;
    pages: {page: string}[];
    systemPage: ISystemPageSnapshot | null;
}

const BlogIndexView: React.FC<BlogIndexViewProps> = ({posts, themeTokens, footer, pages, systemPage}) => {
    const {t} = useT('common');
    const {t: tDispatch} = useT('translation');
    const {t: tApp} = useT('app');
    useEffect(() => { if (themeTokens) applyThemeCssVars(themeTokens); }, [themeTokens]);
    const themeConfig = themeTokens ? buildThemeConfig(themeTokens) : staticTheme;

    return (
        <ConfigProvider theme={themeConfig}>
            <div style={{maxWidth: 1100, margin: '0 auto', padding: 24}}>
                <Logo t={t} admin={false}/>
                <Typography.Title level={1} style={{marginTop: 24}}>{t('Writing')}</Typography.Title>
                {systemPage
                    ? <SystemPageDispatch systemKey="blog-index" sections={systemPage.defaultSections} t={tDispatch} tApp={tApp}/>
                    : null}
            </div>
            <SiteFooter config={footer} pages={pages} hasPosts={posts.length > 0} blogEnabled={true} t={t as any}/>
        </ConfigProvider>
    );
};

export default BlogIndexView;
