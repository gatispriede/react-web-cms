import React, {useEffect} from "react";
import {Alert, Button, Card, Col, Input, Row, Space, Switch, Typography} from "antd";
import {notifyError} from '@admin/lib/notify';
import {DeleteOutlined, PlusOutlined} from "@client/lib/icons";
import {useTranslation} from "react-i18next";
import AuditBadge from "@admin/shell/AuditBadge";
import {useRefreshView} from "@client/lib/useRefreshView";
import ConflictDialog from "@client/lib/ConflictDialog";
import {useViewModel} from "@client/lib/state/observable";
import LinkTargetPicker from "@admin/lib/LinkTargetPicker";
import {FooterViewModel} from "./FooterViewModel";

/** Render-only Footer pane — state lives on `FooterViewModel`. VM3 (2026-05-02). */
const AdminSettingsFooter: React.FC = () => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new FooterViewModel(undefined, t));

    useEffect(() => { void vm.refresh(); }, [vm]);
    useRefreshView(vm.refresh, 'settings');

    return (
        <div style={{padding: 16}}>
            <Alert
                type="info"
                showIcon
                style={{marginBottom: 16}}
                message={t('Columns with these titles are auto-generated: Site (your pages) and Writing (blog). You can override by adding a column with the same title.')}
            />
            <Space style={{marginBottom: 16}} align="center">
                <Switch checked={vm.config.enabled} onChange={vm.setEnabled}/>
                <span>{vm.config.enabled ? t('Footer visible') : t('Footer hidden')}</span>
                <Button data-testid="footer-save-btn" type="primary" onClick={vm.save} loading={vm.saving}>{t('Save')}</Button>
                <Button onClick={vm.refresh} loading={vm.loading}>{t('Refresh')}</Button>
                <AuditBadge editedBy={vm.config.editedBy} editedAt={vm.config.editedAt}/>
            </Space>
            <Row gutter={[12, 12]}>
                {vm.config.columns.map((col, i) => (
                    <Col xs={24} md={12} lg={8} key={i}>
                        <Card
                            size="small"
                            title={
                                <Input
                                    value={col.title}
                                    onChange={e => vm.patchColumn(i, {title: e.target.value})}
                                    placeholder={t('Column title')}
                                />
                            }
                            extra={<Button danger size="small" icon={<DeleteOutlined/>} onClick={() => vm.removeColumn(i)}/>}
                        >
                            <Space orientation="vertical" size={6} style={{width: '100%'}}>
                                {col.entries.map((entry, j) => {
                                    const mode = vm.getRowMode(i, j, entry.url);
                                    const nextMode = mode === 'picker' ? 'free-text' : 'picker';
                                    return (
                                        <Row key={j} gutter={4} align="middle">
                                            <Col xs={8}>
                                                <Input
                                                    size="small"
                                                    value={entry.label}
                                                    onChange={e => vm.patchEntry(i, j, {label: e.target.value})}
                                                    placeholder={t('Label')}
                                                />
                                            </Col>
                                            <Col xs={11}>
                                                {mode === 'picker' ? (
                                                    <LinkTargetPicker
                                                        value={entry.url ?? ''}
                                                        onChange={(v) => vm.patchEntry(i, j, {url: v})}
                                                        placeholder={t('Pick page or anchor')}
                                                        hostId={`footer-col-${i}-entry-${j}`}
                                                    />
                                                ) : (
                                                    <Input
                                                        size="small"
                                                        value={entry.url ?? ''}
                                                        onChange={e => vm.patchEntry(i, j, {url: e.target.value})}
                                                        placeholder="https:// or mailto: or #anchor"
                                                    />
                                                )}
                                            </Col>
                                            <Col xs={3}>
                                                <Button
                                                    size="small"
                                                    onClick={() => vm.setRowMode(i, j, nextMode)}
                                                    title={t('Toggle picker / free-text')}
                                                >
                                                    {mode === 'picker' ? t('Type') : t('Pick')}
                                                </Button>
                                            </Col>
                                            <Col xs={2}>
                                                <Button size="small" danger icon={<DeleteOutlined/>} onClick={() => vm.removeEntry(i, j)}/>
                                            </Col>
                                        </Row>
                                    );
                                })}
                                <Button size="small" icon={<PlusOutlined/>} onClick={() => vm.addEntry(i)}>{t('Add entry')}</Button>
                            </Space>
                        </Card>
                    </Col>
                ))}
                <Col xs={24}>
                    <Button icon={<PlusOutlined/>} onClick={vm.addColumn}>{t('Add column')}</Button>
                </Col>
            </Row>
            <div style={{marginTop: 24}}>
                <Typography.Text strong>{t('Bottom line')}</Typography.Text>
                <Input
                    data-testid="footer-copyright-input"
                    value={vm.config.bottom ?? ''}
                    onChange={e => vm.setBottom(e.target.value)}
                    placeholder={`© ${new Date().getFullYear()} …`}
                    style={{marginTop: 6}}
                />
            </div>
            {vm.conflict && (() => {
                const peer = vm.conflict.error.currentDoc as {editedBy?: string; editedAt?: string} | null;
                return (
                    <ConflictDialog
                        open
                        docKind={t('Footer')}
                        peerVersion={vm.conflict.error.currentVersion}
                        peerEditedBy={peer?.editedBy}
                        peerEditedAt={peer?.editedAt}
                        onCancel={vm.dismissConflict}
                        onTakeTheirs={vm.takeTheirs}
                        onKeepMine={async () => {
                            try { await vm.conflict?.retry(); }
                            catch (err) { notifyError(err); vm.dismissConflict(); }
                        }}
                    />
                );
            })()}
        </div>
    );
};

export default AdminSettingsFooter;
