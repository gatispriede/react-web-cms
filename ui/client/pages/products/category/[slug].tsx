/**
 * `/products/category/[slug]` — Phase 1.D-e category landing page.
 *
 * One level deep — operators get a real URL per category (e.g.
 * /products/category/gpu) which then surfaces only the products
 * carrying that category in their `categories[]` array. The product
 * detail page's category chips link here; the index page's "Browse
 * by category" chips link here.
 *
 * Reuses the same SSR data-load + card render as `/products` so the
 * visual identity stays consistent. Sort + search still apply.
 */
import React, {useEffect, useMemo, useState} from 'react';
import {GetServerSideProps} from 'next';
import {gqlFetch} from '@client/lib/gqlFetch';
import {gatePath} from '@client/lib/loaders/applyPublicGates';
import Link from 'next/link';
import Head from 'next/head';
import {ArrowLeftOutlined} from '@client/lib/icons';
import {Button, ConfigProvider, Card, Col, Empty, Input, Row, Select, Space, Tag, Typography} from 'antd';
import {serverSideTranslations} from 'next-i18next/pages/serverSideTranslations';
import {useTranslation} from 'next-i18next/pages';
import staticTheme from '@client/features/Themes/themeConfig';
import {buildThemeConfig} from '@client/features/Themes/buildThemeConfig';
import {applyThemeCssVars} from '@client/features/Themes/applyThemeCssVars';
import {IProduct} from '@interfaces/IProduct';
import Logo from '@client/features/Logo/Logo';
import CartIcon from '@client/features/Cart/CartIcon';
import SiteFooter from '@client/features/Footer/SiteFooter';
import {DEFAULT_FOOTER, IFooterConfig} from '@interfaces/IFooter';
import {productPrimaryImage} from '@client/lib/productImage';

interface Props {
    products: IProduct[];
    category: string;
    themeTokens: any | null;
    footer: IFooterConfig;
    pages: {page: string}[];
}

const formatPrice = (amount: number, currency: string) => {
    try {
        return new Intl.NumberFormat('en-US', {style: 'currency', currency: currency || 'EUR'}).format((amount ?? 0) / 100);
    } catch {
        return `${(amount ?? 0) / 100} ${currency}`;
    }
};

const CategoryPage = ({products, category, themeTokens, footer, pages}: Props) => {
    const {t} = useTranslation('common');
    useEffect(() => { if (themeTokens) applyThemeCssVars(themeTokens); }, [themeTokens]);
    const themeConfig = themeTokens ? buildThemeConfig(themeTokens) : staticTheme;

    const [query, setQuery] = useState<string>('');
    type SortKey = 'relevance' | 'price-asc' | 'price-desc' | 'title-asc' | 'newest';
    const [sort, setSort] = useState<SortKey>('relevance');

    const matchesQuery = (p: IProduct, q: string): boolean => {
        if (!q) return true;
        const hay: string[] = [p.title ?? '', p.sku ?? '', p.slug ?? ''];
        for (const c of (p.categories ?? [])) hay.push(c);
        for (const v of Object.values(p.attributes ?? {})) hay.push(String(v ?? ''));
        const lc = q.toLowerCase();
        return hay.some(s => s.toLowerCase().includes(lc));
    };

    const visible = useMemo(() => {
        let out = products;
        if (query.trim()) out = out.filter(p => matchesQuery(p, query.trim()));
        const sorted = [...out];
        switch (sort) {
            case 'price-asc':  sorted.sort((a, b) => (a.price ?? 0) - (b.price ?? 0)); break;
            case 'price-desc': sorted.sort((a, b) => (b.price ?? 0) - (a.price ?? 0)); break;
            case 'title-asc':  sorted.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? '')); break;
            case 'newest':     sorted.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')); break;
        }
        return sorted;
    }, [products, query, sort]);

    return (
        <ConfigProvider theme={themeConfig}>
            <Head><title>{category} — {t('Products')}</title></Head>
            <div style={{maxWidth: 1100, margin: '0 auto', padding: 24}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <Logo t={t} admin={false}/>
                    <CartIcon/>
                </div>
                <div style={{marginTop: 16}}>
                    <Link href="/products">
                        <Button type="link" icon={<ArrowLeftOutlined/>}>{t('All products')}</Button>
                    </Link>
                </div>
                <Space style={{marginTop: 8, marginBottom: 16}} align="center" wrap>
                    <Typography.Title level={1} style={{margin: 0, textTransform: 'capitalize'}}>{category}</Typography.Title>
                    <Tag color="blue">{products.length} {products.length === 1 ? t('product') : t('products')}</Tag>
                </Space>
                <Space style={{marginBottom: 16, width: '100%'}} wrap>
                    <Input.Search
                        data-testid="storefront-category-search"
                        placeholder={t('Search in this category…')}
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        allowClear
                        style={{minWidth: 280}}
                    />
                    <Select
                        data-testid="storefront-category-sort"
                        value={sort}
                        onChange={v => setSort(v as SortKey)}
                        style={{minWidth: 200}}
                        options={[
                            {value: 'relevance', label: t('Sort: Featured')},
                            {value: 'price-asc', label: t('Price: low → high')},
                            {value: 'price-desc', label: t('Price: high → low')},
                            {value: 'title-asc', label: t('Name: A → Z')},
                            {value: 'newest', label: t('Newest first')},
                        ]}
                    />
                </Space>
                {visible.length === 0 && <Empty description={t('No products in this category yet.')}/>}
                <Row gutter={[16, 16]}>
                    {visible.map(p => (
                        <Col xs={24} md={12} lg={8} key={p.id}>
                            <Link href={`/products/${p.slug}`} style={{textDecoration: 'none'}} data-testid={`storefront-category-product-card-${p.slug}`}>
                                <Card
                                    className="product-card"
                                    hoverable
                                    cover={<img src={productPrimaryImage(p)} alt={p.title} style={{height: 220, objectFit: 'cover'}}/>}
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
                        </Col>
                    ))}
                </Row>
            </div>
            <SiteFooter config={footer} pages={pages} hasPosts={false} t={t as any}/>
        </ConfigProvider>
    );
};

export const getServerSideProps: GetServerSideProps<Props> = gatePath('/products', async ({params, locale}: any) => {
    const slug = decodeURIComponent(String(params?.slug ?? '')).toLowerCase();
    let products: IProduct[] = [];
    let themeTokens: any | null = null;
    let footer: IFooterConfig = {...DEFAULT_FOOTER};
    let pages: {page: string}[] = [];
    const data = await gqlFetch<{mongo: {getProducts: string; getActiveTheme: string | null; getFooter: string; getNavigationCollection: {page: string}[]}}>(
        `{ mongo { getProducts(limit: 500) getActiveTheme getFooter getNavigationCollection { page } } }`,
    );
    try {
        const all: IProduct[] = data?.mongo?.getProducts ? JSON.parse(data.mongo.getProducts) : [];
        // Case-insensitive substring match — operator-friendly URLs
        // ("/products/category/CPU" and "/products/category/cpu" both
        // land on the same set).
        products = all.filter(p => (p.categories ?? []).some(c => c.toLowerCase() === slug));
        const themeRaw = data?.mongo?.getActiveTheme;
        if (themeRaw) themeTokens = JSON.parse(themeRaw).tokens ?? null;
        if (data?.mongo?.getFooter) footer = JSON.parse(data.mongo.getFooter);
        pages = (data?.mongo?.getNavigationCollection ?? []).map(p => ({page: p.page}));
    } catch (err) {
        console.error('[products/category] parse error:', err);
    }
    return {
        props: {
            products,
            category: slug,
            themeTokens,
            footer,
            pages,
            ...(await serverSideTranslations(locale ?? 'en', ['common', 'app'])),
        },
    };
}) as GetServerSideProps<Props>;

export default CategoryPage;
