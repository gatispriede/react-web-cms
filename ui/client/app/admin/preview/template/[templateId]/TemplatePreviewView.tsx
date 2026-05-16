'use client';
/**
 * Client view for `/admin/preview/template/[templateId]` —
 * App Router migration, Batch 6.
 *
 * Direct lift of the visible chrome from
 * `pages/admin/preview/template/[templateId].tsx`. The page itself is a
 * pure data-loading Server Component; only the JSX needs the client
 * runtime because `<ProductContext.Provider>` is a React Context.
 */
import React from 'react';
import type {IProduct} from '@interfaces/IProduct';
import type {IProductTemplate} from '@interfaces/IProductTemplate';
import type {ISection} from '@interfaces/ISection';
import {ProductContext} from '@client/lib/ProductContext';

interface Props {
    template: IProductTemplate | null;
    product: IProduct | null;
    sections: ISection[];
}

const TemplatePreviewView: React.FC<Props> = ({template, product, sections}) => {
    if (!template) {
        return (
            <div style={{padding: 24}} data-testid="template-preview-not-found">
                <h1>Template not found</h1>
            </div>
        );
    }
    return (
        <ProductContext.Provider
            value={product ? {product, currency: product.currency} : null}
        >
            <div
                className="template-preview"
                data-testid={`template-preview-${template.id}`}
                style={{maxWidth: 1080, margin: '0 auto', padding: 24}}
            >
                <header style={{marginBottom: 24}}>
                    <h1 style={{margin: 0}} data-testid="template-preview-title">
                        {template.name}
                    </h1>
                    <p style={{opacity: 0.7, margin: '4px 0 0'}}>{template.description}</p>
                    {product ? (
                        <p style={{fontSize: 12, opacity: 0.6, margin: '8px 0 0'}}>
                            Fixture: <code>{product.id}</code> — {product.title}
                        </p>
                    ) : (
                        <p style={{fontSize: 12, opacity: 0.6, margin: '8px 0 0'}}>
                            No fixture product available — rendering unbound.
                        </p>
                    )}
                </header>
                <ol data-testid="template-preview-sections">
                    {sections.map((s, i) => (
                        <li key={s.id ?? i} data-testid={`template-preview-section-${i}`}>
                            <code>{(s.content?.[0] as {type?: string} | undefined)?.type ?? 'unknown'}</code>
                            {s.locked && <span style={{marginLeft: 8, opacity: 0.6}}>(locked)</span>}
                        </li>
                    ))}
                </ol>
            </div>
        </ProductContext.Provider>
    );
};

export default TemplatePreviewView;
