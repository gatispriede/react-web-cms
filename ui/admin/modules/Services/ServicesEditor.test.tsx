// @vitest-environment jsdom
import React, {useState} from 'react';
import {describe, it, expect} from 'vitest';
import {render, fireEvent} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ServicesEditor from './ServicesEditor';
import Services from '@client/modules/Services';
import {EItemType} from '@enums/EItemType';

const t = ((k: string) => k) as any;

function Harness({initial}: {initial: string}) {
    const [c, setC] = useState(initial);
    return <div><ServicesEditor content={c} setContent={setC} t={t}/><div data-testid="out">{c}</div></div>;
}

describe('ServicesEditor addRow', () => {
    it('adds a row from the empty state', () => {
        const {getByText, getByTestId} = render(<Harness initial='{"rows":[]}'/>);
        fireEvent.click(getByText('Add service row'));
        expect(JSON.parse(getByTestId('out').textContent!).rows).toHaveLength(1);
    });

    it('adds multiple rows, preserves prior entries', () => {
        const {getByText, getByTestId} = render(<Harness initial='{"rows":[]}'/>);
        const btn = getByText('Add service row');
        fireEvent.click(btn); fireEvent.click(btn); fireEvent.click(btn);
        const rows = JSON.parse(getByTestId('out').textContent!).rows;
        expect(rows).toHaveLength(3);
        expect(rows.map((r: any) => r.number)).toEqual(['01', '02', '03']);
    });

    it('handles the registry defaultContent shape', () => {
        const def = '{"sectionNumber":"","sectionTitle":"","sectionSubtitle":"","rows":[]}';
        const {getByText, getByTestId} = render(<Harness initial={def}/>);
        fireEvent.click(getByText('Add service row'));
        const parsed = JSON.parse(getByTestId('out').textContent!);
        expect(parsed.rows).toHaveLength(1);
        expect(parsed).toHaveProperty('sectionNumber', '');
    });

    it('handles content with missing rows key (empty object)', () => {
        const {getByText, getByTestId} = render(<Harness initial='{}'/>);
        fireEvent.click(getByText('Add service row'));
        const parsed = JSON.parse(getByTestId('out').textContent!);
        expect(parsed.rows).toHaveLength(1);
    });

    it('handles corrupted content (non-JSON) without throwing', () => {
        // parse() catches + logs; _parsedContent stays stale, data accessor should still return defaults
        const {getByText, getByTestId} = render(<Harness initial='not json'/>);
        expect(() => fireEvent.click(getByText('Add service row'))).not.toThrow();
    });
});

describe('Services renderer — default item from registry', () => {
    it('renders a freshly-created (empty) Services item without crashing', () => {
        const def = '{"sectionNumber":"","sectionTitle":"","sectionSubtitle":"","rows":[]}';
        expect(() => {
            render(<Services
                item={{type: EItemType.Services, content: def}}
                t={t} tApp={t}/>);
        }).not.toThrow();
    });
});
