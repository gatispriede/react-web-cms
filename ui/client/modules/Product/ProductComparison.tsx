import React from 'react';
import type {IProductModule, IProductRenderable} from './Product.types';
import ProductPrice from './ProductPrice';

/**
 * Comparison variant — side-by-side spec table. Column per product, row
 * per attribute. When `rows === 'all-attributes'` we union every
 * attribute key in the supplied product set; otherwise we honour the
 * explicit operator-picked list (preserving order).
 */
function collectAttrKeys(products: IProductRenderable[], rows: IProductModule['comparison'] extends infer C ? C extends {rows: infer R} ? R : never : never): string[] {
    if (Array.isArray(rows)) return rows;
    const set = new Set<string>();
    for (const p of products) {
        for (const k of Object.keys(p.attributes ?? {})) set.add(k);
    }
    return Array.from(set);
}

const ProductComparison: React.FC<{config: IProductModule; products: IProductRenderable[]}> = ({config, products}) => {
    const rowsCfg = config.comparison?.rows ?? 'all-attributes';
    const attrKeys = collectAttrKeys(products, rowsCfg as any);
    const highlight = config.comparison?.highlightDifferences ?? true;
    if (products.length === 0) return (
        <div className="product product--comparison product--empty" data-testid="product-comparison-empty">
            <p>No products to compare.</p>
        </div>
    );
    return (
        <section className="product product--comparison" data-testid="product-comparison">
            <table className="product__compare-table">
                <thead>
                    <tr>
                        <th scope="col" aria-label="Attribute"></th>
                        {products.map(p => (
                            <th key={p.id} scope="col">{p.title}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {config.showPrice !== false && (
                        <tr>
                            <th scope="row">Price</th>
                            {products.map(p => (
                                <td key={p.id}>
                                    {(typeof p.price === 'number' || p.prices)
                                        ? (
                                            <ProductPrice
                                                prices={p.prices}
                                                price={p.price}
                                                currency={p.currency}
                                                baseCurrency={p.baseCurrency}
                                                testId={`product-comparison-price-${p.slug}`}
                                            />
                                        )
                                        : '—'}
                                </td>
                            ))}
                        </tr>
                    )}
                    {attrKeys.map(k => {
                        const values = products.map(p => p.attributes?.[k] ?? '—');
                        const allSame = values.every(v => v === values[0]);
                        const cls = highlight && !allSame ? 'product__compare-row--diff' : '';
                        return (
                            <tr key={k} className={cls}>
                                <th scope="row">{k}</th>
                                {values.map((v, i) => <td key={i}>{v}</td>)}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </section>
    );
};

export default ProductComparison;
