import React from 'react';
import type {DayOfWeek, OpeningHoursDay, OpeningHoursProps} from './OpeningHours.types';

const DAY_ORDER: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_INDEX: Record<DayOfWeek, number> = {Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6};

interface NowParts {
    dayIndex: number;   // 0=Sunday .. 6=Saturday (matches Date#getDay)
    minutes: number;    // minutes since midnight in the target zone
}

function partsFromDate(d: Date, timezone?: string): NowParts {
    if (!timezone) {
        return {dayIndex: d.getDay(), minutes: d.getHours() * 60 + d.getMinutes()};
    }
    // Intl.DateTimeFormat gives us zone-correct wall-clock parts without pulling tz-data.
    try {
        const fmt = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            weekday: 'long',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });
        const parts = fmt.formatToParts(d);
        const weekday = parts.find(p => p.type === 'weekday')?.value as DayOfWeek | undefined;
        const hour = Number(parts.find(p => p.type === 'hour')?.value ?? 0);
        const minute = Number(parts.find(p => p.type === 'minute')?.value ?? 0);
        return {
            dayIndex: weekday ? DAY_INDEX[weekday] : d.getDay(),
            minutes: (hour % 24) * 60 + minute,
        };
    } catch {
        return {dayIndex: d.getDay(), minutes: d.getHours() * 60 + d.getMinutes()};
    }
}

function hhmmToMinutes(s: string): number {
    const [h, m] = s.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
}

function isOpenNow(day: OpeningHoursDay | undefined, nowMin: number): boolean {
    if (!day || !day.opens || !day.closes) return false;
    const o = hhmmToMinutes(day.opens);
    const c = hhmmToMinutes(day.closes);
    if (c <= o) return false;
    return nowMin >= o && nowMin < c;
}

function groupHours(schedule: OpeningHoursDay[]): {dayOfWeek: DayOfWeek[]; opens: string; closes: string}[] {
    const groups: {dayOfWeek: DayOfWeek[]; opens: string; closes: string}[] = [];
    for (const d of schedule) {
        if (!d.opens || !d.closes) continue;
        const last = groups[groups.length - 1];
        if (last && last.opens === d.opens && last.closes === d.closes) {
            last.dayOfWeek.push(d.day);
        } else {
            groups.push({dayOfWeek: [d.day], opens: d.opens, closes: d.closes});
        }
    }
    return groups;
}

const OpeningHours: React.FC<OpeningHoursProps> = ({
    testId,
    schedule,
    timezone,
    schemaOrg = true,
    nowOverride,
}) => {
    if (!schedule || schedule.length === 0) return null;

    const now = nowOverride ?? new Date();
    const {dayIndex, minutes} = partsFromDate(now, timezone);
    // Date#getDay: 0=Sun..6=Sat. Convert to our DAY_ORDER (Mon..Sun) index.
    const todayName: DayOfWeek = dayIndex === 0 ? 'Sunday' : DAY_ORDER[dayIndex - 1];
    const todayEntry = schedule.find(d => d.day === todayName);
    const open = isOpenNow(todayEntry, minutes);

    const grouped = groupHours(schedule);
    const jsonLd = grouped.map(g => ({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: g.dayOfWeek,
        opens: g.opens,
        closes: g.closes,
    }));

    return (
        <div className="opening-hours" data-testid={testId}>
            <span
                className={`opening-hours__status opening-hours__status--${open ? 'open' : 'closed'}`}
                data-testid={`${testId}-status`}
                role="status"
            >{open ? 'Open now' : 'Closed'}</span>
            <table className="opening-hours__table">
                <caption className="opening-hours__caption">Opening hours</caption>
                <tbody>
                    {schedule.map(d => {
                        const isToday = d.day === todayName;
                        const closed = !d.opens || !d.closes;
                        return (
                            <tr
                                key={d.day}
                                className={`opening-hours__row${isToday ? ' is-today' : ''}`}
                                data-testid={`${testId}-row-${d.day}`}
                            >
                                <th scope="row" className="opening-hours__day">{d.day}</th>
                                <td className="opening-hours__hours">
                                    {closed ? 'Closed' : `${d.opens} – ${d.closes}`}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            {schemaOrg && jsonLd.length > 0 && (
                <script
                    type="application/ld+json"
                    data-testid={`${testId}-jsonld`}
                    dangerouslySetInnerHTML={{__html: JSON.stringify(jsonLd)}}
                />
            )}
        </div>
    );
};

export default OpeningHours;
export {OpeningHours};
export type {OpeningHoursProps, OpeningHoursDay, DayOfWeek} from './OpeningHours.types';
