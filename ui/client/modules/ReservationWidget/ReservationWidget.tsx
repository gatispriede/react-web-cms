import React, {useState} from 'react';
import type {ReservationSubmission, ReservationWidgetProps} from './ReservationWidget.types';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const ReservationWidget: React.FC<ReservationWidgetProps> = ({
    testId,
    onSubmit,
    minPartySize = 1,
    maxPartySize = 12,
    minDate,
    headline = 'Reserve a table',
    submitLabel = 'Request reservation',
    successLabel = "Thanks — we'll confirm your table within an hour.",
}) => {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (busy) return;
        const fd = new FormData(e.currentTarget);
        const date = String(fd.get('date') ?? '').trim();
        const time = String(fd.get('time') ?? '').trim();
        const partySize = Number(fd.get('partySize') ?? 0);
        const name = String(fd.get('name') ?? '').trim();
        const email = String(fd.get('email') ?? '').trim();
        const phone = String(fd.get('phone') ?? '').trim() || undefined;
        const notes = String(fd.get('notes') ?? '').trim() || undefined;

        if (!date || !time || !partySize || !name || !email) {
            setError('Please fill in date, time, party size, name and email.');
            return;
        }
        if (!EMAIL_RE.test(email)) { setError("That email doesn't look right."); return; }
        if (partySize < minPartySize || partySize > maxPartySize) {
            setError(`Party size must be between ${minPartySize} and ${maxPartySize}.`);
            return;
        }
        if (minDate && date < minDate) {
            setError('Please pick a later date.');
            return;
        }

        const submission: ReservationSubmission = {date, time, partySize, name, email, phone, notes};
        setBusy(true);
        setError(null);
        try {
            const res = await onSubmit(submission);
            if ('ok' in res && res.ok) { setSent(true); return; }
            if ('error' in res) { setError(res.error); }
        } finally {
            setBusy(false);
        }
    };

    if (sent) {
        return (
            <div
                className="reservation-widget reservation-widget--sent"
                data-testid={`${testId}-success`}
                role="status"
            >
                <p>{successLabel}</p>
            </div>
        );
    }

    return (
        <form
            className="reservation-widget"
            data-testid={testId}
            onSubmit={handleSubmit}
            aria-label="Reservation request"
        >
            <header className="reservation-widget__header">
                <h3>{headline}</h3>
            </header>
            <div className="reservation-widget__row">
                <label htmlFor={`${testId}-date`}>Date
                    <input
                        id={`${testId}-date`}
                        type="date"
                        name="date"
                        min={minDate}
                        data-testid={`${testId}-date`}
                        required
                    />
                </label>
                <label htmlFor={`${testId}-time`}>Time
                    <input
                        id={`${testId}-time`}
                        type="time"
                        name="time"
                        data-testid={`${testId}-time`}
                        required
                    />
                </label>
                <label htmlFor={`${testId}-party`}>Party size
                    <input
                        id={`${testId}-party`}
                        type="number"
                        name="partySize"
                        min={minPartySize}
                        max={maxPartySize}
                        data-testid={`${testId}-party`}
                        required
                    />
                </label>
            </div>
            <div className="reservation-widget__row">
                <label htmlFor={`${testId}-name`}>Name
                    <input id={`${testId}-name`} name="name" data-testid={`${testId}-name`} required />
                </label>
                <label htmlFor={`${testId}-email`}>Email
                    <input
                        id={`${testId}-email`}
                        type="email"
                        name="email"
                        autoComplete="email"
                        data-testid={`${testId}-email`}
                        required
                    />
                </label>
            </div>
            <label htmlFor={`${testId}-phone`}>Phone (optional)
                <input
                    id={`${testId}-phone`}
                    type="tel"
                    name="phone"
                    autoComplete="tel"
                    data-testid={`${testId}-phone`}
                />
            </label>
            <label htmlFor={`${testId}-notes`}>Notes (optional)
                <textarea id={`${testId}-notes`} name="notes" rows={2} data-testid={`${testId}-notes`} />
            </label>
            {error && <p className="reservation-widget__error" data-testid={`${testId}-error`}>{error}</p>}
            <button
                type="submit"
                className="reservation-widget__submit"
                data-testid={`${testId}-submit`}
                disabled={busy}
            >
                {busy ? 'Sending…' : submitLabel}
            </button>
        </form>
    );
};

export default ReservationWidget;
export {ReservationWidget};
export type {ReservationWidgetProps, ReservationSubmission} from './ReservationWidget.types';
