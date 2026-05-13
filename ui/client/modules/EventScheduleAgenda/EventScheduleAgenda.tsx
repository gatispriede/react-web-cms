import React, {useCallback, useEffect, useMemo, useState} from 'react';
import type {EventScheduleAgendaProps, ScheduleSession} from './EventScheduleAgenda.types';

type Variant = 'mobile' | 'desktop';

const MOBILE_MAX = 540;

function detectVariant(force: Variant | undefined): Variant {
    if (force) return force;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'desktop';
    return window.matchMedia(`(max-width: ${MOBILE_MAX}px)`).matches ? 'mobile' : 'desktop';
}

function uniqueSorted<T>(arr: T[]): T[] {
    return Array.from(new Set(arr));
}

function SessionCard({session, testId}: {session: ScheduleSession; testId: string}): React.ReactElement {
    return (
        <div className="event-schedule-agenda__session" data-testid={`${testId}-session-${session.key}`}>
            <span className="event-schedule-agenda__time">{session.startTime}{'–'}{session.endTime}</span>
            <span className="event-schedule-agenda__title">{session.title}</span>
            {session.speaker ? (
                <span className="event-schedule-agenda__speaker">{session.speaker}</span>
            ) : null}
        </div>
    );
}

const EventScheduleAgenda: React.FC<EventScheduleAgendaProps> = ({
    testId,
    tracks,
    sessions,
    initialFilter,
    forceVariant,
}) => {
    const [autoVariant, setAutoVariant] = useState<Variant>(() => detectVariant(undefined));
    const [active, setActive] = useState<Set<string>>(() => new Set(initialFilter ?? []));

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
        const mq = window.matchMedia(`(max-width: ${MOBILE_MAX}px)`);
        const apply = (): void => setAutoVariant(mq.matches ? 'mobile' : 'desktop');
        mq.addEventListener('change', apply);
        return () => mq.removeEventListener('change', apply);
    }, []);

    const variant = forceVariant ?? autoVariant;

    const toggle = useCallback((key: string) => {
        setActive(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    }, []);

    const visible = useMemo(() => {
        if (active.size === 0) return sessions;
        return sessions.filter(s => active.has(s.track));
    }, [sessions, active]);

    const days = useMemo(() => uniqueSorted(sessions.map(s => s.day)), [sessions]);
    const timeSlots = useMemo(() => uniqueSorted(visible.map(s => s.startTime)).sort(), [visible]);

    return (
        <section className={`event-schedule-agenda event-schedule-agenda--${variant}`} data-testid={testId}>
            <div className="event-schedule-agenda__filters" role="group" aria-label="Filter by track">
                {tracks.map(t => {
                    const isOn = active.has(t.key);
                    return (
                        <button
                            key={t.key}
                            type="button"
                            className={`event-schedule-agenda__chip${isOn ? ' is-active' : ''}`}
                            data-testid={`${testId}-filter-${t.key}`}
                            aria-pressed={isOn}
                            onClick={() => toggle(t.key)}
                            style={t.color ? {borderColor: t.color} : undefined}
                        >{t.label}</button>
                    );
                })}
            </div>

            {variant === 'desktop' ? (
                <table className="event-schedule-agenda__table">
                    <thead>
                        <tr>
                            <th scope="col" className="event-schedule-agenda__th-time">Time</th>
                            {tracks.map(t => (
                                <th key={t.key} scope="col">{t.label}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {timeSlots.map(slot => (
                            <tr key={slot}>
                                <th scope="row" className="event-schedule-agenda__th-time">{slot}</th>
                                {tracks.map(t => {
                                    const cell = visible.find(s => s.startTime === slot && s.track === t.key);
                                    return (
                                        <td key={t.key}>
                                            {cell ? <SessionCard session={cell} testId={testId} /> : null}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : (
                <div className="event-schedule-agenda__mobile">
                    {days.map(day => {
                        const inDay = visible.filter(s => s.day === day);
                        if (inDay.length === 0) return null;
                        return (
                            <div
                                key={day}
                                className="event-schedule-agenda__day"
                                data-testid={`${testId}-day-${day}`}
                            >
                                <h3 className="event-schedule-agenda__day-title">{day}</h3>
                                <ul className="event-schedule-agenda__list" role="list">
                                    {inDay.map(s => (
                                        <li key={s.key}>
                                            <SessionCard session={s} testId={testId} />
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
};

export default EventScheduleAgenda;
export {EventScheduleAgenda};
