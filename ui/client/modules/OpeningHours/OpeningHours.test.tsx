// @vitest-environment jsdom
import React from 'react';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import OpeningHours from './OpeningHours';
import type {OpeningHoursDay} from './OpeningHours.types';

const SCHEDULE: OpeningHoursDay[] = [
    {day: 'Monday', opens: '09:00', closes: '17:00'},
    {day: 'Tuesday', opens: '09:00', closes: '17:00'},
    {day: 'Wednesday', opens: '09:00', closes: '17:00'},
    {day: 'Thursday', opens: '09:00', closes: '17:00'},
    {day: 'Friday', opens: '09:00', closes: '17:00'},
    {day: 'Saturday', opens: '10:00', closes: '14:00'},
    {day: 'Sunday'},
];

// 2026-05-11 is a Monday; choose noon -> open.
const MON_NOON = new Date('2026-05-11T12:00:00Z');
// 2026-05-11 08:00 -> before open.
const MON_EARLY = new Date('2026-05-11T08:00:00Z');
// 2026-05-17 is a Sunday -> closed all day.
const SUN_NOON = new Date('2026-05-17T12:00:00Z');

describe('OpeningHours', () => {
    it('renders 7 rows', () => {
        render(<OpeningHours testId="oh" schedule={SCHEDULE} nowOverride={MON_NOON} />);
        expect(screen.getByTestId('oh-row-Monday')).toBeInTheDocument();
        expect(screen.getByTestId('oh-row-Sunday')).toBeInTheDocument();
        const rows = document.querySelectorAll('[data-testid^="oh-row-"]');
        expect(rows.length).toBe(7);
    });

    it('marks current day with is-today class', () => {
        render(<OpeningHours testId="oh" schedule={SCHEDULE} timezone="UTC" nowOverride={MON_NOON} />);
        expect(screen.getByTestId('oh-row-Monday')).toHaveClass('is-today');
        expect(screen.getByTestId('oh-row-Tuesday')).not.toHaveClass('is-today');
    });

    it('shows Open now status when inside hours', () => {
        render(<OpeningHours testId="oh" schedule={SCHEDULE} timezone="UTC" nowOverride={MON_NOON} />);
        const status = screen.getByTestId('oh-status');
        expect(status).toHaveTextContent('Open now');
        expect(status).toHaveClass('opening-hours__status--open');
    });

    it('shows Closed status when outside hours', () => {
        render(<OpeningHours testId="oh" schedule={SCHEDULE} timezone="UTC" nowOverride={MON_EARLY} />);
        const status = screen.getByTestId('oh-status');
        expect(status).toHaveTextContent('Closed');
        expect(status).toHaveClass('opening-hours__status--closed');
    });

    it('renders Closed for closed-all-day entries', () => {
        render(<OpeningHours testId="oh" schedule={SCHEDULE} timezone="UTC" nowOverride={SUN_NOON} />);
        expect(screen.getByTestId('oh-row-Sunday')).toHaveTextContent('Closed');
    });

    it('emits grouped JSON-LD specifications', () => {
        render(<OpeningHours testId="oh" schedule={SCHEDULE} nowOverride={MON_NOON} />);
        const ld = screen.getByTestId('oh-jsonld');
        const parsed = JSON.parse(ld.innerHTML);
        expect(Array.isArray(parsed)).toBe(true);
        // Mon-Fri grouped (same hours) + Saturday alone = 2 groups, Sunday closed omitted.
        expect(parsed).toHaveLength(2);
        expect(parsed[0]).toEqual({
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            opens: '09:00',
            closes: '17:00',
        });
        expect(parsed[1].dayOfWeek).toEqual(['Saturday']);
    });

    it('omits JSON-LD when schemaOrg is false', () => {
        render(<OpeningHours testId="oh" schedule={SCHEDULE} schemaOrg={false} nowOverride={MON_NOON} />);
        expect(screen.queryByTestId('oh-jsonld')).toBeNull();
    });
});
