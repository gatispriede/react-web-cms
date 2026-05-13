export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export interface OpeningHoursDay {
    day: DayOfWeek;
    opens?: string;   // 'HH:MM' — undefined => closed all day
    closes?: string;
}

export interface OpeningHoursProps {
    testId: string;
    /** Exactly 7 entries Mon..Sun (caller's job). */
    schedule: OpeningHoursDay[];
    /** IANA timezone, e.g. 'Europe/Riga'. Defaults to runtime locale. */
    timezone?: string;
    /** Inject Schema.org OpeningHoursSpecification. Default true. */
    schemaOrg?: boolean;
    /** Test-only forced "now" for deterministic open-now tests. */
    nowOverride?: Date;
}
