/**
 * Inquiry form — Contact-page workhorse. Author-defined topic chips + free
 * text fields + a Send button. Submissions POST to `/api/inquiry`, which
 * sends an email via SMTP (env-configured) to the recipient address from
 * `siteFlags.inquiryRecipientEmail` and audit-logs the row to the
 * `Inquiries` Mongo collection.
 */
export interface IInquiryFormField {
    /** Field name posted to the backend (e.g. "name", "email"). */
    name: string;
    /** Human-readable label rendered above / inside the input. */
    label: string;
    /** Placeholder copy for the input. */
    placeholder?: string;
    /** Field control kind — drives input type / textarea / email validation. */
    kind?: 'text' | 'email' | 'textarea';
    /** Required = client-side `required` attribute. */
    required?: boolean;
}

export interface IInquiryFormTopic {
    /** Internal value posted with the submission. */
    value: string;
    /** Display label on the chip. */
    label: string;
}

export interface IInquiryForm {
    /** Mono caps eyebrow (e.g. "INQUIRY · 002"). */
    eyebrow?: string;
    /** Display heading. */
    title?: string;
    /** Sub-line under the title. */
    subtitle?: string;
    /** Mono caps label above the topic chip row. */
    topicsLabel?: string;
    topics?: IInquiryFormTopic[];
    /** Form fields rendered in declaration order. */
    fields?: IInquiryFormField[];
    /** Submit-button label. */
    submitLabel?: string;
    /** Optional in-flight label while the POST is in flight. Falls back
     *  to "Sending…" when not provided. */
    sendingLabel?: string;
    /** Confirmation copy shown after a successful submit. */
    successMessage?: string;
    /** Side-note column copy under the chips (mono small caps). */
    sideNote?: string;
}

export enum EInquiryFormStyle {
    Default = "default",
    /** Paper / editorial CV variant — dashed rules, mono labels. */
    Editorial = "editorial",
}
