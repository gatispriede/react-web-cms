/**
 * Themed 404 — App Router migration, Batch 1.
 *
 * App-Router replacement for `pages/404.tsx`. Next renders this file
 * whenever a route is unmatched or `notFound()` is called. It is a
 * Server Component: the v16 `getT` server helper (from
 * `next-i18next/server`) resolves translations against the singleton
 * initialised in `app/i18n.ts`, replacing the Pages-Router
 * `serverSideTranslations` + `useTranslation` pair.
 *
 * `pages/404.tsx` was deleted in the same change. Picks up the active
 * theme's CSS vars from `app/layout.tsx` (injected `<style data-theme-vars>`),
 * exactly as the old page picked them up from `_document.tsx`.
 */
import React from 'react';
import type {TFunction} from 'i18next';
import {getT} from 'next-i18next/server';
import ErrorScreen from '@client/features/ErrorScreen/ErrorScreen';

export default async function NotFound(): Promise<React.ReactElement> {
    const {t} = await getT('app');
    return (
        <ErrorScreen
            code={404}
            title={t('Page not found') as string}
            description={t("The page you're looking for doesn't exist or has been moved.") as string}
            t={t as unknown as TFunction<'translation', undefined>}
        />
    );
}
