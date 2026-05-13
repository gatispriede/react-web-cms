import React, {useState} from 'react';
import type {CarFinanceEstimatorProps, CarFinanceEstimatorSubmission} from './CarFinanceEstimator.types';
import './CarFinanceEstimator.scss';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const CarFinanceEstimator: React.FC<CarFinanceEstimatorProps> = ({
    testId,
    productId,
    onSubmit,
    headline = 'Check if financing fits',
    body = "Tell us a preferred monthly payment range. We'll route your request to our finance partners — no automated quote, no credit check at this stage.",
    submitLabel = 'Request a quote',
    successLabel = "Thanks — we'll be in touch within a business day.",
}) => {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (busy) return;
        const fd = new FormData(e.currentTarget);
        const name = String(fd.get('name') ?? '').trim();
        const email = String(fd.get('email') ?? '').trim();
        const phone = String(fd.get('phone') ?? '').trim() || undefined;
        const min = Number(fd.get('minMonthly') ?? 0);
        const max = Number(fd.get('maxMonthly') ?? 0);
        const notes = String(fd.get('notes') ?? '').trim() || undefined;

        if (!name || !email) { setError('Please supply your name and email.'); return; }
        if (!EMAIL_RE.test(email)) { setError("That email doesn't look right."); return; }
        if (!min || !max || min <= 0 || max <= 0) { setError('Please supply a preferred monthly range.'); return; }
        if (min > max) { setError('Minimum must be lower than the maximum.'); return; }

        const submission: CarFinanceEstimatorSubmission = {name, email, phone, minMonthly: min, maxMonthly: max, notes};

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
            <div className="car-finance-estimator car-finance-estimator--sent" data-testid={`${testId}-success`} role="status">
                <p>{successLabel}</p>
            </div>
        );
    }

    return (
        <form
            className="car-finance-estimator"
            data-testid={testId}
            data-product-id={productId}
            onSubmit={handleSubmit}
            aria-label="Finance estimate request"
        >
            <header className="car-finance-estimator__header">
                <h3>{headline}</h3>
                <p>{body}</p>
            </header>
            <div className="car-finance-estimator__row">
                <label htmlFor={`${testId}-name`}>Name
                    <input id={`${testId}-name`} name="name" data-testid={`${testId}-name`} required />
                </label>
                <label htmlFor={`${testId}-email`}>Email
                    <input id={`${testId}-email`} type="email" name="email" autoComplete="email" data-testid={`${testId}-email`} required />
                </label>
            </div>
            <label htmlFor={`${testId}-phone`}>Phone (optional)
                <input id={`${testId}-phone`} type="tel" name="phone" autoComplete="tel" data-testid={`${testId}-phone`} />
            </label>
            <div className="car-finance-estimator__row">
                <label htmlFor={`${testId}-min`}>Min monthly
                    <input id={`${testId}-min`} type="number" name="minMonthly" min={0} data-testid={`${testId}-min`} required />
                </label>
                <label htmlFor={`${testId}-max`}>Max monthly
                    <input id={`${testId}-max`} type="number" name="maxMonthly" min={0} data-testid={`${testId}-max`} required />
                </label>
            </div>
            <label htmlFor={`${testId}-notes`}>Notes (optional)
                <textarea id={`${testId}-notes`} name="notes" rows={2} data-testid={`${testId}-notes`} />
            </label>
            {error && <p className="car-finance-estimator__error" data-testid={`${testId}-error`}>{error}</p>}
            <button type="submit" className="car-finance-estimator__submit" data-testid={`${testId}-submit`} disabled={busy}>
                {busy ? 'Sending…' : submitLabel}
            </button>
        </form>
    );
};

export default CarFinanceEstimator;
export {CarFinanceEstimator};
export type {CarFinanceEstimatorProps, CarFinanceEstimatorSubmission} from './CarFinanceEstimator.types';
