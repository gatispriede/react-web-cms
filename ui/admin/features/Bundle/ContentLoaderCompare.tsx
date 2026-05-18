import React, {useEffect, useMemo} from 'react';
import {Alert, Button, Input, Popover, Space, Switch, Table, Tag, Tooltip, Typography} from 'antd';
import {notifyError} from '@admin/lib/notify';
import {DownloadOutlined, EditOutlined, InfoCircleOutlined, SearchOutlined, UploadOutlined} from '@client/lib/icons';
import TranslationManager from '@admin/shell/TranslationManager';
import CsvImportDialog from './CsvImportDialog';
import {ITranslationMetaEntry, hashSource} from '@services/features/Languages/TranslationMetaService';
import ConflictDialog from '@client/lib/ConflictDialog';
import {useTranslation} from 'react-i18next';
import {useViewModel} from '@client/lib/state/observable';
import {ContentLoaderCompareViewModel, MetaCellViewModel} from './ContentLoaderCompareViewModel';

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
    const vm = useViewModel(() => new MetaCellViewModel());

    useEffect(() => {
        if (vm.open) vm.syncFromEntry(entry);
    }, [vm, vm.open, entry?.description, entry?.context]);

    const commit = async () => {
        const nextDesc = vm.description.trim();
        const nextCtx  = vm.context.trim();
        const prevDesc = entry?.description ?? '';
        const prevCtx  = entry?.context ?? '';
        if (nextDesc !== prevDesc || nextCtx !== prevCtx) {
            await onSave({description: nextDesc, context: nextCtx});
        }
        vm.setOpen(false);
    };

    const popoverContent = (
        <div style={{width: 300}}>
            <div style={{marginBottom: 6, fontWeight: 500}}>Short description</div>
            <Input
                value={vm.description}
                onChange={e => vm.setDescription(e.target.value)}
                placeholder="e.g. 'CTA on the homepage hero'"
                maxLength={120}
                onPressEnter={() => { void commit(); }}
                autoFocus
            />
            <div style={{margin: '10px 0 6px', fontWeight: 500}}>Longer context</div>
            <Input.TextArea
                value={vm.context}
                onChange={e => vm.setContext(e.target.value)}
                placeholder="Background, tone hints, where the string appears…"
                rows={3}
                maxLength={600}
            />
            <div style={{display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10}}>
                <Button size="small" onClick={() => vm.setOpen(false)}>Cancel</Button>
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
                onClick={() => vm.setOpen(true)}
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
            onClick={() => vm.setOpen(true)}
        >
            Add note
        </Button>
    );

    return (
        <Popover
            content={popoverContent}
            title="Translator notes"
            trigger="click"
            open={vm.open}
            onOpenChange={vm.setOpen}
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
    const vm = useViewModel(() => new ContentLoaderCompareViewModel(translationManager, dataPromise));
    const {t} = useTranslation();

    useEffect(() => { void vm.loadAll(); }, [vm]);

    const nonDefaultLangs = useMemo(() => vm.langs.filter(l => !l.default), [vm.langs]);

    const rows: Row[] = useMemo(() => {
        const lower = vm.filter.trim().toLowerCase();
        return Object.entries(vm.sourceMap)
            .map(([key, source]) => {
                const entry = vm.meta[key];
                const storedHash = entry?.acceptedSourceHash;
                const hashStale = Boolean(storedHash && storedHash !== hashSource(source));
                const rawAccepted = entry?.acceptedSources ?? [];
                const values: Record<string, string> = {};
                const missing: string[] = [];
                const accepted: string[] = [];
                const staleAccepted: string[] = [];
                for (const lang of nonDefaultLangs) {
                    const v = vm.resources[lang.symbol]?.[key];
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
            .filter(r => !vm.missingOnly || r.missing.length > 0 || r.staleAccepted.length > 0);
    }, [vm.sourceMap, nonDefaultLangs, vm.resources, vm.filter, vm.missingOnly, vm.meta]);

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
                const entry = vm.meta[row.key];
                return (
                    <MetaCell
                        entry={entry}
                        onSave={(next) => vm.persistMeta(row.key, next)}
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
                    value={vm.filter}
                    onChange={e => vm.setFilter(e.target.value)}
                    style={{width: 280}}
                />
                <Space>
                    <Switch checked={vm.missingOnly} onChange={vm.setMissingOnly}/>
                    <span>Missing only</span>
                </Space>
                <Button icon={<DownloadOutlined/>} onClick={downloadCsv} disabled={rows.length === 0}>Export CSV</Button>
                <Button icon={<UploadOutlined/>} onClick={vm.openImport} disabled={nonDefaultLangs.length === 0}>Import CSV</Button>
                <Typography.Text type="secondary">{rows.length} keys × {nonDefaultLangs.length} languages</Typography.Text>
            </Space>
            <CsvImportDialog
                open={vm.importOpen}
                close={async (didImport) => {
                    vm.closeImport();
                    if (didImport) { await vm.loadAll(); }
                }}
                translationManager={translationManager}
                languages={nonDefaultLangs}
            />
            <Table
                rowKey="key"
                loading={vm.loading}
                columns={columns as any}
                dataSource={rows}
                pagination={{pageSize: 25, showSizeChanger: true}}
                size="small"
                scroll={{x: 'max-content'}}
            />
            {vm.conflict && (() => {
                const c = vm.conflict;
                const peer = c.error.currentDoc as {editedBy?: string; editedAt?: string} | null;
                return (
                    <ConflictDialog
                        open
                        docKind={t('Translator notes')}
                        peerVersion={c.error.currentVersion}
                        peerEditedBy={peer?.editedBy}
                        peerEditedAt={peer?.editedAt}
                        onCancel={vm.dismissConflict}
                        onTakeTheirs={async () => { vm.dismissConflict(); await vm.reloadMeta(); }}
                        onKeepMine={async () => {
                            try { await c.retry(); }
                            catch (err) { notifyError(err); vm.dismissConflict(); }
                        }}
                    />
                );
            })()}
        </div>
    );
};

export default ContentLoaderCompare;
