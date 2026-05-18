export interface BeforeAfterSliderProps {
    testId: string;
    beforeUrl: string;
    beforeAlt: string;
    afterUrl: string;
    afterAlt: string;
    /** Initial reveal percentage 0-100. Default 50. */
    initialPercent?: number;
    /** Operator labels for the labels overlaid in each region. */
    beforeLabel?: string;
    afterLabel?: string;
}
