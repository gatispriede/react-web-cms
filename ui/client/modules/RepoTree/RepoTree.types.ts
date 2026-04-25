/**
 * RepoTree — interactive repository structure viewer.
 * Renders a tree column on the left (paths grouped by directory ancestry,
 * computed from each node's `path`) and a detail pane on the right
 * showing the selected node's summary + body.
 *
 * `path` is the canonical id; segments are split on `/` to derive depth.
 */
export interface IRepoNode {
    /** Slash-separated path, e.g. "ui/client/modules/Hero". */
    path: string;
    kind: 'dir' | 'file';
    /** One-liner shown next to the node label in the tree. */
    summary?: string;
    /** Long-form description shown in the right detail pane. */
    body?: string;
    /** Optional mono caps tag in the detail pane (e.g. "FRONTEND"). */
    tag?: string;
}

export interface IRepoTree {
    eyebrow?: string;
    title?: string;
    subtitle?: string;
    /** Mono caps label above the tree column. */
    treeLabel?: string;
    nodes?: IRepoNode[];
}

export enum ERepoTreeStyle {
    Default = "default",
    Editorial = "editorial",
}
