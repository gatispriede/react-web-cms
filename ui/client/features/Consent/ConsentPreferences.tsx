/**
 * W8b — consent preference surface (per-category opt-in toggles).
 *
 * Rendered both inside the banner ("Manage preferences" expands it) and as a
 * standalone revoke/adjust panel. Strictly-necessary is locked on. Each row
 * carries a `data-testid` so e2e specs can target individual toggles.
 *
 * Inline styles intentional — same rationale as the banner: the consent UI
 * must render correctly before global stylesheets load (no FOUC, no missing
 * controls on a slow first paint).
 */
import React from 'react';
import {
    CONSENT_CATEGORIES,
    COOKIE_REGISTRY,
    type CookieCategory,
    type ConsentRecord,
} from '@client/lib/consent';

const CATEGORY_LABEL: Record<CookieCategory, string> = {
    necessary: 'Strictly necessary',
    functional: 'Functional',
    analytics: 'Analytics',
    marketing: 'Marketing',
};

const CATEGORY_DESC: Record<CookieCategory, string> = {
    necessary: 'Required for the site to work — session, security, language. Always on.',
    functional: 'Remembers your preferences (theme, currency, recent searches).',
    analytics: 'Aggregate, anonymised usage stats so we can improve the site.',
    marketing: 'Attribution + advertising-effectiveness measurement.',
};

interface ConsentPreferencesProps {
    draft: ConsentRecord;
    onChange: (next: ConsentRecord) => void;
}

const ConsentPreferences: React.FC<ConsentPreferencesProps> = ({draft, onChange}) => (
    <div data-testid="consent-preferences" style={{margin: '12px 0'}}>
        {CONSENT_CATEGORIES.map(cat => {
            const locked = cat === 'necessary';
            const cookies = COOKIE_REGISTRY.filter(c => c.category === cat);
            return (
                <label
                    key={cat}
                    data-testid={`consent-preferences-category-${cat}`}
                    style={{display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0'}}
                >
                    <input
                        type="checkbox"
                        checked={locked ? true : Boolean(draft.categories[cat])}
                        disabled={locked}
                        onChange={e => onChange({
                            ...draft,
                            categories: {...draft.categories, [cat]: e.target.checked, necessary: true},
                        })}
                        data-testid={`consent-preferences-toggle-${cat}`}
                        style={{marginTop: 3}}
                    />
                    <span>
                        <strong>{CATEGORY_LABEL[cat]}</strong>
                        <br/>
                        <span style={{fontSize: 13, opacity: 0.75}}>{CATEGORY_DESC[cat]}</span>
                        {cookies.length > 0 && (
                            <span style={{display: 'block', fontSize: 12, opacity: 0.6, marginTop: 2}}>
                                Cookies: {cookies.map(c => c.name).join(', ')}
                            </span>
                        )}
                    </span>
                </label>
            );
        })}
    </div>
);

export default ConsentPreferences;
