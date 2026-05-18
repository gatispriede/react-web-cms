/**
 * `DownloadablePdf` — auto-rendered product spec sheet as a downloadable
 * PDF link. Used by the `B2B Spec Sheet` built-in template. Reuses
 * `services/features/Orders/InvoiceService` PDF primitives when present
 * (W8g VAT-compliant invoice rendering); falls back to a placeholder
 * link with a TODO marker otherwise. Phase 1.F (product-display-
 * templates).
 */
export interface IDownloadablePdf {
    /** Label rendered on the download button. Defaults to "Download spec sheet (PDF)". */
    label?: string;
    /** Explicit href override. When omitted the renderer points at
     *  `/api/products/{productId}/spec-sheet.pdf`. */
    href?: string;
}

export enum EDownloadablePdfStyle {
    Default = "default",
    /** Elevated card with PDF icon + meta. */
    Card = "card",
    /** Full-width accent band. */
    Banner = "banner",
    /** Subtle inline link with icon, no chrome. */
    Inline = "inline",
}
