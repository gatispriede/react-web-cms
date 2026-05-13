import React, {useMemo} from 'react';
import {
    type OauthButtonStackProps,
    type OauthProvider,
    PROVIDER_LABELS,
    WEB_ORDER,
    IOS_ORDER,
} from './OauthButtonStack.types';

function detectPlatform(): 'ios' | 'web' {
    if (typeof navigator === 'undefined') return 'web';
    const ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
    // iPadOS pretends to be Mac — detect via touch.
    if (/Mac OS X/.test(ua) && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1) return 'ios';
    return 'web';
}

const OauthButtonStack: React.FC<OauthButtonStackProps> = ({
    testId,
    onChoose,
    lastUsed,
    providers,
    forcePlatform,
}) => {
    const ordered = useMemo<OauthProvider[]>(() => {
        const platform = forcePlatform ?? detectPlatform();
        const base = platform === 'ios' ? [...IOS_ORDER] : [...WEB_ORDER];
        const subset = providers ? base.filter(p => providers.includes(p)) : base;
        if (lastUsed && subset.includes(lastUsed)) {
            return [lastUsed, ...subset.filter(p => p !== lastUsed)];
        }
        return subset;
    }, [forcePlatform, providers, lastUsed]);

    if (ordered.length === 0) return null;

    return (
        <div className="oauth-button-stack" data-testid={testId}>
            {ordered.map(provider => (
                <button
                    key={provider}
                    type="button"
                    className={`oauth-button oauth-button--${provider}`}
                    data-testid={`${testId}-${provider}`}
                    data-provider={provider}
                    onClick={() => onChoose(provider)}
                >
                    <span className="oauth-button__icon" aria-hidden />
                    <span className="oauth-button__label">{PROVIDER_LABELS[provider]}</span>
                </button>
            ))}
        </div>
    );
};

export default OauthButtonStack;
export {OauthButtonStack};
export type {OauthProvider, OauthButtonStackProps} from './OauthButtonStack.types';
