import TranslationManager from "../TranslationManager";
import React, {use, useEffect, useMemo, useState} from "react";
import {Input, Space, Switch, Table, Tag, Typography} from "antd";
import {SearchOutlined} from "@ant-design/icons";
import {sanitizeKey} from "../../../../utils/stringFunctions";

interface TranslationRow {
    key: string;
    source: string;
    translation: string;
    missing: boolean;
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
    const [newTranslations] = useState<Record<string, string>>({});
    const [filter, setFilter] = useState('');
    const [missingOnly, setMissingOnly] = useState(false);

    const keys = useMemo(() => Object.keys(translations), [translations]);

    const i18nConfig = i18n.toJSON();
    keys.forEach(key => {
        const languageData = i18nConfig?.store?.data?.[currentLanguageKey]?.app;
        if (languageData) {
            if (typeof languageData[key] !== 'undefined') {
                newTranslations[key] = tApp(key);
            } else if (typeof newTranslations[key] === 'undefined') {
                newTranslations[key] = translations[key];
            }
        } else if (typeof newTranslations[key] === 'undefined') {
            newTranslations[key] = key !== sanitizeKey(t(key)) ? tApp(key) : translations[key];
        }
    });

    useEffect(() => {
        setTranslation(newTranslations);
    }, [currentLanguageKey, newTranslations, setTranslation]);

    const translationChange = (key: string, value: string) => {
        newTranslations[key] = value;
        setTranslation({...newTranslations});
    };

    const rows: TranslationRow[] = useMemo(() => {
        const lower = filter.trim().toLowerCase();
        return keys
            .map(k => {
                const tr = newTranslations[k] ?? '';
                const missing = !tr || tr === k;
                return {key: k, source: translations[k], translation: tr, missing};
            })
            .filter(r => !lower || r.key.toLowerCase().includes(lower) || r.source?.toLowerCase().includes(lower))
            .filter(r => !missingOnly || r.missing);
    }, [keys, filter, missingOnly, translations, newTranslations]);

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
                <Space.Compact style={{width: '100%'}}>
                    <Input
                        defaultValue={row.translation}
                        placeholder={row.source}
                        onBlur={(e) => translationChange(row.key, e.target.value)}
                        status={row.missing ? 'warning' : undefined}
                    />
                    {row.missing && <Tag color="orange" style={{marginLeft: 8}}>missing</Tag>}
                </Space.Compact>
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
