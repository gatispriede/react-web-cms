import React from 'react';
import {InputNumber, Select, Space, Switch, Typography, Divider, Input} from 'antd';
import {EItemType} from '@enums/EItemType';
import {IInputContent} from '@interfaces/IInputContent';
import {ProductContent, type IProductModule} from '@client/modules/Product';
import {ProductPickerControl} from './ProductPickerControl';
import {ProductSourceControl} from './ProductSourceControl';

/**
 * ProductEditor — top-level mode dispatcher + per-mode option surfaces.
 *
 * All `<Select>` fields use `options=[...]` (predefined) — no free-text
 * mode entry. Product IDs are picked via `ProductPickerControl`, never
 * typed. Source kind is a radio-style selector with constrained values.
 */
const MODE_OPTIONS = [
    {value: 'featured', label: 'Featured (one-product hero)'},
    {value: 'grid', label: 'Grid (N×M cards)'},
    {value: 'carousel', label: 'Carousel (horizontal scroll)'},
    {value: 'comparison', label: 'Comparison table'},
    {value: 'related', label: 'Related (auto-populated)'},
];

const DENSITY_OPTIONS = [
    {value: 'compact', label: 'Compact'},
    {value: 'standard', label: 'Standard'},
    {value: 'spacious', label: 'Spacious'},
];

const CTA_STYLE_OPTIONS = [
    {value: 'primary', label: 'Primary'},
    {value: 'secondary', label: 'Secondary'},
    {value: 'ghost', label: 'Ghost'},
];

const IMAGE_POS_OPTIONS = [
    {value: 'left', label: 'Image left'},
    {value: 'right', label: 'Image right'},
    {value: 'top', label: 'Image top'},
    {value: 'background', label: 'Image background'},
];

const RELATED_RULE_OPTIONS = [
    {value: 'same-category', label: 'Same category'},
    {value: 'same-tags', label: 'Same tags'},
    {value: 'frequently-bought-together', label: 'Frequently bought together'},
];

const ProductEditor: React.FC<IInputContent> = ({content, setContent, t}) => {
    const mgr = new ProductContent(EItemType.Product, content);
    const data = mgr.data;

    const commit = (next: IProductModule) => {
        mgr.data = next;
        setContent(mgr.stringData);
    };
    const update = (patch: Partial<IProductModule>) => commit({...data, ...patch});

    return (
        <div className="admin-product" style={{display: 'flex', flexDirection: 'column', gap: 14}}>
            <div>
                <label>{t('Mode')}</label>
                <Select
                    data-testid="product-editor-mode-select"
                    style={{width: '100%'}}
                    value={data.mode}
                    options={MODE_OPTIONS.map(o => ({...o, label: t(o.label)}))}
                    onChange={(mode) => update({mode: mode as IProductModule['mode']})}
                />
            </div>

            <Divider style={{margin: '4px 0'}}/>

            <ProductSourceControl
                selection={data.products}
                onChange={(products) => update({products})}
                t={t}
            />

            {data.products?.source === 'manual' && (
                <ProductPickerControl
                    ids={data.products?.ids ?? []}
                    onChange={(ids) => update({products: {...data.products!, ids}})}
                    t={t}
                />
            )}

            <Divider style={{margin: '4px 0'}}/>

            <Space wrap>
                <label style={{display: 'flex', alignItems: 'center', gap: 8}}>
                    <Switch
                        data-testid="product-editor-showbuycta-switch"
                        checked={data.showBuyCta !== false}
                        onChange={(v) => update({showBuyCta: v})}
                    />
                    {t('Show Buy CTA')}
                </label>
                <label style={{display: 'flex', alignItems: 'center', gap: 8}}>
                    <Switch
                        checked={data.showPrice !== false}
                        onChange={(v) => update({showPrice: v})}
                    />
                    {t('Show price')}
                </label>
                <label style={{display: 'flex', alignItems: 'center', gap: 8}}>
                    <Switch
                        checked={!!data.showRating}
                        onChange={(v) => update({showRating: v})}
                    />
                    {t('Show rating')}
                </label>
                <label style={{display: 'flex', alignItems: 'center', gap: 8}}>
                    <Switch
                        checked={!!data.showStockBadge}
                        onChange={(v) => update({showStockBadge: v})}
                    />
                    {t('Show stock badge')}
                </label>
            </Space>

            <Typography.Text type="secondary" style={{fontSize: 12}}>
                {t('Buy CTA only renders when commerce.checkoutEnabled is on. Catalogue-only sites can leave the toggle on safely.')}
            </Typography.Text>

            <Divider orientation="left">{t('Mode-specific')}</Divider>

            {data.mode === 'featured' && (
                <Space wrap>
                    <div>
                        <label>{t('Image position')}</label>
                        <Select
                            data-testid="product-editor-featured-imagepos"
                            style={{width: 200}}
                            value={data.featured?.imagePosition ?? 'left'}
                            options={IMAGE_POS_OPTIONS.map(o => ({...o, label: t(o.label)}))}
                            onChange={(v) => update({featured: {...data.featured!, imagePosition: v as any}})}
                        />
                    </div>
                    <div>
                        <label>{t('CTA style')}</label>
                        <Select
                            style={{width: 160}}
                            value={data.featured?.ctaStyle ?? 'primary'}
                            options={CTA_STYLE_OPTIONS.map(o => ({...o, label: t(o.label)}))}
                            onChange={(v) => update({featured: {...data.featured!, ctaStyle: v as any}})}
                        />
                    </div>
                    <div>
                        <label>{t('CTA text override')}</label>
                        <Input
                            style={{width: 200}}
                            value={data.featured?.ctaText ?? ''}
                            placeholder="Buy now"
                            onChange={(e) => update({featured: {...data.featured!, ctaText: e.target.value}})}
                        />
                    </div>
                </Space>
            )}

            {data.mode === 'grid' && (
                <Space wrap>
                    <div>
                        <label>{t('Columns')}</label>
                        <Select
                            data-testid="product-editor-grid-columns"
                            style={{width: 120}}
                            value={data.grid?.columns ?? 3}
                            options={[2, 3, 4, 5, 6].map(n => ({value: n, label: String(n)}))}
                            onChange={(v) => update({grid: {...data.grid!, columns: v as any}})}
                        />
                    </div>
                    <div>
                        <label>{t('Rows (optional cap)')}</label>
                        <InputNumber
                            min={1}
                            max={20}
                            value={data.grid?.rows}
                            onChange={(v) => update({grid: {...data.grid!, rows: typeof v === 'number' ? v : undefined}})}
                        />
                    </div>
                    <div>
                        <label>{t('Density')}</label>
                        <Select
                            style={{width: 160}}
                            value={data.grid?.density ?? 'standard'}
                            options={DENSITY_OPTIONS.map(o => ({...o, label: t(o.label)}))}
                            onChange={(v) => update({grid: {...data.grid!, density: v as any}})}
                        />
                    </div>
                </Space>
            )}

            {data.mode === 'carousel' && (
                <Space wrap>
                    <div>
                        <label>{t('Slides per view')}</label>
                        <Select
                            style={{width: 120}}
                            value={data.carousel?.slidesPerView ?? 3}
                            options={[2, 3, 4].map(n => ({value: n, label: String(n)}))}
                            onChange={(v) => update({carousel: {...data.carousel!, slidesPerView: v as any}})}
                        />
                    </div>
                    <label style={{display: 'flex', alignItems: 'center', gap: 8}}>
                        <Switch
                            checked={!!data.carousel?.autoplay}
                            onChange={(v) => update({carousel: {...data.carousel!, autoplay: v}})}
                        />
                        {t('Autoplay')}
                    </label>
                    <label style={{display: 'flex', alignItems: 'center', gap: 8}}>
                        <Switch
                            checked={data.carousel?.showDots ?? true}
                            onChange={(v) => update({carousel: {...data.carousel!, showDots: v}})}
                        />
                        {t('Show dots')}
                    </label>
                    <label style={{display: 'flex', alignItems: 'center', gap: 8}}>
                        <Switch
                            checked={data.carousel?.showArrows ?? true}
                            onChange={(v) => update({carousel: {...data.carousel!, showArrows: v}})}
                        />
                        {t('Show arrows')}
                    </label>
                </Space>
            )}

            {data.mode === 'comparison' && (
                <Space direction="vertical" style={{width: '100%'}}>
                    <label style={{display: 'flex', alignItems: 'center', gap: 8}}>
                        <Switch
                            checked={data.comparison?.highlightDifferences ?? true}
                            onChange={(v) => update({comparison: {...data.comparison!, highlightDifferences: v}})}
                        />
                        {t('Highlight differing rows')}
                    </label>
                    <Typography.Text type="secondary" style={{fontSize: 12}}>
                        {t('Rows source: all-attributes by default. Tightening to a custom list lands in sub-jump C.')}
                    </Typography.Text>
                </Space>
            )}

            {data.mode === 'related' && (
                <div>
                    <label>{t('Rule')}</label>
                    <Select
                        style={{width: 280}}
                        value={data.related?.rule ?? 'same-category'}
                        options={RELATED_RULE_OPTIONS.map(o => ({...o, label: t(o.label)}))}
                        onChange={(v) => update({related: {rule: v as any}})}
                    />
                </div>
            )}
        </div>
    );
};

export {ProductEditor};
export default ProductEditor;
