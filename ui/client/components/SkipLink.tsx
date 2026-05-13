/**
 * SkipLink — "Skip to main content" affordance.
 *
 * Wave 8a (WCAG 2.2 AA — landmarks + keyboard nav). First focusable element
 * on every page; only visible once focused (the `.skip-to-content` style in
 * `ui/client/styles/globals/global.scss` parks it offscreen at `-9999px`
 * left and brings it back to `0` on `:focus`). Target id `#main` resolves
 * to the `<main>` landmark in `app.tsx`.
 *
 * i18n: label flows through `next-i18next` (`a11y.skip.toMain`). SSR-safe —
 * no hooks beyond `useTranslation`.
 */
import {useTranslation} from 'next-i18next/pages';

export default function SkipLink(): JSX.Element {
    const {t} = useTranslation('common');
    return (
        <a
            href="#main"
            className="skip-to-content"
            data-testid="skip-link"
        >
            {t('a11y.skip.toMain', 'Skip to main content')}
        </a>
    );
}
