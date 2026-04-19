import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Button, Card, Col, ColorPicker, ConfigProvider, Form, Input, InputNumber, Modal, Popconfirm, Row, Space, Tag, message} from 'antd';
import {CheckCircleFilled, CopyOutlined, DeleteOutlined, EditOutlined, PlusOutlined} from '../../common/icons';
import {useTranslation} from 'next-i18next';
import ThemeApi from '../../../api/ThemeApi';
import {ITheme, IThemeTokens, InTheme} from '../../../../Interfaces/ITheme';
import AuditBadge from '../AuditBadge';
import {useRefreshView} from '../../../lib/refreshBus';
import ThemePreviewFrame from './ThemePreviewFrame';
import FontPicker, {FontPickerSlot} from './FontPicker';
import ConflictDialog from '../../common/ConflictDialog';
import {ConflictError, isConflictError} from '../../../lib/conflict';

const themeApi = new ThemeApi();

const COLOR_TOKENS: {key: keyof IThemeTokens; label: string}[] = [
    {key: 'colorPrimary', label: 'Primary'},
    {key: 'colorBgBase', label: 'Background'},
    {key: 'colorTextBase', label: 'Text'},
    {key: 'colorSuccess', label: 'Success'},
    {key: 'colorWarning', label: 'Warning'},
    {key: 'colorError', label: 'Error'},
    {key: 'colorInfo', label: 'Info'},
];

const BLANK_TOKENS: IThemeTokens = {
    colorPrimary: '#3b3939',
    colorBgBase: '#ffffff',
    colorTextBase: '#1f1f1f',
    colorSuccess: '#52c41a',
    colorWarning: '#faad14',
    colorError: '#ff4d4f',
    colorInfo: '#1677ff',
    borderRadius: 6,
    fontSize: 16,
    contentPadding: 24,
};

const toHex = (v: any): string => (typeof v === 'string' ? v : v?.toHexString?.() ?? '');

const ThemeCard: React.FC<{
    theme: ITheme;
    active: boolean;
    onActivate: () => void;
    onEdit: () => void;
    onDuplicate: () => void;
    onDelete: () => void;
    t: (k: string) => string;
}> = ({theme, active, onActivate, onEdit, onDuplicate, onDelete, t}) => (
    <Card
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
                {!active && (
                    <Button size="small" type="primary" onClick={onActivate}>{t('Activate')}</Button>
                )}
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
            {theme.custom && (
                <Popconfirm
                    title={t('Delete theme?')}
                    okText={t('Delete')}
                    cancelText={t('Cancel')}
                    okButtonProps={{danger: true}}
                    onConfirm={onDelete}
                >
                    <Button size="small" danger icon={<DeleteOutlined/>}/>
                </Popconfirm>
            )}
        </Space>
    </Card>
);

const ThemeEditor: React.FC<{
    initial: InTheme;
    onCancel: () => void;
    onSave: (theme: InTheme) => Promise<void>;
    t: (k: string) => string;
    saving: boolean;
}> = ({initial, onCancel, onSave, t, saving}) => {
    const [draft, setDraft] = useState<InTheme>(initial);
    const [pickerSlot, setPickerSlot] = useState<FontPickerSlot | null>(null);

    const setToken = (key: keyof IThemeTokens, value: string | number) =>
        setDraft(d => ({...d, tokens: {...d.tokens, [key]: value}}));

    const previewConfig = useMemo(() => ({token: draft.tokens as any}), [draft.tokens]);

    const FONT_SLOTS: {slot: FontPickerSlot; tokenKey: 'fontDisplay' | 'fontSans' | 'fontMono'; label: string}[] = [
        {slot: 'display', tokenKey: 'fontDisplay', label: t('Display')},
        {slot: 'sans', tokenKey: 'fontSans', label: t('Body')},
        {slot: 'mono', tokenKey: 'fontMono', label: t('Mono')},
    ];

    return (
        <Modal
            title={initial.id ? t('Edit theme') : t('New theme')}
            open
            width={720}
            onCancel={onCancel}
            onOk={() => onSave(draft)}
            confirmLoading={saving}
            okText={t('Save')}
        >
            <Form layout="vertical">
                <Form.Item label={t('Name')}>
                    <Input
                        value={draft.name}
                        onChange={e => setDraft(d => ({...d, name: e.target.value}))}
                    />
                </Form.Item>
                <Row gutter={[12, 8]}>
                    {COLOR_TOKENS.map(({key, label}) => (
                        <Col xs={12} md={8} key={key}>
                            <Form.Item label={t(label)} style={{marginBottom: 8}}>
                                <ColorPicker
                                    value={draft.tokens[key] as string}
                                    onChange={v => setToken(key, toHex(v))}
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
                                onChange={v => setToken('borderRadius', Number(v) || 0)}
                            />
                        </Form.Item>
                    </Col>
                    <Col xs={12} md={8}>
                        <Form.Item label={t('Font size')} style={{marginBottom: 8}}>
                            <InputNumber
                                min={10}
                                max={24}
                                value={draft.tokens.fontSize}
                                onChange={v => setToken('fontSize', Number(v) || 16)}
                            />
                        </Form.Item>
                    </Col>
                    <Col xs={12} md={8}>
                        <Form.Item label={t('Content padding (px)')} style={{marginBottom: 8}} tooltip={t('Site-wide horizontal padding. Full-bleed modules (hero with bg, image-as-background) break out.')}>
                            <InputNumber
                                min={0}
                                max={96}
                                value={draft.tokens.contentPadding}
                                onChange={v => setToken('contentPadding', Number(v) || 24)}
                            />
                        </Form.Item>
                    </Col>
                </Row>
                <div style={{marginTop: 12, borderTop: '1px solid #eee', paddingTop: 12}}>
                    <div style={{fontWeight: 500, marginBottom: 8}}>{t('Fonts')}</div>
                    <Space direction="vertical" size={6} style={{width: '100%'}}>
                        {FONT_SLOTS.map(({slot, tokenKey, label}) => {
                            const stack = draft.tokens[tokenKey] as string | undefined;
                            return (
                                <div key={slot} style={{display: 'flex', alignItems: 'center', gap: 10}}>
                                    <span style={{minWidth: 70, fontSize: 12, color: '#555'}}>{label}</span>
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
                                    <Button size="small" onClick={() => setPickerSlot(slot)}>{t('Pick…')}</Button>
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
                open={pickerSlot !== null}
                slot={pickerSlot ?? 'display'}
                currentStack={pickerSlot
                    ? draft.tokens[pickerSlot === 'sans' ? 'fontSans' : pickerSlot === 'mono' ? 'fontMono' : 'fontDisplay'] as string | undefined
                    : undefined}
                onCancel={() => setPickerSlot(null)}
                onPick={(stack) => {
                    if (!pickerSlot) return;
                    const tokenKey = pickerSlot === 'sans' ? 'fontSans' : pickerSlot === 'mono' ? 'fontMono' : 'fontDisplay';
                    setToken(tokenKey, stack);
                    setPickerSlot(null);
                }}
            />
        </Modal>
    );
};

const AdminSettingsTheme = () => {
    const {t} = useTranslation('common');
    const [themes, setThemes] = useState<ITheme[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [activeAudit, setActiveAudit] = useState<{editedBy?: string; editedAt?: string}>({});
    const [loading, setLoading] = useState(false);
    const [editing, setEditing] = useState<InTheme | null>(null);
    /** Server-side `version` at the time the editor opened — sent as
     *  `expectedVersion` so the next save catches a peer's concurrent
     *  edit. `undefined` for a brand-new theme that hasn't been saved
     *  yet (no version to check against). */
    const [editingVersion, setEditingVersion] = useState<number | undefined>(undefined);
    const [saving, setSaving] = useState(false);
    const [conflict, setConflict] = useState<{error: ConflictError<any>; retry: () => Promise<void>} | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const [list, active] = await Promise.all([
                themeApi.listThemes(),
                themeApi.getActive(),
            ]);
            setThemes(list);
            setActiveId(active?.id ?? null);
            setActiveAudit({editedBy: active?.editedBy, editedAt: active?.editedAt});
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void refresh(); }, [refresh]);
    useRefreshView(refresh, 'settings');

    const activate = async (id: string) => {
        const result = await themeApi.setActive(id);
        if (result.error) { message.error(result.error); return; }
        message.success(t('Theme activated — reload to see changes site-wide.'));
        setActiveId(id);
    };

    const remove = async (id: string) => {
        const result = await themeApi.deleteTheme(id);
        if (result.error) { message.error(result.error); return; }
        message.success(t('Theme deleted'));
        await refresh();
    };

    const duplicate = (theme: ITheme) => {
        // Duplicate writes a brand-new theme — no expectedVersion baseline yet.
        setEditing({
            name: `${theme.name} ${t('(copy)')}`,
            tokens: {...theme.tokens},
            custom: true,
        });
        setEditingVersion(undefined);
    };

    const edit = (theme: ITheme) => {
        setEditing({id: theme.id, name: theme.name, tokens: {...theme.tokens}, custom: true});
        setEditingVersion(typeof theme.version === 'number' ? theme.version : 0);
    };

    const createBlank = () => {
        setEditing({name: t('New theme'), tokens: {...BLANK_TOKENS}, custom: true});
        setEditingVersion(undefined);
    };

    const performSave = useCallback(async (draft: InTheme, expectedVersion: number | undefined) => {
        const result = await themeApi.saveTheme(draft, expectedVersion);
        if (result.error) { message.error(result.error); return false; }
        message.success(t('Theme saved'));
        setEditing(null);
        setEditingVersion(undefined);
        await refresh();
        return true;
    }, [refresh, t]);

    const save = async (draft: InTheme) => {
        if (!draft.name.trim()) { message.error(t('Name is required')); return; }
        setSaving(true);
        try {
            await performSave(draft, editingVersion);
        } catch (err) {
            if (isConflictError(err)) {
                // Stash the conflict so the dialog can offer take-theirs vs
                // keep-mine. Keep-mine retries with the bumped version baseline.
                setConflict({
                    error: err,
                    retry: async () => {
                        setSaving(true);
                        try {
                            await performSave(draft, err.currentVersion);
                            setConflict(null);
                        } finally {
                            setSaving(false);
                        }
                    },
                });
            } else {
                message.error(String((err as Error)?.message ?? err));
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{padding: 16}}>
            <Space style={{marginBottom: 16}} align="center">
                <Button type="primary" icon={<PlusOutlined/>} onClick={createBlank}>{t('New theme')}</Button>
                <Button onClick={refresh} loading={loading}>{t('Refresh')}</Button>
                <AuditBadge editedBy={activeAudit.editedBy} editedAt={activeAudit.editedAt}/>
            </Space>
            <Row gutter={[12, 12]}>
                {themes.map(theme => (
                    <Col xs={24} md={12} lg={8} key={theme.id}>
                        <ThemeCard
                            theme={theme}
                            active={theme.id === activeId}
                            onActivate={() => activate(theme.id)}
                            onEdit={() => edit(theme)}
                            onDuplicate={() => duplicate(theme)}
                            onDelete={() => remove(theme.id)}
                            t={t}
                        />
                    </Col>
                ))}
            </Row>
            {editing && (
                <ThemeEditor
                    initial={editing}
                    onCancel={() => { setEditing(null); setEditingVersion(undefined); }}
                    onSave={save}
                    t={t}
                    saving={saving}
                />
            )}
            {conflict && (() => {
                const peer = conflict.error.currentDoc as {editedBy?: string; editedAt?: string; name?: string} | null;
                return (
                    <ConflictDialog
                        open
                        docKind={t('Theme')}
                        peerVersion={conflict.error.currentVersion}
                        peerEditedBy={peer?.editedBy}
                        peerEditedAt={peer?.editedAt}
                        onCancel={() => setConflict(null)}
                        onTakeTheirs={async () => {
                            setConflict(null);
                            setEditing(null);
                            setEditingVersion(undefined);
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

export default AdminSettingsTheme;
