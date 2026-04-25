import React, {useMemo, useState} from "react";
import {EItemType} from "@enums/EItemType";
import {IItem} from "@interfaces/IItem";
import ContentManager from "@client/lib/ContentManager";
import {TFunction} from "i18next";
import {InlineTranslatable} from "@client/lib/InlineTranslatable";
import RevealOnScroll from "@client/lib/RevealOnScroll";
import {slugifyAnchor} from "@utils/stringFunctions";
import type {IRepoNode, IRepoTree} from "./RepoTree.types";
export type {IRepoTree, IRepoNode} from "./RepoTree.types";
export {ERepoTreeStyle} from "./RepoTree.types";

const defaults: IRepoTree = {nodes: []};

export class RepoTreeContent extends ContentManager {
    public _parsedContent: IRepoTree = {...defaults};
    get data(): IRepoTree {
        this.parse();
        return {...defaults, ...this._parsedContent, nodes: this._parsedContent?.nodes ?? []};
    }
    set data(v: IRepoTree) { this._parsedContent = v; }
    setField<K extends keyof IRepoTree>(k: K, v: IRepoTree[K]) { this._parsedContent[k] = v; }
}

// ------------------------------------------------------------------
// Build a hierarchical view-tree from the flat node list. The flat
// list comes from the bundle generator (one entry per discovered
// path). We re-attach each entry to its parent folder so the UI can
// expand/collapse nested structures rather than spilling 150+ rows
// onto the page at once. The detail pane reads from the original
// IRepoNode metadata (kind/tag/summary/body), so expand/collapse is
// purely a presentational concern.
// ------------------------------------------------------------------
type ViewNode = {path: string; name: string; depth: number; children: ViewNode[]; node: IRepoNode};

function buildViewTree(nodes: IRepoNode[]): ViewNode[] {
    const byPath: Record<string, ViewNode> = {};
    const roots: ViewNode[] = [];
    // Deterministic ordering: directories before files at each level,
    // then alphabetical by leaf name. We sort the input first so the
    // resulting tree mirrors how we'd lay out a printed dossier.
    const sorted = [...nodes].sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1;
        return a.path.localeCompare(b.path);
    });
    for (const node of sorted) {
        const segments = node.path.split('/').filter(Boolean);
        const name = segments[segments.length - 1] ?? node.path;
        const depth = Math.max(0, segments.length - 1);
        const view: ViewNode = {path: node.path, name, depth, children: [], node};
        byPath[node.path] = view;
        if (segments.length <= 1) {
            roots.push(view);
        } else {
            const parentPath = segments.slice(0, -1).join('/');
            const parent = byPath[parentPath];
            if (parent) parent.children.push(view);
            else roots.push(view); // orphan — surface at top so it's not dropped
        }
    }
    return roots;
}

const RepoTree = ({item, tApp}: {
    item: IItem;
    t: TFunction<"translation", undefined>;
    tApp: TFunction<string, undefined>;
}) => {
    const c = new RepoTreeContent(EItemType.RepoTree, item.content).data;
    const tr = (v: string) => <InlineTranslatable tApp={tApp as any} source={v}/>;
    const nodes = c.nodes ?? [];

    const viewTree = useMemo(() => buildViewTree(nodes), [nodes]);

    // Default expansion: every folder up to depth 2 (i.e. the first three
    // visible layers — root + two nested levels). Deeper folders stay
    // collapsed but are still toggleable.
    const initialExpanded = useMemo(() => {
        const set = new Set<string>();
        const walk = (vn: ViewNode) => {
            if (vn.node.kind !== 'dir') return;
            if (vn.depth <= 2) set.add(vn.path);
            for (const child of vn.children) walk(child);
        };
        for (const root of viewTree) walk(root);
        return set;
    }, [viewTree]);
    const [expanded, setExpanded] = useState<Set<string>>(initialExpanded);

    const [selectedPath, setSelectedPath] = useState<string | undefined>(nodes[0]?.path);
    const selected: IRepoNode | undefined = useMemo(
        () => nodes.find(n => n.path === selectedPath) ?? nodes[0],
        [nodes, selectedPath],
    );

    const toggle = (path: string) => {
        setExpanded(prev => {
            const next = new Set(prev);
            if (next.has(path)) next.delete(path); else next.add(path);
            return next;
        });
    };

    const renderNode = (vn: ViewNode): React.ReactNode => {
        const isDir = vn.node.kind === 'dir';
        const isOpen = expanded.has(vn.path);
        const isActive = (selected?.path ?? '') === vn.path;
        return (
            <li key={vn.path}>
                <button
                    type="button"
                    className={`repo-tree__node repo-tree__node--${vn.node.kind}${isActive ? ' is-active' : ''}`}
                    style={{paddingLeft: 8 + vn.depth * 14}}
                    onClick={() => {
                        setSelectedPath(vn.path);
                        if (isDir) toggle(vn.path);
                    }}
                    aria-expanded={isDir ? isOpen : undefined}
                >
                    <span className="repo-tree__node-icon" aria-hidden>
                        {isDir ? (isOpen ? '▾' : '▸') : '·'}
                    </span>
                    <span className="repo-tree__node-label">{vn.name}</span>
                    {vn.node.summary && <span className="repo-tree__node-summary">{tr(vn.node.summary)}</span>}
                </button>
                {isDir && isOpen && vn.children.length > 0 && (
                    <ul className="repo-tree__nodes repo-tree__nodes--nested">
                        {vn.children.map(renderNode)}
                    </ul>
                )}
            </li>
        );
    };

    return (
        <RevealOnScroll className={`repo-tree ${item.style ?? ''}`}>
            {(c.eyebrow || c.title || c.subtitle) && (
                <header className="repo-tree__head">
                    {c.eyebrow && <div className="repo-tree__eyebrow">{tr(c.eyebrow)}</div>}
                    {c.title && <h2 id={slugifyAnchor(c.title)} className="repo-tree__title">{tr(c.title)}</h2>}
                    {c.subtitle && <p className="repo-tree__subtitle">{tr(c.subtitle)}</p>}
                </header>
            )}
            <div className="repo-tree__body">
                <div className="repo-tree__col-tree">
                    {c.treeLabel && <div className="repo-tree__sub">{tr(c.treeLabel)}</div>}
                    <div className="repo-tree__scroll">
                        <ul className="repo-tree__nodes">
                            {viewTree.map(renderNode)}
                        </ul>
                    </div>
                </div>
                <div className="repo-tree__col-detail">
                    {selected ? (() => {
                        const segments = selected.path.split('/').filter(Boolean);
                        const leafName = segments[segments.length - 1] ?? selected.path;
                        const trailing = selected.kind === 'dir' ? '/' : '';
                        const ancestors: {label: string; path: string}[] = [];
                        let cum = '';
                        for (let i = 0; i < segments.length - 1; i++) {
                            cum = cum ? `${cum}/${segments[i]}` : segments[i];
                            ancestors.push({label: segments[i], path: cum});
                        }
                        // direct children of selected (if dir) — pulled from viewTree
                        const findInTree = (list: ViewNode[], path: string): ViewNode | undefined => {
                            for (const v of list) {
                                if (v.path === path) return v;
                                const hit = findInTree(v.children, path);
                                if (hit) return hit;
                            }
                            return undefined;
                        };
                        const selectedView = findInTree(viewTree, selected.path);
                        const children = selectedView?.children ?? [];
                        return (
                            <div className="repo-tree__detail-card">
                                {ancestors.length > 0 && (
                                    <div className="repo-tree__crumb">
                                        {ancestors.map((a, i) => (
                                            <React.Fragment key={a.path}>
                                                <button type="button" className="repo-tree__crumb-link" onClick={() => setSelectedPath(a.path)}>{a.label}</button>
                                                {i < ancestors.length - 1 && <span className="repo-tree__crumb-sep">/</span>}
                                            </React.Fragment>
                                        ))}
                                        <span className="repo-tree__crumb-sep">/</span>
                                        <span className="repo-tree__crumb-here">{leafName}</span>
                                    </div>
                                )}
                                <h3 className="repo-tree__detail-title">{leafName}{trailing}</h3>
                                {selected.badge && (
                                    <div className="repo-tree__detail-badge"><span className="repo-tree__detail-dot" aria-hidden/>{tr(selected.badge)}</div>
                                )}
                                {selected.body && <p className="repo-tree__detail-body">{tr(selected.body)}</p>}
                                {selected.kind === 'dir' && selected.stats && (
                                    <div className="repo-tree__stats">
                                        <div className="repo-tree__stat"><div className="repo-tree__stat-v">{selected.stats.subfolders}</div><div className="repo-tree__stat-l">subfolders</div></div>
                                        <div className="repo-tree__stat"><div className="repo-tree__stat-v">{selected.stats.files}</div><div className="repo-tree__stat-l">files (annotated)</div></div>
                                        <div className="repo-tree__stat"><div className="repo-tree__stat-v">{selected.stats.maxDepth}</div><div className="repo-tree__stat-l">max depth</div></div>
                                        <div className="repo-tree__stat"><div className="repo-tree__stat-v">{ancestors.length === 0 ? '—' : ancestors.length}</div><div className="repo-tree__stat-l">depth here</div></div>
                                    </div>
                                )}
                                {children.length > 0 && (
                                    <>
                                        <div className="repo-tree__detail-sub">Contents · {children.length} direct child{children.length === 1 ? '' : 'ren'}</div>
                                        <ul className="repo-tree__children">
                                            {children.map(ch => (
                                                <li key={ch.path}>
                                                    <button type="button" className="repo-tree__child" onClick={() => { setSelectedPath(ch.path); if (ch.node.kind === 'dir' && !expanded.has(ch.path)) toggle(ch.path); }}>
                                                        <span className="repo-tree__child-name">
                                                            <span className="repo-tree__child-glyph" aria-hidden>▦</span>
                                                            {ch.name}{ch.node.kind === 'dir' ? '/' : ''}
                                                        </span>
                                                        {ch.node.summary && <span className="repo-tree__child-desc">{tr(ch.node.summary)}</span>}
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    </>
                                )}
                            </div>
                        );
                    })() : (
                        <div className="repo-tree__detail-empty">—</div>
                    )}
                </div>
            </div>
        </RevealOnScroll>
    );
};

export default RepoTree;
