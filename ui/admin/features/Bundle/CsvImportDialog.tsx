import React from 'react';
import {Alert, Button, Input, Modal, Select, Space, Typography} from 'antd';
import {UploadOutlined} from '@client/lib/icons';
import TranslationManager from '@admin/shell/TranslationManager';
import {useViewModel} from '@client/lib/state/observable';
import {CsvImportDialogViewModel} from './CsvImportDialogViewModel';

interface Props {
    open: boolean;
    close: (didImport: boolean) => void;
    translationManager: TranslationManager;
    /** non-default locales; drives the target-locale picker */
    languages: Array<{symbol: string; label: string}>;
}

/**
 * Paste-or-upload CSV and merge into a chosen locale via the existing
 * `saveLanguage` mutation (server-side merges on top of disk + Mongo, so the
 * import only ADDS / OVERWRITES the supplied keys — nothing is wiped).
 *
 * Expected CSV shape: header row with a `key` column and one column per
 * locale symbol (e.g. `key,source,en,lv`). The `source` column is ignored.
 */
const CsvImportDialog: React.FC<Props> = ({open, close, translationManager, languages}) => {
    const vm = useViewModel(() => new CsvImportDialogViewModel(translationManager, languages, close));

    const parsed  = vm.parsed as {error?: string} | null;
    const preview = vm.preview as Record<string, string> & {error?: string} | null;
    const previewCount   = preview && !preview.error ? Object.keys(preview).length : 0;
    const previewSamples = preview && !preview.error
        ? Object.entries(preview as Record<string, string>).slice(0, 5)
        : [];

    return (
        <Modal
            open={open}
            onCancel={vm.cancel}
            onOk={() => void vm.handleImport()}
            okButtonProps={{disabled: !previewCount || vm.saving, loading: vm.saving}}
            okText={previewCount ? `Import ${previewCount} keys` : 'Import'}
            title="Bulk import translations (CSV)"
            width={720}
            destroyOnClose
        >
            <Alert
                type="info"
                showIcon
                style={{marginBottom: 12}}
                message="Header row must include a `key` column plus one column per locale symbol. Empty cells are skipped (they won't wipe existing translations)."
            />
            <Space orientation="vertical" size={8} style={{width: '100%'}}>
                <Space wrap>
                    <Typography.Text strong>Target locale:</Typography.Text>
                    <Select
                        style={{width: 200}}
                        value={vm.targetLocale}
                        onChange={vm.setTargetLocale}
                        options={languages.map(l => ({value: l.symbol, label: `${l.label} (${l.symbol})`}))}
                    />
                    <label>
                        <input type="file" accept=".csv,text/csv" style={{display: 'none'}}
                               onChange={e => { const f = e.target.files?.[0]; if (f) void vm.handleFile(f); e.target.value = ''; }}/>
                        <Button icon={<UploadOutlined/>} onClick={e => (e.currentTarget.previousElementSibling as HTMLInputElement).click()}>
                            Upload CSV
                        </Button>
                    </label>
                </Space>
                <Typography.Text type="secondary">Or paste CSV below:</Typography.Text>
                <Input.TextArea
                    rows={8}
                    value={vm.raw}
                    onChange={e => vm.setRaw(e.target.value)}
                    placeholder={'key,source,en,lv\nHome,Home,Home,Sākums\n…'}
                    style={{fontFamily: 'ui-monospace, monospace', fontSize: 12}}
                />
                {parsed?.error && <Alert type="error" showIcon message={parsed.error}/>}
                {preview?.error && <Alert type="error" showIcon message={preview.error}/>}
                {previewCount > 0 && (
                    <Alert
                        type="success"
                        showIcon
                        message={`${previewCount} translations ready to import`}
                        description={
                            <div>
                                <Typography.Text type="secondary">First few:</Typography.Text>
                                <ul style={{margin: '4px 0 0', paddingLeft: 18}}>
                                    {previewSamples.map(([k, v]) => (
                                        <li key={k}><code>{k}</code> → {v.slice(0, 80)}{v.length > 80 ? '…' : ''}</li>
                                    ))}
                                </ul>
                            </div>
                        }
                    />
                )}
            </Space>
        </Modal>
    );
};

export default CsvImportDialog;
