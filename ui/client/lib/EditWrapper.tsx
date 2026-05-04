import {DeleteOutlined, DownOutlined, UpOutlined} from "./icons";
import {Button, Popconfirm} from 'antd';
import React, {JSX, useRef} from "react";
import {TFunction} from "i18next";
import {getCachedMode} from "@admin/lib/adminMode";

interface PropsEditWrapper {
    children: React.ReactNode,
    deleteAction?: () => Promise<void>,
    editAction?: () => void,
    editContent?: JSX.Element,
    edit?: boolean,
    del?: boolean,
    admin: boolean,
    wrapperClass?: string,
    /** Optional reorder callbacks — when set, up/down arrow buttons
     *  render alongside the delete control. `canMoveUp` / `canMoveDown`
     *  drive the disabled state at boundaries. The earlier drag-reorder
     *  flow stopped working; the explicit arrows are the deliberate
     *  fallback (and clearer for keyboard / screen-reader users). */
    moveUp?: () => Promise<void> | void,
    moveDown?: () => Promise<void> | void,
    canMoveUp?: boolean,
    canMoveDown?: boolean,
    /** Tiny badge text shown in the edit-button cluster — usually the
     *  module type ("Hero", "Timeline"). Helps when the section has
     *  several modules of the same shape and the operator needs to
     *  know which row they're acting on. */
    label?: string,
    t: TFunction<"translation", undefined>
}

const EditWrapper = (
    {
        admin,
        wrapperClass,
        children,
        editAction,
        editContent,
        deleteAction,
        edit = false,
        del = true,
        moveUp,
        moveDown,
        canMoveUp,
        canMoveDown,
        label,
        t
    }: PropsEditWrapper) => {
    const wrapperRef = useRef<HTMLDivElement>(null);
    // Simplified-mode authoring: clicking anywhere on the rendered module
    // body opens the edit drawer. We trigger the existing edit Button
    // via querySelector inside our own DOM subtree (the AddNewSectionItem
    // tags it with `section-module-edit-<type>-btn`). Falls through to
    // explicit edit-button click in advanced mode.
    const simplified = admin && getCachedMode() === 'simplified';
    const onBodyClick = (e: React.MouseEvent) => {
        if (!simplified) return;
        const tag = (e.target as HTMLElement)?.closest?.('button, a, input, .ant-popconfirm');
        if (tag) return;  // don't hijack clicks on inner controls
        const btn = wrapperRef.current?.querySelector<HTMLButtonElement>(
            'button[data-testid^="section-module-edit-"]',
        );
        if (btn) {
            e.stopPropagation();
            btn.click();
        }
    };
    const hasEdit = !!(edit && editContent && !simplified);
    const hasDelete = !!(del && deleteAction);
    const hasReorder = !!(moveUp || moveDown);
    // Single inline strip: [label] [edit] [up] [down] [delete]. Same DOM
    // shape at both section and module levels — only the SCSS positioning
    // differs (section strip sits top-right with bigger buttons, module
    // strip sits top-left with compact 24px buttons; both anchored by the
    // existing `.edit-button-container` rules).
    const strip = (hasEdit || hasDelete || hasReorder) ? (
        <div className={'edit-button-container edit-action-strip'} onClick={e => e.stopPropagation()}>
            {label && (
                <span className="edit-button-label" data-testid="section-module-row-label">
                    {label}
                </span>
            )}
            {hasEdit && (
                <span className="edit-button">{editContent}</span>
            )}
            {hasReorder && (
                <Button
                    size="small"
                    data-testid="section-module-move-up-btn"
                    aria-label={t('Move up')}
                    title={t('Move up')}
                    disabled={!canMoveUp || !moveUp}
                    icon={<UpOutlined/>}
                    onClick={async (e) => { e.stopPropagation(); if (moveUp) await moveUp(); }}
                />
            )}
            {hasReorder && (
                <Button
                    size="small"
                    data-testid="section-module-move-down-btn"
                    aria-label={t('Move down')}
                    title={t('Move down')}
                    disabled={!canMoveDown || !moveDown}
                    icon={<DownOutlined/>}
                    onClick={async (e) => { e.stopPropagation(); if (moveDown) await moveDown(); }}
                />
            )}
            {hasDelete && (
                <Popconfirm
                    title={t("Delete")}
                    description={t("Are you sure to delete?")}
                    onConfirm={async () => { await deleteAction!(); }}
                    okText={t("Delete")}
                    cancelText={t("Cancel")}
                >
                    <Button danger size="small" icon={<DeleteOutlined/>} aria-label={t('Delete')}/>
                </Popconfirm>
            )}
        </div>
    ) : null;
    return (
        <div className={wrapperClass} ref={wrapperRef}>
            {
                admin ?
                    <div className={'edit-wrapper'}>
                        {/* Simplified mode keeps `editContent` mounted (hidden)
                            so the body-click handler can still find + click
                            the edit button programmatically. */}
                        {simplified && edit && editContent && (
                            <div style={{display: 'none'}} aria-hidden>{editContent}</div>
                        )}
                        {!simplified && strip}
                        {
                            children && <div onClick={onBodyClick} style={simplified ? {cursor: 'pointer'} : undefined}>{children}</div>
                        }
                    </div>
                    :
                    <div>{children}</div>
            }
        </div>
    )
}
export default EditWrapper