/**
 * Sonner wrapper — single notification surface for the admin chrome.
 *
 * Replaces the old AntD `message.*` calls site-by-site. Keep this module
 * the *only* place that talks to `sonner` directly so the i18n keys, the
 * Undo affordance, and the default duration live in one spot.
 *
 * The Toaster itself is mounted once in `ui/admin/shell/AdminApp.tsx`.
 */
import {toast} from 'sonner';
import adminI18n from '@admin/i18n/adminI18n';

export function notifySuccess(message: string): void {
    toast.success(message);
}

export function notifyError(err: unknown): void {
    const detail = String((err as Error)?.message ?? err);
    toast.error(adminI18n.t('errors.generic', {message: detail}));
}

export function notifyWarning(message: string): void {
    toast.warning(message);
}

export function notifyInfo(message: string): void {
    toast.info(message);
}

export async function notifyPromise<T>(
    promise: Promise<T>,
    labels: {
        loading: string;
        success: string | ((value: T) => string);
        error: string | ((err: unknown) => string);
    },
): Promise<T> {
    toast.promise(promise, labels);
    return promise;
}

/**
 * Destructive op with Undo. `onUndo` runs if the user clicks Undo within
 * `duration` (default 10s). `onUndo` should call the matching restore
 * mutation — typically a `trash.restore(group)` for cascade-trash ops.
 */
export function notifyDestructive(
    message: string,
    onUndo: () => void | Promise<void>,
    duration = 10_000,
): void {
    toast(message, {
        action: {
            label: adminI18n.t('actions.undo'),
            onClick: () => { void onUndo(); },
        },
        duration,
    });
}
