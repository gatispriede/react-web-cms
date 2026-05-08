import React from 'react';
import {Button} from 'antd';
import {CloseOutlined, DownOutlined, EditOutlined, FileOutlined} from "@client/lib/icons";
import {TFunction} from "i18next";
import AuditBadge from "../AuditBadge";

export interface BuildPageMenuArgs {
    tabProps: any[];
    openKeys: string[];
    siderCollapsed: boolean;
    isAdmin: boolean;
    canEditNav: boolean;
    t: TFunction<"translation", undefined>;
    onToggleOpenKey: (key: string) => void;
    onOpenEdit: (pageIndex: number) => void;
    onConfirmDelete: (tp: any) => void;
}

/**
 * Build the items[] passed to AntD `<Menu items={...}/>` for the build-page
 * sider.
 *
 * F1 sub-pages + click-parent-edits (option B) — `tabProps` is a
 * flat list (one entry per page). Build a parent → children tree
 * off `id` / `parent`, then *flatten back to a single-level list*
 * with depth-based indent. The flatten is deliberate: if we hand
 * AntD `<Menu items[].children>`, AntD renders a SubMenu and
 * intercepts the title click for expand/collapse — meaning a
 * click on a parent page can no longer set `activeTab` (i.e.
 * navigate to edit the parent itself). We want title click =
 * navigate, separate chevron = expand. Doing the flatten here
 * gives us full control over both interactions. Orphans
 * (parent points at a missing page) surface as roots.
 */
export function buildPageMenuItems(args: BuildPageMenuArgs): any[] {
    const {tabProps, openKeys, siderCollapsed, isAdmin, canEditNav, t, onToggleOpenKey, onOpenEdit, onConfirmDelete} = args;

    const byId = new Map<string, any>();
    for (const tp of tabProps) {
        if (tp.id) byId.set(tp.id, {...tp, kids: []});
    }
    const roots: any[] = [];
    for (const node of byId.values()) {
        if (node.parent && byId.has(node.parent)) {
            byId.get(node.parent)!.kids.push(node);
        } else {
            roots.push(node);
        }
    }

    const buildLabel = (tp: any, depth: number, hasKids: boolean, isOpen: boolean) => (
        <div
            className="admin-sider-item"
            data-testid={`nav-page-row-${String(tp.page).toLowerCase()}`}
            style={{
                display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between',
                paddingLeft: depth * 20,
            }}
        >
            <div style={{flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2}}>
                <span style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    lineHeight: 1.3,
                }}>
                    {hasKids ? (
                        <Button
                            size="small"
                            type="text"
                            aria-label={isOpen ? t('Collapse') : t('Expand')}
                            aria-expanded={isOpen}
                            data-testid={`nav-page-toggle-${String(tp.page).toLowerCase()}`}
                            onClick={e => { e.stopPropagation(); onToggleOpenKey(tp.key); }}
                            icon={
                                <DownOutlined
                                    style={{
                                        transition: 'transform 120ms',
                                        transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                                    }}
                                />
                            }
                            style={{flex: '0 0 auto', width: 20, height: 20, padding: 0, opacity: 0.7}}
                        />
                    ) : (
                        /* Generic per-page icon. A future per-page `iconName`
                           (set via the navigation editor) would slot in here. */
                        <FileOutlined aria-hidden="true" style={{flex: '0 0 auto', opacity: 0.7}}/>
                    )}
                    <span style={{overflow: 'hidden', textOverflow: 'ellipsis'}}>{tp.page}</span>
                </span>
                {!siderCollapsed && isAdmin && tp.editedAt && (
                    <span style={{lineHeight: 1.1, fontSize: 10, opacity: 0.75, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                        <AuditBadge compact editedBy={tp.editedBy} editedAt={tp.editedAt}/>
                    </span>
                )}
            </div>
            {!siderCollapsed && canEditNav && (
                <span
                    className="admin-sider-actions"
                    style={{display: 'inline-flex', gap: 2, flex: '0 0 auto'}}
                    onClick={e => e.stopPropagation()}
                >
                    <Button
                        size="small"
                        type="text"
                        icon={<EditOutlined/>}
                        onClick={e => { e.stopPropagation(); onOpenEdit(Number(tp.key)); }}
                        aria-label={t('Edit page')}
                    />
                    <Button
                        data-testid="nav-page-delete-btn"
                        size="small"
                        type="text"
                        danger
                        icon={<CloseOutlined/>}
                        onClick={e => { e.stopPropagation(); onConfirmDelete(tp); }}
                        aria-label={t('Delete page')}
                    />
                </span>
            )}
        </div>
    );

    const out: any[] = [];
    const walk = (node: any, depth: number) => {
        const hasKids = node.kids.length > 0;
        const isOpen = openKeys.includes(node.key);
        out.push({
            key: node.key,
            label: buildLabel(node, depth, hasKids, isOpen),
        });
        if (hasKids && isOpen) {
            for (const c of node.kids) walk(c, depth + 1);
        }
    };
    for (const r of roots) walk(r, 0);
    return out;
}
