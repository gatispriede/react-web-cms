import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Alert, Button, Input, Popover, Space, Switch, Table, Tag, Tooltip, Typography, message} from 'antd';
import {DownloadOutlined, EditOutlined, InfoCircleOutlined, SearchOutlined, UploadOutlined} from '../../common/icons';
import TranslationManager from '../TranslationManager';
import CsvImportDialog from './CsvImportDialog';
import TranslationMetaApi from '../../../api/TranslationMetaApi';
import {ITranslationMetaEntry, ITranslationMetaMap, hashSource} from '../../../../Server/TranslationMetaService';
import ConflictDialog from '../../common/ConflictDialog';
import {ConflictError, isConflictError} from '../../../lib/conflict';
import {useTranslation} from 'react-i18next';

interface Row {
    key: string;
    source: string;
    /** locale → translation value (empty string if missing) */
    values: Record<string, string>;
    missing: string[];
    /** Langs where the translator accepted this key as "same as source" and the hash is still current. */
    accepted: string[];
    /** Langs that were accepted but the source has since changed — show "needs review". */
    staleAccepted: string[];
}

interface LanguageEntry {
    symbol: string;
    label: string;
    default?: boolean;
}

const fetchLocale = async (lang: string): Promise<Record<string, string>> => {
    try {
        const r = await fetch(`/locales/${lang}/app.json`);
        if (!r.ok) return {};
        return await r.json();
    } catch {
        return {};
    }
};

/**
 * Per-row inline editor for translator notes. Empty on both fields → row
 * renders a subtle "add note" pencil; populated → renders the description as
 * dimmed text with the context available via hover tooltip, and still lets
 * the editor click through to edit.
 */
const MetaCell = ({entry, onSave}: {
    entry: ITranslationMetaEntry | undefined;
    onSave: (next: ITranslationMetaEntry) => Promise<void> | void;
}) => {
    const [open, setOpen] = useState(false);
    const [description, setDescription] = useState(entry?.description ?? '');
    const [context, setContext] = useState(entry?.context ?? '');

    useEffect(() => {
        if (open) {
            setDescription(entry?.description ?? '');
            setContext(entry?.context ?? '');
        }
    }, [open, entry?.description, entry?.context]);

    const commit = async () => {
        const nextDesc = description.trim();
        const nextCtx = context.trim();
        const prevDesc = entry?.description ?? '';
        const prevCtx = entry?.context ?? '';
        if (nextDesc !== prevDesc || nextCtx !== prevCtx) {
            await onSave({description: nextDesc, context: nextCtx});
        }
        setOpen(false);
    };

    const popoverContent = (
        <div style={{width: 300}}>
            <div style={{marginBottom: 6, fontWeight: 500}}>Short description</div>
            <Input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="e.g. 'CTA on the homepage hero'"
                maxLength={120}
                onPressEnter={() => { void commit(); }}
                autoFocus
            />
            <div style={{margin: '10px 0 6px', fontWeight: 500}}>Longer context</div>
            <Input.TextArea
                value={context}
                onChange={e => setContext(e.target.value)}
                placeholder="Background, tone hints, where the string appears…"
                rows={3}
                maxLength={600}
            />
            <div style={{display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10}}>
                <Button size="small" onClick={() => setOpen(false)}>Cancel</Button>
                <Button size="small" type="primary" onClick={() => { void commit(); }}>Save</Button>
            </div>
        </div>
    );

    const hasEntry = Boolean(entry?.description || entry?.context);
    const trigger = hasEntry ? (
        <Tooltip title={entry?.context || entry?.description}>
            <Button
                type="link"
                size="small"
                style={{padding: 0, height: 'auto', textAlign: 'left', maxWidth: '100%'}}
                onClick={() => setOpen(true)}
            >
                <span style={{
                    display: 'inline-block',
                    maxWidth: 210,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    verticalAlign: 'bottom',
                    color: '#555',
                }}>
                    {entry?.description || entry?.context}
                </span>
                <EditOutlined style={{marginLeft: 6, color: '#999'}}/>
            </Button>
        </Tooltip>
    ) : (
        <Button
            type="link"
            size="small"
            icon={<EditOutlined/>}
            style={{padding: 0, height: 'auto', color: '#bbb'}}
            onClick={() => setOpen(true)}
        >
            Add note
        </Button>
    );

    return (
        <Popover
            content={popoverContent}
            title="Translator notes"
            trigger="click"
            open={open}
            onOpenChange={setOpen}
            destroyTooltipOnHide
        >
            {trigger}
        </Popover>
    );
};

/**
 * Side-by-side translation compare view — loads every configured language's
 * `app.json` bundle at once and renders one column per language so translators
 * can see coverage gaps across the whole site in a single pass.
 *
 * Read-only — per-language edit still happens in the single-language tab.
 */
export const ContentLoaderCompare = ({translationManager, dataPromise}: {
    translationManager: TranslationManager,
    dataPromise: Promise<unknown>,
}) => {
    const [sourceMap] = useState<Record<string, string>>(() => ({}));
    const [langs, setLangs] = useState<LanguageEntry[]>([]);
    const [resources, setResources] = useState<Record<string, Record<string, string>>>({});
    const [filter, setFilter] = useState('');
    const [missingOnly, setMissingOnly] = useState(false);
    const [loading, setLoading] = useState(true);
    const [importOpen, setImportOpen] = useState(false);
    const [meta, setMeta] = useState<ITranslationMetaMap>({});
    const [metaVersion, setMetaVersion] = useState<number>(0);
    const [conflict, setConflict] = useState<{error: ConflictError<any>; retry: () => Promise<void>} | null>(null);
    const metaApi = useMemo(() => new TranslationMetaApi(), []);
    const {t} = useTranslation();

    const loadAll = useCallback(async () => {
        setLoading(true);
        try {
            await dataPromise;
            Object.assign(sourceMap, translationManager.getTranslations());
            const raw = await translationManager.getLanguages() as unknown;
            const list: LanguageEntry[] = Array.isArray(raw)
                ? (raw as LanguageEntry[])
                : Object.values((raw ?? {}) as Record<string, LanguageEntry>);
            setLangs(list);
            const loaded: Record<string, Record<string, string>> = {};
            await Promise.all(list.map(async l => {
                loaded[l.symbol] = await fetchLocale(l.symbol);
            }));
            setResources(loaded);
            const current = await metaApi.get();
            setMeta(current.value);
            setMetaVersion(current.version);
        } finally {
            setLoading(false);
        }
    }, [translationManager, dataPromise, sourceMap, metaApi]);

    const reloadMeta = useCallback(async () => {
        const current = await metaApi.get();
        setMeta(current.value);
        setMetaVersion(current.version);
    }, [metaApi]);

    const performMetaSave = useCallback(async (patch: ITranslationMetaMap, expectedVersion: number | undefined) => {
        const result = await metaApi.save(patch, expectedVersion);
        if ((result as any)?.error) {
            message.error(String((result as any).error));
            await reloadMeta();
            return false;
        }
        if (typeof (result as any).version === 'number') setMetaVersion((result as any).version);
        if ((result as any).value) setMeta((result as any).value as ITranslationMetaMap);
        return true;
    }, [metaApi, reloadMeta]);

    const persistMeta = useCallback(async (key: string, entry: ITranslationMetaEntry) => {
        // Optimistic update so the row reflects the edit instantly.
        setMeta(prev => {
            const next = {...prev};
            const description = entry.description?.trim() ?? '';
            const context = entry.context?.trim() ?? '';
            if (!description && !context) delete next[key];
            else next[key] = {
                ...(description ? {description} : {}),
                ...(context ? {context} : {}),
            };
            return next;
        });
        const patch = {[key]: entry};
        try {
            await performMetaSave(patch, metaVersion);
        } catch (err) {
            if (isConflictError(err)) {
                setConflict({
                    error: err,
                    retry: async () => {
                        try {
                            await performMetaSave(patch, err.currentVersion);
                            setConflict(null);
                        } catch (e) {
                            message.error(String((e as Error)?.message ?? e));
                            setConflict(null);
                        }
                    },
                });
            } else {
                message.error(String((err as Error)?.message ?? err));
                await reloadMeta();
            }
        }
    }, [performMetaSave, metaVersion, reloadMeta]);

    useEffect(() => { void loadAll(); }, [loadAll]);

    const nonDefaultLangs = useMemo(() => langs.filter(l => !l.default), [langs]);

    const rows: Row[] = useMemo(() => {
        const lower = filter.trim().toLowerCase();
        return Object.entries(sourceMap)
            .map(([key, source]) => {
                const entry = meta[key];
                const storedHash = entry?.acceptedSourceHash;
                const hashStale = Boolean(storedHash && storedHash !== hashSource(source));
                const rawAccepted = entry?.acceptedSources ?? [];
                const values: Record<string, string> = {};
                const missing: string[] = [];
                const accepted: string[] = [];
                const staleAccepted: string[] = [];
                for (const lang of nonDefaultLangs) {
                    const v = resources[lang.symbol]?.[key];
                    const wasAccepted = rawAccepted.includes(lang.symbol);
                    if (wasAccepted && hashStale) {
                        staleAccepted.push(lang.symbol);
                    } else if (wasAccepted) {
                        accepted.push(lang.symbol);
                    } else if (!v || v === key) {
                        missing.push(lang.symbol);
                    }
                    values[lang.symbol] = v ?? '';
                }
                return {key, source, values, missing, accepted, staleAccepted};
            })
            .filter(r => !lower || r.key.toLowerCase().includes(lower) || r.source?.toLowerCase().includes(lower))
            .filter(r => !missingOnly || r.missing.length > 0 || r.staleAccepted.length > 0);
    }, [sourceMap, nonDefaultLangs, resources, filter, missingOnly, meta]);

    const downloadCsv = () => {
        const header = ['key', 'source', ...nonDefaultLangs.map(l => l.symbol)];
        const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
        const lines = [header.map(esc).join(',')];
        for (const row of rows) {
            lines.push([
                esc(row.key),
                esc(row.source ?? ''),
                ...nonDefaultLangs.map(l => esc(row.values[l.symbol] ?? '')),
            ].join(','));
        }
        const blob = new Blob([lines.join('\n')], {type: 'text/csv;charset=utf-8'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `translations-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    const columns = [
        {title: 'Key', dataIndex: 'key', width: 220, render: (k: string) => <Typography.Text code>{k}</Typography.Text>},
        {title: 'Source', dataIndex: 'source', width: 240, render: (s: string) => <Typography.Text>{s}</Typography.Text>},
        {
            title: (
                <Space size={4}>
                    <span>Translator notes</span>
                    <Tooltip title="Optional per-key description + longer context shown to translators. Not shipped to the public site.">
                        <InfoCircleOutlined style={{color: '#999'}}/>
                    </Tooltip>
                </Space>
            ),
            key: 'meta',
            width: 240,
            render: (_: unknown, row: Row) => {
                const entry = meta[row.key];
                return (
                    <MetaCell
                        entry={entry}
                        onSave={(next) => persistMeta(row.key, next)}
                    />
                );
            },
        },
        ...nonDefaultLangs.map(lang => ({
            title: lang.label ? `${lang.symbol} — ${lang.label}` : lang.symbol,
            dataIndex: ['values', lang.symbol],
            key: lang.symbol,
            render: (v: string, row: Row) => {
                if (row.staleAccepted.includes(lang.symbol)) {
                    return <Tooltip title="Source string changed since this was accepted — please re-review"><Tag color="gold">needs review</Tag></Tooltip>;
                }
                if (row.accepted.includes(lang.symbol)) {
                    return <Tooltip title="Accepted as-is — same as source string"><Tag color="blue" style={{opacity: 0.7}}>accepted</Tag></Tooltip>;
                }
                if (row.missing.includes(lang.symbol)) return <Tag color="orange">missing</Tag>;
                return <Typography.Text>{v}</Typography.Text>;
            },
        })),
    ];

    return (
        <div style={{padding: 16, background: '#fff'}}>
            <Alert
                type="info"
                showIcon
                style={{marginBottom: 12}}
                message="Read-only side-by-side view. Switch to a language in the left sidebar to edit."
            />
            <Space style={{marginBottom: 12}} wrap>
                <Input
                    allowClear
                    placeholder="Search keys or source"
                    prefix={<SearchOutlined/>}
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                    style={{width: 280}}
                />
                <Space>
                    <Switch checked={missingOnly} onChange={setMissingOnly}/>
                    <span>Missing only</span>
                </Space>
                <Button icon={<DownloadOutlined/>} onClick={downloadCsv} disabled={rows.length === 0}>Export CSV</Button>
                <Button icon={<UploadOutlined/>} onClick={() => setImportOpen(true)} disabled={nonDefaultLangs.length === 0}>Import CSV</Button>
                <Typography.Text type="secondary">{rows.length} keys × {nonDefaultLangs.length} languages</Typography.Text>
            </Space>
            <CsvImportDialog
                open={importOpen}
                close={async (didImport) => {
                    setImportOpen(false);
                    if (didImport) { await loadAll(); }
                }}
                translationManager={translationManager}
                languages={nonDefaultLangs}
            />
            <Table
                rowKey="key"
                loading={loading}
                columns={columns as any}
                dataSource={rows}
                pagination={{pageSize: 25, showSizeChanger: true}}
                size="small"
                scroll={{x: 'max-content'}}
            />
            {conflict && (() => {
                const peer = conflict.error.currentDoc as {editedBy?: string; editedAt?: string} | null;
                return (
                    <ConflictDialog
                        open
                        docKind={t('Translator notes')}
                        peerVersion={conflict.error.currentVersion}
                        peerEditedBy={peer?.editedBy}
                        peerEditedAt={peer?.editedAt}
                        onCancel={() => setConflict(null)}
                        onTakeTheirs={async () => { setConflict(null); await reloadMeta(); }}
                        onKeepMine={async () => {
                            try { await conflict.retry(); }
                            catch (err) { message.error(String((err as Error)?.message ?? err)); setConflict(null); }
                        }}
                    />
                );
            })()}
        </div>
    );
};

export default ContentLoaderCompare;
