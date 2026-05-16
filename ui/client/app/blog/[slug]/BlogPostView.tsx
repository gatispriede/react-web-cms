'use client';
/**
 * Client view for a single blog post — App Router migration, Batch 4.
 *
 * Mechanical lift of the render body of the former `pages/blog/[slug].tsx`
 * into a `'use client'` component so the route file (`app/blog/[slug]/page.tsx`)
 * can stay a pure Server Component that does the data fetch. Same reasons
 * as `BlogIndexView` — antd `ConfigProvider`, `applyThemeCssVars`
 * `useEffect`, `useTranslation` need browser runtime.
 */
import React, {useEffect} from 'react';
import Link from 'next/link';
import {ArrowLeftOutlined} from '@client/lib/icons';
import {Button, ConfigProvider, Typography} from 'antd';
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

export interface BlogPostViewProps {
    post: IPost | null;
    themeTokens: any | null;
    footer: IFooterConfig;
    pages: {page: string}[];
    hasPosts: boolean;
    systemPage: ISystemPageSnapshot | null;
}

const BlogPostView: React.FC<BlogPostViewProps> = ({post, themeTokens, footer, pages, hasPosts, systemPage}) => {
    const {t} = useT('common');
    const {t: tDispatch} = useT('translation');
    const {t: tApp} = useT('app');
    useEffect(() => { if (themeTokens) applyThemeCssVars(themeTokens); }, [themeTokens]);
    const themeConfig = themeTokens ? buildThemeConfig(themeTokens) : staticTheme;

    if (!post) {
        return (
            <ConfigProvider theme={themeConfig}>
                <div style={{maxWidth: 720, margin: '0 auto', padding: 48}}>
                    <Typography.Title level={2}>{t('Post not found')}</Typography.Title>
                    <Link href="/blog">
                        <Button icon={<ArrowLeftOutlined/>}>{t('Back to blog')}</Button>
                    </Link>
                </div>
            </ConfigProvider>
        );
    }

    return (
        <ConfigProvider theme={themeConfig}>
            <div style={{maxWidth: 720, margin: '0 auto', padding: '24px 20px 80px'}}>
                <Logo t={t} admin={false}/>
                <div style={{marginTop: 16}}>
                    <Link href="/blog"><Button type="link" icon={<ArrowLeftOutlined/>}>{t('All posts')}</Button></Link>
                </div>
                {systemPage
                    ? <SystemPageDispatch systemKey="blog-post" sections={systemPage.defaultSections} t={tDispatch} tApp={tApp}/>
                    : null}
            </div>
            <SiteFooter config={footer} pages={pages} hasPosts={hasPosts} t={t as any}/>
        </ConfigProvider>
    );
};

export default BlogPostView;
