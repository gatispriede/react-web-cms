'use client';
/**
 * Client view for `/products` — App Router migration, Batch 5.
 *
 * Mechanical lift of the visible body from the former
 * `pages/products/index.tsx`. The faceted-filter URL binding now flows
 * through `next/navigation` `useSearchParams()` instead of
 * `next/router`'s `router.query` — same shape via the small flattener
 * below.
 */
import React, {useEffect, useMemo} from 'react';
import {useSearchParams} from 'next/navigation';
import Link from 'next/link';
import {ConfigProvider, Card, Col, Empty, Row, Space, Tag, Typography} from 'antd';
import {useT} from 'next-i18next/client';
import staticTheme from '@client/features/Themes/themeConfig';
import {buildThemeConfig} from '@client/features/Themes/buildThemeConfig';
import {applyThemeCssVars} from '@client/features/Themes/applyThemeCssVars';
import type {IProduct} from '@interfaces/IProduct';
import Logo from '@client/features/Logo/Logo';
import CartIcon from '@client/features/Cart/CartIcon';
import RevealOnScroll from '@client/lib/RevealOnScroll';
import SiteFooter from '@client/features/Footer/SiteFooter';
import type {IFooterConfig} from '@interfaces/IFooter';
import {
    PRODUCTS_LIST_CONFIG,
    applyFilterState,
    computeFacetCounts,
    parseFilterUrl,
    type FacetAccessors,
    type IFacetOption,
} from '@client/lib/facetedFilter';
import {FacetedFilterPanel} from '@client/components/FacetedFilter';

export interface ProductsIndexViewProps {
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

/**
 * Facet value-accessors for `IProduct`. `price` is read in MAJOR units
 * (cents / 100) to match the `€`-unit range facet config. `instock` is a
 * boolean facet — true only when stock > 0.
 */
const PRODUCT_FACET_ACCESSORS: FacetAccessors<IProduct> = {
    category: p => p.categories ?? [],
    price: p => (p.price ?? 0) / 100,
    instock: p => (p.stock ?? 0) > 0,
};

/** Flatten URLSearchParams into the `{k: v | v[]}` shape `parseFilterUrl` expects. */
function searchToQuery(search: URLSearchParams | null): Record<string, string | string[] | undefined> {
    if (!search) return {};
    const out: Record<string, string | string[] | undefined> = {};
    for (const key of new Set(Array.from(search.keys()))) {
        const all = search.getAll(key);
        out[key] = all.length > 1 ? all : all[0];
    }
    return out;
}

const ProductsIndexView: React.FC<ProductsIndexViewProps> = ({products, themeTokens, footer, pages}) => {
    const {t} = useT('common');
    const search = useSearchParams();
    useEffect(() => { if (themeTokens) applyThemeCssVars(themeTokens); }, [themeTokens]);
    const themeConfig = themeTokens ? buildThemeConfig(themeTokens) : staticTheme;

    const facets = PRODUCTS_LIST_CONFIG.facets;

    const filterState = useMemo(
        () => parseFilterUrl(searchToQuery(search), facets),
        [search, facets],
    );

    // Live category options come from the product set (the config leaves
    // `category.options` empty — it's a dynamic taxonomy facet).
    const categoryOptions: IFacetOption[] = useMemo(() => {
        const set = new Set<string>();
        for (const p of products) for (const c of (p.categories ?? [])) set.add(c);
        return [...set].sort().map(c => ({value: c, label: c}));
    }, [products]);

    const optionsByFacet = useMemo(() => ({category: categoryOptions}), [categoryOptions]);

    const countsByFacet = useMemo(
        () => computeFacetCounts(products, filterState, facets, PRODUCT_FACET_ACCESSORS),
        [products, filterState, facets],
    );

    const visible = useMemo(
        () => applyFilterState(products, filterState, facets, PRODUCT_FACET_ACCESSORS),
        [products, filterState, facets],
    );

    return (
        <ConfigProvider theme={themeConfig}>
            <div style={{maxWidth: 1100, margin: '0 auto', padding: 24}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <Logo t={t} admin={false}/>
                    <CartIcon/>
                </div>
                <Space style={{marginTop: 24, marginBottom: 16}} align="center" wrap>
                    <Typography.Title level={1} style={{margin: 0}}>{t('Products')}</Typography.Title>
                </Space>
                <Row gutter={[24, 16]}>
                    <Col xs={24} md={7} lg={6}>
                        <FacetedFilterPanel
                            testId="products-filter"
                            config={PRODUCTS_LIST_CONFIG}
                            optionsByFacet={optionsByFacet}
                            countsByFacet={countsByFacet}
                            resultCount={visible.length}
                        />
                    </Col>
                    <Col xs={24} md={17} lg={18}>
                        <Typography.Text type="secondary" data-testid="products-result-count">
                            {visible.length} {visible.length === 1 ? t('result') : t('results')}
                        </Typography.Text>
                        {visible.length === 0 && <Empty description={t('No products match your filters.')}/>}
                        <Row gutter={[16, 16]} style={{marginTop: 12}}>
                            {visible.map((p, i) => (
                                <Col xs={24} sm={12} lg={8} key={p.id}>
                                    <RevealOnScroll delay={i * 60}>
                                        <Link href={`/products/${p.slug}`} style={{textDecoration: 'none'}} data-testid={`storefront-product-card-${p.slug}`}>
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
                    </Col>
                </Row>
            </div>
            <SiteFooter config={footer} pages={pages} hasPosts={false} t={t as any}/>
        </ConfigProvider>
    );
};

export default ProductsIndexView;
