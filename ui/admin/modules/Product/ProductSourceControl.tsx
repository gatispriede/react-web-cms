import React from 'react';
import {Input, Radio, Select, Space} from 'antd';
import type {IProductSelection} from '@client/modules/Product/Product.types';

/**
 * ProductSourceControl — predefined-Select source picker. Replaces the
 * old "type a UUID" free-text pattern; operators choose between four
 * enumerated sources (manual / category / tag / auto) and supply
 * filters as constrained inputs.
 */
const AUTO_RULE_OPTIONS = [
    {value: 'bestsellers', label: 'Bestsellers'},
    {value: 'recent', label: 'Most recent'},
    {value: 'on-sale', label: 'On sale'},
    {value: 'related', label: 'Related to primary product'},
];

export const ProductSourceControl: React.FC<{
    selection?: IProductSelection;
    onChange: (next: IProductSelection) => void;
    t: (k: string) => string;
}> = ({selection, onChange, t}) => {
    const src = selection?.source ?? 'manual';
    const update = (patch: Partial<IProductSelection>) =>
        onChange({source: src, ...selection, ...patch});

    return (
        <div>
            <label>{t('Product source')}</label>
            <Radio.Group
                data-testid="product-editor-source-radio"
                value={src}
                onChange={(e) => update({source: e.target.value})}
                style={{display: 'flex', gap: 12, flexWrap: 'wrap'}}
            >
                <Radio value="manual">{t('Manual list')}</Radio>
                <Radio value="category">{t('By category')}</Radio>
                <Radio value="tag">{t('By tag')}</Radio>
                <Radio value="auto">{t('Auto-rule')}</Radio>
            </Radio.Group>

            <Space style={{marginTop: 8}} wrap>
                {src === 'category' && (
                    <Input
                        data-testid="product-editor-source-category"
                        style={{width: 240}}
                        placeholder={t('category slug')}
                        value={selection?.category ?? ''}
                        onChange={(e) => update({category: e.target.value})}
                    />
                )}
                {src === 'tag' && (
                    <Input
                        data-testid="product-editor-source-tag"
                        style={{width: 240}}
                        placeholder={t('tag')}
                        value={selection?.tag ?? ''}
                        onChange={(e) => update({tag: e.target.value})}
                    />
                )}
                {src === 'auto' && (
                    <Select
                        data-testid="product-editor-source-autorule"
                        style={{width: 260}}
                        value={selection?.autoRule ?? 'recent'}
                        options={AUTO_RULE_OPTIONS.map(o => ({...o, label: t(o.label)}))}
                        onChange={(v) => update({autoRule: v as any})}
                    />
                )}
                <Input
                    style={{width: 160}}
                    type="number"
                    placeholder={t('limit')}
                    value={typeof selection?.limit === 'number' ? selection.limit : ''}
                    onChange={(e) => {
                        const n = parseInt(e.target.value, 10);
                        update({limit: Number.isFinite(n) && n > 0 ? n : undefined});
                    }}
                />
            </Space>
        </div>
    );
};

export default ProductSourceControl;
