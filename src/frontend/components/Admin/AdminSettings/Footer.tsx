import React, {useCallback, useEffect, useState} from "react";
import {Alert, Button, Card, Col, Input, Row, Space, Switch, Typography, message} from "antd";
import {DeleteOutlined, PlusOutlined} from "../../common/icons";
import {useTranslation} from "next-i18next";
import FooterApi from "../../../api/FooterApi";
import {DEFAULT_FOOTER, IFooterColumn, IFooterConfig, IFooterEntry} from "../../../../Interfaces/IFooter";
import AuditBadge from "../AuditBadge";
import {useRefreshView} from "../../../lib/refreshBus";
import ConflictDialog from "../../common/ConflictDialog";
import {ConflictError, isConflictError} from "../../../lib/conflict";

const footerApi = new FooterApi();

const AdminSettingsFooter: React.FC = () => {
    const {t} = useTranslation('common');
    const [config, setConfig] = useState<IFooterConfig>({...DEFAULT_FOOTER});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [conflict, setConflict] = useState<{error: ConflictError<any>; retry: () => Promise<void>} | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        try { setConfig(await footerApi.get()); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { void refresh(); }, [refresh]);
    useRefreshView(refresh, 'settings');

    const update = (patch: Partial<IFooterConfig>) => setConfig(c => ({...c, ...patch}));

    const addColumn = () => update({columns: [...config.columns, {title: t('New column'), entries: []}]});
    const removeColumn = (i: number) => update({columns: config.columns.filter((_, j) => j !== i)});
    const patchColumn = (i: number, patch: Partial<IFooterColumn>) =>
        update({columns: config.columns.map((c, j) => j === i ? {...c, ...patch} : c)});
    const addEntry = (i: number) =>
        patchColumn(i, {entries: [...config.columns[i].entries, {label: '', url: ''}]});
    const removeEntry = (i: number, j: number) =>
        patchColumn(i, {entries: config.columns[i].entries.filter((_, k) => k !== j)});
    const patchEntry = (i: number, j: number, patch: Partial<IFooterEntry>) =>
        patchColumn(i, {entries: config.columns[i].entries.map((e, k) => k === j ? {...e, ...patch} : e)});

    const performSave = useCallback(async (cfg: IFooterConfig, expectedVersion: number | undefined) => {
        const result = await footerApi.save(cfg, expectedVersion);
        if ((result as any).error) { message.error((result as any).error); return false; }
        message.success(t('Footer saved'));
        // Adopt the bumped version into local state so subsequent saves stay aligned.
        if (typeof (result as any).version === 'number') {
            setConfig(c => ({...c, version: (result as any).version}));
        }
        return true;
    }, [t]);

    const save = async () => {
        setSaving(true);
        try {
            await performSave(config, config.version);
        } catch (err) {
            if (isConflictError(err)) {
                setConflict({
                    error: err,
                    retry: async () => {
                        setSaving(true);
                        try {
                            await performSave(config, err.currentVersion);
                            setConflict(null);
                        } finally { setSaving(false); }
                    },
                });
            } else {
                message.error(String((err as Error)?.message ?? err));
            }
        } finally { setSaving(false); }
    };

    return (
        <div style={{padding: 16}}>
            <Alert
                type="info"
                showIcon
                style={{marginBottom: 16}}
                message={t('Columns with these titles are auto-generated: Site (your pages) and Writing (blog). You can override by adding a column with the same title.')}
            />
            <Space style={{marginBottom: 16}} align="center">
                <Switch checked={config.enabled} onChange={v => update({enabled: v})}/>
                <span>{config.enabled ? t('Footer visible') : t('Footer hidden')}</span>
                <Button type="primary" onClick={save} loading={saving}>{t('Save')}</Button>
                <Button onClick={refresh} loading={loading}>{t('Refresh')}</Button>
                <AuditBadge editedBy={config.editedBy} editedAt={config.editedAt}/>
            </Space>
            <Row gutter={[12, 12]}>
                {config.columns.map((col, i) => (
                    <Col xs={24} md={12} lg={8} key={i}>
                        <Card
                            size="small"
                            title={
                                <Input
                                    value={col.title}
                                    onChange={e => patchColumn(i, {title: e.target.value})}
                                    placeholder={t('Column title')}
                                />
                            }
                            extra={<Button danger size="small" icon={<DeleteOutlined/>} onClick={() => removeColumn(i)}/>}
                        >
                            <Space direction="vertical" size={6} style={{width: '100%'}}>
                                {col.entries.map((entry, j) => (
                                    <Row key={j} gutter={4} align="middle">
                                        <Col xs={10}>
                                            <Input
                                                size="small"
                                                value={entry.label}
                                                onChange={e => patchEntry(i, j, {label: e.target.value})}
                                                placeholder={t('Label')}
                                            />
                                        </Col>
                                        <Col xs={12}>
                                            <Input
                                                size="small"
                                                value={entry.url ?? ''}
                                                onChange={e => patchEntry(i, j, {url: e.target.value})}
                                                placeholder={t('URL (optional)')}
                                            />
                                        </Col>
                                        <Col xs={2}>
                                            <Button size="small" danger icon={<DeleteOutlined/>} onClick={() => removeEntry(i, j)}/>
                                        </Col>
                                    </Row>
                                ))}
                                <Button size="small" icon={<PlusOutlined/>} onClick={() => addEntry(i)}>{t('Add entry')}</Button>
                            </Space>
                        </Card>
                    </Col>
                ))}
                <Col xs={24}>
                    <Button icon={<PlusOutlined/>} onClick={addColumn}>{t('Add column')}</Button>
                </Col>
            </Row>
            <div style={{marginTop: 24}}>
                <Typography.Text strong>{t('Bottom line')}</Typography.Text>
                <Input
                    value={config.bottom ?? ''}
                    onChange={e => update({bottom: e.target.value})}
                    placeholder={`© ${new Date().getFullYear()} …`}
                    style={{marginTop: 6}}
                />
            </div>
            {conflict && (() => {
                const peer = conflict.error.currentDoc as {editedBy?: string; editedAt?: string} | null;
                return (
                    <ConflictDialog
                        open
                        docKind={t('Footer')}
                        peerVersion={conflict.error.currentVersion}
                        peerEditedBy={peer?.editedBy}
                        peerEditedAt={peer?.editedAt}
                        onCancel={() => setConflict(null)}
                        onTakeTheirs={async () => {
                            setConflict(null);
                            await refresh();
                        }}
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

export default AdminSettingsFooter;
