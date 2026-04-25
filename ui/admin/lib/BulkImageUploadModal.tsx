/**
 * BulkImageUploadModal (C3) — drop/pick many files, optionally lock them to
 * an aspect ratio on the server, surface per-file progress + errors.
 *
 * Kept deliberately separate from `ImageUpload.tsx` (which is a single-file
 * *picker* modal) so the "populate a gallery from a phone dump" flow stays
 * a first-class button instead of bolted-on UX inside the picker.
 *
 * Server endpoint: `POST /api/upload-batch` — returns `{results: PerFile[]}`
 * with `{ok, error?, image?, originalName?}` per input file. We surface the
 * `.image.location` values to the caller so a gallery editor can stitch them
 * straight into items without re-opening the picker.
 */
import React, {useCallback, useMemo, useRef, useState} from "react";
import {Alert, Button, List, Modal, Progress, Select, Space, Typography} from "antd";
import {CloudUploadOutlined} from "@client/lib/icons";
import type {TFunction} from "i18next";
import type IImage from "@interfaces/IImage";

export type BulkRatio = 'free' | '1:1' | '4:3' | '3:2' | '16:9';
const RATIOS: BulkRatio[] = ['free', '1:1', '4:3', '3:2', '16:9'];

export interface BulkUploadResult {
    ok: boolean;
    error?: string;
    image?: IImage;
    originalName?: string;
}

interface Props {
    open: boolean;
    onClose: () => void;
    /** Called once per accepted image after the batch completes. The caller
     *  decides what to do (e.g. push into a gallery, refresh a picker). */
    onUploaded: (images: IImage[]) => void;
    /** Pre-selected ratio — admin can still override inside the modal. */
    initialRatio?: BulkRatio;
    t: TFunction<"translation", undefined>;
}

const BulkImageUploadModal: React.FC<Props> = ({open, onClose, onUploaded, initialRatio, t}) => {
    const [files, setFiles] = useState<File[]>([]);
    const [ratio, setRatio] = useState<BulkRatio>(initialRatio ?? 'free');
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [results, setResults] = useState<BulkUploadResult[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const reset = useCallback(() => {
        setFiles([]); setResults(null); setError(null); setProgress(0);
    }, []);

    const handleFilesPicked = (picked: FileList | null) => {
        if (!picked) return;
        const arr = Array.from(picked);
        setFiles(prev => [...prev, ...arr]);
        setResults(null);
        setError(null);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        handleFilesPicked(e.dataTransfer.files);
    };

    const totalBytes = useMemo(() => files.reduce((n, f) => n + f.size, 0), [files]);
    const fmtMB = (b: number) => `${(b / (1024 * 1024)).toFixed(1)} MB`;

    const doUpload = async () => {
        if (!files.length) return;
        setUploading(true);
        setProgress(0);
        setResults(null);
        setError(null);
        try {
            const fd = new FormData();
            fd.append('ratio', ratio);
            for (const f of files) fd.append('file', f, f.name);

            // Use XHR rather than fetch so we get upload progress — the
            // `fetch` Streams API can't report upload progress without
            // extension-level browser APIs still in origin-trial.
            const payload = await new Promise<any>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', '/api/upload-batch');
                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
                };
                xhr.onload = () => {
                    try {
                        const body = JSON.parse(xhr.responseText);
                        if (xhr.status >= 400) return reject(new Error(body?.error ?? `HTTP ${xhr.status}`));
                        resolve(body);
                    } catch (err) { reject(err); }
                };
                xhr.onerror = () => reject(new Error('network error'));
                xhr.send(fd);
            });

            const rs: BulkUploadResult[] = payload?.results ?? [];
            setResults(rs);
            const accepted = rs.filter(r => r.ok && r.image).map(r => r.image as IImage);
            if (accepted.length) onUploaded(accepted);
        } catch (e: any) {
            setError(String(e?.message ?? e));
        } finally {
            setUploading(false);
        }
    };

    const succeeded = results?.filter(r => r.ok).length ?? 0;
    const failed = (results?.length ?? 0) - succeeded;

    return (
        <Modal
            open={open}
            width={'min(720px, 95vw)'}
            title={t('Bulk upload')}
            onCancel={() => { if (!uploading) { reset(); onClose(); } }}
            footer={[
                <Button key="close" onClick={() => { if (!uploading) { reset(); onClose(); } }} disabled={uploading}>
                    {results ? t('Done') : t('Cancel')}
                </Button>,
                <Button key="upload" type="primary" loading={uploading} disabled={!files.length} onClick={doUpload}>
                    {t('Upload {{n}} files', {n: files.length})}
                </Button>,
            ]}
        >
            <Space orientation="vertical" size={12} style={{width: '100%'}}>
                <Space wrap>
                    <Typography.Text strong>{t('Aspect ratio')}</Typography.Text>
                    <Select<BulkRatio>
                        value={ratio}
                        onChange={setRatio}
                        style={{minWidth: 140}}
                        disabled={uploading}
                        options={RATIOS.map(r => ({value: r, label: r}))}
                    />
                    <Typography.Text type="secondary" style={{fontSize: 12}}>
                        {t('Applied server-side (sharp: cover-crop, EXIF stripped).')}
                    </Typography.Text>
                </Space>

                <div
                    onDragOver={e => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => inputRef.current?.click()}
                    style={{
                        border: '2px dashed #d9d9d9',
                        borderRadius: 8,
                        padding: 24,
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: '#fafafa',
                    }}
                >
                    <CloudUploadOutlined style={{fontSize: 32, opacity: 0.6}}/>
                    <div style={{marginTop: 8}}>{t('Drop files here or click to pick')}</div>
                    <input
                        ref={inputRef}
                        type="file"
                        multiple
                        accept="image/*"
                        style={{display: 'none'}}
                        onChange={e => handleFilesPicked(e.target.files)}
                    />
                </div>

                {files.length > 0 && (
                    <Typography.Text type="secondary" style={{fontSize: 12}}>
                        {t('{{count}} files queued ({{size}} total)', {count: files.length, size: fmtMB(totalBytes)})}
                    </Typography.Text>
                )}

                {uploading && <Progress percent={progress}/>}

                {error && <Alert type="error" message={error} closable onClose={() => setError(null)}/>}

                {results && (
                    <Alert
                        type={failed === 0 ? 'success' : 'warning'}
                        message={t('{{ok}} succeeded, {{fail}} failed', {ok: succeeded, fail: failed})}
                        showIcon
                    />
                )}

                {results && failed > 0 && (
                    <List
                        size="small"
                        bordered
                        dataSource={results.filter(r => !r.ok)}
                        renderItem={r => (
                            <List.Item>
                                <Typography.Text code>{r.originalName ?? '—'}</Typography.Text>
                                <Typography.Text type="danger" style={{marginLeft: 8}}>{r.error}</Typography.Text>
                            </List.Item>
                        )}
                    />
                )}
            </Space>
        </Modal>
    );
};

export default BulkImageUploadModal;
