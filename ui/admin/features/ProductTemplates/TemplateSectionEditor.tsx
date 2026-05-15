/**
 * Inline section editor for the Product Template detail view.
 *
 * Phase 1.F polish — operators can finally edit `template.sections[]`
 * structurally without dropping to MCP. The shape mirrors `IPage.sections`
 * (same `ISection` type), so this editor is intentionally minimal: a
 * reorderable list of {type, slots, content-length} rows with raw-JSON
 * fallback for `content[]` deep edits (the per-module composable editor
 * lives at the leaf-page layer and isn't worth duplicating here).
 *
 * Built-in templates render read-only (operator must duplicate first —
 * the parent panel surfaces a banner with a Duplicate CTA). The
 * `data-testid="template-section-editor"` testid is the e2e anchor.
 */
import React from 'react';
import {Button, Empty, Input, InputNumber, List, Popconfirm, Space, Tag, Typography} from 'antd';
import {useTranslation} from 'react-i18next';
import type {ISection} from '@interfaces/ISection';
import {observable, useViewModel} from '@client/lib/state/observable';

class SectionsEditorVM {
    draft: ISection[] = [];
    raw = '[]';
    rawError: string | null = null;

    constructor() { return observable(this); }

    seed(sections: ISection[]): void {
        this.draft = sections.map(s => JSON.parse(JSON.stringify(s)) as ISection);
        this.syncRaw();
    }

    private syncRaw(): void {
        this.raw = JSON.stringify(this.draft, null, 2);
        this.rawError = null;
    }

    setRaw(v: string): void {
        this.raw = v;
        try {
            const parsed = JSON.parse(v);
            if (!Array.isArray(parsed)) throw new Error('sections must be an array');
            this.draft = parsed as ISection[];
            this.rawError = null;
        } catch (err) {
            this.rawError = String((err as Error)?.message ?? err);
        }
    }

    addSection(): void {
        this.draft.push({type: 1, content: []});
        this.syncRaw();
    }
    removeAt(i: number): void {
        this.draft.splice(i, 1);
        this.syncRaw();
    }
    moveUp(i: number): void {
        if (i <= 0) return;
        [this.draft[i - 1], this.draft[i]] = [this.draft[i], this.draft[i - 1]];
        this.syncRaw();
    }
    moveDown(i: number): void {
        if (i >= this.draft.length - 1) return;
        [this.draft[i + 1], this.draft[i]] = [this.draft[i], this.draft[i + 1]];
        this.syncRaw();
    }
    setType(i: number, type: number): void {
        const s = this.draft[i]; if (!s) return;
        s.type = type;
        this.syncRaw();
    }
}

interface Props {
    sections: ISection[];
    readOnly: boolean;
    saving: boolean;
    onSave: (s: ISection[]) => void | Promise<void>;
}

const TemplateSectionEditor: React.FC<Props> = ({sections, readOnly, saving, onSave}) => {
    const {t} = useTranslation();
    const vm = useViewModel(() => {
        const v = new SectionsEditorVM();
        v.seed(sections);
        return v;
    });
    React.useEffect(() => { vm.seed(sections); }, [sections, vm]);

    return (
        <div data-testid="template-section-editor" style={{marginTop: 16}}>
            <Typography.Text strong>{t('Sections')}</Typography.Text>
            <List
                size="small"
                bordered
                style={{marginTop: 8}}
                dataSource={vm.draft}
                locale={{emptyText: <Empty description={t('No sections yet')}/>}}
                renderItem={(s, i) => (
                    <List.Item
                        data-testid={`template-section-row-${i}`}
                        actions={readOnly ? [] : [
                            <Button key="up" size="small" disabled={i === 0} onClick={() => vm.moveUp(i)}>↑</Button>,
                            <Button key="down" size="small" disabled={i === vm.draft.length - 1} onClick={() => vm.moveDown(i)}>↓</Button>,
                            <Popconfirm
                                key="rm"
                                title={t('Remove this section?')}
                                onConfirm={() => vm.removeAt(i)}
                                okText={t('Remove')}
                                cancelText={t('Cancel')}
                            >
                                <Button size="small" danger data-testid={`template-section-remove-${i}`}>×</Button>
                            </Popconfirm>,
                        ]}
                    >
                        <Space wrap>
                            <Tag>#{i + 1}</Tag>
                            <Typography.Text type="secondary">{t('cols')}</Typography.Text>
                            <InputNumber
                                size="small"
                                min={1}
                                max={4}
                                value={s.type}
                                disabled={readOnly}
                                onChange={v => vm.setType(i, Number(v ?? 1))}
                                data-testid={`template-section-type-${i}`}
                            />
                            <Tag color="default">{(s.content ?? []).length} {t('items')}</Tag>
                            {s.slots ? <Tag color="geekblue">slots: [{s.slots.join(',')}]</Tag> : null}
                        </Space>
                    </List.Item>
                )}
            />

            {!readOnly && (
                <Space style={{marginTop: 8}}>
                    <Button
                        data-testid="template-section-add"
                        onClick={() => vm.addSection()}
                    >{t('+ Add section')}</Button>
                    <Button
                        type="primary"
                        loading={saving}
                        disabled={vm.rawError !== null}
                        data-testid="template-section-save"
                        onClick={() => void onSave(vm.draft)}
                    >{t('Save sections')}</Button>
                </Space>
            )}

            <details style={{marginTop: 12}}>
                <summary>{t('Edit raw JSON (advanced)')}</summary>
                <Input.TextArea
                    rows={8}
                    value={vm.raw}
                    onChange={e => vm.setRaw(e.target.value)}
                    disabled={readOnly}
                    data-testid="template-section-raw-json"
                    style={{fontFamily: 'monospace', marginTop: 8}}
                />
                {vm.rawError && (
                    <Typography.Text type="danger" data-testid="template-section-raw-error">
                        {vm.rawError}
                    </Typography.Text>
                )}
            </details>
        </div>
    );
};

export default TemplateSectionEditor;
