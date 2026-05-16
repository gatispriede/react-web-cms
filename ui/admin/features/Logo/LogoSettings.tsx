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
import {useRefreshView} from "@client/lib/useRefreshView";
import ConflictDialog from "@client/lib/ConflictDialog";
import {useViewModel} from "@client/lib/state/observable";
import AdminFormModule from "@admin/modules/shapes/AdminFormModule";
import {LogoViewModel} from "./LogoViewModel";

/**
 * admin-module-composed — Logo settings bridge.
 *
 * Was a render-only VM3 pane; now the `AdminLoader` *bridge* for
 * `client-config/logo`. `LogoViewModel` is unchanged — only the
 * surrounding chrome moves into the generic `AdminFormModule` shape.
 * The `AuditBadge` becomes `headerExtra`; Save maps onto `onSave`;
 * Refresh + Clear stay bespoke in `footerExtra`. The `ConflictDialog`
 * stays in the form body.
 *
 * Registered with the `AdminPageRegistry` by `LogoAdminLoader`; the
 * shell reaches it via `AdminPageDispatch` (see `LogoAdminUILoader`).
 */
const AdminSettingsLogo: React.FC = () => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new LogoViewModel(undefined, t));

    useEffect(() => { void vm.refresh(); }, [vm]);
    useRefreshView(vm.refresh, 'settings');

    return (
        <AdminFormModule
            testId="admin-logo"
            title={t('Logo')}
            headerExtra={<AuditBadge editedBy={vm.audit.editedBy} editedAt={vm.audit.editedAt}/>}
            onSave={vm.save}
            saveLabel={t('Save')}
            saving={vm.saving}
            saveDisabled={vm.loading}
            footerExtra={
                <>
                    <Button onClick={vm.refresh} loading={vm.loading}>{t('Refresh')}</Button>
                    <Popconfirm
                        title={t('Clear the logo?')}
                        okText={t('Clear')}
                        cancelText={t('Cancel')}
                        onConfirm={vm.clear}
                    >
                        <Button danger icon={<DeleteOutlined/>}>{t('Clear logo')}</Button>
                    </Popconfirm>
                </>
            }
        >
            <div style={{maxWidth: 720}}>
                <Alert
                    type="info"
                    showIcon
                    style={{marginBottom: 16}}
                    message={t('The logo appears at the far left of the public site header, next to the navigation. Choose an image then press Save.')}
                />

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
        </AdminFormModule>
    );
};

export default AdminSettingsLogo;
