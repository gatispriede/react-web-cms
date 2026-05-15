/**
 * Admin preview page — Phase 1.F (product-display-templates).
 *
 * Server-renders a product display template against a fixture product
 * so operators see the layout before assigning to live products. Admin
 * shell is hidden; the page is wrapped in `<ProductContext>` so the
 * template's modules bind to the fixture product like they would on a
 * real leaf product page.
 */
import React from 'react';
import type {GetServerSideProps} from 'next';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import type {IProduct} from '@interfaces/IProduct';
import type {IProductTemplate} from '@interfaces/IProductTemplate';
import type {ISection} from '@interfaces/ISection';
import {ProductContext} from '@client/lib/ProductContext';

interface Props {
    template: IProductTemplate | null;
    product: IProduct | null;
    sections: ISection[];
}

const TemplatePreviewPage: React.FC<Props> = ({template, product, sections}) => {
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
                            <code>{(s.content?.[0] as any)?.type ?? 'unknown'}</code>
                            {s.locked && <span style={{marginLeft: 8, opacity: 0.6}}>(locked)</span>}
                        </li>
                    ))}
                </ol>
            </div>
        </ProductContext.Provider>
    );
};

export const getServerSideProps: GetServerSideProps<Props> = async ({params, query}) => {
    const templateId = String(params?.templateId ?? '');
    const fixtureProductId = typeof query.product === 'string' ? query.product : undefined;
    const conn = getMongoConnection();
    const template = await conn.productTemplateService.get(templateId);
    if (!template) return {props: {template: null, product: null, sections: []}};
    let product: IProduct | null = fixtureProductId
        ? await conn.productService.getById(fixtureProductId)
        : null;
    if (!product) {
        const list = await conn.productService.list({limit: 1});
        product = Array.isArray(list) ? (list[0] ?? null) : null;
    }
    const sections = product
        ? conn.productTemplateService.applyTemplate(template, product)
        : template.sections;
    return {props: {template, product, sections}};
};

export default TemplatePreviewPage;
