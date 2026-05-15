import React, {useEffect, useMemo, useState} from 'react';
import {GetServerSideProps} from 'next';
import {gqlFetch} from '@client/lib/gqlFetch';
import {gatePath} from '@client/lib/loaders/applyPublicGates';
import Link from 'next/link';
import Head from 'next/head';
import {ConfigProvider, Card, Col, Empty, Input, Row, Select, Space, Tag, Typography} from 'antd';
import {serverSideTranslations} from 'next-i18next/pages/serverSideTranslations';
import {useTranslation} from 'next-i18next/pages';
import staticTheme from '@client/features/Themes/themeConfig';
import {buildThemeConfig} from '@client/features/Themes/buildThemeConfig';
import {applyThemeCssVars} from '@client/features/Themes/applyThemeCssVars';
import {IProduct} from '@interfaces/IProduct';
import Logo from '@client/features/Logo/Logo';
import CartIcon from '@client/features/Cart/CartIcon';
import RevealOnScroll from '@client/lib/RevealOnScroll';
import SiteFooter from '@client/features/Footer/SiteFooter';
import {DEFAULT_FOOTER, IFooterConfig} from '@interfaces/IFooter';
import {productPrimaryImage} from '@client/lib/productImage';

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
    const [query, setQuery] = useState<string>('');
    type SortKey = 'relevance' | 'price-asc' | 'price-desc' | 'newest' | 'title-asc';
    const [sort, setSort] = useState<SortKey>('relevance');

    const categories = useMemo(() => {
        const set = new Set<string>();
        for (const p of products) for (const c of (p.categories ?? [])) set.add(c);
        return [...set].sort();
    }, [products]);

    /**
     * Wide search — substring-match across title, sku, brand attribute,
     * categories, and every other attribute value. Case-insensitive.
     * Filter runs client-side over the SSR-loaded list; the SSR limit
     * (200) is far above the operator's catalogue today.
     */
    const matchesQuery = (p: IProduct, q: string): boolean => {
        if (!q) return true;
        const hay: string[] = [];
        hay.push(p.title ?? '', p.sku ?? '', p.slug ?? '');
        for (const c of (p.categories ?? [])) hay.push(c);
        for (const v of Object.values(p.attributes ?? {})) hay.push(String(v ?? ''));
        const lc = q.toLowerCase();
        return hay.some(s => s.toLowerCase().includes(lc));
    };

    const visible = useMemo(() => {
        let out = products;
        if (category) out = out.filter(p => (p.categories ?? []).includes(category));
        if (query.trim()) out = out.filter(p => matchesQuery(p, query.trim()));
        // Sort. `relevance` keeps the SSR order (newest-first today).
        const sorted = [...out];
        switch (sort) {
            case 'price-asc':  sorted.sort((a, b) => (a.price ?? 0) - (b.price ?? 0)); break;
            case 'price-desc': sorted.sort((a, b) => (b.price ?? 0) - (a.price ?? 0)); break;
            case 'title-asc':  sorted.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? '')); break;
            case 'newest':     sorted.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')); break;
        }
        return sorted;
    }, [products, category, query, sort]);

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
                </Space>
                {/* Search + sort row. Wide search runs over title, SKU,
                 *  categories and every attribute value — typing "DDR5"
                 *  finds the RAM kit, typing "AM5" hits both the board
                 *  and the Ryzen CPU. */}
                <Space style={{marginBottom: 16, width: '100%'}} wrap>
                    <Input.Search
                        data-testid="storefront-product-search"
                        placeholder={t('Search title, SKU, attributes…')}
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        allowClear
                        style={{minWidth: 320}}
                    />
                    {categories.length > 0 && (
                        <Select
                            data-testid="storefront-product-category-filter"
                            allowClear
                            placeholder={t('Filter by category')}
                            style={{minWidth: 200}}
                            value={category}
                            onChange={setCategory}
                            options={categories.map(c => ({value: c, label: c}))}
                        />
                    )}
                    <Select
                        data-testid="storefront-product-sort"
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
                {/* Category chips — link to /products/category/<slug> so
                 *  visitors can pivot to a focused subpage instead of
                 *  using the dropdown filter every time. */}
                {categories.length > 0 && (
                    <Space size={[6, 6]} wrap style={{marginBottom: 16}}>
                        <Typography.Text type="secondary">{t('Browse by category')}:</Typography.Text>
                        {categories.map(c => (
                            <Link key={c} href={`/products/category/${encodeURIComponent(c)}`} data-testid={`storefront-products-category-chip-${c}`}>
                                <Tag style={{cursor: 'pointer'}} color={category === c ? 'blue' : 'default'}>{c}</Tag>
                            </Link>
                        ))}
                    </Space>
                )}
                {visible.length === 0 && <Empty description={t('No products available yet.')}/>}
                <Row gutter={[16, 16]}>
                    {visible.map((p, i) => (
                        <Col xs={24} md={12} lg={8} key={p.id}>
                            <RevealOnScroll delay={i * 60}>
                                <Link href={`/products/${p.slug}`} style={{textDecoration: 'none'}} data-testid={`storefront-product-card-${p.slug}`}>
                                    <Card
                                        className="product-card"
                                        hoverable
                                        cover={
                                            <img
                                                src={productPrimaryImage(p)}
                                                alt={p.title}
                                                style={{height: 220, objectFit: 'cover'}}
                                            />
                                        }
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

// Switched from `getStaticProps + revalidate: 3600` to `getServerSideProps`
// 2026-05-09. The static path baked an empty-Mongo state at image build
// time (the prebuild's in-memory Mongo holds no products), so /products
// served an empty grid for ~1h after every deploy until ISR caught up.
// Per-request render against runtime Mongo eliminates the staleness
// window. Same fix pattern as `pages/index.tsx` and `pages/blog/index.tsx`.
export const getServerSideProps: GetServerSideProps<Props> = gatePath('/products', async ({locale}: {locale?: string}) => {
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
    };
}) as GetServerSideProps<Props>;

export default ProductsIndex;
