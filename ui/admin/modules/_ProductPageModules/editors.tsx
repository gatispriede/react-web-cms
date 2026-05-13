/**
 * Phase 1.C — 5 thin editor components, one per new module.
 *
 * Each delegates to `PlaceholderJsonEditor` with module-specific copy.
 * Pagination additionally renders a constrained `<Select>` for the
 * `variant` field — predefined-selection rule (per coding-principles).
 */
import React from 'react';
import {Select, Typography} from 'antd';
import type {IInputContent} from '@interfaces/IInputContent';
import {PlaceholderJsonEditor} from './PlaceholderJsonEditor';
import {PAGINATION_VARIANT_OPTIONS, type IPagination} from '@client/modules/Pagination';

const {Paragraph} = Typography;

export const ProductDetailHeroEditor: React.FC<IInputContent> = (props) => (
    <PlaceholderJsonEditor
        {...props}
        label="Product detail hero"
        description="Gallery + title + price + Buy CTA + VAT badge. Auto-bound to the page's productId."
        testidSuffix="product-detail-hero"
    />
);

export const ProductSpecTableEditor: React.FC<IInputContent> = (props) => (
    <PlaceholderJsonEditor
        {...props}
        label="Product spec table"
        description="Two-column key/value sheet. Defaults to auto-render from IProduct.attributes."
        testidSuffix="product-spec-table"
    />
);

export const ProductDescriptionEditor: React.FC<IInputContent> = (props) => (
    <PlaceholderJsonEditor
        {...props}
        label="Product description"
        description="Rich body — defaults to the product's stored description, overridable inline."
        testidSuffix="product-description"
    />
);

export const BreadcrumbEditor: React.FC<IInputContent> = (props) => (
    <PlaceholderJsonEditor
        {...props}
        label="Breadcrumb"
        description="Auto-walks the page parent chain N-deep. Override via JSON for curated trails."
        testidSuffix="breadcrumb"
    />
);

// Phase 1.F — product-display-templates: 4 net-new modules consumed by
// the 5 built-in templates + operator-created custom templates. Editors
// use the same JSON placeholder pattern until per-module UIs land.

export const LargeGalleryEditor: React.FC<IInputContent> = (props) => (
    <PlaceholderJsonEditor
        {...props}
        label="Large gallery"
        description="Image-led full-bleed gallery. Defaults to product.images via ProductContext when bound."
        testidSuffix="large-gallery"
    />
);

export const SubProductsGridEditor: React.FC<IInputContent> = (props) => (
    <PlaceholderJsonEditor
        {...props}
        label="Sub-products grid"
        description="Renders sibling products under a parent. For the Bundle template."
        testidSuffix="sub-products-grid"
    />
);

export const DownloadablePdfEditor: React.FC<IInputContent> = (props) => (
    <PlaceholderJsonEditor
        {...props}
        label="Downloadable PDF"
        description="Auto-renders the product spec sheet as a PDF download link."
        testidSuffix="downloadable-pdf"
    />
);

export const WarrantyInfoEditor: React.FC<IInputContent> = (props) => (
    <PlaceholderJsonEditor
        {...props}
        label="Warranty info"
        description="Warranty terms — auto-binds to product.attributes.warrantyYears/warrantyTerms."
        testidSuffix="warranty-info"
    />
);

/** Pagination editor — exposes the variant as a constrained Select. */
export const PaginationEditor: React.FC<IInputContent> = ({content, setContent}) => {
    let parsed: IPagination;
    try {
        parsed = JSON.parse(content || '{"variant":"load-more"}') as IPagination;
    } catch {
        parsed = {variant: 'load-more'};
    }
    const onVariantChange = (v: IPagination['variant']) => {
        setContent(JSON.stringify({...parsed, variant: v}));
    };
    return (
        <div className="module-editor-pagination">
            <Paragraph strong>Pagination</Paragraph>
            <Paragraph type="secondary">Cursor-based — pick the UX variant.</Paragraph>
            <Select<IPagination['variant']>
                data-testid="module-editor-pagination-variant"
                value={parsed.variant}
                onChange={onVariantChange}
                options={[...PAGINATION_VARIANT_OPTIONS]}
                style={{minWidth: 220}}
            />
        </div>
    );
};
