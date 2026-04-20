import React from 'react';
import {sanitizeKey} from '../../../utils/stringFunctions';
import {translateOrKeep} from '../../../utils/translateOrKeep';

type TFn = (key: string) => string;

/**
 * JSX-friendly sibling of [`translateOrKeep`](../../../utils/translateOrKeep.ts).
 * Returns a `<span data-i18n-key="…">` wrapper carrying the sanitised key so
 * the admin inline-translation editor (see `InlineTranslationEditor`) can
 * find and edit the string on Alt-click without any per-component wiring
 * beyond swapping the local `tr()` helper to call this.
 *
 * The wrapper is always rendered — public pages are SSG so they can't branch
 * on session at build time, and the `data-i18n-key` attribute is cheap. The
 * editor affordance (hover ring + click handler) is gated on the body via
 * `data-admin-inline-edit="true"`, set only when an editor-or-admin session
 * is active AND `siteFlags.inlineTranslationEdit` is on.
 *
 * Empty / missing values still render as empty spans so the layout reserves
 * the same space pre-/post-edit.
 */
export const InlineTranslatable: React.FC<{
    tApp: TFn | undefined;
    source: string;
    as?: keyof React.JSX.IntrinsicElements;
}> = ({tApp, source, as: Tag = 'span'}) => {
    const text = translateOrKeep(tApp, source ?? '');
    const key = sanitizeKey(source ?? '');
    // Don't tag empty strings — they'd collect into a single key that no one
    // could usefully edit.
    if (!key) return <>{text}</>;
    const T = Tag as React.ElementType;
    return <T data-i18n-key={key} data-i18n-source={source}>{text}</T>;
};

/**
 * Helper matching the existing `tr = (v: string) => translateOrKeep(tApp, v)`
 * pattern in section components but returning JSX.
 */
export function trNode(tApp: TFn | undefined, source: string): React.ReactNode {
    return <InlineTranslatable tApp={tApp} source={source}/>;
}

export default InlineTranslatable;
