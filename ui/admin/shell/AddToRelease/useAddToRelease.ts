/**
 * Shared "Add to release" affordance for editor panes.
 *
 * Every editable surface (Pages, Posts, Products, Themes, Navigation,
 * Footer, Seo) can call `useAddToRelease(entity, id)` to get a single
 * `{open, dialog}` pair to drop into its toolbar. The hook owns the
 * release-picker modal + the network call so feature panes don't
 * reimplement the flow.
 *
 * Flow:
 *   1. Caller invokes `open()` from a toolbar button.
 *   2. Modal lists every release in `draft` or `failed` status (the only
 *      states accepting new members) + a "+ Create new release" row.
 *   3. Selection issues `POST /api/releases {op: 'attach', …}` with the
 *      current entity. Toasts surface success / failure.
 *
 * The release list refreshes on every modal open — releases are
 * relatively few and the operator may have just created one in the
 * Releases pane.
 */

import {useState, useCallback, useEffect} from 'react';
import {App, Button, Input, List, Modal, Space, Tag, Typography} from 'antd';
import React from 'react';
import {releasesApi} from '@admin/features/Releases/ReleasesApi';
import type {IReleaseSummary, ReleaseEntityKind} from '@interfaces/IRelease';

export interface UseAddToReleaseResult {
    /** Open the picker modal. Returns immediately. */
    open: () => void;
    /** Render this into the parent — the modal element. */
    dialog: React.ReactElement;
    /** True while the network call is in flight. */
    busy: boolean;
}

export function useAddToRelease(entity: ReleaseEntityKind, id: string | undefined): UseAddToReleaseResult {
    const {message} = App.useApp();
    const [visible, setVisible] = useState(false);
    const [releases, setReleases] = useState<IReleaseSummary[]>([]);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [newTitle, setNewTitle] = useState('');

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const list = await releasesApi.list();
            setReleases(list.filter(r => r.status === 'draft' || r.status === 'failed'));
        } catch (err) {
            message.error(`Failed to load releases: ${String((err as Error).message ?? err)}`);
        } finally {
            setLoading(false);
        }
    }, [message]);

    useEffect(() => {
        if (visible) void refresh();
    }, [visible, refresh]);

    const open = useCallback(() => {
        if (!id) {
            message.warning('Save the item before adding to a release.');
            return;
        }
        setVisible(true);
    }, [id, message]);

    const attach = useCallback(async (releaseId: string) => {
        if (!id) return;
        setBusy(true);
        try {
            await releasesApi.attach(releaseId, entity, id);
            message.success('Added to release');
            setVisible(false);
        } catch (err) {
            message.error(`Attach failed: ${String((err as Error).message ?? err)}`);
        } finally {
            setBusy(false);
        }
    }, [entity, id, message]);

    const createAndAttach = useCallback(async () => {
        if (!id || !newTitle.trim()) return;
        setBusy(true);
        try {
            const r = await releasesApi.create(newTitle.trim());
            await releasesApi.attach(r.id, entity, id);
            message.success(`Created release "${r.title}" and attached`);
            setNewTitle('');
            setVisible(false);
        } catch (err) {
            message.error(`Create+attach failed: ${String((err as Error).message ?? err)}`);
        } finally {
            setBusy(false);
        }
    }, [entity, id, newTitle, message]);

    const dialog = React.createElement(Modal, {
        title: 'Add to release',
        open: visible,
        onCancel: () => setVisible(false),
        footer: null,
        'data-testid': 'add-to-release-modal',
    } as any,
        React.createElement(Space, {direction: 'vertical', style: {width: '100%'}, size: 'middle'},
            React.createElement(Typography.Paragraph, {type: 'secondary', style: {margin: 0}},
                `Will attach ${entity}:${id ?? ''} to the chosen release.`,
            ),
            React.createElement(List as any, {
                'data-testid': 'add-to-release-list',
                size: 'small',
                bordered: true,
                loading,
                dataSource: releases,
                locale: {emptyText: 'No mutable releases — create one below.'},
                renderItem: (r: IReleaseSummary) => React.createElement(List.Item as any, {
                    key: r.id,
                    'data-testid': `add-to-release-item-${r.id}`,
                    actions: [
                        React.createElement(Button as any, {
                            key: 'add',
                            size: 'small',
                            type: 'primary',
                            disabled: busy,
                            onClick: () => void attach(r.id),
                            'data-testid': `add-to-release-attach-${r.id}`,
                        }, 'Attach'),
                    ],
                },
                    React.createElement(Space as any, null,
                        React.createElement('span', null, r.title),
                        React.createElement(Tag as any, null, r.status),
                        React.createElement(Typography.Text as any, {type: 'secondary', style: {fontSize: 11}},
                            `${r.memberCount} members`,
                        ),
                    ),
                ),
            }),
            React.createElement(Space.Compact as any, {style: {width: '100%'}},
                React.createElement(Input as any, {
                    placeholder: 'New release title',
                    value: newTitle,
                    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setNewTitle(e.target.value),
                    'data-testid': 'add-to-release-new-title',
                }),
                React.createElement(Button as any, {
                    onClick: () => void createAndAttach(),
                    loading: busy,
                    disabled: !newTitle.trim(),
                    'data-testid': 'add-to-release-create-attach',
                }, 'Create + attach'),
            ),
        ),
    );

    return {open, dialog, busy};
}
