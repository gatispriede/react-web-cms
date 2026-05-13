import React, {useEffect, useState} from 'react';
import {Select, Tag, Space, Button} from 'antd';
import {DeleteOutlined} from '@client/lib/icons';
import ProductApi from '@services/api/client/ProductApi';
import type {IProduct} from '@interfaces/IProduct';

/**
 * ProductPickerControl — predefined Select sourced from the live
 * product catalog. Operators search by slug / title; the picked items
 * land in `ids[]` (preserving order). No free-text UUID entry — every
 * stored ID maps to a real product in the catalog at pick time.
 *
 * Selected products render as removable tags below the search box so
 * the editor sees the chosen order without scrolling the dropdown.
 */
export const ProductPickerControl: React.FC<{
    ids: string[];
    onChange: (next: string[]) => void;
    t: (k: string) => string;
}> = ({ids, onChange, t}) => {
    const [options, setOptions] = useState<IProduct[]>([]);
    const [loading, setLoading] = useState(false);
    const [query, setQuery] = useState('');

    useEffect(() => {
        let alive = true;
        setLoading(true);
        (async () => {
            try {
                const api = new ProductApi();
                const list = query
                    ? await api.search(query, 25)
                    : await api.list({limit: 25});
                if (alive) setOptions(list as IProduct[]);
            } catch {
                if (alive) setOptions([]);
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, [query]);

    const byId = new Map(options.map(p => [p.id, p]));
    const selectOptions = options
        .filter(p => !ids.includes(p.id))
        .map(p => ({value: p.id, label: `${p.title} — /${p.slug}`}));

    const add = (id: string) => {
        if (!id || ids.includes(id)) return;
        onChange([...ids, id]);
    };
    const remove = (id: string) => onChange(ids.filter(x => x !== id));

    return (
        <div>
            <label>{t('Products')}</label>
            <Select
                data-testid="product-editor-picker"
                style={{width: '100%'}}
                showSearch
                placeholder={t('Search products by title or slug…')}
                value={null}
                options={selectOptions}
                loading={loading}
                filterOption={false}
                onSearch={setQuery}
                onChange={(id) => add(id as string)}
            />
            <Space wrap style={{marginTop: 8}}>
                {ids.map(id => {
                    const p = byId.get(id);
                    return (
                        <Tag
                            key={id}
                            data-testid={`product-editor-picked-${id}`}
                            closable
                            onClose={() => remove(id)}
                            closeIcon={<DeleteOutlined/>}
                        >
                            {p ? `${p.title}` : id}
                        </Tag>
                    );
                })}
                {ids.length > 0 && (
                    <Button size="small" onClick={() => onChange([])} data-testid="product-editor-picker-clear">
                        {t('Clear all')}
                    </Button>
                )}
            </Space>
        </div>
    );
};

export default ProductPickerControl;
