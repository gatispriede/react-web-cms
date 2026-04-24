// @vitest-environment jsdom
import React from 'react';
import {describe, it, expect} from 'vitest';
import {render} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import Services from './Services';
import {EItemType} from '@enums/EItemType';
import type {IServices} from './Services.types';

const t = ((k: string) => k) as any;

const fixture: IServices = {
    sectionNumber: '§ 03',
    sectionTitle: 'Solutions *architecture*',
    sectionSubtitle: 'What I build',
    rows: [
        {number: '01', title: 'Discovery', description: 'Map the domain.', tags: ['workshops', 'audits'], ctaLabel: 'Learn more', ctaHref: '/d', iconGlyph: '◆'},
        {number: '02', title: 'Delivery', description: 'Ship steady.'},
    ],
};

describe('Services render', () => {
    it('renders header + one row per entry with number/title/description', () => {
        const {container} = render(
            <Services
                item={{type: EItemType.Services, content: JSON.stringify(fixture), style: 'grid'}}
                t={t}
                tApp={t}
            />,
        );
        expect(container.querySelector('.services-module__head')).not.toBeNull();
        expect(container.querySelector('.services-module__num')?.textContent).toContain('§ 03');
        const title = container.querySelector('.services-module__title');
        expect(title).not.toBeNull();
        // accent-run: `*architecture*` → <em class="em-accent">architecture</em>
        expect(title!.querySelector('em.em-accent')?.textContent).toBe('architecture');
        const rows = container.querySelectorAll('.services-module__row');
        expect(rows).toHaveLength(2);
        expect(container.querySelectorAll('.services-module__row-title')[0].textContent).toContain('Discovery');
        // tags on first row only
        const tagRows = container.querySelectorAll('.services-module__row-tags');
        expect(tagRows).toHaveLength(1);
        expect(tagRows[0].querySelectorAll('.services-module__tag')).toHaveLength(2);
        // CTA anchor for first row, none for second
        expect(container.querySelectorAll('.services-module__row-cta a')).toHaveLength(1);
    });

    it('empty rows: renders section wrapper with no rows + no header', () => {
        const empty: IServices = {rows: []};
        const {container} = render(
            <Services
                item={{type: EItemType.Services, content: JSON.stringify(empty)}}
                t={t}
                tApp={t}
            />,
        );
        expect(container.querySelector('.services-module')).not.toBeNull();
        expect(container.querySelector('.services-module__head')).toBeNull();
        expect(container.querySelectorAll('.services-module__row')).toHaveLength(0);
    });
});
