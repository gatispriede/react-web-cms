export interface CountdownTimerProps {
    testId: string;
    /** ISO target instant. */
    target: string;
    /** Operator-overridable labels. */
    daysLabel?: string;
    hoursLabel?: string;
    minutesLabel?: string;
    secondsLabel?: string;
    endedLabel?: string;
    startingLabel?: string;
    /** Polling cadence in ms. Default 1000; bump to 60_000 for reduced-motion. */
    intervalMs?: number;
    /** Test-only override for "now". */
    nowOverride?: Date;
    /** Test-only force reduced-motion render path. */
    forceReducedMotion?: boolean;
}
