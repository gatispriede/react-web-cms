/**
 * Tiny helper for module display components — emits the
 * `data-edit-target` attribute when running inside the admin shell.
 *
 * Usage in a module:
 *
 *   <h1 {...inlineEditAttr(admin, item.name, 'headline')}>{title}</h1>
 *
 * The helper returns an empty object when `admin` is falsy so the public
 * production HTML has no `data-edit-target` attributes at all (verified
 * by the build smoke per spec).
 */
import {formatInlineEditTarget, InlineEditCollection} from '@interfaces/InlineEdit';

export interface InlineEditAttrShape {
    'data-edit-target'?: string;
}

export function inlineEditAttr(
    admin: boolean | undefined,
    id: string | undefined,
    field: string,
    collection: InlineEditCollection = 'modules',
): InlineEditAttrShape {
    if (!admin || !id) return {};
    const target = formatInlineEditTarget({collection, id, field});
    if (!target) return {};
    return {'data-edit-target': target};
}
