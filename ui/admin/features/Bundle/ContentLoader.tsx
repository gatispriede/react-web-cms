import TranslationManager from "@admin/shell/TranslationManager";
import React, {use, useEffect, useMemo} from "react";
import {Checkbox, Input, Space, Switch, Table, Tag, Tooltip, Typography} from "antd";
import {SearchOutlined} from "@client/lib/icons";
import {useViewModel} from "@client/lib/state/observable";
import {ContentLoaderViewModel} from "./ContentLoaderViewModel";

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

    const vm = useViewModel(() => new ContentLoaderViewModel());
    const translations = useMemo(() => translationManager.getTranslations(), [translationManager]);
    const keys = useMemo(() => Object.keys(translations), [translations]);

    // Bind sink each render — `setTranslation` may be a fresh closure.
    vm.setSink(setTranslation);

    // Seed newTranslations directly from the locale JSON file on disk —
    // the same source of truth `ContentLoaderCompare` uses. Pollution rule:
    // any stored entry where `value === key` (or sanitized key) is treated
    // as missing — leftover `saveMissing` writes from earlier dev runs.
    useEffect(() => {
        if (currentLanguageKey === 'default') {
            vm.seed({});
            return;
        }
        let cancelled = false;
        const reseed = async () => {
            let stored: Record<string, string> = {};
            try {
                const r = await fetch(`/locales/${currentLanguageKey}/app.json`, {cache: 'no-store'});
                if (r.ok) stored = await r.json();
            } catch {
                // network / 404 — leave stored empty.
            }
            if (cancelled) return;
            const seeded: Record<string, string> = {};
            for (const key of keys) {
                const v = stored[key];
                const source = translations[key];
                const isPolluted =
                    typeof v === 'string' &&
                    v !== source &&
                    (v === key || (key.includes('_') && v === key.replace(/_/g, '')));
                seeded[key] = (typeof v === 'string' && v.length > 0 && !isPolluted) ? v : '';
            }
            vm.seed(seeded);
        };
        void reseed();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentLanguageKey, keys, translations]);

    // Pull translationMeta whenever the active language changes.
    useEffect(() => {
        let cancelled = false;
        void vm.loadMeta(currentLanguageKey).then(() => {
            if (cancelled) return;
        });
        return () => { cancelled = true; };
    }, [currentLanguageKey, vm]);

    // Backfill source values into staged translations for accepted-but-blank rows.
    useEffect(() => {
        vm.backfillAccepted(translations);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [vm.acceptedKeys, translations]);

    const rows: TranslationRow[] = useMemo(() => {
        const lower = vm.filter.trim().toLowerCase();
        return keys
            .map(k => {
                const tr = vm.newTranslations[k] ?? '';
                const acceptedSource = vm.acceptedKeys.has(k);
                const source = translations[k];
                const missing = !acceptedSource && (!tr || tr === source);
                return {key: k, source: translations[k], translation: tr, missing, acceptedSource};
            })
            .filter(r => !lower || r.key.toLowerCase().includes(lower) || r.source?.toLowerCase().includes(lower))
            .filter(r => !vm.missingOnly || r.missing);
    }, [keys, vm.filter, vm.missingOnly, translations, vm.newTranslations, vm.acceptedKeys]);

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
            title: () => {
                const visibleKeys = rows.map(r => r.key);
                const acceptedCount = visibleKeys.filter(k => vm.acceptedKeys.has(k)).length;
                const allAccepted = visibleKeys.length > 0 && acceptedCount === visibleKeys.length;
                const indeterminate = acceptedCount > 0 && !allAccepted;
                return (
                    <Space style={{width: '100%', justifyContent: 'space-between'}}>
                        <span>Translation</span>
                        <Tooltip title={`Mark all ${visibleKeys.length} visible row${visibleKeys.length === 1 ? '' : 's'} as 'same as source'. Narrow the filter first if you only want a subset.`}>
                            <Checkbox
                                checked={allAccepted}
                                indeterminate={indeterminate}
                                onChange={(e) => void vm.bulkAcceptVisible(visibleKeys, e.target.checked, currentLanguageKey, translations)}
                                style={{fontSize: 11, fontWeight: 'normal'}}
                            >
                                Same as source ({acceptedCount}/{visibleKeys.length})
                            </Checkbox>
                        </Tooltip>
                    </Space>
                );
            },
            dataIndex: 'translation',
            key: 'translation',
            width: '40%',
            render: (_: unknown, row: TranslationRow) => (
                <Space orientation="vertical" size={4} style={{width: '100%'}}>
                    <Space.Compact style={{width: '100%'}}>
                        <Input
                            data-testid={`translations-row-${row.key}-input`}
                            value={row.translation}
                            placeholder={row.source}
                            disabled={row.acceptedSource}
                            onChange={(e) => vm.translationChange(row.key, e.target.value)}
                            status={row.missing ? 'warning' : undefined}
                        />
                        {row.missing && <Tag color="orange" style={{marginLeft: 8}}>missing</Tag>}
                        {row.acceptedSource && <Tag color="blue" style={{marginLeft: 8}}>same as source</Tag>}
                    </Space.Compact>
                    <Tooltip title="Mark as 'no translation needed' — numbers, proper nouns, single-word technical terms that stay identical across locales. The source string is used as the translation value and the key is excluded from missing-translation reports for this language.">
                        <Checkbox
                            checked={row.acceptedSource}
                            onChange={(e) => void vm.toggleAcceptSource(row.key, e.target.checked, currentLanguageKey, translations)}
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
                    value={vm.filter}
                    onChange={e => vm.setFilter(e.target.value)}
                    style={{width: 280}}
                />
                {!isDefault && (
                    <Space>
                        <Switch checked={vm.missingOnly} onChange={vm.setMissingOnly}/>
                        <span>Missing only</span>
                    </Space>
                )}
                <Typography.Text type="secondary">{rows.length} / {keys.length}</Typography.Text>
            </Space>
            <Table
                rowKey="key"
                columns={columns as any}
                dataSource={rows}
                pagination={{
                    defaultPageSize: 25,
                    pageSizeOptions: ['10', '25', '50', '100', '250'],
                    showSizeChanger: true,
                    showTotal: (total) => `${total} key${total === 1 ? '' : 's'}`,
                }}
                size="small"
            />
        </div>
    );
};
