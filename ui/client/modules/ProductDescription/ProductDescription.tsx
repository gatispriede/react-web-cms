/**
 * ProductDescription — Phase 1.C.
 *
 * Renders the bound product's description, or an operator override body
 * when set. Defensive against missing context.
 */
import React from 'react';
import type {IProductDescription} from './ProductDescription.types';
import './ProductDescription.scss';

export interface ProductDescriptionProps {
    content: IProductDescription | string;
    /** Test seam — injected description copy when used outside context. */
    description?: string;
}

function parseContent(raw: string | IProductDescription): IProductDescription {
    if (typeof raw === 'string') {
        try { return JSON.parse(raw) as IProductDescription; } catch { return {productId: ''}; }
    }
    return raw;
}

const ProductDescription: React.FC<ProductDescriptionProps> = ({content, description}) => {
    const c = parseContent(content);
    const body = c.body ?? description ?? '';
    if (!body) {
        return (
            <div className="product-description product-description--empty" data-testid="product-description-empty">
                <em>No description.</em>
            </div>
        );
    }
    return (
        <div className="product-description" data-testid="product-description">
            <p>{body}</p>
        </div>
    );
};

export default ProductDescription;
export {ProductDescription};
