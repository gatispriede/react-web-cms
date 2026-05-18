// @vitest-environment jsdom
import React from 'react';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import ProcessTimeline from './ProcessTimeline';
import type {ProcessPhase} from './ProcessTimeline.types';

const phases: ProcessPhase[] = [
    {key: 'discover', title: 'Discover', date: '2024-01-15', description: 'Research and interviews.', status: 'done'},
    {key: 'design', title: 'Design', description: 'Wireframes and prototypes.', status: 'active'},
    {key: 'build', title: 'Build', description: 'Engineering.'},
];

describe('ProcessTimeline', () => {
    it('returns null when empty', () => {
        const {container} = render(<ProcessTimeline testId="pt" phases={[]} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders one li per phase', () => {
        render(<ProcessTimeline testId="pt" phases={phases} />);
        const items = screen.getByTestId('pt').querySelectorAll('li');
        expect(items).toHaveLength(3);
    });

    it('emits per-phase testids and data-status', () => {
        render(<ProcessTimeline testId="pt" phases={phases} />);
        expect(screen.getByTestId('pt-phase-discover').getAttribute('data-status')).toBe('done');
        expect(screen.getByTestId('pt-phase-design').getAttribute('data-status')).toBe('active');
        expect(screen.getByTestId('pt-phase-build').getAttribute('data-status')).toBe('pending');
    });

    it('renders date only when provided', () => {
        render(<ProcessTimeline testId="pt" phases={phases} />);
        expect(screen.getByTestId('pt-date-discover')).toBeInTheDocument();
        expect(screen.queryByTestId('pt-date-design')).toBeNull();
        expect(screen.queryByTestId('pt-date-build')).toBeNull();
    });

    it('defaults status to pending when absent', () => {
        render(<ProcessTimeline testId="pt" phases={[{key: 'x', title: 'X', description: 'd'}]} />);
        expect(screen.getByTestId('pt-phase-x').getAttribute('data-status')).toBe('pending');
    });

    it('defaults aria-label to "Project process timeline"', () => {
        render(<ProcessTimeline testId="pt" phases={phases} />);
        expect(screen.getByTestId('pt').getAttribute('aria-label')).toBe('Project process timeline');
    });

    it('honours custom ariaLabel', () => {
        render(<ProcessTimeline testId="pt" phases={phases} ariaLabel="Sprint phases" />);
        expect(screen.getByTestId('pt').getAttribute('aria-label')).toBe('Sprint phases');
    });

    it('sets aria-current="step" on the active phase only', () => {
        render(<ProcessTimeline testId="pt" phases={phases} />);
        expect(screen.getByTestId('pt-phase-design').getAttribute('aria-current')).toBe('step');
        expect(screen.getByTestId('pt-phase-discover').getAttribute('aria-current')).toBeNull();
        expect(screen.getByTestId('pt-phase-build').getAttribute('aria-current')).toBeNull();
    });
});
