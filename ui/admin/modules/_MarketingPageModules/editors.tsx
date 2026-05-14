/**
 * all-pages-module-composed — Marketing batch admin editors.
 *
 * `FeatureGrid` / `LogoCloud` / `PricingTable` / `TestimonialWall`
 * carry rich array content (feature cards, logo entries, pricing
 * tiers + matrix rows, testimonials). A bespoke typed form per module
 * is a follow-up — for now each editor is a validated JSON textarea,
 * the same placeholder approach `_ProductPageModules` shipped for its
 * auto-injected modules. Invalid JSON is left untouched so a
 * mid-edit keystroke doesn't blow away the blob.
 */
import React from 'react';
import {Input} from 'antd';
import type {IInputContent} from '@interfaces/IInputContent';

function pretty(raw: string): string {
    if (!raw) return '';
    try { return JSON.stringify(JSON.parse(raw), null, 2); } catch { return raw; }
}

const JsonAreaEditor: React.FC<IInputContent & {testid: string; hint: string}> = ({content, setContent, testid, hint}) => (
    <div className={`marketing-editor marketing-editor--${testid}`} data-testid={`editor-${testid}`}>
        <label style={{display: 'block', fontSize: 12, opacity: 0.8, marginBottom: 4}}>{hint}</label>
        <Input.TextArea
            data-testid={`editor-${testid}-json`}
            defaultValue={pretty(content)}
            onChange={e => setContent(e.target.value)}
            autoSize={{minRows: 6, maxRows: 24}}
            spellCheck={false}
            style={{fontFamily: 'monospace', fontSize: 12}}
        />
    </div>
);

export const FeatureGridEditor: React.FC<IInputContent> = (props) => (
    <JsonAreaEditor {...props} testid="feature-grid" hint='JSON — { "features": [{ "key", "title", "description" }], "columns": 2 | 3 }'/>
);

export const LogoCloudEditor: React.FC<IInputContent> = (props) => (
    <JsonAreaEditor {...props} testid="logo-cloud" hint='JSON — { "headline": "…", "logos": [{ "key", "name", "logoUrl", "href?" }] }'/>
);

export const PricingTableEditor: React.FC<IInputContent> = (props) => (
    <JsonAreaEditor {...props} testid="pricing-table" hint='JSON — { "tiers": [{ "key", "name", "monthlyPriceFormatted", "annualPriceFormatted", "ctaLabel", "ctaHref", "highlighted?" }], "features": [{ "key", "label", "perTier": { "<tierKey>": true | "text" } }] }'/>
);

export const TestimonialWallEditor: React.FC<IInputContent> = (props) => (
    <JsonAreaEditor {...props} testid="testimonial-wall" hint='JSON — { "items": [{ "key", "quote", "name", "role?", "company?", "photoUrl?" }], "desktopColumns": 2 | 3 | 4 }'/>
);
