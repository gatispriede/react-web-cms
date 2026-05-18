// @vitest-environment jsdom
import React from 'react';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import ChangelogTimeline from './ChangelogTimeline';
import type {ChangelogEntry} from './ChangelogTimeline.types';

const entries: ChangelogEntry[] = [
    {version: '2.3.0', date: '2026-05-10', title: 'New homepage hero', body: 'Refreshed messaging.', tags: ['feature']},
    {version: '2.2.1', date: '2026-05-01', title: 'Patch flaky CI', tags: ['fix', 'security']},
    {version: '2.2.0', date: '2026-04-20', title: 'Breaking change to API', tags: ['breaking']},
];

describe('ChangelogTimeline', () => {
    it('renders nothing when entries is empty', () => {
        const {container} = render(<ChangelogTimeline testId="cl" entries={[]} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders one entry per item with stable testids', () => {
        render(<ChangelogTimeline testId="cl" entries={entries} />);
        expect(screen.getByTestId('cl-entry-2.3.0')).toBeInTheDocument();
        expect(screen.getByTestId('cl-entry-2.2.1')).toBeInTheDocument();
        expect(screen.getByTestId('cl-entry-2.2.0')).toBeInTheDocument();
    });

    it('caps at maxEntries when provided', () => {
        render(<ChangelogTimeline testId="cl" entries={entries} maxEntries={2} />);
        expect(screen.getByTestId('cl-entry-2.3.0')).toBeInTheDocument();
        expect(screen.getByTestId('cl-entry-2.2.1')).toBeInTheDocument();
        expect(screen.queryByTestId('cl-entry-2.2.0')).toBeNull();
    });

    it('renders one tag badge per tag on each entry', () => {
        render(<ChangelogTimeline testId="cl" entries={entries} />);
        expect(screen.getByTestId('cl-tag-2.3.0-feature')).toBeInTheDocument();
        expect(screen.getByTestId('cl-tag-2.2.1-fix')).toBeInTheDocument();
        expect(screen.getByTestId('cl-tag-2.2.1-security')).toBeInTheDocument();
        expect(screen.getByTestId('cl-tag-2.2.0-breaking')).toBeInTheDocument();
    });

    it('formats the date via toLocaleDateString', () => {
        render(<ChangelogTimeline testId="cl" entries={[{version: '1.0.0', date: '2026-05-10', title: 't'}]} />);
        const expected = new Date('2026-05-10').toLocaleDateString();
        expect(screen.getByTestId('cl-date-1.0.0').textContent).toBe(expected);
    });
});
