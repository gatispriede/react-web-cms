/**
 * Car reservation CTA — Wave 7b. Anonymous "Reserve" button opens a
 * modal that collects email + phone and POSTs to /api/cars/reserve to
 * create an Inquiry tagged with the car externalId. Operator confirms
 * the deposit manually from the Cars admin pane.
 */
import React, {useState} from 'react';
import {useTranslation} from 'next-i18next/pages';

interface Props {
    carExternalId?: string;
    carSlug: string;
    testId?: string;
}

const CarReservationCta: React.FC<Props> = ({carExternalId, carSlug, testId}) => {
    const {t} = useTranslation('common');
    const [open, setOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [name, setName] = useState('');
    const [message, setMessage] = useState('');
    const [hp, setHp] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch('/api/cars/reserve', {
                method: 'POST',
                headers: {'content-type': 'application/json'},
                credentials: 'same-origin',
                body: JSON.stringify({
                    carExternalId, carSlug,
                    email, phone, name, message,
                    website: hp,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(data?.error || `Failed (${res.status})`);
                return;
            }
            setSuccess(true);
        } catch (err) {
            setError(String((err as Error).message ?? err));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div data-testid={testId ?? 'car-reservation-cta'}>
            <button
                type="button"
                data-testid="car-reservation-open-button"
                onClick={() => setOpen(true)}
                style={{
                    width: '100%', padding: '12px 16px', fontSize: 16, fontWeight: 600,
                    background: 'var(--theme-accent, #1f1f1f)', color: '#fff',
                    border: 'none', borderRadius: 8, cursor: 'pointer',
                }}
            >
                {t('cars.reserve.cta', {defaultValue: 'Reserve this car'}) as string}
            </button>
            {open ? (
                <div
                    role="dialog"
                    aria-modal="true"
                    data-testid="car-reservation-modal"
                    style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                    }}
                    onClick={() => !submitting && setOpen(false)}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{background: '#fff', borderRadius: 8, padding: 24, width: 'min(480px, 92vw)', color: '#222'}}
                    >
                        <h3 style={{marginTop: 0}}>{t('cars.reserve.title', {defaultValue: 'Reserve this car'}) as string}</h3>
                        {success ? (
                            <div data-testid="car-reservation-success">
                                <p>{t('cars.reserve.success', {defaultValue: 'Thanks — we will be in touch shortly to confirm the deposit and finalise the hold.'}) as string}</p>
                                <button
                                    type="button"
                                    data-testid="car-reservation-close-success"
                                    onClick={() => { setOpen(false); setSuccess(false); }}
                                >
                                    {t('Close', {defaultValue: 'Close'}) as string}
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={onSubmit} data-testid="car-reservation-form">
                                <label style={{display: 'block', marginBottom: 12}}>
                                    <span style={{display: 'block', fontSize: 13, marginBottom: 4}}>{t('Email', {defaultValue: 'Email'}) as string} *</span>
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        data-testid="car-reservation-email"
                                        style={{width: '100%', padding: 8, fontSize: 14, border: '1px solid #ccc', borderRadius: 4}}
                                    />
                                </label>
                                <label style={{display: 'block', marginBottom: 12}}>
                                    <span style={{display: 'block', fontSize: 13, marginBottom: 4}}>{t('Phone', {defaultValue: 'Phone'}) as string} *</span>
                                    <input
                                        type="tel"
                                        required
                                        value={phone}
                                        onChange={e => setPhone(e.target.value)}
                                        data-testid="car-reservation-phone"
                                        style={{width: '100%', padding: 8, fontSize: 14, border: '1px solid #ccc', borderRadius: 4}}
                                    />
                                </label>
                                <label style={{display: 'block', marginBottom: 12}}>
                                    <span style={{display: 'block', fontSize: 13, marginBottom: 4}}>{t('Name', {defaultValue: 'Name'}) as string}</span>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        data-testid="car-reservation-name"
                                        style={{width: '100%', padding: 8, fontSize: 14, border: '1px solid #ccc', borderRadius: 4}}
                                    />
                                </label>
                                <label style={{display: 'block', marginBottom: 12}}>
                                    <span style={{display: 'block', fontSize: 13, marginBottom: 4}}>{t('Message', {defaultValue: 'Message'}) as string}</span>
                                    <textarea
                                        value={message}
                                        onChange={e => setMessage(e.target.value)}
                                        data-testid="car-reservation-message"
                                        rows={3}
                                        style={{width: '100%', padding: 8, fontSize: 14, border: '1px solid #ccc', borderRadius: 4}}
                                    />
                                </label>
                                {/* Honeypot — must stay empty */}
                                <input
                                    type="text"
                                    value={hp}
                                    onChange={e => setHp(e.target.value)}
                                    tabIndex={-1}
                                    autoComplete="off"
                                    aria-hidden="true"
                                    name="website"
                                    style={{position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0}}
                                />
                                {error ? (
                                    <div data-testid="car-reservation-error" style={{color: '#b00020', fontSize: 13, marginBottom: 8}}>{error}</div>
                                ) : null}
                                <div style={{display: 'flex', gap: 8, justifyContent: 'flex-end'}}>
                                    <button
                                        type="button"
                                        data-testid="car-reservation-cancel"
                                        onClick={() => setOpen(false)}
                                        disabled={submitting}
                                    >
                                        {t('Cancel', {defaultValue: 'Cancel'}) as string}
                                    </button>
                                    <button
                                        type="submit"
                                        data-testid="car-reservation-submit"
                                        disabled={submitting}
                                        style={{background: 'var(--theme-accent, #1f1f1f)', color: '#fff', padding: '8px 16px', border: 'none', borderRadius: 4, fontWeight: 600}}
                                    >
                                        {submitting
                                            ? (t('Sending…', {defaultValue: 'Sending…'}) as string)
                                            : (t('cars.reserve.submit', {defaultValue: 'Send reservation request'}) as string)}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            ) : null}
        </div>
    );
};

export default CarReservationCta;
