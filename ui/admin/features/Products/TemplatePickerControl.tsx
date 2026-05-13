/**
 * Constrained `<Select>` for `IProduct.templateId`. Phase 1.F polish.
 *
 * Replaces the free-text id input on the product drawer per the
 * "predefined selections beat free-text" rule. Options come live from
 * `/api/product-templates` (`productTemplate.list`) filtered by:
 *   - `applicableTo.categories` ⊇ product.category (or empty = all)
 *   - `applicableTo.sources` ⊇ product.source     (or empty = all)
 *   - `audience` matches `siteFlags.commerce.defaultProductAudience`
 *     (`either` matches any)
 *
 * The first option is always "Standard (built-in:standard)" so leaving
 * the picker untouched yields a known-good fallback. Selected template's
 * `name` + `description` render inline below the control. VM4 — no
 * `useState`; the small `PickerVM` exposed via `useViewModel` holds
 * the list + the resolved flag value.
 */
import React, {useEffect} from 'react';
import {Select, Typography} from 'antd';
import {useTranslation} from 'react-i18next';
import {observable, useViewModel} from '@client/lib/state/observable';
import {productTemplatesApi, type TemplateListItem} from '@admin/features/ProductTemplates/ProductTemplatesApi';
import type {TemplateAudience} from '@interfaces/IProductTemplate';

class PickerVM {
    list: TemplateListItem[] = [];
    audienceFlag: TemplateAudience = 'either';
    loading = false;

    constructor() { return observable(this); }

    async load(): Promise<void> {
        if (this.loading) return;
        this.loading = true;
        try {
            const [list, flagRes] = await Promise.all([
                productTemplatesApi.list({}),
                fetch('/api/commerce/flag-status').then(r => r.json()).catch(() => ({})),
            ]);
            this.list = list ?? [];
            // `flag-status` exposes checkoutEnabled today; we read
            // `defaultProductAudience` defensively in case the endpoint
            // grows. Falls back to 'either' = no narrowing.
            const f = flagRes as {defaultProductAudience?: TemplateAudience};
            this.audienceFlag = f.defaultProductAudience ?? 'either';
        } finally {
            this.loading = false;
        }
    }
}

interface Props {
    /** Wired by `Form.Item` — current `templateId` form value. */
    value?: string;
    category: string | undefined;
    source: 'manual' | 'warehouse' | undefined;
    /** Wired by `Form.Item` — form-level setter. */
    onChange?: (id: string | undefined) => void;
}

const TemplatePickerControl: React.FC<Props> = ({value, category, source, onChange}) => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new PickerVM());
    useEffect(() => { void vm.load(); }, [vm]);

    const filtered = vm.list.filter(tpl => {
        const cats = tpl.applicableTo?.categories ?? [];
        if (cats.length > 0 && category && !cats.includes(category)) return false;
        const srcs = tpl.applicableTo?.sources ?? [];
        if (srcs.length > 0 && source && !srcs.includes(source)) return false;
        if (vm.audienceFlag !== 'either'
            && tpl.audience !== 'either'
            && tpl.audience !== vm.audienceFlag) return false;
        return true;
    });

    const options = [
        {label: t('Standard (built-in:standard)'), value: ''},
        ...filtered.map(tpl => ({
            label: `${tpl.name}${tpl.builtIn ? ' (built-in)' : ''}`,
            value: tpl.id,
        })),
    ];

    const selected = vm.list.find(x => x.id === value);

    return (
        <>
            <Select
                data-testid="admin-products-template-select"
                value={value ?? ''}
                onChange={v => onChange?.(v === '' ? undefined : v)}
                options={options}
                loading={vm.loading}
                style={{width: '100%'}}
                showSearch
                optionFilterProp="label"
            />
            {selected && (
                <Typography.Paragraph
                    type="secondary"
                    style={{marginTop: 4, marginBottom: 0, fontSize: 12}}
                    data-testid="admin-products-template-description"
                >
                    <strong>{selected.name}</strong>
                    {selected.description ? ` — ${selected.description}` : null}
                </Typography.Paragraph>
            )}
        </>
    );
};

export default TemplatePickerControl;
