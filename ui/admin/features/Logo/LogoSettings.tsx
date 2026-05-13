import React, {useEffect} from "react";
import {Alert, Button, InputNumber, Popconfirm, Select, Space, Typography} from "antd";
import {notifyError} from '@admin/lib/notify';
import {DeleteOutlined} from "@client/lib/icons";
import {ELogoStyle} from "@enums/ELogoStyle";
import {useTranslation} from "react-i18next";
import ImageUpload from "@admin/lib/ImageUpload";
import ImageDropTarget from "@client/lib/ImageDropTarget";
import {PUBLIC_IMAGE_PATH} from "@utils/imgPath";
import AuditBadge from "@admin/shell/AuditBadge";
import {useRefreshView} from "@client/lib/refreshBus";
import ConflictDialog from "@client/lib/ConflictDialog";
import {useViewModel} from "@client/lib/state/observable";
import {LogoViewModel} from "./LogoViewModel";

/** Render-only Logo pane — VM3 (2026-05-02). */
const AdminSettingsLogo: React.FC = () => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new LogoViewModel(undefined, t));

    useEffect(() => { void vm.refresh(); }, [vm]);
    useRefreshView(vm.refresh, 'settings');

    return (
        <div style={{padding: 16, maxWidth: 720}}>
            <Alert
                type="info"
                showIcon
                style={{marginBottom: 16}}
                message={t('The logo appears at the far left of the public site header, next to the navigation. Choose an image then press Save.')}
            />

            <div style={{marginBottom: 12}}>
                <AuditBadge editedBy={vm.audit.editedBy} editedAt={vm.audit.editedAt}/>
            </div>

            <Space align="start" size={32} style={{marginBottom: 24, flexWrap: 'wrap'}}>
                <div>
                    <Typography.Text strong>{t('Current logo')}</Typography.Text>
                    <div style={{marginTop: 8, padding: 12, border: '1px dashed rgba(0,0,0,0.15)', minHeight: 64, minWidth: 200, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                        {vm.logo.src
                            ? <img alt="logo" src={`/${vm.logo.src}`} height={vm.logo.height}/>
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
                            value={vm.logo.height}
                            onChange={v => vm.setHeight(Number(v) || 40)}
                        />
                    </div>
                </div>
                <div>
                    <Typography.Text strong>{t('Style')}</Typography.Text>
                    <div style={{marginTop: 8}}>
                        <Select
                            value={vm.logo.style}
                            style={{minWidth: 160}}
                            onChange={vm.setStyle}
                            options={[
                                {value: ELogoStyle.Default, label: t('Default')},
                                {value: ELogoStyle.Bordered, label: t('Bordered')},
                                {value: ELogoStyle.Framed, label: t('Framed')},
                                {value: ELogoStyle.Circle, label: t('Circle')},
                            ]}
                        />
                    </div>
                </div>
            </Space>

            <Typography.Text strong>{t('Upload or pick a logo image')}</Typography.Text>
            <ImageDropTarget
                filled={!!vm.logo.src}
                style={{marginTop: 8}}
                onImage={(img) => vm.setLogoSrc(`${PUBLIC_IMAGE_PATH}${img.name}`)}
            >
                <ImageUpload t={t as any} setFile={vm.handleFile}/>
            </ImageDropTarget>

            <Space style={{marginTop: 24}}>
                <Button type="primary" onClick={vm.save} loading={vm.saving} disabled={vm.loading}>
                    {t('Save')}
                </Button>
                <Button onClick={vm.refresh} loading={vm.loading}>{t('Refresh')}</Button>
                <Popconfirm
                    title={t('Clear the logo?')}
                    okText={t('Clear')}
                    cancelText={t('Cancel')}
                    onConfirm={vm.clear}
                >
                    <Button danger icon={<DeleteOutlined/>}>{t('Clear logo')}</Button>
                </Popconfirm>
            </Space>
            {vm.conflict && (() => {
                const peer = vm.conflict.error.currentDoc as {editedBy?: string; editedAt?: string} | null;
                return (
                    <ConflictDialog
                        open
                        docKind={t('Logo')}
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

export default AdminSettingsLogo;
