/**
 * Helpers for composing and selecting `data-testid` attributes. The
 * naming convention itself is documented in
 * [docs/architecture/test-ids.md](../../../docs/architecture/test-ids.md)
 * — do NOT maintain a registry of testid strings here. Specs derive
 * the testid from the rule on the fly, the JSX puts the same string in
 * `data-testid={…}`, and they meet by convention.
 *
 * Three exports:
 *   - `tid(...parts)`  — composes a testid string per the rule
 *                        (`<feature>-<element>[-<context>]-<role>`).
 *   - `byTid(page, id)` — locator helper, swap-in for `getByTestId`.
 *   - `moduleTypeSlug(t)` — normalizes an `EItemType` enum value to the
 *                           kebab-case form used in picker / row /
 *                           edit-button testids.
 */

import {EItemType} from '@enums/EItemType';
import type {Page, Locator} from '@playwright/test';

/** Compose a testid per the convention. Empty / falsy parts are dropped. */
export function tid(...parts: Array<string | undefined | null | false>): string {
    return parts
        .filter((p): p is string => Boolean(p))
        .map(p => p.toLowerCase())
        .join('-');
}

/** Playwright locator wrapper. Use this in specs instead of raw `getByTestId`. */
export function byTid(page: Page, testid: string): Locator {
    return page.getByTestId(testid);
}

/** `RICH_TEXT` → `rich-text`. Use as the `context` slot in picker / row / edit testids. */
export function moduleTypeSlug(type: EItemType): string {
    return type.toLowerCase().replace(/_/g, '-');
}
