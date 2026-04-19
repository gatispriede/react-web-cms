import {Button, message, Popconfirm, Space, Typography} from "antd";
import {DownloadOutlined, UploadOutlined} from "../../common/icons";
import React, {useRef, useState} from "react";
import {TFunction} from "i18next";

const {Title, Paragraph, Text} = Typography;

const BundleSettings = ({t}: { t: TFunction<"translation", undefined> }) => {
    const [exporting, setExporting] = useState(false);
    const [importing, setImporting] = useState(false);
    const [pendingBundle, setPendingBundle] = useState<any>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const doExport = async () => {
        setExporting(true);
        try {
            const res = await fetch('/api/export');
            if (!res.ok) throw new Error(`Export failed: ${res.status}`);
            const blob = await res.blob();
            const disposition = res.headers.get('Content-Disposition') || '';
            const match = /filename="([^"]+)"/.exec(disposition);
            const filename = match?.[1] || `site-${new Date().toISOString().slice(0, 10)}.json`;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            message.success(t('Export downloaded'));
        } catch (err) {
            message.error(t('Export failed') + ': ' + String(err));
        } finally {
            setExporting(false);
        }
    };

    const handleFile = async (file: File) => {
        try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            if (!parsed?.manifest || !parsed?.site) {
                throw new Error('Missing manifest or site');
            }
            setPendingBundle(parsed);
        } catch (err) {
            message.error(t('Invalid bundle file') + ': ' + String(err));
        }
    };

    const doImport = async () => {
        if (!pendingBundle) return;
        setImporting(true);
        try {
            const res = await fetch('/api/import', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(pendingBundle),
            });
            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || `Import failed: ${res.status}`);
            message.success(`${t('Import complete')} — ${JSON.stringify(data.restored)}, assets: ${data.assets}`);
            if (Array.isArray(data.skippedAssets) && data.skippedAssets.length) {
                message.warning(`${t('Skipped assets')}: ${data.skippedAssets.join(', ')}`);
            }
            setPendingBundle(null);
            if (fileRef.current) fileRef.current.value = '';
            setTimeout(() => window.location.reload(), 1500);
        } catch (err) {
            message.error(t('Import failed') + ': ' + String(err));
        } finally {
            setImporting(false);
        }
    };

    return (
        <Space direction="vertical" size="large" style={{width: '100%', padding: 16}}>
            <div>
                <Title level={4}>{t('Export')}</Title>
                <Paragraph>{t('Download a single JSON file with your navigation, sections, languages, logo and all referenced images inlined as base64.')}</Paragraph>
                <Button type="primary" icon={<DownloadOutlined/>} loading={exporting} onClick={doExport}>
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
                        type="file"
                        accept="application/json,.json"
                        onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void handleFile(f);
                        }}
                    />
                    <Popconfirm
                        title={t('Replace all site data?')}
                        description={t('This cannot be undone. Export first if unsure.')}
                        okText={t('Import')}
                        okButtonProps={{danger: true}}
                        cancelText={t('Cancel')}
                        disabled={!pendingBundle || importing}
                        onConfirm={doImport}
                    >
                        <Button
                            danger
                            icon={<UploadOutlined/>}
                            loading={importing}
                            disabled={!pendingBundle}
                        >
                            {pendingBundle
                                ? `${t('Apply')} (v${pendingBundle.manifest?.version}, ${Object.keys(pendingBundle.assets ?? {}).length} ${t('assets')})`
                                : t('Choose a file first')}
                        </Button>
                    </Popconfirm>
                </Space>
            </div>
        </Space>
    );
};

export default BundleSettings;
