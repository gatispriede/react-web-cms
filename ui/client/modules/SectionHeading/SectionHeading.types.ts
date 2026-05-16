/**
 * SectionHeading — eyebrow + heading + optional subtitle.
 *
 * Replaces the hand-typed `<h2>§ 01 · Title</h2><p><em>Subtitle</em></p>`
 * pattern operators were stuffing into `RichText`. Audit (2026-05-16):
 * 20 sections across 4 pages on funisimo.pro use this exact shape.
 *
 * Style variants are theme-tuned, JSX is identical:
 *   - editorial         (§ NN numbering, serif heading, italic subtitle)
 *   - tech-modern       (saas-landing — violet mono eyebrow, sans display)
 *   - centered-marquee  (commerce — large centered display)
 *
 * Second module through the Stitch design pipeline (Claude-design step).
 */

export interface ISectionHeading {
    /** Mono-typeset eyebrow above the heading (e.g. "§ 01 · Capability matrix"). */
    eyebrow?: string;
    /** Required headline — H2 in the DOM for SEO + a11y hierarchy. */
    heading: string;
    /** Optional subtitle below the heading; italic in the editorial variant. */
    subtitle?: string;
    /** When set, overrides the variant's default alignment. */
    align?: 'left' | 'center';
}

export enum ESectionHeadingStyle {
    /** § NN eyebrow + serif heading + italic subtitle (editorial theme). Default. */
    Editorial = "editorial",
    /** Violet mono eyebrow + sans display (saas-landing theme). */
    TechModern = "tech-modern",
    /** Large centered display, marquee feel (commerce theme). */
    CenteredMarquee = "centered-marquee",
}
