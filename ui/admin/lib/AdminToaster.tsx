/**
 * Admin Sonner `<Toaster/>` wrapper — the single toast container for the
 * admin chrome. Mounted once in `ui/admin/shell/AdminApp.tsx`.
 *
 * Why a wrapper instead of using `<Toaster/>` directly:
 *  - `AdminApp` is a class component, so it can't `useAdminDarkMode()` to
 *    feed Sonner's `theme` prop. This wrapper is the function component
 *    that subscribes to the `adminDarkMode` store and re-renders the
 *    Toaster with `theme="dark" | "light"` in lockstep with the rest of
 *    the admin chrome (the top-bar `DarkModeSwitcher` + AntD
 *    `ConfigProvider` algorithm). Without this the toasts stayed light
 *    while everything else flipped to dark.
 *  - Keeps the Sonner config (position, duration, richColors) in one
 *    spot next to `notify.ts`, the only other module that imports
 *    `sonner` directly.
 *
 * Dark-mode source of truth: `@admin/lib/adminDarkMode` (localStorage
 * `admin.darkMode` + `data-admin-theme` on `<html>`). See
 * `docs/roadmap/admin/admin-dark-mode-audit.md`.
 */
import React from 'react';
import {Toaster} from 'sonner';
import {useAdminDarkMode} from '@admin/lib/adminDarkMode';

export default function AdminToaster(): React.ReactElement {
    const {dark} = useAdminDarkMode();
    // Sonner v1.x doesn't accept `data-testid` in `toastOptions`, so the
    // e2e hook is a wrapping `<div data-testid>` for "the toast surface
    // exists" plus a stable `admin-toast` class on every rendered toast
    // (`.admin-toast[data-sonner-toast]`) for per-toast text assertions —
    // per the roadmap `data-testid` universal requirement.
    return (
        <div data-testid="admin-toaster">
            <Toaster
                theme={dark ? 'dark' : 'light'}
                richColors
                closeButton
                position="bottom-right"
                duration={4000}
                toastOptions={{className: 'admin-toast'}}
            />
        </div>
    );
}
