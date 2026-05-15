// @vitest-environment jsdom
import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import EventScheduleAgenda from './EventScheduleAgenda';
import type {ScheduleSession} from './EventScheduleAgenda.types';

const tracks = [
    {key: 'main', label: 'Main Stage'},
    {key: 'work', label: 'Workshops'},
];

const sessions: ScheduleSession[] = [
    {key: 's1', track: 'main', day: 'Day 1', startTime: '09:00', endTime: '10:00', title: 'Keynote', speaker: 'Alice'},
    {key: 's2', track: 'work', day: 'Day 1', startTime: '09:00', endTime: '10:00', title: 'Workshop A'},
    {key: 's3', track: 'main', day: 'Day 2', startTime: '11:00', endTime: '12:00', title: 'Panel'},
];

describe('EventScheduleAgenda', () => {
    it('renders all sessions when no filter (desktop)', () => {
        render(<EventScheduleAgenda testId="sa" tracks={tracks} sessions={sessions} forceVariant="desktop" />);
        expect(screen.getByTestId('sa-session-s1')).toBeInTheDocument();
        expect(screen.getByTestId('sa-session-s2')).toBeInTheDocument();
        expect(screen.getByTestId('sa-session-s3')).toBeInTheDocument();
    });

    it('filter chip toggle hides/shows sessions', () => {
        render(<EventScheduleAgenda testId="sa" tracks={tracks} sessions={sessions} forceVariant="desktop" />);
        fireEvent.click(screen.getByTestId('sa-filter-main'));
        expect(screen.getByTestId('sa-session-s1')).toBeInTheDocument();
        expect(screen.queryByTestId('sa-session-s2')).toBeNull();
        fireEvent.click(screen.getByTestId('sa-filter-main'));
        expect(screen.getByTestId('sa-session-s2')).toBeInTheDocument();
    });

    it("forceVariant='mobile' groups by day", () => {
        render(<EventScheduleAgenda testId="sa" tracks={tracks} sessions={sessions} forceVariant="mobile" />);
        expect(screen.getByTestId('sa-day-Day 1')).toBeInTheDocument();
        expect(screen.getByTestId('sa-day-Day 2')).toBeInTheDocument();
    });

    it("forceVariant='desktop' shows table layout", () => {
        const {container} = render(<EventScheduleAgenda testId="sa" tracks={tracks} sessions={sessions} forceVariant="desktop" />);
        expect(container.querySelector('table.event-schedule-agenda__table')).not.toBeNull();
        expect(screen.queryByTestId('sa-day-Day 1')).toBeNull();
    });

    it('multiple chips OR-combine', () => {
        render(<EventScheduleAgenda testId="sa" tracks={tracks} sessions={sessions} forceVariant="desktop" />);
        fireEvent.click(screen.getByTestId('sa-filter-main'));
        fireEvent.click(screen.getByTestId('sa-filter-work'));
        expect(screen.getByTestId('sa-session-s1')).toBeInTheDocument();
        expect(screen.getByTestId('sa-session-s2')).toBeInTheDocument();
        expect(screen.getByTestId('sa-session-s3')).toBeInTheDocument();
    });

    it('initialFilter pre-selects chips', () => {
        render(
            <EventScheduleAgenda
                testId="sa"
                tracks={tracks}
                sessions={sessions}
                initialFilter={['main']}
                forceVariant="desktop"
            />,
        );
        expect(screen.getByTestId('sa-filter-main').getAttribute('aria-pressed')).toBe('true');
        expect(screen.queryByTestId('sa-session-s2')).toBeNull();
    });
});
