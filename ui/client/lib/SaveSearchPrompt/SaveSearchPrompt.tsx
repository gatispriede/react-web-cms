import React, {useCallback, useEffect, useState} from 'react';
import type {SaveSearchPromptProps} from './SaveSearchPrompt.types';

const STORAGE_PREFIX = 'savesearch.dismissed.';
const ACTIVITY_DELAY_MS = 5000;

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
        // sessionStorage may throw in privacy modes — silent fallback keeps the prompt dismissed in-memory only.
    }
}

const SaveSearchPrompt: React.FC<SaveSearchPromptProps> = ({
    testId,
    persistKey,
    loggedIn,
    activityKey,
    headline = 'Save this search?',
    body = "We'll email you when new results match.",
    primaryLabel = 'Save search',
    dismissLabel = 'Not now',
    onSave,
}) => {
    const [dismissed, setDismissed] = useState<boolean>(() => readDismissed(persistKey));
    // Stores the activityKey that the 5s timer most recently elapsed against; visibility is derived.
    const [readyKey, setReadyKey] = useState<string | number | null>(null);

    useEffect(() => {
        if (!loggedIn || dismissed) return;
        // Each activityKey change re-runs this effect; cleanup clears the previous timer so the 5s countdown restarts.
        const t = setTimeout(() => setReadyKey(activityKey), ACTIVITY_DELAY_MS);
        return () => clearTimeout(t);
    }, [loggedIn, dismissed, activityKey]);

    const handleDismiss = useCallback(() => {
        writeDismissed(persistKey);
        setDismissed(true);
    }, [persistKey]);

    const handleSave = useCallback(() => {
        void onSave();
        writeDismissed(persistKey);
        setDismissed(true);
    }, [onSave, persistKey]);

    const visible = readyKey === activityKey;

    if (!loggedIn || dismissed || !visible) return null;

    return (
        <div className="save-search-prompt" data-testid={testId} role="status">
            <div className="save-search-prompt__text">
                <h3 className="save-search-prompt__headline">{headline}</h3>
                <p className="save-search-prompt__body">{body}</p>
            </div>
            <div className="save-search-prompt__actions">
                <button
                    type="button"
                    className="save-search-prompt__save"
                    data-testid={`${testId}-save`}
                    onClick={handleSave}
                >{primaryLabel}</button>
                <button
                    type="button"
                    className="save-search-prompt__dismiss"
                    data-testid={`${testId}-dismiss`}
                    onClick={handleDismiss}
                >{dismissLabel}</button>
            </div>
        </div>
    );
};

export default SaveSearchPrompt;
export {SaveSearchPrompt};
