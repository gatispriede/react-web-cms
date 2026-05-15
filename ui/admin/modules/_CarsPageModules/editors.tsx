/**
 * all-pages-module-composed — Cars batch admin editors.
 *
 * `CarsList` exposes only empty-state copy; the listing data + facets
 * are storefront-derived. `CarDetail` is fully car-driven — nothing to
 * configure. Both are thin, mirroring `_AccountPageModules`.
 */
import React from 'react';
import {Input} from 'antd';
import type {IInputContent} from '@interfaces/IInputContent';

function parse<T>(raw: string): T {
    if (!raw) return {} as T;
    try { return JSON.parse(raw) as T; } catch { return {} as T; }
}
function stringify<T>(v: T): string {
    try { return JSON.stringify(v); } catch { return '{}'; }
}

interface CarsListContent {
    emptyTitle?: string;
    emptyDescription?: string;
}

const Field: React.FC<{label: string; testid: string; value: string; onChange: (v: string) => void; placeholder?: string}> =
    ({label, testid, value, onChange, placeholder}) => (
        <div style={{marginBottom: 12}}>
            <label style={{display: 'block', fontSize: 12, opacity: 0.8, marginBottom: 4}}>{label}</label>
            <Input data-testid={`editor-${testid}`} value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}/>
        </div>
    );

export const CarsListEditor: React.FC<IInputContent> = ({content, setContent}) => {
    const d = parse<CarsListContent>(content);
    const patch = (p: Partial<CarsListContent>) => setContent(stringify({...d, ...p}));
    return (
        <div className="cars-editor cars-editor--cars-list" data-testid="editor-cars-list">
            <Field label="Empty-state title" testid="cars-list-empty-title" value={d.emptyTitle ?? ''} onChange={v => patch({emptyTitle: v})} placeholder="No cars match your filters"/>
            <Field label="Empty-state description (optional)" testid="cars-list-empty-body" value={d.emptyDescription ?? ''} onChange={v => patch({emptyDescription: v})}/>
        </div>
    );
};

export const CarDetailEditor: React.FC<IInputContent> = () => (
    <div className="cars-editor cars-editor--car-detail" data-testid="editor-car-detail">
        <p style={{fontSize: 12, opacity: 0.8, margin: 0}}>
            This module renders the car for the current <code>/cars/[slug]</code> URL —
            gallery, spec table, VAT badge and reservation CTA all come from the car
            record. Nothing to configure here.
        </p>
    </div>
);
