import TranslationManager from "@admin/shell/TranslationManager";
import React, {use, useCallback, useEffect, useMemo, useState} from "react";
import {Checkbox, Input, Space, Switch, Table, Tag, Tooltip, Typography, message} from "antd";
import {SearchOutlined} from "@client/lib/icons";
import {sanitizeKey} from "@utils/stringFunctions";
import TranslationMetaApi from "@services/api/client/TranslationMetaApi";

interface TranslationRow {
    key: string;
    source: string;
    translation: string;
    missing: boolean;
    acceptedSource: boolean;
}

export const ContentLoader = ({translationManager, currentLanguageKey, dataPromise, i18n, setTranslation, t, tApp}: {
    translationManager: TranslationManager,
    currentLanguageKey: string,
    dataPromise: any,
    setTranslation: any,
    i18n: any,
    t: (data: string) => string,
    tApp: (data: string) => string
}) => {
    use(dataPromise);

    const [translations] = useState<Record<string, string>>(translationManager.getTranslations());
    const [newTranslations, setNewTranslations] = useState<Record<string, string>>({});
    const [filter, setFilter] = useState('');
    const [missingOnly, setMissingOnly] = useState(false);
    // Per-key membership in `translationMeta.acceptedSources` for the active
    // language. Loaded from the server on mount + after every language swap,
    // mutated optimistically when the user toggles the "Same as source"
    // checkbox below, and pushed back through `TranslationMetaApi`.
    const [acceptedKeys, setAcceptedKeys] = useState<Set<string>>(new Set());
    const [metaVersion, setMetaVersion] = useState<number>(0);
    const metaApi = useMemo(() => new TranslationMetaApi(), []);

    const keys = useMemo(() => Object.keys(translations), [translations]);

    // Seed newTranslations from the i18next store **once per language**. The
    // earlier version seeded during render, so every re-render (including the
    // one triggered by the user's own keystroke) overwrote the edit with the
    // stored value before the save payload could see it — giving the visible
    // "save doesn't persist" bug.
    useEffect(() => {
        const i18nConfig = i18n.toJSON();
        const languageData = i18nConfig?.store?.data?.[currentLanguageKey]?.app;
        const seeded: Record<string, string> = {};
        for (const key of keys) {
            if (languageData && typeof languageData[key] !== 'undefined') {
                seeded[key] = tApp(key);
            } else {
                seeded[key] = key !== sanitizeKey(t(key)) ? tApp(key) : translations[key];
            }
        }
        setNewTranslations(seeded);
        setTranslation(seeded);
        // Intentional: we only reseed when language or key-set changes, never
        // on in-flight edits. i18n object identity shifts between renders and
        // would cause the overwrite we just fixed — keep it out of deps.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentLanguageKey, keys, translations]);

    const translationChange = (key: string, value: string) => {
        setNewTranslations(prev => {
            const next = {...prev, [key]: value};
            setTranslation(next);
            return next;
        });
    };

    // Pull translationMeta whenever the active language changes — acceptedSources
    // is per-language, so a key accepted in `lv` isn't assumed accepted in `ru`.
    useEffect(() => {
        let cancelled = false;
        void metaApi.get().then(({value, version}) => {
            if (cancelled) return;
            const next = new Set<string>();
            for (const [k, entry] of Object.entries(value ?? {})) {
                if (Array.isArray(entry?.acceptedSources) && entry.acceptedSources.includes(currentLanguageKey)) {
                    next.add(k);
                }
            }
            setAcceptedKeys(next);
            setMetaVersion(version ?? 0);
        });
        return () => { cancelled = true; };
    }, [currentLanguageKey, metaApi]);

    const toggleAcceptSource = useCallback(async (key: string, checked: boolean) => {
        // Optimistic — update local state first, then persist. On server error,
        // reload from authority.
        const nextSet = new Set(acceptedKeys);
        if (checked) nextSet.add(key); else nextSet.delete(key);
        setAcceptedKeys(nextSet);
        // Pin the translation value to the source string when accepting; when
        // un-accepting, leave whatever is there (translator may want to edit).
        if (checked) {
            translationChange(key, translations[key]);
        }
        try {
            const {value: current} = await metaApi.get();
            const existing = current[key] ?? {};
            const prev = Array.isArray(existing.acceptedSources) ? existing.acceptedSources : [];
            const next = checked
                ? Array.from(new Set([...prev, currentLanguageKey]))
                : prev.filter(s => s !== currentLanguageKey);
            const result = await metaApi.save({[key]: {...existing, acceptedSources: next}}, metaVersion);
            if ((result as any)?.version != null) setMetaVersion((result as any).version);
        } catch (err) {
            console.error('translationMeta toggle failed:', err);
            message.error('Could not save "Same as source" — reloading.');
            // Restore from server on failure so local state stays honest.
            const {value, version} = await metaApi.get();
            const restored = new Set<string>();
            for (const [k, entry] of Object.entries(value ?? {})) {
                if (Array.isArray(entry?.acceptedSources) && entry.acceptedSources.includes(currentLanguageKey)) {
                    restored.add(k);
                }
            }
            setAcceptedKeys(restored);
            setMetaVersion(version ?? 0);
        }
    }, [acceptedKeys, currentLanguageKey, metaApi, metaVersion, translations]);

    const rows: TranslationRow[] = useMemo(() => {
        const lower = filter.trim().toLowerCase();
        return keys
            .map(k => {
                const tr = newTranslations[k] ?? '';
                const acceptedSource = acceptedKeys.has(k);
                // A key counts as "translated" when an explicit value is set OR
                // the translator accepted the source verbatim. Keys where the
                // bound value happens to equal the sanitised key aren't really
                // translated (i18next fallback) unless acceptedSource is set.
                const missing = !acceptedSource && (!tr || tr === k);
                return {key: k, source: translations[k], translation: tr, missing, acceptedSource};
            })
            .filter(r => !lower || r.key.toLowerCase().includes(lower) || r.source?.toLowerCase().includes(lower))
            .filter(r => !missingOnly || r.missing);
    }, [keys, filter, missingOnly, translations, newTranslations, acceptedKeys]);

    const isDefault = currentLanguageKey === 'default';

    const columns = [
        {
            title: 'Key',
            dataIndex: 'key',
            key: 'key',
            width: 260,
            sorter: (a: TranslationRow, b: TranslationRow) => a.key.localeCompare(b.key),
            render: (k: string) => <Typography.Text code>{k}</Typography.Text>,
        },
        {
            title: 'Source',
            dataIndex: 'source',
            key: 'source',
            render: (s: string) => <Typography.Text>{s}</Typography.Text>,
        },
        ...(isDefault ? [] : [{
            title: 'Translation',
            dataIndex: 'translation',
            key: 'translation',
            width: '40%',
            render: (_: unknown, row: TranslationRow) => (
                <Space orientation="vertical" size={4} style={{width: '100%'}}>
                    <Space.Compact style={{width: '100%'}}>
                        <Input
                            // Controlled — drives off the state we also send to the
                            // server, so there can't be DOM/state divergence.
                            value={row.translation}
                            placeholder={row.source}
                            disabled={row.acceptedSource}
                            onChange={(e) => translationChange(row.key, e.target.value)}
                            status={row.missing ? 'warning' : undefined}
                        />
                        {row.missing && <Tag color="orange" style={{marginLeft: 8}}>missing</Tag>}
                        {row.acceptedSource && <Tag color="blue" style={{marginLeft: 8}}>same as source</Tag>}
                    </Space.Compact>
                    <Tooltip title="Mark as 'no translation needed' — numbers, proper nouns, single-word technical terms that stay identical across locales. The source string is used as the translation value and the key is excluded from missing-translation reports for this language.">
                        <Checkbox
                            checked={row.acceptedSource}
                            onChange={(e) => void toggleAcceptSource(row.key, e.target.checked)}
                            style={{fontSize: 11}}
                        >
                            Same as source
                        </Checkbox>
                    </Tooltip>
                </Space>
            ),
        }]),
    ];

    return (
        <div style={{padding: 16, background: '#fff', borderRadius: 2}}>
            <Space style={{marginBottom: 12}} wrap>
                <Input
                    allowClear
                    placeholder="Search keys or source"
                    prefix={<SearchOutlined/>}
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                    style={{width: 280}}
                />
                {!isDefault && (
                    <Space>
                        <Switch checked={missingOnly} onChange={setMissingOnly}/>
                        <span>Missing only</span>
                    </Space>
                )}
                <Typography.Text type="secondary">{rows.length} / {keys.length}</Typography.Text>
            </Space>
            <Table
                rowKey="key"
                columns={columns as any}
                dataSource={rows}
                pagination={{pageSize: 25, showSizeChanger: true}}
                size="small"
            />
        </div>
    );
};
