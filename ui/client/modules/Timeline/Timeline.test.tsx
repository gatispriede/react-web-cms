// @vitest-environment jsdom
import React from 'react';
import {describe, it, expect} from 'vitest';
import {render} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import Timeline from './Timeline';
import {EItemType} from '@enums/EItemType';
import type {ITimeline} from './Timeline.types';

const t = ((k: string) => k) as any;

const fixture: ITimeline = {
    entries: [
        {
            start: '2021', end: '2024', company: 'Acme', role: 'Staff engineer',
            location: 'Remote', domain: 'acme.com', contractType: 'Permanent',
            experience: ['Scaling', 'Mentoring'],
            achievements: ['Cut infra cost 40%'],
            quote: 'Ship small, learn fast',
        },
        {start: '2018', end: '2021', company: 'Beta', role: 'Senior engineer'},
    ],
};

describe('Timeline render', () => {
    it('renders one entry per row with when/who/role + detail grid where present', () => {
        const {container} = render(
            <Timeline
                item={{type: EItemType.Timeline, content: JSON.stringify(fixture), style: 'editorial'}}
                t={t}
                tApp={t}
            />,
        );
        const rows = container.querySelectorAll('.timeline__entry');
        expect(rows).toHaveLength(2);
        // first entry has full detail
        const whos = container.querySelectorAll('.timeline__who');
        expect(whos).toHaveLength(2);
        expect(whos[0].textContent).toContain('Acme');
        // detail grid only where experience/achievements/quote supplied
        expect(container.querySelectorAll('.timeline__detail')).toHaveLength(1);
        expect(container.querySelectorAll('.timeline__quote')).toHaveLength(1);
        // bullet lists
        const uls = container.querySelectorAll('.timeline__detail ul');
        expect(uls).toHaveLength(2);
        expect(uls[0].querySelectorAll('li')).toHaveLength(2);
        expect(uls[1].querySelectorAll('li')).toHaveLength(1);
    });

    it('empty entries: renders wrapper with zero rows', () => {
        const empty: ITimeline = {entries: []};
        const {container} = render(
            <Timeline
                item={{type: EItemType.Timeline, content: JSON.stringify(empty)}}
                t={t}
                tApp={t}
            />,
        );
        expect(container.querySelector('.timeline')).not.toBeNull();
        expect(container.querySelectorAll('.timeline__entry')).toHaveLength(0);
    });
});
