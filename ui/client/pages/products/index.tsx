import React, {useEffect, useMemo, useState} from 'react';
import {GetStaticProps} from 'next';
import {gqlFetch} from '@client/lib/gqlFetch';
import Link from 'next/link';
import Head from 'next/head';
import {ConfigProvider, Card, Col, Empty, Row, Select, Space, Tag, Typography} from 'antd';
import {serverSideTranslations} from 'next-i18next/pages/serverSideTranslations';
import {useTranslation} from 'next-i18next/pages';
import staticTheme from '@client/features/Themes/themeConfig';
import {buildThemeConfig} from '@client/features/Themes/buildThemeConfig';
import {applyThemeCssVars} from '@client/features/Themes/applyThemeCssVars';
import {IProduct} from '@interfaces/IProduct';
import Logo from '@client/features/Logo/Logo';
import CartIcon from '../../components/cart/CartIcon';
import RevealOnScroll from '@client/lib/RevealOnScroll';
import SiteFooter from '@client/features/Footer/SiteFooter';
import {DEFAULT_FOOTER, IFooterConfig} from '@interfaces/IFooter';

interface Props {
    products: IProduct[];
    themeTokens: any | null;
    footer: IFooterConfig;
    pages: {page: string}[];
}

const formatPrice = (amount: number, currency: string) => {
    try {
        return new Intl.NumberFormat(undefined, {style: 'currency', currency: currency || 'EUR'}).format((amount ?? 0) / 100);
    } catch {
        return `${(amount ?? 0) / 100} ${currency}`;
    }
};

const ProductsIndex = ({products, themeTokens, footer, pages}: Props) => {
    const {t} = useTranslation('common');
    useEffect(() => { if (themeTokens) applyThemeCssVars(themeTokens); }, [themeTokens]);
    const themeConfig = themeTokens ? buildThemeConfig(themeTokens) : staticTheme;

    const [category, setCategory] = useState<string | undefined>(undefined);

    const categories = useMemo(() => {
        const set = new Set<string>();
        for (const p of products) for (const c of (p.categories ?? [])) set.add(c);
        return [...set].sort();
    }, [products]);

    const visible = useMemo(() => {
        if (!category) return products;
        return products.filter(p => (p.categories ?? []).includes(category));
    }, [products, category]);

    return (
        <ConfigProvider theme={themeConfig}>
            <Head>
                <title>{t('Products')}</title>
            </Head>
            <div style={{maxWidth: 1100, margin: '0 auto', padding: 24}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <Logo t={t} admin={false}/>
                    <CartIcon/>
                </div>
                <Space style={{marginTop: 24, marginBottom: 16}} align="center" wrap>
                    <Typography.Title level={1} style={{margin: 0}}>{t('Products')}</Typography.Title>
                    {categories.length > 0 && (
                        <Select
                            allowClear
                            placeholder={t('Filter by category')}
                            style={{minWidth: 200}}
                            value={category}
                            onChange={setCategory}
                            options={categories.map(c => ({value: c, label: c}))}
                        />
                    )}
                </Space>
                {visible.length === 0 && <Empty description={t('No products available yet.')}/>}
                <Row gutter={[16, 16]}>
                    {visible.map((p, i) => (
                        <Col xs={24} md={12} lg={8} key={p.id}>
                            <RevealOnScroll delay={i * 60}>
                                <Link href={`/products/${p.slug}`} style={{textDecoration: 'none'}}>
                                    <Card
                                        className="product-card"
                                        hoverable
                                        cover={p.images?.[0] ? (
                                            <img src={p.images[0]} alt={p.title} style={{height: 220, objectFit: 'cover'}}/>
                                        ) : undefined}
                                    >
                                        <Card.Meta
                                            title={p.title}
                                            description={
                                                <Space orientation="vertical" size={6} style={{width: '100%'}}>
                                                    <Typography.Text strong>{formatPrice(p.price, p.currency)}</Typography.Text>
                                                    {p.stock === 0 && <Tag color="red">{t('Out of stock')}</Tag>}
                                                    {(p.categories ?? []).length > 0 && (
                                                        <Space size={4} wrap>
                                                            {(p.categories ?? []).slice(0, 4).map(c => <Tag key={c}>{c}</Tag>)}
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
            <SiteFooter config={footer} pages={pages} hasPosts={false} t={t as any}/>
        </ConfigProvider>
    );
};

export const getStaticProps: GetStaticProps<Props> = async ({locale}) => {
    let products: IProduct[] = [];
    let themeTokens: any | null = null;
    let footer: IFooterConfig = {...DEFAULT_FOOTER};
    let pages: {page: string}[] = [];
    const data = await gqlFetch<{mongo: {getProducts: string; getActiveTheme: string | null; getFooter: string; getNavigationCollection: {page: string}[]}}>(
        `{ mongo { getProducts(limit: 200) getActiveTheme getFooter getNavigationCollection { page } } }`,
    );
    try {
        products = data?.mongo?.getProducts ? JSON.parse(data.mongo.getProducts) : [];
        const themeRaw = data?.mongo?.getActiveTheme;
        if (themeRaw) themeTokens = JSON.parse(themeRaw).tokens ?? null;
        if (data?.mongo?.getFooter) footer = JSON.parse(data.mongo.getFooter);
        pages = (data?.mongo?.getNavigationCollection ?? []).map(p => ({page: p.page}));
    } catch (err) {
        console.error('[products/index] parse error:', err);
    }
    return {
        props: {
            products,
            themeTokens,
            footer,
            pages,
            ...(await serverSideTranslations(locale ?? 'en', ['common', 'app'])),
        },
        revalidate: 3600,
    };
};

export default ProductsIndex;
