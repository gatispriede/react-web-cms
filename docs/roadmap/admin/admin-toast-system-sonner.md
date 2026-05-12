---
name: admin-toast-system-sonner
description: Adopt Sonner as the single toast/notification library across the admin. Replace AntD message.*, custom toasts, raw alerts. Wrap async ops in toast.promise + offer Undo on destructive ops.
research: see research-findings-2026-05-12.md §1 Toasts + optimistic UI
---

# Sonner adoption across admin

## Goal

Standardise on **Sonner** as the only toast library in the admin. The current admin uses a mix of AntD `message.*`, custom inline error strips, and silent failure on some flows. Replacing all of it with Sonner gives:

- `toast.promise(promise, {loading, success, error})` — single API for every async mutation
- **Undo affordance on destructive ops** — 10s window, restores from the cascade-trash collections we already have
- React 19 `useOptimistic` + `startTransition` pairing — toasts transition cleanly from optimistic preview → confirmed/failed
- One i18n surface area — `notify*()` helpers central in `ui/admin/lib/notify.ts`

## Why now

- Highest-ROI perceived-quality lift on the admin (~1 day of work, every operator-facing async op feels immediately better).
- Sonner is the industry default — OpenAI, Adobe, Sonos, shadcn/ui's default. Adopting it aligns us with conventions the operator's developer-tier muscle memory already knows.
- Pairs with the [admin-command-palette](admin-command-palette.md) work — both are quick adoptions that compound: kbar action triggers a toast.promise wrapped op, Undo lives in the toast.

## Design

### Library + version

`sonner` (latest 1.x). Single dependency add. No peer deps.

### Mount

Single `<Toaster />` mounted in `ui/admin/shell/AdminApp.tsx` next to the existing `ConfigProvider`. Position bottom-right by default; `richColors` + `closeButton` enabled.

```tsx
import {Toaster} from 'sonner';

// inside AdminApp
<Toaster richColors closeButton position="bottom-right" duration={4_000} />
```

### Helper API — `ui/admin/lib/notify.ts`

A thin wrapper so call sites stay terse + i18n-able:

```ts
import {toast} from 'sonner';
import type {Action} from 'sonner';
import {i18n} from '@admin/i18n';

export function notifySuccess(message: string) {
    toast.success(message);
}

export function notifyError(err: unknown) {
    toast.error(i18n.t('errors.generic', {message: String((err as Error)?.message ?? err)}));
}

export async function notifyPromise<T>(
    promise: Promise<T>,
    labels: {loading: string; success: string | ((value: T) => string); error: string | ((err: unknown) => string)},
): Promise<T> {
    return toast.promise(promise, labels) as unknown as Promise<T>;
}

/**
 * Destructive op with Undo. `onUndo` runs if the user clicks Undo within
 * `duration` (default 10s). `onUndo` should call the matching restore mutation.
 */
export function notifyDestructive(message: string, onUndo: () => void | Promise<void>, duration = 10_000) {
    toast(message, {
        action: {label: i18n.t('actions.undo'), onClick: () => void onUndo()},
        duration,
    });
}
```

### Migration pattern

1. **Audit usage:** `grep -r 'message\.' ui/admin/features/` — list every AntD `message.*` call site.
2. **Replace systematically:** each `message.success(x)` → `notifySuccess(x)`; `message.error(err)` → `notifyError(err)`; in-flight + complete patterns → `notifyPromise(...)`.
3. **Add Undo to destructive ops:** any mutation that writes to a `*.trash` collection (the cascade-engine ones) gets a `notifyDestructive(msg, () => trash.restore(id))` toast.
4. **Strip custom error strips:** look for inline `<Alert />` patterns gating mutation results; remove + route through `notifyError`.

### Coverage targets (acceptance)

- Zero remaining `message.*` calls in `ui/admin/**`
- Every destructive mutation hooks Undo (verified by spec scanning for `notifyDestructive` calls per delete-style mutation in service tests)
- Every ServiceLoader-backed mutation in admin call sites uses `toast.promise` or `notifyPromise`

## Files to touch

- `package.json` — add `sonner` dep
- `ui/admin/shell/AdminApp.tsx` — mount `<Toaster />`
- `ui/admin/lib/notify.ts` (new) — helper API
- `ui/admin/i18n/{en,lv,ru}.json` — keys `errors.generic`, `actions.undo`, per-pane success messages
- All `ui/admin/features/**` call sites — replace AntD `message.*`
- `eslint.config.mjs` — add `no-restricted-imports` rule banning `from 'antd' import { message }` and similar
- Tests: e2e specs that assert visible toast text per major op (smoke spec gets one assertion per destructive flow with Undo verification)

## Starter code

See **Pattern H** in [agent-handoff-format.md](../_meta/agent-handoff-format.md).

## Acceptance

1. `sonner` installed; `<Toaster />` rendered exactly once
2. `ui/admin/lib/notify.ts` exports `notifySuccess`, `notifyError`, `notifyPromise`, `notifyDestructive`
3. Zero `message.*` AntD calls remain in `ui/admin/**` (grep CI check)
4. Every destructive mutation (delete-by-id, bulk-delete, cascade-delete) shows an Undo toast that successfully restores within the trash TTL window
5. ESLint rule blocks re-introduction of AntD `message.*`
6. Smoke e2e asserts a `notifySuccess` toast after publish; a `notifyDestructive` toast with working Undo after delete-section

## Effort

**S · ~30-60 min AI.** Mechanical refactor pass; the helper API + Toaster mount is 10 min, the call-site replacement is the bulk and is grep-driven.

## Open questions

None. Sonner is locked in by the research pass.

## Out of scope

- Customer-facing client toasts (different needs — single-screen ack vs operator-grade undo). File a follow-up item if the storefront wants the same pattern.
- Re-styling Sonner to match each first-class theme — Sonner's defaults are fine; theme integration is a [first-class-themes](../storefront/first-class-themes.md) follow-up.
