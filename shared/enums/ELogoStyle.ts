/**
 * Visual variants for the site-wide Logo top-bar slot.
 *
 * All variants read from theme tokens (`--logoBorderColor`, `--logoFrameBg`,
 * etc.) so swapping the active theme restyles the logo automatically. See
 * `ui/client/styles/Common/Logo.scss` for the token fallback chain.
 */
export enum ELogoStyle {
    Default = 'default',   // bare image / mark — current behaviour
    Bordered = 'bordered', // thin accent-coloured border + padding
    Framed = 'framed',     // card: bg + shadow + radius
    Circle = 'circle',     // round clip — for avatar-style marks
}
