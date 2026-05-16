import React, {useEffect} from "react";
import {Alert, Button, InputNumber, Popconfirm, Select, Space, Typography} from "antd";
import {notifyError} from '@admin/lib/notify';
import {DeleteOutlined} from "@client/lib/icons";
import {ELogoStyle} from "@enums/ELogoStyle";
import {ELogoVariant} from "@enums/ELogoVariant";
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
 * Variant slots rendered in the admin form. Order is intentional — most-
 * useful first (Icon stands in for the mark on tight slots; Mono is the
 * dark-footer/print fallback; Wordmark fills text-only theme lockups).
 */
const LOGO_VARIANT_SLOTS: Array<{variant: ELogoVariant; label: string; hint: string}> = [
    {variant: ELogoVariant.Icon, label: 'Icon (mark only)', hint: 'Square / bare-mark variant. Used for mobile-collapsed header and tight slots.'},
    {variant: ELogoVariant.Mono, label: 'Mono (single colour)', hint: 'Single-colour version for dark backgrounds, footers, and print contexts.'},
    {variant: ELogoVariant.Wordmark, label: 'Wordmark (text only)', hint: 'Text-only lockup. Picked automatically when the active theme declares logoLockup: "wordmark".'},
    {variant: ELogoVariant.Full, label: 'Full (explicit)', hint: 'Optional explicit override of the primary slot above. Leave empty to use the primary image as the Full variant.'},
];

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
                <Typography.Paragraph type="secondary" style={{marginTop: 4, marginBottom: 8}}>
                    {t('Primary slot — used as the "Full" variant fallback for every theme + context. Single-image installs only need to fill this one.')}
                </Typography.Paragraph>
                <ImageDropTarget
                    filled={!!vm.logo.src}
                    style={{marginTop: 8}}
                    onImage={(img) => vm.setLogoSrc(`${PUBLIC_IMAGE_PATH}${img.name}`)}
                >
                    <ImageUpload t={t as any} setFile={vm.handleFile}/>
                </ImageDropTarget>

                <div style={{marginTop: 32}}>
                    <Typography.Title level={5} style={{marginBottom: 4}}>
                        {t('Theme-aware variants (optional)')}
                    </Typography.Title>
                    <Typography.Paragraph type="secondary" style={{marginBottom: 16}}>
                        {t('Upload alternate marks for themes that prefer a different lockup (e.g. wordmark-only editorial, icon-only mobile collapse, mono for dark footers). Any unset slot falls back to the primary image above.')}
                    </Typography.Paragraph>
                    {LOGO_VARIANT_SLOTS.map(slot => {
                        const asset = vm.logo.variants[slot.variant];
                        return (
                            <div key={slot.variant} data-testid={`logo-variant-${slot.variant}`} style={{marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid rgba(0,0,0,0.06)'}}>
                                <Space align="start" size={16} style={{width: '100%', flexWrap: 'wrap'}}>
                                    <div style={{minWidth: 220}}>
                                        <Typography.Text strong>{t(slot.label)}</Typography.Text>
                                        <Typography.Paragraph type="secondary" style={{margin: '2px 0 0 0', fontSize: 12}}>
                                            {t(slot.hint)}
                                        </Typography.Paragraph>
                                    </div>
                                    <div style={{padding: 8, border: '1px dashed rgba(0,0,0,0.15)', minHeight: 56, minWidth: 120, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                                        {asset?.src
                                            ? <img alt={`logo-${slot.variant}`} src={`/${asset.src}`} style={{maxHeight: 40, maxWidth: 160}}/>
                                            : <Typography.Text type="secondary" style={{fontSize: 12}}>{t('Empty')}</Typography.Text>
                                        }
                                    </div>
                                    <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
                                        <ImageDropTarget
                                            filled={!!asset?.src}
                                            onImage={(img) => vm.setVariantSrc(slot.variant, `${PUBLIC_IMAGE_PATH}${img.name}`)}
                                        >
                                            <ImageUpload t={t as any} setFile={(f: any) => vm.handleVariantFile(slot.variant, f)}/>
                                        </ImageDropTarget>
                                        {asset?.src && (
                                            <Button size="small" icon={<DeleteOutlined/>} onClick={() => vm.clearVariant(slot.variant)}>
                                                {t('Clear')}
                                            </Button>
                                        )}
                                    </div>
                                </Space>
                            </div>
                        );
                    })}
                </div>

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
