import React from 'react';
import {GetStaticProps} from 'next';
import {gqlFetch} from '../../lib/gqlFetch';
import Link from 'next/link';
import Head from 'next/head';
import {ConfigProvider, Card, Col, Empty, Row, Space, Tag, Typography} from 'antd';
import {serverSideTranslations} from 'next-i18next/serverSideTranslations';
import {useTranslation} from 'next-i18next';
import staticTheme from '../../theme/themeConfig';
import {buildThemeConfig} from '../../theme/buildThemeConfig';
import {applyThemeCssVars} from '../../theme/applyThemeCssVars';
import {IPost} from '../../../Interfaces/IPost';
import Logo from '../../components/common/Logo';
import RevealOnScroll from '../../components/common/RevealOnScroll';
import SiteFooter from '../../components/common/SiteFooter';
import {DEFAULT_FOOTER, IFooterConfig} from '../../../Interfaces/IFooter';

interface Props {
    posts: IPost[];
    themeTokens: any | null;
    footer: IFooterConfig;
    pages: {page: string}[];
}

const BlogIndex = ({posts, themeTokens, footer, pages}: Props) => {
    const {t} = useTranslation('common');
    if (typeof window !== 'undefined' && themeTokens) applyThemeCssVars(themeTokens);
    const themeConfig = themeTokens ? buildThemeConfig(themeTokens) : staticTheme;

    return (
        <ConfigProvider theme={themeConfig}>
            <Head>
                <title>{t('Blog')}</title>
            </Head>
            <div style={{maxWidth: 1100, margin: '0 auto', padding: 24}}>
                <Logo t={t} admin={false}/>
                <Typography.Title level={1} style={{marginTop: 24}}>{t('Writing')}</Typography.Title>
                {posts.length === 0 && <Empty description={t('No posts published yet.')}/>}
                <Row gutter={[16, 16]}>
                    {posts.map((p, i) => (
                        <Col xs={24} md={12} lg={8} key={p.id}>
                            <RevealOnScroll delay={i * 60}>
                                <Link href={`/blog/${p.slug}`} style={{textDecoration: 'none'}}>
                                    <Card
                                        className="blog-card"
                                        hoverable
                                        cover={p.coverImage ? <img src={p.coverImage} alt={p.title} style={{height: 180, objectFit: 'cover'}}/> : undefined}
                                    >
                                        <Card.Meta
                                            title={p.title}
                                            description={
                                                <Space direction="vertical" size={6} style={{width: '100%'}}>
                                                    <span style={{fontSize: '.85em', opacity: .65}}>
                                                        {p.publishedAt ? new Date(p.publishedAt).toLocaleDateString() : ''}
                                                        {p.author ? ` · ${p.author}` : ''}
                                                    </span>
                                                    {p.excerpt && <span>{p.excerpt}</span>}
                                                    {p.tags.length > 0 && (
                                                        <Space size={4} wrap>
                                                            {p.tags.slice(0, 4).map(tag => <Tag key={tag}>{tag}</Tag>)}
                                                        </Space>
                                                    )}
                                                </Space>
                                            }
                                        />
                                    </Card>
                                </Link>
                            </RevealOnScroll>
                        </Col>
                    ))}
                </Row>
            </div>
            <SiteFooter config={footer} pages={pages} hasPosts={posts.length > 0} blogEnabled={true} t={t as any}/>
        </ConfigProvider>
    );
};

export const getStaticProps: GetStaticProps<Props> = async ({locale}) => {
    let posts: IPost[] = [];
    let themeTokens: any | null = null;
    let footer: IFooterConfig = {...DEFAULT_FOOTER};
    let pages: {page: string}[] = [];
    let blogEnabled = true;
    const data = await gqlFetch<{mongo: {getPosts: string; getActiveTheme: string | null; getFooter: string; getNavigationCollection: {page: string}[]; getSiteFlags: string}}>(
        `{ mongo { getPosts(limit: 50) getActiveTheme getFooter getNavigationCollection { page } getSiteFlags } }`,
    );
    try {
        posts = data?.mongo?.getPosts ? JSON.parse(data.mongo.getPosts) : [];
        const themeRaw = data?.mongo?.getActiveTheme;
        if (themeRaw) themeTokens = JSON.parse(themeRaw).tokens ?? null;
        if (data?.mongo?.getFooter) footer = JSON.parse(data.mongo.getFooter);
        pages = (data?.mongo?.getNavigationCollection ?? []).map(p => ({page: p.page}));
        if (data?.mongo?.getSiteFlags) blogEnabled = JSON.parse(data.mongo.getSiteFlags).blogEnabled !== false;
    } catch (err) {
        console.error('[blog/index] parse error:', err);
    }
    if (!blogEnabled) return {notFound: true, revalidate: 60};
    return {
        props: {
            posts,
            themeTokens,
            footer,
            pages,
            ...(await serverSideTranslations(locale ?? 'en', ['common', 'app'])),
        },
        revalidate: 60,
    };
};

export default BlogIndex;
