import React, {useCallback, useEffect, useState} from "react";
import {Alert, Button, InputNumber, Popconfirm, Space, Typography, message} from "antd";
import {DeleteOutlined} from "@ant-design/icons";
import {useTranslation} from "next-i18next";
import ImageUpload from "../../ImageUpload";
import MongoApi from "../../../api/MongoApi";
import {PUBLIC_IMAGE_PATH} from "../../../../constants/imgPath";
import AuditBadge from "../AuditBadge";
import {useRefreshView} from "../../../lib/refreshBus";

interface LogoState {
    src: string;
    width: number;
    height: number;
}

const DEFAULT: LogoState = {src: '', width: 40, height: 40};

const mongoApi = new MongoApi();

/**
 * Derive the canonical `api/<file>` path from whatever shape ImageUpload
 * hands us. A gallery-selected `IImage` already has `location`; a fresh
 * upload is a raw `File` whose `.name` matches the filename written to
 * `public/images/` by `/api/upload` (with spaces → underscores).
 */
const inferLocation = (f: any): string | undefined => {
    if (!f) return undefined;
    if (typeof f.location === 'string' && f.location) return f.location;
    const name = typeof f.name === 'string' ? f.name : undefined;
    if (!name) return undefined;
    return `${PUBLIC_IMAGE_PATH}${name.replace(/ /g, '_')}`;
};

const AdminSettingsLogo: React.FC = () => {
    const {t} = useTranslation('common');
    const [logo, setLogo] = useState<LogoState>({...DEFAULT});
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(false);
    const [audit, setAudit] = useState<{editedBy?: string; editedAt?: string}>({});

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const raw = await mongoApi.getLogo();
            setAudit({editedBy: raw?.editedBy, editedAt: raw?.editedAt});
            if (!raw?.content) { setLogo({...DEFAULT}); return; }
            try {
                const parsed = JSON.parse(raw.content);
                setLogo({
                    src: typeof parsed?.src === 'string' ? parsed.src : '',
                    width: Number.isFinite(parsed?.width) ? parsed.width : DEFAULT.width,
                    height: Number.isFinite(parsed?.height) ? parsed.height : DEFAULT.height,
                });
            } catch { setLogo({...DEFAULT}); }
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { void refresh(); }, [refresh]);
    useRefreshView(refresh, 'settings');

    // ImageUpload calls this with either a raw File (fresh upload) or an
    // IImage (gallery select). Either way, update the preview immediately so
    // the admin sees what they picked.
    const handleFile = (f: any) => {
        const src = inferLocation(f);
        if (!src) {
            message.warning(t('Could not determine the uploaded image location yet — try again.'));
            return;
        }
        setLogo(prev => ({...prev, src}));
    };

    const save = async () => {
        setSaving(true);
        try {
            await mongoApi.saveLogo(JSON.stringify(logo));
            message.success(t('Logo saved'));
        } catch (err) {
            message.error(String((err as Error)?.message ?? err));
        } finally { setSaving(false); }
    };

    const clear = async () => {
        setSaving(true);
        try {
            await mongoApi.saveLogo(JSON.stringify({...DEFAULT}));
            setLogo({...DEFAULT});
            message.success(t('Logo cleared'));
        } finally { setSaving(false); }
    };

    return (
        <div style={{padding: 16, maxWidth: 720}}>
            <Alert
                type="info"
                showIcon
                style={{marginBottom: 16}}
                message={t('The logo appears at the far left of the public site header, next to the navigation. Choose an image then press Save.')}
            />

            <div style={{marginBottom: 12}}>
                <AuditBadge editedBy={audit.editedBy} editedAt={audit.editedAt}/>
            </div>

            <Space align="start" size={32} style={{marginBottom: 24, flexWrap: 'wrap'}}>
                <div>
                    <Typography.Text strong>{t('Current logo')}</Typography.Text>
                    <div style={{marginTop: 8, padding: 12, border: '1px dashed rgba(0,0,0,0.15)', minHeight: 64, minWidth: 200, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                        {logo.src
                            ? <img alt="logo" src={`/${logo.src}`} height={logo.height}/>
                            : <Typography.Text type="secondary">{t('No logo set')}</Typography.Text>
                        }
                    </div>
                </div>
                <div>
                    <Typography.Text strong>{t('Height (px)')}</Typography.Text>
                    <div style={{marginTop: 8}}>
                        <InputNumber
                            min={16}
                            max={160}
                            value={logo.height}
                            onChange={v => setLogo(prev => ({...prev, height: Number(v) || DEFAULT.height}))}
                        />
                    </div>
                </div>
            </Space>

            <Typography.Text strong>{t('Upload or pick a logo image')}</Typography.Text>
            <div style={{marginTop: 8}}>
                <ImageUpload t={t as any} setFile={handleFile}/>
            </div>

            <Space style={{marginTop: 24}}>
                <Button type="primary" onClick={save} loading={saving} disabled={loading}>
                    {t('Save')}
                </Button>
                <Button onClick={refresh} loading={loading}>{t('Refresh')}</Button>
                <Popconfirm
                    title={t('Clear the logo?')}
                    okText={t('Clear')}
                    cancelText={t('Cancel')}
                    onConfirm={clear}
                >
                    <Button danger icon={<DeleteOutlined/>}>{t('Clear logo')}</Button>
                </Popconfirm>
            </Space>
        </div>
    );
};

export default AdminSettingsLogo;
