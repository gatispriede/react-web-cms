import {Button, Popconfirm, Progress, Space, Typography} from "antd";
import {DownloadOutlined, UploadOutlined} from "@client/lib/icons";
import React, {useEffect, useRef} from "react";
import {TFunction} from "i18next";
import {useViewModel} from "@client/lib/state/observable";
import AdminActionPanelModule from "@admin/modules/shapes/AdminActionPanelModule";
import {BundleViewModel} from "./BundleViewModel";

const {Title, Paragraph, Text} = Typography;

/**
 * admin-module-composed — Bundle bridge.
 *
 * Was a bespoke render-only pane; now the `AdminLoader` bridge for
 * `release/bundle`. `BundleViewModel` is unchanged; the export/import
 * controls move into the generic `AdminActionPanel` shape's `children`
 * slot and the import progress into its `result` slot.
 *
 * Registered with the `AdminPageRegistry` by `BundleAdminLoader`; the
 * shell reaches it via `AdminPageDispatch` (see `BundleAdminUILoader`).
 */
const BundleSettings = ({t}: { t: TFunction<"translation", undefined> }) => {
    const vm = useViewModel(() => new BundleViewModel(t as unknown as (k: string) => string));
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => () => vm.dispose(), [vm]);

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f) void vm.loadFile(f);
    };

    return (
        <AdminActionPanelModule
            testId="admin-bundle"
            title={t('Bundle')}
            description={t('Export the whole site as a single JSON file, or restore a previously exported bundle.')}
            result={vm.importProgress !== null && (
                <Progress
                    percent={vm.importProgress}
                    status={vm.importProgress === 100 ? 'success' : 'active'}
                    style={{maxWidth: 400}}
                />
            )}
        >
            <Space orientation="vertical" size="large" style={{width: '100%'}}>
                <div>
                    <Title level={4}>{t('Export')}</Title>
                    <Paragraph>{t('Download a single JSON file with your navigation, sections, languages, logo and all referenced images inlined as base64.')}</Paragraph>
                    <Button data-testid="bundle-export-button" type="primary" icon={<DownloadOutlined/>} loading={vm.exporting} onClick={vm.doExport}>
                        {t('Download site bundle')}
                    </Button>
                </div>

                <div>
                    <Title level={4}>{t('Import')}</Title>
                    <Paragraph>
                        {t('Restore a previously exported bundle.')}{' '}
                        <Text type="danger">{t('This replaces ALL site data and overwrites files in public/images.')}</Text>
                    </Paragraph>
                    <Space>
                        <input
                            ref={fileRef}
                            data-testid="bundle-import-file-input"
                            type="file"
                            accept="application/json,.json"
                            onChange={onFileChange}
                        />
                        <Popconfirm
                            title={t('Replace all site data?')}
                            description={t('This cannot be undone. Export first if unsure.')}
                            okText={t('Import')}
                            okButtonProps={{danger: true, 'data-testid': 'bundle-import-confirm-btn'} as any}
                            cancelText={t('Cancel')}
                            disabled={!vm.pendingBundle || vm.importing}
                            onConfirm={() => vm.doImport(() => { if (fileRef.current) fileRef.current.value = ''; })}
                        >
                            <Button
                                data-testid="bundle-import-submit-btn"
                                danger
                                icon={<UploadOutlined/>}
                                loading={vm.importing}
                                disabled={!vm.pendingBundle}
                            >
                                {vm.pendingBundle
                                    ? `${t('Apply')} (v${vm.pendingBundle.manifest?.version}, ${Object.keys(vm.pendingBundle.assets ?? {}).length} ${t('assets')})`
                                    : t('Choose a file first')}
                            </Button>
                        </Popconfirm>
                    </Space>
                </div>
            </Space>
        </AdminActionPanelModule>
    );
};

export default BundleSettings;
