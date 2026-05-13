/**
 * Breadcrumb — Phase 1.C.
 *
 * Renders a horizontal page-chain. When `autoFromParentChain` is true,
 * the rendering page provides the resolved chain via the `crumbs` prop
 * (resolved server-side from `IPage.parent` walking the full ancestry —
 * no depth cap, per Phase 0b).
 *
 * Used both as an auto-injected section on warehouse-derived category
 * pages AND as a free-standing module operators can drop anywhere.
 */
import React from 'react';
import type {IBreadcrumb, IBreadcrumbCrumb} from './Breadcrumb.types';
import './Breadcrumb.scss';

export interface BreadcrumbProps {
    content: IBreadcrumb | string;
    /** Resolved crumbs from the page context. Used when
     *  `autoFromParentChain` is true (the default). */
    crumbs?: IBreadcrumbCrumb[];
}

function parseContent(raw: string | IBreadcrumb): IBreadcrumb {
    if (typeof raw === 'string') {
        try { return JSON.parse(raw) as IBreadcrumb; } catch { return {autoFromParentChain: true}; }
    }
    return raw;
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({content, crumbs: injected}) => {
    const c = parseContent(content);
    const auto = c.autoFromParentChain !== false;
    const crumbs = auto ? (injected ?? []) : (c.crumbs ?? []);
    const sep = c.separator ?? '›';
    if (crumbs.length === 0) {
        return (
            <nav className="breadcrumb breadcrumb--empty" aria-label="Breadcrumb" data-testid="breadcrumb-empty" />
        );
    }
    return (
        <nav className="breadcrumb" aria-label="Breadcrumb" data-testid="breadcrumb">
            <ol>
                {crumbs.map((c, i) => {
                    const last = i === crumbs.length - 1;
                    return (
                        <li key={`${c.href}-${i}`} data-testid={`breadcrumb-${i}`}>
                            {last
                                ? <span aria-current="page">{c.label}</span>
                                : <a href={c.href}>{c.label}</a>}
                            {!last && <span className="breadcrumb__sep" aria-hidden> {sep} </span>}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
};

export default Breadcrumb;
export {Breadcrumb};
