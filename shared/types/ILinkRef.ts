export interface ILinkRef {
    url: string;
    label?: string;
}

export const EMPTY_LINK_REF: ILinkRef = {url: ''};

/**
 * Normalise legacy link fields to {@link ILinkRef}. Hero CTAs used
 * `{label, href}`; ProjectCard used `{url, label}`; Gallery used a bare
 * `href` string. All converge on `{url, label}` so editors / renderers can
 * share helpers.
 */
export function toLinkRef(input: unknown, legacy?: {
    url?: string;
    href?: string;
    label?: string;
}): ILinkRef {
    if (input && typeof input === 'object') {
        const obj = input as Record<string, unknown>;
        const url = typeof obj.url === 'string' ? obj.url
            : typeof obj.href === 'string' ? obj.href
                : '';
        const ref: ILinkRef = {url};
        if (typeof obj.label === 'string' && obj.label) ref.label = obj.label;
        return ref;
    }
    if (typeof input === 'string') {
        const ref: ILinkRef = {url: input};
        if (legacy?.label) ref.label = legacy.label;
        return ref;
    }
    const url = legacy?.url ?? legacy?.href ?? '';
    const ref: ILinkRef = {url};
    if (legacy?.label) ref.label = legacy.label;
    return ref;
}
