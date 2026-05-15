'use client';

/**
 * Themed global error boundary — App Router migration, Batch 1.
 *
 * App-Router replacement for the hard-SSR-500 path that `pages/500.tsx`
 * and the `_error.tsx` catch-all handled. Next renders `global-error.tsx`
 * only when the **root layout itself** (`app/layout.tsx`) throws — at
 * that point the layout's `<html>` / `<body>` never rendered, so this
 * file must supply its own.
 *
 * Because it sits ABOVE `app/layout.tsx`, none of the providers are
 * mounted here — no `<I18nProvider>`, so no `useT`. The old `_error.tsx`
 * already documented that error-page copy falling back to the source
 * English string is acceptable (`fallbackLng: false`); a layout-level
 * crash is the rarest, most degraded state, so this boundary ships
 * static English copy rather than risking a second failure trying to
 * resolve translations. Theme CSS vars are also unavailable here (they
 * were resolved in the layout that just crashed), so `<ErrorScreen/>`
 * falls through to its built-in `var(--…, fallback)` defaults.
 *
 * MUST be a Client Component and accept `{error, reset}` per the App
 * Router contract. `pages/500.tsx` + `pages/_error.tsx` were deleted in
 * the same change.
 */
import React, {useEffect} from 'react';
import type {TFunction} from 'i18next';
import ErrorScreen from '@client/features/ErrorScreen/ErrorScreen';
import {reportError} from '@client/lib/reportError';

interface GlobalErrorProps {
    error: Error & {digest?: string};
    reset: () => void;
}

/**
 * Minimal `t` stand-in — `global-error.tsx` has no i18n provider in
 * scope (it renders above the root layout). `ErrorScreen` only calls
 * `t()` as an identity-with-fallback for already-English copy, so an
 * identity function is a correct, side-effect-free substitute.
 */
const identityT = ((key: string) => key) as unknown as TFunction<'translation', undefined>;

export default function GlobalError({error}: GlobalErrorProps): React.ReactElement {
    useEffect(() => {
        reportError({
            message: error.message,
            stack: error.stack,
            scope: 'app-router.global-error-boundary',
            level: 'error',
            extra: error.digest ? {digest: error.digest} : undefined,
        });
    }, [error]);

    return (
        <html lang="en">
            <body>
                <ErrorScreen
                    code={500}
                    title="Something went wrong"
                    description="A server error occurred. Try again in a moment, or head back home and try a different route."
                    t={identityT}
                />
            </body>
        </html>
    );
}
