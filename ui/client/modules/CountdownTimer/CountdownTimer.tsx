import React, {useEffect, useState} from 'react';
import type {CountdownTimerProps} from './CountdownTimer.types';

interface Parts {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    ended: boolean;
}

function diff(target: Date, now: Date): Parts {
    const ms = target.getTime() - now.getTime();
    if (ms <= 0) return {days: 0, hours: 0, minutes: 0, seconds: 0, ended: true};
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return {days, hours, minutes, seconds, ended: false};
}

function detectReducedMotion(force: boolean | undefined): boolean {
    if (force !== undefined) return force;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({
    testId,
    target,
    daysLabel = 'Days',
    hoursLabel = 'Hours',
    minutesLabel = 'Minutes',
    secondsLabel = 'Seconds',
    endedLabel = 'Event ended',
    startingLabel = 'Starts in',
    intervalMs,
    nowOverride,
    forceReducedMotion,
}) => {
    const reduced = detectReducedMotion(forceReducedMotion);
    const targetDate = new Date(target);
    const [now, setNow] = useState<Date>(() => nowOverride ?? new Date());

    useEffect(() => {
        if (nowOverride) return;
        const cadence = intervalMs ?? (reduced ? 60_000 : 1000);
        const id = setInterval(() => setNow(new Date()), cadence);
        return () => clearInterval(id);
    }, [intervalMs, reduced, nowOverride]);

    const parts = diff(targetDate, nowOverride ?? now);

    if (parts.ended) {
        return (
            <div className="countdown-timer countdown-timer--ended" data-testid={testId}>
                <span className="countdown-timer__ended" data-testid={`${testId}-ended`}>{endedLabel}</span>
            </div>
        );
    }

    if (reduced) {
        return (
            <div className="countdown-timer countdown-timer--reduced" data-testid={testId}>
                <span
                    className="countdown-timer__reduced"
                    data-testid={`${testId}-reduced`}
                >{`${startingLabel} ${parts.days} ${daysLabel.toLowerCase()}`}</span>
            </div>
        );
    }

    const units: Array<{key: 'days' | 'hours' | 'minutes' | 'seconds'; value: number; label: string}> = [
        {key: 'days', value: parts.days, label: daysLabel},
        {key: 'hours', value: parts.hours, label: hoursLabel},
        {key: 'minutes', value: parts.minutes, label: minutesLabel},
        {key: 'seconds', value: parts.seconds, label: secondsLabel},
    ];

    return (
        <div className="countdown-timer" data-testid={testId} role="timer" aria-live="off">
            {units.map(u => (
                <div key={u.key} className={`countdown-timer__unit countdown-timer__unit--${u.key}`}>
                    <span
                        className="countdown-timer__value"
                        data-testid={`${testId}-${u.key}`}
                    >{String(u.value).padStart(2, '0')}</span>
                    <span className="countdown-timer__label">{u.label}</span>
                </div>
            ))}
        </div>
    );
};

export default CountdownTimer;
export {CountdownTimer};
