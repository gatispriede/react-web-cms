import React, {useCallback, useEffect, useState} from 'react';
import type {CtaAction, StickyCtaBarProps} from './StickyCtaBar.types';

type Variant = 'mobile' | 'desktop';

interface InternalProps extends StickyCtaBarProps {
    forceVariant?: Variant;
}

const MOBILE_MAX_WIDTH = 540;
const STORAGE_PREFIX = 'stickycta.dismissed.';

function readDismissed(key: string): boolean {
    if (typeof window === 'undefined') return false;
    try {
        return window.sessionStorage.getItem(STORAGE_PREFIX + key) === '1';
    } catch {
        return false;
    }
}

function writeDismissed(key: string): void {
    if (typeof window === 'undefined') return;
    try {
        window.sessionStorage.setItem(STORAGE_PREFIX + key, '1');
    } catch {
        // sessionStorage may throw in privacy modes — silent fallback keeps the bar dismissed in-memory only.
    }
}

function CtaEl({action, fallbackTestId}: {action: CtaAction; fallbackTestId: string}): React.ReactElement {
    const testid = action.testId ?? fallbackTestId;
    const cls = 'sticky-cta-bar__cta';
    const content = (
        <>
            {action.icon ? <span className="sticky-cta-bar__icon" aria-hidden>{action.icon}</span> : null}
            <span className="sticky-cta-bar__label">{action.label}</span>
        </>
    );
    if (action.href) {
        return (
            <a
                className={cls}
                href={action.href}
                data-testid={testid}
                aria-disabled={action.disabled || undefined}
                onClick={e => { if (action.disabled) e.preventDefault(); }}
            >{content}</a>
        );
    }
    return (
        <button
            type="button"
            className={cls}
            data-testid={testid}
            disabled={action.disabled}
            onClick={action.onClick}
        >{content}</button>
    );
}

const StickyCtaBar: React.FC<InternalProps> = ({ctas, persistKey, ariaLabel, forceVariant}) => {
    const [variant, setVariant] = useState<Variant>(() => forceVariant ?? 'mobile');
    const [dismissed, setDismissed] = useState<boolean>(() => readDismissed(persistKey));

    useEffect(() => {
        if (forceVariant) return;
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
        const mq = window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`);
        const apply = (): void => setVariant(mq.matches ? 'mobile' : 'desktop');
        apply();
        mq.addEventListener('change', apply);
        return () => mq.removeEventListener('change', apply);
    }, [forceVariant]);

    const handleDismiss = useCallback(() => {
        writeDismissed(persistKey);
        setDismissed(true);
    }, [persistKey]);

    useEffect(() => {
        if (variant !== 'desktop' || dismissed) return;
        const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') handleDismiss(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [variant, dismissed, handleDismiss]);

    if (!ctas || ctas.length === 0) return null;
    const capped = ctas.slice(0, 3);
    const visible = variant === 'desktop' ? capped.slice(0, 1) : capped;
    if (variant === 'desktop' && dismissed) return null;

    return (
        <div
            className={`sticky-cta-bar sticky-cta-bar--${variant}`}
            data-testid="sticky-cta-bar"
            role="region"
            aria-label={ariaLabel ?? 'Quick actions'}
        >
            {visible.map((cta, i) => (
                <CtaEl key={i} action={cta} fallbackTestId={`sticky-cta-bar-cta-${i}`} />
            ))}
            {variant === 'desktop' && (
                <button
                    type="button"
                    className="sticky-cta-bar__dismiss"
                    data-testid="sticky-cta-bar-dismiss"
                    aria-label="Dismiss"
                    onClick={handleDismiss}
                >×</button>
            )}
        </div>
    );
};

export default StickyCtaBar;
export {StickyCtaBar};
