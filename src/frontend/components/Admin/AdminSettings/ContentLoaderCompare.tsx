import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Alert, Button, Input, Space, Switch, Table, Tag, Typography} from 'antd';
import {DownloadOutlined, SearchOutlined, UploadOutlined} from '@ant-design/icons';
import TranslationManager from '../TranslationManager';
import CsvImportDialog from './CsvImportDialog';

interface Row {
    key: string;
    source: string;
    /** locale → translation value (empty string if missing) */
    values: Record<string, string>;
    missing: string[];
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
        } finally {
            setLoading(false);
        }
    }, [translationManager, dataPromise, sourceMap]);

    useEffect(() => { void loadAll(); }, [loadAll]);

    const nonDefaultLangs = useMemo(() => langs.filter(l => !l.default), [langs]);

    const rows: Row[] = useMemo(() => {
        const lower = filter.trim().toLowerCase();
        return Object.entries(sourceMap)
            .map(([key, source]) => {
                const values: Record<string, string> = {};
                const missing: string[] = [];
                for (const lang of nonDefaultLangs) {
                    const v = resources[lang.symbol]?.[key];
                    if (!v || v === key) missing.push(lang.symbol);
                    values[lang.symbol] = v ?? '';
                }
                return {key, source, values, missing};
            })
            .filter(r => !lower || r.key.toLowerCase().includes(lower) || r.source?.toLowerCase().includes(lower))
            .filter(r => !missingOnly || r.missing.length > 0);
    }, [sourceMap, nonDefaultLangs, resources, filter, missingOnly]);

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
        {title: 'Key', dataIndex: 'key', width: 240, render: (k: string) => <Typography.Text code>{k}</Typography.Text>},
        {title: 'Source', dataIndex: 'source', width: 260, render: (s: string) => <Typography.Text>{s}</Typography.Text>},
        ...nonDefaultLangs.map(lang => ({
            title: lang.label ? `${lang.symbol} — ${lang.label}` : lang.symbol,
            dataIndex: ['values', lang.symbol],
            key: lang.symbol,
            render: (v: string, row: Row) => (
                row.missing.includes(lang.symbol)
                    ? <Tag color="orange">missing</Tag>
                    : <Typography.Text>{v}</Typography.Text>
            ),
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
        </div>
    );
};

export default ContentLoaderCompare;
