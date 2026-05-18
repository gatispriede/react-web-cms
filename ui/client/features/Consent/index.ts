/**
 * W8b — cookie-consent / DNT-GPC feature.
 *
 * `ConsentBanner` is the globally-mounted first-visit banner; `ConsentPreferences`
 * is the per-category opt-in surface it expands (also reusable standalone). The
 * canonical storage + signal + registry lib lives at `@client/lib/consent`.
 */
export {default as ConsentBanner} from './ConsentBanner';
export {default as ConsentPreferences} from './ConsentPreferences';
