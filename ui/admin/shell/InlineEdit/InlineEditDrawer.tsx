import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Drawer, Button, Input, Space, Typography} from 'antd';
import {TFunction} from 'i18next';
import {notifyPromise} from '@admin/lib/notify';
import type {InlineEditHoverState} from './useInlineEdit';
import {resolveEditTarget} from './editTargetRoute';

/**
 * Slide-out drawer that opens when an operator clicks a `data-edit-target`
 * element in the rendered preview. Pre-populates the field input with the
 * current value (read from the clicked element's `textContent` as a best-
 * effort — the source-of-truth still lives in the section's stored content
 * blob, which `onSave` writes back to via the existing `module.update` /
 * `addUpdateSectionItem` mutation path).
 *
 * The drawer is intentionally minimal — single textarea + Save / Cancel.
 * Compound editors (image picker, link picker, list reordering) stay in the
 * full editor panes; this drawer is the click-to-edit fast path for the
 * common case of "fix a typo".
 *
 * Per spec: testids on every interactive (`inline-edit-drawer-*`).
 */

const {Text} = Typography;

export interface InlineEditDrawerProps {
    /** The currently-active click target, or `undefined` when closed. */
    active: InlineEditHoverState | undefined;
    /** Close handler (drawer or Cancel button click). */
    onClose: () => void;
    /** Persistence callback. Returns a Promise so the drawer can wrap the
     *  call in `notifyPromise` and the toast updates in lockstep. */
    onSave: (active: InlineEditHoverState, value: string) => Promise<void>;
    /** Escape hatch — navigate to the collection's full editor pane for
     *  compound fields (image / link pickers, list reordering) the
     *  lightweight textarea can't handle. Only rendered when the resolved
     *  dispatch carries a `fullEditorHref`. */
    onOpenFullEditor: (active: InlineEditHoverState) => void;
    t: TFunction<'translation', undefined>;
    /** e2e hook for the drawer root. Defaults to `inline-edit-drawer`. */
    'data-testid'?: string;
}

const readSeedValue = (el: HTMLElement | undefined): string => {
    if (!el) return '';
    // Read the first meaningful text. `textContent` may include the field
    // pill from a child if the highlight had already attached — strip
    // anything inside elements whose `data-testid` starts with
    // `inline-edit-` to keep the seed clean.
    const clone = el.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('[data-testid^="inline-edit-"]').forEach(n => n.remove());
    return clone.textContent?.trim() ?? '';
};

export const InlineEditDrawer: React.FC<InlineEditDrawerProps> = ({
    active, onClose, onSave, onOpenFullEditor, t, 'data-testid': testId = 'inline-edit-drawer',
}) => {
    const [value, setValue] = useState('');
    const [saving, setSaving] = useState(false);
    const inputRef = useRef<any>(null);

    const seed = useMemo(() => readSeedValue(active?.element), [active]);

    // Whether the resolved dispatch offers a "full editor" deep-link for
    // this target — drives the optional escape-hatch button in the footer.
    const fullEditorHref = useMemo(() => {
        if (!active) return undefined;
        const dispatch = resolveEditTarget(active.target);
        return dispatch.kind === 'drawer' ? dispatch.fullEditorHref : undefined;
    }, [active]);

    useEffect(() => {
        if (!active) return undefined;
        // Defer the initial setValue + focus by one tick — keeps the lint
        // rule banning synchronous setState-in-useEffect honoured and
        // gives the drawer's enter animation a frame to start before we
        // disturb the input.
        const seedTimer = window.setTimeout(() => setValue(seed), 0);
        const focusTimer = window.setTimeout(() => {
            inputRef.current?.focus({cursor: 'all'});
        }, 80);
        return () => {
            window.clearTimeout(seedTimer);
            window.clearTimeout(focusTimer);
        };
    }, [active, seed]);

    const handleSave = async () => {
        if (!active) return;
        setSaving(true);
        try {
            await notifyPromise(onSave(active, value), {
                loading: t('Saving…'),
                success: t('Saved'),
                error: (err) => String((err as Error)?.message ?? err),
            });
            onClose();
        } catch {
            // notifyPromise surfaces the error toast; swallow here so the
            // drawer stays open for the operator to retry.
        } finally {
            setSaving(false);
        }
    };

    return (
        <Drawer
            open={Boolean(active)}
            onClose={onClose}
            title={t('Edit field')}
            placement="right"
            width={420}
            data-testid={testId}
            destroyOnHidden
            footer={
                <Space style={{width: '100%', justifyContent: 'space-between'}}>
                    {/* Escape hatch — only shown when the resolved dispatch
                        offers a fuller editing surface than this textarea. */}
                    {fullEditorHref && active ? (
                        <Button
                            type="link"
                            onClick={() => onOpenFullEditor(active)}
                            data-testid="inline-edit-drawer-open-full-editor-button"
                        >
                            {t('Open full editor')}
                        </Button>
                    ) : <span/>}
                    <Space>
                        <Button onClick={onClose} data-testid="inline-edit-drawer-cancel-button">
                            {t('Cancel')}
                        </Button>
                        <Button
                            type="primary"
                            loading={saving}
                            onClick={handleSave}
                            data-testid="inline-edit-drawer-save-button"
                        >
                            {t('Save')}
                        </Button>
                    </Space>
                </Space>
            }
        >
            {active && (
                <Space direction="vertical" style={{width: '100%'}}>
                    <Text type="secondary" data-testid="inline-edit-drawer-target">
                        {active.target.collection}/{active.target.id}/{active.target.field}
                    </Text>
                    <Input.TextArea
                        ref={inputRef}
                        autoSize={{minRows: 3, maxRows: 12}}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        data-testid="inline-edit-drawer-input"
                        // ⌘↵ / Ctrl+↵ submit, matching the command-palette doc-shortcut.
                        onPressEnter={(e) => {
                            if (e.metaKey || e.ctrlKey) {
                                e.preventDefault();
                                void handleSave();
                            }
                        }}
                    />
                    {active.sectionId && (
                        <Text type="secondary" style={{fontSize: 12}}>
                            {t('Section')}: <code>{active.sectionId}</code>
                        </Text>
                    )}
                </Space>
            )}
        </Drawer>
    );
};

export default InlineEditDrawer;
