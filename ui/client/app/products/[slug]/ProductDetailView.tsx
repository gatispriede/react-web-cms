'use client';
/**
 * Client view for `/products/[slug]` — App Router migration, Batch 5.
 * Direct lift of the visible body from the former
 * `pages/products/[slug].tsx`. SEO `<Head>` moved to server-side
 * `generateMetadata`; the product is guaranteed non-null here (the
 * server file calls `notFound()` before mounting).
 */
import React, {useEffect, useMemo, useRef, useState} from 'react';
import Link from 'next/link';
import {ArrowLeftOutlined} from '@client/lib/icons';
import {Button, ConfigProvider, Select, Space, Table, Tag, Typography} from 'antd';
import {useT} from 'next-i18next/client';
import staticTheme from '@client/features/Themes/themeConfig';
import {buildThemeConfig} from '@client/features/Themes/buildThemeConfig';
import {applyThemeCssVars} from '@client/features/Themes/applyThemeCssVars';
import {sanitizeHtml} from '@utils/sanitize';
import type {IProduct, IProductVariant} from '@interfaces/IProduct';
import Logo from '@client/features/Logo/Logo';
import CartIcon from '@client/features/Cart/CartIcon';
import SiteFooter from '@client/features/Footer/SiteFooter';
import type {IFooterConfig} from '@interfaces/IFooter';
import {useCart} from '@client/features/Cart/useCart';
import {productPrimaryImage} from '@client/lib/productImage';
import {message} from 'antd';

export interface ProductDetailViewProps {
    product: IProduct;
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

const ProductDetailView: React.FC<ProductDetailViewProps> = ({product, themeTokens, footer, pages}) => {
    // DECISION: i18n title/description go through `useT` with the doc's
    // canonical title/description as fallback (spec §7).
    const {t, i18n} = useT('common');
    const ref = useRef<HTMLDivElement | null>(null);
    useEffect(() => { if (themeTokens) applyThemeCssVars(themeTokens); }, [themeTokens]);
    const themeConfig = themeTokens ? buildThemeConfig(themeTokens) : staticTheme;

    const variants: IProductVariant[] = product.variants ?? [];
    const [variantId, setVariantId] = useState<string | undefined>(variants[0]?.id);
    const activeVariant = useMemo(() => variants.find(v => v.id === variantId), [variants, variantId]);

    const effectivePrice = activeVariant?.price ?? product.price ?? 0;
    const effectiveStock = variants.length > 0 ? (activeVariant?.stock ?? 0) : (product.stock ?? 0);
    const outOfStock = effectiveStock === 0;

    const i18nTitle = (i18n?.t?.(`product.${product.slug}.title`, {defaultValue: product.title}) as string) ?? product.title;
    const i18nDescription = (i18n?.t?.(`product.${product.slug}.description`, {defaultValue: product.description}) as string) ?? product.description;

    useEffect(() => {
        if (ref.current && i18nDescription) ref.current.innerHTML = sanitizeHtml(i18nDescription);
    }, [i18nDescription]);

    const {addItem} = useCart();
    const [messageApi, messageCtx] = message.useMessage();

    const attributeRows = Object.entries(product.attributes ?? {}).map(([key, value]) => ({key, value}));

    const onAddToCart = async () => {
        const sku = activeVariant?.sku ?? product.sku;
        try {
            const cart = await addItem(product.id, sku, 1);
            const clamped = (cart.warnings ?? []).find(w => w.sku === sku && w.reason === 'clamped');
            if (clamped) messageApi.warning('Added — but quantity was capped at available stock.');
            else messageApi.success('Added to cart');
        } catch (err: any) {
            messageApi.error(err?.message ?? 'Failed to add to cart');
        }
    };

    return (
        <ConfigProvider theme={themeConfig}>
            {messageCtx}
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
                        <img
                            src={productPrimaryImage(product)}
                            alt={i18nTitle}
                            style={{width: '100%', maxHeight: 480, objectFit: 'cover', borderRadius: 'var(--theme-borderRadius, 8px)'}}
                        />
                        {(product.images ?? []).length > 1 && (
                            <Space size={8} style={{marginTop: 8, flexWrap: 'wrap'}}>
                                {product.images!.slice(1).map((src, i) => (
                                    <img key={i} src={src} alt="" style={{width: 80, height: 80, objectFit: 'cover', borderRadius: 4}}/>
                                ))}
                            </Space>
                        )}
                    </div>
                    <div>
                        <Typography.Title data-testid="storefront-product-title" level={1} style={{marginTop: 0, marginBottom: 6}}>{i18nTitle}</Typography.Title>
                        {(product.attributes?.brand || product.categories?.[0]) && (
                            <Typography.Text data-testid="storefront-product-brand" style={{display: 'block', color: '#007185', marginBottom: 8}}>
                                {t('Brand')}: <strong>{String(product.attributes?.brand ?? product.categories![0])}</strong>
                            </Typography.Text>
                        )}
                        {(product.categories ?? []).length > 0 && (
                            <Space size={4} wrap style={{marginBottom: 8}}>
                                {(product.categories ?? []).map(cat => (
                                    <Link key={cat} href={`/products/category/${encodeURIComponent(cat)}`} data-testid={`storefront-product-category-${cat}`}>
                                        <Tag style={{cursor: 'pointer'}}>{cat}</Tag>
                                    </Link>
                                ))}
                            </Space>
                        )}
                        <Typography.Title data-testid="storefront-product-price" level={2} style={{marginTop: 8, marginBottom: 0, color: '#0f1111'}}>
                            {formatPrice(effectivePrice, product.currency)}
                        </Typography.Title>
                        <Typography.Text type="secondary" style={{display: 'block', marginBottom: 12}}>
                            {t('Prices include VAT.')}
                        </Typography.Text>
                        {outOfStock
                            ? <Tag data-testid="storefront-out-of-stock-badge" color="red">{t('Out of stock')}</Tag>
                            : <Tag color="green">{t('In stock')}</Tag>}
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
                                data-testid="storefront-product-specs"
                                style={{marginTop: 16}}
                                size="small"
                                pagination={false}
                                showHeader={false}
                                rowKey="key"
                                dataSource={attributeRows}
                                columns={[
                                    {dataIndex: 'key', key: 'k', width: '40%', render: (k: string) => <strong>{k}</strong>},
                                    {dataIndex: 'value', key: 'v', render: (v: unknown) => String(v ?? '')},
                                ]}
                            />
                        )}
                        <Button
                            data-testid="storefront-add-to-cart-btn"
                            type="primary"
                            size="large"
                            disabled={outOfStock}
                            onClick={onAddToCart}
                            style={{marginTop: 16, background: '#FFD814', borderColor: '#FCD200', color: '#0f1111', fontWeight: 500, borderRadius: 100, height: 40, paddingInline: 24}}
                        >
                            {outOfStock ? t('Out of stock') : t('Add to cart')}
                        </Button>
                    </div>
                </div>
                {i18nDescription && (
                    <section style={{marginTop: 40, padding: '24px', background: '#fff', borderRadius: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.04)'}}>
                        <Typography.Title level={3} style={{marginTop: 0}}>{t('About this item')}</Typography.Title>
                        <div ref={ref} className="rich-text" data-testid="storefront-product-description"/>
                    </section>
                )}
            </div>
            <SiteFooter config={footer} pages={pages} hasPosts={false} t={t as any}/>
        </ConfigProvider>
    );
};

export default ProductDetailView;
