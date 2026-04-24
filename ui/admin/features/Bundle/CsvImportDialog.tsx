import React, {useMemo, useState} from 'react';
import {Alert, Button, Input, Modal, Select, Space, Typography, message} from 'antd';
import {UploadOutlined} from '@client/lib/icons';
import {parseCsv, translationsFromCsv} from '@utils/csvTranslations';
import TranslationManager from '@admin/shell/TranslationManager';

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
    const [raw, setRaw] = useState('');
    const [targetLocale, setTargetLocale] = useState<string | undefined>(languages[0]?.symbol);
    const [saving, setSaving] = useState(false);

    const parsed = useMemo(() => {
        if (!raw.trim()) return null;
        try { return parseCsv(raw); }
        catch (err) { return {error: String((err as Error)?.message ?? err)} as any; }
    }, [raw]);

    const preview = useMemo(() => {
        if (!parsed || (parsed as any).error || !targetLocale) return null;
        try { return translationsFromCsv(parsed, targetLocale); }
        catch (err) { return {error: String((err as Error)?.message ?? err)} as any; }
    }, [parsed, targetLocale]);

    const previewCount = preview && !(preview as any).error ? Object.keys(preview).length : 0;
    const previewSamples = preview && !(preview as any).error
        ? Object.entries(preview as Record<string, string>).slice(0, 5)
        : [];

    const handleFile = async (file: File) => {
        const text = await file.text();
        setRaw(text);
    };

    const handleImport = async () => {
        if (!targetLocale || !preview || (preview as any).error) return;
        setSaving(true);
        try {
            const lang = languages.find(l => l.symbol === targetLocale);
            if (!lang) return;
            await translationManager.saveNewTranslation(lang, preview as Record<string, string>);
            message.success(`Imported ${previewCount} translations into ${lang.label}`);
            setRaw('');
            close(true);
        } catch (err) {
            message.error(String((err as Error)?.message ?? err));
        } finally { setSaving(false); }
    };

    return (
        <Modal
            open={open}
            onCancel={() => close(false)}
            onOk={handleImport}
            okButtonProps={{disabled: !previewCount || saving, loading: saving}}
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
            <Space direction="vertical" size={8} style={{width: '100%'}}>
                <Space wrap>
                    <Typography.Text strong>Target locale:</Typography.Text>
                    <Select
                        style={{width: 200}}
                        value={targetLocale}
                        onChange={setTargetLocale}
                        options={languages.map(l => ({value: l.symbol, label: `${l.label} (${l.symbol})`}))}
                    />
                    <label>
                        <input type="file" accept=".csv,text/csv" style={{display: 'none'}}
                               onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ''; }}/>
                        <Button icon={<UploadOutlined/>} onClick={e => (e.currentTarget.previousElementSibling as HTMLInputElement).click()}>
                            Upload CSV
                        </Button>
                    </label>
                </Space>
                <Typography.Text type="secondary">Or paste CSV below:</Typography.Text>
                <Input.TextArea
                    rows={8}
                    value={raw}
                    onChange={e => setRaw(e.target.value)}
                    placeholder={'key,source,en,lv\nHome,Home,Home,Sākums\n…'}
                    style={{fontFamily: 'ui-monospace, monospace', fontSize: 12}}
                />
                {(parsed as any)?.error && <Alert type="error" showIcon message={(parsed as any).error}/>}
                {(preview as any)?.error && <Alert type="error" showIcon message={(preview as any).error}/>}
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
