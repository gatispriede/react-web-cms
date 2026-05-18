'use client';
/**
 * Client view for `/docs/[slug]` — App Router migration, Batch 6.
 * Direct lift of the visible chrome from `pages/docs/[slug].tsx`.
 */
import React, {useEffect, useRef} from 'react';
import Link from 'next/link';
import {Button, ConfigProvider, Typography} from 'antd';
import {useT} from 'next-i18next/client';
import staticTheme from '@client/features/Themes/themeConfig';
import {buildThemeConfig} from '@client/features/Themes/buildThemeConfig';
import {applyThemeCssVars} from '@client/features/Themes/applyThemeCssVars';
import {sanitizeHtml} from '@utils/sanitize';
import Logo from '@client/features/Logo/Logo';
import SiteFooter from '@client/features/Footer/SiteFooter';
import type {IFooterConfig} from '@interfaces/IFooter';

interface Props {
    title: string;
    html: string;
    themeTokens: unknown;
    footer: IFooterConfig;
    navPages: {page: string}[];
}

const DocSlugView: React.FC<Props> = ({title, html, themeTokens, footer, navPages}) => {
    const {t} = useT('common');
    const ref = useRef<HTMLDivElement | null>(null);
    useEffect(() => { if (themeTokens) applyThemeCssVars(themeTokens as Parameters<typeof applyThemeCssVars>[0]); }, [themeTokens]);
    const themeConfig = themeTokens ? buildThemeConfig(themeTokens as Parameters<typeof buildThemeConfig>[0]) : staticTheme;

    useEffect(() => {
        if (ref.current && html) ref.current.innerHTML = sanitizeHtml(html);
    }, [html]);

    return (
        <ConfigProvider theme={themeConfig}>
            <div style={{maxWidth: 800, margin: '0 auto', padding: '24px 20px 80px'}}>
                <Logo t={t as any} admin={false}/>
                <div style={{marginTop: 16}}>
                    <Link href="/docs"><Button type="link">{t('All docs') as string}</Button></Link>
                </div>
                <Typography.Title level={1} style={{marginTop: 12}}>{title}</Typography.Title>
                <div ref={ref} className="rich-text"/>
            </div>
            <SiteFooter config={footer} pages={navPages} hasPosts={false} blogEnabled={false} t={t as any}/>
        </ConfigProvider>
    );
};

export default DocSlugView;
