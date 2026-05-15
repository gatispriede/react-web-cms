/**
 * Phase 1.C — shared placeholder JSON editor for the 5 new modules
 * introduced by products-as-composable-page sub-jump B
 * (ProductDetailHero, ProductSpecTable, Pagination, ProductDescription,
 * Breadcrumb).
 *
 * These modules are mostly **auto-injected** by `CategoryTemplate` +
 * `ProductDetailTemplate`; the editor surface is a fallback for operators
 * who want to drop one onto a manual page. Bespoke per-module editors
 * (image-picker for the hero gallery, spec-row drag-reorder, etc.) ship
 * in a follow-up. Until then a JSON textarea is the honest minimum that
 * lets us register the modules without lying about the editing UX.
 *
 * Per `feedback_predefined_selections.md`: the Pagination module uses a
 * proper `<Select>` for its `variant` field — the JSON textarea is the
 * fallback for the other modules' free-shape content.
 */
import React from 'react';
import {Input, Typography} from 'antd';
import type {IInputContent} from '@interfaces/IInputContent';

const {Paragraph} = Typography;

/**
 * Render a label + description + JSON textarea. The `label` is shown
 * as a heading hint so operators know which module they're editing.
 */
export interface PlaceholderJsonEditorProps extends IInputContent {
    label: string;
    description: string;
    /** Optional data-testid suffix so e2e specs can target one of the
     *  several placeholder editors deterministically. */
    testidSuffix: string;
}

const PlaceholderJsonEditor: React.FC<PlaceholderJsonEditorProps> = ({content, setContent, label, description, testidSuffix}) => {
    return (
        <div className={`module-editor-placeholder module-editor-placeholder--${testidSuffix}`}>
            <Paragraph strong>{label}</Paragraph>
            <Paragraph type="secondary">{description}</Paragraph>
            <Input.TextArea
                data-testid={`module-editor-json-${testidSuffix}`}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                autoSize={{minRows: 6, maxRows: 14}}
            />
        </div>
    );
};

export default PlaceholderJsonEditor;
export {PlaceholderJsonEditor};
