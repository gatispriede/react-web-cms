import React, {useEffect, useMemo, useRef, useState} from 'react';
import {GetStaticPaths, GetStaticProps} from 'next';
import {gqlFetch} from '@client/lib/gqlFetch';
import Link from 'next/link';
import Head from 'next/head';
import {ArrowLeftOutlined} from '@client/lib/icons';
import {Button, ConfigProvider, Select, Space, Table, Tag, Typography} from 'antd';
import {serverSideTranslations} from 'next-i18next/pages/serverSideTranslations';
import {useTranslation} from 'next-i18next/pages';
import staticTheme from '@client/features/Themes/themeConfig';
import {buildThemeConfig} from '@client/features/Themes/buildThemeConfig';
import {applyThemeCssVars} from '@client/features/Themes/applyThemeCssVars';
import {sanitizeHtml} from '@utils/sanitize';
import {IProduct, IProductVariant} from '@interfaces/IProduct';
import Logo from '@client/features/Logo/Logo';
import CartIcon from '../../components/cart/CartIcon';
import SiteFooter from '@client/features/Footer/SiteFooter';
import {DEFAULT_FOOTER, IFooterConfig} from '@interfaces/IFooter';
import {useCart} from '../../components/cart/useCart';
import {message} from 'antd';

interface Props {
    product: IProduct | null;
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

const ProductPage = ({product, themeTokens, footer, pages}: Props) => {
    // DECISION: i18n title/description go through `useTranslation` with the
    // doc's canonical title/description as fallback (spec §7). The CSV
    // editor sub-tab in admin is deferred — see Products.tsx note.
    const {t, i18n} = useTranslation('common');
    const ref = useRef<HTMLDivElement | null>(null);
    useEffect(() => { if (themeTokens) applyThemeCssVars(themeTokens); }, [themeTokens]);
    const themeConfig = themeTokens ? buildThemeConfig(themeTokens) : staticTheme;

    const variants: IProductVariant[] = product?.variants ?? [];
    const [variantId, setVariantId] = useState<string | undefined>(variants[0]?.id);
    const activeVariant = useMemo(() => variants.find(v => v.id === variantId), [variants, variantId]);

    // When variants exist, the parent `stock` is ignored — selected variant
    // owns the displayed stock & price (spec §10.2).
    const effectivePrice = activeVariant?.price ?? product?.price ?? 0;
    const effectiveStock = variants.length > 0 ? (activeVariant?.stock ?? 0) : (product?.stock ?? 0);
    const outOfStock = effectiveStock === 0;

    // Title/description with i18n overlay; doc value is the fallback.
    const i18nTitle = product
        ? (i18n?.t?.(`product.${product.slug}.title`, {defaultValue: product.title}) as string ?? product.title)
        : '';
    const i18nDescription = product
        ? (i18n?.t?.(`product.${product.slug}.description`, {defaultValue: product.description}) as string ?? product.description)
        : '';

    useEffect(() => {
        if (ref.current && i18nDescription) ref.current.innerHTML = sanitizeHtml(i18nDescription);
    }, [i18nDescription]);

    if (!product) {
        return (
            <ConfigProvider theme={themeConfig}>
                <div style={{maxWidth: 720, margin: '0 auto', padding: 48}}>
                    <Typography.Title level={2}>{t('Product not found')}</Typography.Title>
                    <Link href="/products">
                        <Button icon={<ArrowLeftOutlined/>}>{t('Back to products')}</Button>
                    </Link>
                </div>
            </ConfigProvider>
        );
    }

    const attributeRows = Object.entries(product.attributes ?? {}).map(([key, value]) => ({key, value}));

    const {addItem} = useCart();
    const [messageApi, messageCtx] = message.useMessage();
    const onAddToCart = async () => {
        if (!product) return;
        const sku = activeVariant?.sku ?? product.sku;
        try {
            const cart = await addItem(product.id, sku, 1);
            const clamped = (cart.warnings ?? []).find(w => w.sku === sku && w.reason === 'clamped');
            if (clamped) {
                messageApi.warning('Added — but quantity was capped at available stock.');
            } else {
                messageApi.success('Added to cart');
            }
        } catch (err: any) {
            messageApi.error(err?.message ?? 'Failed to add to cart');
        }
    };

    return (
        <ConfigProvider theme={themeConfig}>
            {messageCtx}
            <Head>
                <title>{i18nTitle}</title>
                {i18nDescription && <meta name="description" content={i18nDescription.slice(0, 200)}/>}
                {product.images?.[0] && <meta property="og:image" content={product.images[0]}/>}
            </Head>
            <div style={{maxWidth: 960, margin: '0 auto', padding: '24px 20px 80px'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <Logo t={t} admin={false}/>
                    <CartIcon/>
                </div>
                <div style={{marginTop: 16}}>
                    <Link href="/products"><Button type="link" icon={<ArrowLeftOutlined/>}>{t('All products')}</Button></Link>
                </div>
                <div style={{display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 32, marginTop: 16}}>
                    <div>
                        {(product.images ?? []).length > 0 ? (
                            <div>
                                <img
                                    src={product.images[0]}
                                    alt={i18nTitle}
                                    style={{width: '100%', maxHeight: 480, objectFit: 'cover', borderRadius: 'var(--theme-borderRadius, 8px)'}}
                                />
                                {product.images.length > 1 && (
                                    <Space size={8} style={{marginTop: 8, flexWrap: 'wrap'}}>
                                        {product.images.slice(1).map((src, i) => (
                                            <img key={i} src={src} alt="" style={{width: 80, height: 80, objectFit: 'cover', borderRadius: 4}}/>
                                        ))}
                                    </Space>
                                )}
                            </div>
                        ) : null}
                    </div>
                    <div>
                        <Typography.Title level={1} style={{marginTop: 0}}>{i18nTitle}</Typography.Title>
                        <Typography.Title level={2} style={{marginTop: 0}}>
                            {formatPrice(effectivePrice, product.currency)}
                        </Typography.Title>
                        {outOfStock
                            ? <Tag color="red">{t('Out of stock')}</Tag>
                            : <Tag color="green">{t('In stock')}</Tag>}
                        <div ref={ref} className="rich-text" style={{marginTop: 16}}/>
                        {variants.length > 0 && (
                            <div style={{marginTop: 16}}>
                                <Typography.Text strong>{t('Variant')}</Typography.Text>
                                <Select
                                    style={{width: '100%', marginTop: 4}}
                                    value={variantId}
                                    onChange={setVariantId}
                                    options={variants.map(v => ({
                                        value: v.id,
                                        label: `${v.title}${v.stock === 0 ? ` — ${t('out of stock')}` : ''}`,
                                    }))}
                                />
                            </div>
                        )}
                        {attributeRows.length > 0 && (
                            <Table
                                style={{marginTop: 16}}
                                size="small"
                                pagination={false}
                                showHeader={false}
                                rowKey="key"
                                dataSource={attributeRows}
                                columns={[
                                    {dataIndex: 'key', key: 'k', render: (k: string) => <strong>{k}</strong>},
                                    {dataIndex: 'value', key: 'v'},
                                ]}
                            />
                        )}
                        <Button
                            type="primary"
                            size="large"
                            disabled={outOfStock}
                            onClick={onAddToCart}
                            style={{marginTop: 16}}
                        >
                            {outOfStock ? t('Out of stock') : t('Add to cart')}
                        </Button>
                    </div>
                </div>
            </div>
            <SiteFooter config={footer} pages={pages} hasPosts={false} t={t as any}/>
        </ConfigProvider>
    );
};

export const getStaticPaths: GetStaticPaths = async () => {
    const data = await gqlFetch<{mongo: {getProducts: string}}>(
        `{ mongo { getProducts(limit: 500) } }`,
    );
    const products: {slug: string}[] = data?.mongo?.getProducts ? JSON.parse(data.mongo.getProducts) : [];
    return {
        paths: products.map(p => ({params: {slug: p.slug}})),
        fallback: 'blocking',
    };
};

export const getStaticProps: GetStaticProps<Props> = async ({params, locale}) => {
    const slug = Array.isArray(params?.slug) ? params.slug[0] : params?.slug;
    let product: IProduct | null = null;
    let themeTokens: any | null = null;
    let footer: IFooterConfig = {...DEFAULT_FOOTER};
    let pages: {page: string}[] = [];
    const data = await gqlFetch<{mongo: {
        getProduct: string | null;
        getActiveTheme: string | null;
        getFooter: string;
        getNavigationCollection: {page: string}[];
    }}>(
        `query($slug: String!){ mongo { getProduct(slug: $slug) getActiveTheme getFooter getNavigationCollection { page } } }`,
        {slug: slug ?? ''},
    );
    try {
        const raw = data?.mongo?.getProduct;
        product = raw ? JSON.parse(raw) : null;
        const themeRaw = data?.mongo?.getActiveTheme;
        if (themeRaw) themeTokens = JSON.parse(themeRaw).tokens ?? null;
        if (data?.mongo?.getFooter) footer = JSON.parse(data.mongo.getFooter);
        pages = (data?.mongo?.getNavigationCollection ?? []).map(p => ({page: p.page}));
    } catch (err) {
        console.error('[products/[slug]] parse error:', err);
    }
    if (!product) return {notFound: true, revalidate: 3600};
    return {
        props: {
            product,
            themeTokens,
            footer,
            pages,
            ...(await serverSideTranslations(locale ?? 'en', ['common', 'app'])),
        },
        revalidate: 3600,
    };
};

export default ProductPage;
