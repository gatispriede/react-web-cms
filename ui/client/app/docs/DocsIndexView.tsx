'use client';
/**
 * Client view for `/docs` — App Router migration, Batch 6.
 * Direct lift of the visible chrome from `pages/docs/index.tsx`.
 */
import React, {useEffect} from 'react';
import Link from 'next/link';
import {Card, Col, ConfigProvider, Empty, Row, Typography} from 'antd';
import {useT} from 'next-i18next/client';
import staticTheme from '@client/features/Themes/themeConfig';
import {buildThemeConfig} from '@client/features/Themes/buildThemeConfig';
import {applyThemeCssVars} from '@client/features/Themes/applyThemeCssVars';
import Logo from '@client/features/Logo/Logo';
import RevealOnScroll from '@client/lib/RevealOnScroll';
import SiteFooter from '@client/features/Footer/SiteFooter';
import type {IFooterConfig} from '@interfaces/IFooter';

interface DocPage {
    page: string;
    slug: string;
    title: string;
}

interface Props {
    docs: DocPage[];
    themeTokens: unknown;
    footer: IFooterConfig;
    navPages: {page: string}[];
}

const DocsIndexView: React.FC<Props> = ({docs, themeTokens, footer, navPages}) => {
    const {t} = useT('common');
    useEffect(() => { if (themeTokens) applyThemeCssVars(themeTokens as Parameters<typeof applyThemeCssVars>[0]); }, [themeTokens]);
    const themeConfig = themeTokens ? buildThemeConfig(themeTokens as Parameters<typeof buildThemeConfig>[0]) : staticTheme;

    return (
        <ConfigProvider theme={themeConfig}>
            <div style={{maxWidth: 1100, margin: '0 auto', padding: 24}}>
                <Logo t={t as any} admin={false}/>
                <Typography.Title level={1} style={{marginTop: 24}}>{t('Documentation') as string}</Typography.Title>
                <Typography.Paragraph type="secondary">
                    Setup, feature reference, and the AI / MCP authoring workflow.
                </Typography.Paragraph>
                {docs.length === 0 && (
                    <Empty description="No docs pages imported yet. Apply docs-bundle.json from the Bundle pane."/>
                )}
                <Row gutter={[16, 16]}>
                    {docs.map((d, i) => (
                        <Col xs={24} md={12} lg={8} key={d.slug}>
                            <RevealOnScroll delay={i * 40}>
                                <Link href={`/docs/${d.slug}`} style={{textDecoration: 'none'}}>
                                    <Card hoverable>
                                        <Card.Meta
                                            title={d.title}
                                            description={`/docs/${d.slug}`}
                                        />
                                    </Card>
                                </Link>
                            </RevealOnScroll>
                        </Col>
                    ))}
                </Row>
            </div>
            <SiteFooter config={footer} pages={navPages} hasPosts={false} blogEnabled={false} t={t as any}/>
        </ConfigProvider>
    );
};

export default DocsIndexView;
