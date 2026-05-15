export interface SaveSearchPromptProps {
    /** Stable testid prefix. */
    testId: string;
    /** Storage key for the dismissal flag. */
    persistKey: string;
    /** Visibility gate. When false the component renders nothing. */
    loggedIn: boolean;
    /** Activity ticker — caller increments this whenever the user changes a filter.
     *  When the prompt has been visible AT LEAST 5 seconds since the latest activity
     *  bump, the CTA stays mounted; visitor inactivity (no bump) restarts the countdown. */
    activityKey: string | number;
    /** Headline + body + CTA labels — operator-edited per locale. */
    headline?: string;
    body?: string;
    primaryLabel?: string;
    dismissLabel?: string;
    onSave: () => void | Promise<void>;
}
