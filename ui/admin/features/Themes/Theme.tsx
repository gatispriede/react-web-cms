import React, {useEffect} from 'react';
import {Button, Card, Col, ColorPicker, ConfigProvider, Form, Input, InputNumber, Modal, Popconfirm, Row, Space, Tag, message} from 'antd';
import {CheckCircleFilled, CopyOutlined, DeleteOutlined, EditOutlined, PlusOutlined} from '@client/lib/icons';
import {useTranslation} from 'react-i18next';
import {ITheme, IThemeTokens} from '@interfaces/ITheme';
import AuditBadge from '@admin/shell/AuditBadge';
import {useRefreshView} from '@client/lib/refreshBus';
import ThemePreviewFrame from './ThemePreviewFrame';
import FontPicker, {FontPickerSlot} from './FontPicker';
import ConflictDialog from '@client/lib/ConflictDialog';
import {useViewModel} from '@client/lib/state/observable';
import {ThemesViewModel} from './ThemesViewModel';

/** Preset names with a source-controlled JSON in `ui/client/themes/<slug>.json`.
 *  Only these presets expose the "Reset to preset" affordance — the colour-only
 *  basics (Classic, Ocean, Forest, Midnight, Brandappart) live only in code, so
 *  there's nothing to reset against on disk. Keep in sync with
 *  `services/features/Themes/ThemeService.ts` JSON_PRESET_SLUGS. */
const JSON_PRESET_NAMES = new Set(['Industrial', 'Studio', 'Paper', 'High contrast']);

const COLOR_TOKENS: {key: keyof IThemeTokens; label: string}[] = [
    {key: 'colorPrimary', label: 'Primary'},
    {key: 'colorBgBase', label: 'Background'},
    {key: 'colorTextBase', label: 'Text'},
    {key: 'colorSuccess', label: 'Success'},
    {key: 'colorWarning', label: 'Warning'},
    {key: 'colorError', label: 'Error'},
    {key: 'colorInfo', label: 'Info'},
];

const toHex = (v: any): string => (typeof v === 'string' ? v : v?.toHexString?.() ?? '');

const ThemeCard: React.FC<{
    theme: ITheme;
    active: boolean;
    onActivate: () => void;
    onEdit: () => void;
    onDuplicate: () => void;
    onDelete: () => void;
    onReset: () => void;
    deletePending?: boolean;
    t: (k: string) => string;
}> = ({theme, active, onActivate, onEdit, onDuplicate, onDelete, onReset, deletePending, t}) => (
    <Card
        data-testid={`themes-list-row-${theme.id}`}
        size="small"
        title={
            <Space>
                {theme.name}
                {!theme.custom && <Tag color="blue">{t('Preset')}</Tag>}
                {active && <Tag color="green" icon={<CheckCircleFilled/>}>{t('Active')}</Tag>}
            </Space>
        }
        extra={
            <Space size={4}>
                {/* DECISION: render the set-active button on every row (disabled
                    when already active) so tests can locate it per row and use
                    `.isEnabled()` to find an inactive theme to switch to. */}
                <Button
                    data-testid="themes-set-active-btn"
                    size="small"
                    type="primary"
                    disabled={active}
                    onClick={onActivate}
                >
                    {t('Activate')}
                </Button>
            </Space>
        }
    >
        <div style={{marginBottom: 10}}>
            <ThemePreviewFrame tokens={theme.tokens} themeName={theme.name} width={260}/>
        </div>
        <div style={{display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap'}}>
            {COLOR_TOKENS.slice(0, 4).map(({key, label}) => (
                <div key={key} title={label} style={{
                    width: 18,
                    height: 18,
                    borderRadius: 3,
                    background: (theme.tokens?.[key] as string) ?? '#ccc',
                    border: '1px solid #eee',
                }}/>
            ))}
        </div>
        <Space size={4} wrap>
            {theme.custom && (
                <Button size="small" icon={<EditOutlined/>} onClick={onEdit}>{t('Edit')}</Button>
            )}
            <Button size="small" icon={<CopyOutlined/>} onClick={onDuplicate}>{t('Duplicate')}</Button>
            {!theme.custom && JSON_PRESET_NAMES.has(theme.name) && (
                <Popconfirm
                    title={t('Reset this preset to its on-disk JSON defaults?')}
                    okText={t('Reset')}
                    cancelText={t('Cancel')}
                    onConfirm={onReset}
                >
                    <Button size="small">{t('Reset to preset')}</Button>
                </Popconfirm>
            )}
            {theme.custom && (
                <Popconfirm
                    title={t('Delete theme?')}
                    okText={t('Delete')}
                    cancelText={t('Cancel')}
                    okButtonProps={{danger: true, loading: !!deletePending}}
                    onConfirm={onDelete}
                >
                    <Button size="small" danger icon={<DeleteOutlined/>} loading={!!deletePending}/>
                </Popconfirm>
            )}
        </Space>
    </Card>
);

const FONT_SLOTS: {slot: FontPickerSlot; tokenKey: 'fontDisplay' | 'fontSans' | 'fontMono'; label: string}[] = [
    {slot: 'display', tokenKey: 'fontDisplay', label: 'Display'},
    {slot: 'sans', tokenKey: 'fontSans', label: 'Body'},
    {slot: 'mono', tokenKey: 'fontMono', label: 'Mono'},
];

/**
 * Modal editor — render-only over `ThemesViewModel`. The draft +
 * picker-slot state used to live as `useState` here; both moved to
 * the vm so the entire pane has a single source of truth (VM3 final
 * pane, 2026-05-02). All token mutations route through `vm.setToken`
 * → re-assigns `vm.editing` → notifies subscribers → re-render.
 */
const ThemeEditor: React.FC<{vm: ThemesViewModel; t: (k: string) => string}> = ({vm, t}) => {
    const draft = vm.editing;
    if (!draft) return null;

    const previewConfig = {token: draft.tokens as any};

    return (
        <Modal
            title={draft.id ? t('Edit theme') : t('New theme')}
            open
            width={720}
            onCancel={vm.closeEditor}
            onOk={() => vm.save()}
            confirmLoading={vm.saving}
            okText={t('Save')}
        >
            <Form layout="vertical">
                <Form.Item label={t('Name')}>
                    <Input
                        value={draft.name}
                        onChange={e => vm.setName(e.target.value)}
                    />
                </Form.Item>
                <Row gutter={[12, 8]}>
                    {COLOR_TOKENS.map(({key, label}) => (
                        <Col xs={12} md={8} key={key}>
                            <Form.Item label={t(label)} style={{marginBottom: 8}}>
                                <ColorPicker
                                    value={draft.tokens[key] as string}
                                    onChange={v => vm.setToken(key, toHex(v))}
                                    showText
                                />
                            </Form.Item>
                        </Col>
                    ))}
                    <Col xs={12} md={8}>
                        <Form.Item label={t('Border radius')} style={{marginBottom: 8}}>
                            <InputNumber
                                min={0}
                                max={24}
                                value={draft.tokens.borderRadius}
                                onChange={v => vm.setToken('borderRadius', Number(v) || 0)}
                            />
                        </Form.Item>
                    </Col>
                    <Col xs={12} md={8}>
                        <Form.Item label={t('Font size')} style={{marginBottom: 8}}>
                            <InputNumber
                                min={10}
                                max={24}
                                value={draft.tokens.fontSize}
                                onChange={v => vm.setToken('fontSize', Number(v) || 16)}
                            />
                        </Form.Item>
                    </Col>
                    <Col xs={12} md={8}>
                        <Form.Item label={t('Content padding (px)')} style={{marginBottom: 8}} tooltip={t('Site-wide horizontal padding. Full-bleed modules (hero with bg, image-as-background) break out.')}>
                            <InputNumber
                                min={0}
                                max={96}
                                value={draft.tokens.contentPadding}
                                onChange={v => vm.setToken('contentPadding', Number(v) || 24)}
                            />
                        </Form.Item>
                    </Col>
                </Row>
                <div style={{marginTop: 12, borderTop: '1px solid #eee', paddingTop: 12}}>
                    <div style={{fontWeight: 500, marginBottom: 8}}>{t('Fonts')}</div>
                    <Space orientation="vertical" size={6} style={{width: '100%'}}>
                        {FONT_SLOTS.map(({slot, tokenKey, label}) => {
                            const stack = draft.tokens[tokenKey] as string | undefined;
                            return (
                                <div key={slot} style={{display: 'flex', alignItems: 'center', gap: 10}}>
                                    <span style={{minWidth: 70, fontSize: 12, color: '#555'}}>{t(label)}</span>
                                    <span style={{
                                        flex: 1,
                                        fontFamily: stack || 'inherit',
                                        fontSize: 14,
                                        color: stack ? '#1f1f1f' : '#aaa',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}>
                                        {stack ? 'The quick brown fox' : t('System default')}
                                    </span>
                                    <Button size="small" onClick={() => vm.openPicker(slot)}>{t('Pick…')}</Button>
                                </div>
                            );
                        })}
                    </Space>
                </div>
                <div style={{marginTop: 12, borderTop: '1px solid #eee', paddingTop: 12}}>
                    <div style={{fontWeight: 500, marginBottom: 8}}>{t('Preview')}</div>
                    <ConfigProvider theme={previewConfig}>
                        <Space wrap>
                            <Button type="primary">{t('Primary')}</Button>
                            <Button>{t('Default')}</Button>
                            <Button danger>{t('Danger')}</Button>
                            <Tag color={draft.tokens.colorSuccess as string}>{t('Success')}</Tag>
                            <Tag color={draft.tokens.colorWarning as string}>{t('Warning')}</Tag>
                            <Tag color={draft.tokens.colorError as string}>{t('Error')}</Tag>
                        </Space>
                    </ConfigProvider>
                </div>
            </Form>
            <FontPicker
                open={vm.pickerSlot !== null}
                slot={vm.pickerSlot ?? 'display'}
                currentStack={vm.pickerCurrentStack}
                onCancel={vm.closePicker}
                onPick={vm.pickFont}
            />
        </Modal>
    );
};

const AdminSettingsTheme: React.FC = () => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new ThemesViewModel(undefined, t));

    useEffect(() => { void vm.refresh(); }, [vm]);
    useRefreshView(vm.refresh, 'settings');

    return (
        <div style={{padding: 16}}>
            <Space style={{marginBottom: 16}} align="center">
                <Button type="primary" icon={<PlusOutlined/>} onClick={vm.createBlank}>{t('New theme')}</Button>
                <Button onClick={vm.refresh} loading={vm.loading}>{t('Refresh')}</Button>
                <AuditBadge editedBy={vm.activeAudit.editedBy} editedAt={vm.activeAudit.editedAt}/>
            </Space>
            <Row gutter={[12, 12]}>
                {vm.themes.map(theme => (
                    <Col xs={24} md={12} lg={8} key={theme.id}>
                        <ThemeCard
                            theme={theme}
                            active={theme.id === vm.activeId}
                            onActivate={() => vm.activate(theme.id)}
                            onEdit={() => vm.edit(theme)}
                            onDuplicate={() => vm.duplicate(theme)}
                            onDelete={() => vm.remove(theme.id)}
                            deletePending={vm.removePending}
                            onReset={() => vm.resetPreset(theme.id)}
                            t={t}
                        />
                    </Col>
                ))}
            </Row>
            {vm.editing && <ThemeEditor vm={vm} t={t}/>}
            {vm.conflict && (() => {
                const peer = vm.conflict.error.currentDoc as {editedBy?: string; editedAt?: string; name?: string} | null;
                return (
                    <ConflictDialog
                        open
                        docKind={t('Theme')}
                        peerVersion={vm.conflict.error.currentVersion}
                        peerEditedBy={peer?.editedBy}
                        peerEditedAt={peer?.editedAt}
                        onCancel={vm.dismissConflict}
                        onTakeTheirs={() => { void vm.takeTheirs(); }}
                        onKeepMine={async () => {
                            try { await vm.conflict?.retry(); }
                            catch (err) { message.error(String((err as Error)?.message ?? err)); vm.dismissConflict(); }
                        }}
                    />
                );
            })()}
        </div>
    );
};

export default AdminSettingsTheme;
