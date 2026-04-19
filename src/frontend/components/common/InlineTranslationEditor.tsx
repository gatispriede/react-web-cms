import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Button, Input, Space, Typography, message} from 'antd';
import LanguageApi from '../../api/LanguageApi';
import {i18n as nextI18n} from 'next-i18next';
import type {INewLanguage} from '../interfaces/INewLanguage';

/**
 * Floating Alt-click translation editor. Listens once at document level for
 * Alt-clicks on any `[data-i18n-key]`-bearing node (rendered by
 * [`InlineTranslatable`](./InlineTranslatable.tsx)). Pops up an input pinned
 * near the click, saves via `LanguageApi.saveLanguage` with a single-key
 * patch, then triggers `i18n.reloadResources` + a hash-tick re-render so the
 * page picks up the new value without a full reload.
 *
 * Gated by `siteFlags.inlineTranslationEdit` — the host (AdminApp) only
 * mounts this when an editor-role session is active AND the flag is on.
 *
 * Only the public-site `tApp` namespace is edited here; admin chrome lives
 * on the separate `adminI18n` instance and is untouched on purpose.
 */
interface EditorState {
    key: string;
    source: string;
    value: string;
    anchor: {top: number; left: number};
}

const longThreshold = 200;

export const InlineTranslationEditor: React.FC = () => {
    const [state, setState] = useState<EditorState | null>(null);
    const [saving, setSaving] = useState(false);
    const [languages, setLanguages] = useState<Record<string, INewLanguage>>({});
    const inputRef = useRef<any>(null);
    const api = useRef(new LanguageApi());

    useEffect(() => {
        void api.current.getLanguages().then(setLanguages);
    }, []);

    const getActiveLanguage = useCallback((): INewLanguage | null => {
        const sym = (nextI18n?.language && nextI18n.language !== 'default') ? nextI18n.language : 'en';
        return languages[sym] ?? null;
    }, [languages]);

    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            if (!e.altKey) return;
            const target = e.target as HTMLElement | null;
            const node = target?.closest?.('[data-i18n-key]') as HTMLElement | null;
            if (!node) return;
            const key = node.getAttribute('data-i18n-key') ?? '';
            const source = node.getAttribute('data-i18n-source') ?? (node.textContent ?? '').trim();
            if (!key) return;
            e.preventDefault();
            e.stopPropagation();
            const rect = node.getBoundingClientRect();
            const current = node.textContent ?? source;
            setState({
                key,
                source,
                value: current,
                anchor: {
                    top: rect.bottom + window.scrollY + 6,
                    left: rect.left + window.scrollX,
                },
            });
        };
        document.addEventListener('click', onClick, true);
        return () => document.removeEventListener('click', onClick, true);
    }, []);

    useEffect(() => {
        if (state && inputRef.current?.focus) {
            const t = setTimeout(() => inputRef.current.focus({cursor: 'end'}), 0);
            return () => clearTimeout(t);
        }
    }, [state?.key]);

    const close = useCallback(() => setState(null), []);

    const save = useCallback(async () => {
        if (!state) return;
        const lang = getActiveLanguage();
        if (!lang) { message.error('No active language'); return; }
        setSaving(true);
        try {
            await api.current.saveLanguage(lang, {[state.key]: state.value});
            // Re-pull the updated bundle + bump the language to force re-render
            // anywhere bare strings are cached.
            try { await nextI18n?.reloadResources(lang.symbol); } catch { /* noop */ }
            try { await nextI18n?.changeLanguage(lang.symbol); } catch { /* noop */ }
            message.success('Translation saved');
            close();
        } catch (err) {
            message.error(String((err as Error)?.message ?? err));
        } finally {
            setSaving(false);
        }
    }, [state, getActiveLanguage, close]);

    useEffect(() => {
        if (!state) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') close();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [state, close]);

    if (!state) return null;

    const isLong = state.source.length > longThreshold || state.value.length > longThreshold;

    return (
        <div
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
            style={{
                position: 'absolute',
                top: state.anchor.top,
                left: state.anchor.left,
                zIndex: 10000,
                background: 'white',
                border: '1px solid rgba(0,0,0,0.15)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                padding: 10,
                width: isLong ? 520 : 360,
                borderRadius: 6,
            }}
            role="dialog"
            aria-label="Edit translation"
        >
            <Space direction="vertical" size={6} style={{width: '100%'}}>
                <Typography.Text type="secondary" style={{fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block'}}>
                    <code>{state.key}</code> · source: <span style={{opacity: 0.75}}>{state.source}</span>
                </Typography.Text>
                {isLong ? (
                    <Input.TextArea
                        ref={inputRef}
                        rows={4}
                        value={state.value}
                        onChange={e => setState(s => s ? {...s, value: e.target.value} : s)}
                        onPressEnter={e => { if ((e as any).ctrlKey || (e as any).metaKey) void save(); }}
                    />
                ) : (
                    <Input
                        ref={inputRef}
                        value={state.value}
                        onChange={e => setState(s => s ? {...s, value: e.target.value} : s)}
                        onPressEnter={() => void save()}
                    />
                )}
                <Space style={{justifyContent: 'flex-end', width: '100%'}}>
                    <Button size="small" onClick={close}>Cancel</Button>
                    <Button size="small" type="primary" loading={saving} onClick={save}>Save</Button>
                </Space>
            </Space>
        </div>
    );
};

export default InlineTranslationEditor;
