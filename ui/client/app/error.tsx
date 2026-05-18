'use client';

/**
 * Themed route-level error boundary — App Router migration, Batch 1.
 *
 * App-Router replacement for the runtime-error half of `pages/_error.tsx`
 * (the 404 half moved to `app/not-found.tsx`; the hard-SSR-500 half moves
 * to `app/global-error.tsx`). Next renders this file when a Server or
 * Client Component below the root layout throws during rendering.
 *
 * MUST be a Client Component — the App Router contract requires `error.tsx`
 * to be `'use client'` and to accept `{error, reset}`. Translations come
 * from the v16 `useT` client hook (`next-i18next/client`), hydrated by the
 * `<I18nProvider>` mounted in `app/providers.tsx` — the App-Router analog
 * of the `appWithTranslation` HOC the old `_error.tsx` relied on.
 *
 * `pages/_error.tsx` and `pages/500.tsx` were deleted in the same change.
 * This boundary still sits inside `app/layout.tsx`, so the active theme's
 * CSS vars + `<body data-theme-name>` are present and `<ErrorScreen/>`
 * stays on-brand.
 */
import React, {useEffect} from 'react';
import type {TFunction} from 'i18next';
import {useT} from 'next-i18next/client';
import ErrorScreen from '@client/features/ErrorScreen/ErrorScreen';
import {reportError} from '@client/lib/reportError';

interface ErrorBoundaryProps {
    error: Error & {digest?: string};
    reset: () => void;
}

export default function RouteError({error}: ErrorBoundaryProps): React.ReactElement {
    const {t} = useT('app');

    useEffect(() => {
        // Surface the boundary-caught error to the server reporter, same
        // as any uncaught client error would be (ClientRuntimeHost installs
        // the reporter; this is a belt-and-braces explicit report so the
        // `digest` is captured even if the global handler missed it).
        reportError({
            message: error.message,
            stack: error.stack,
            scope: 'app-router.error-boundary',
            extra: error.digest ? {digest: error.digest} : undefined,
        });
    }, [error]);

    return (
        <ErrorScreen
            code={500}
            title={t('Something went wrong') as string}
            description={t('An unexpected error occurred. Try again in a moment, or head back home and try a different route.') as string}
            t={t as unknown as TFunction<'translation', undefined>}
        />
    );
}
