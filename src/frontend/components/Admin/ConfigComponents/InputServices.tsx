import React from "react";
import {Button, Input, Space, Typography} from "antd";
import {DeleteOutlined, PlusOutlined} from "../../common/icons";
import {IInputContent} from "../../../../Interfaces/IInputContent";
import {EItemType} from "../../../../enums/EItemType";
import {IServiceRow, IServices, ServicesContent} from "../../SectionComponents/Services";

/**
 * Editor for the Services module. Mirrors the schema 1:1. Title supports
 * the `*italic accent*` markup convention — we show a hint under the field.
 */
const InputServices: React.FC<IInputContent> = ({content, setContent, t}) => {
    const mgr = new ServicesContent(EItemType.Services, content);
    const data = mgr.data;

    const commit = (next: IServices) => {
        mgr.data = next;
        setContent(mgr.stringData);
    };
    const update = (patch: Partial<IServices>) => commit({...data, ...patch});

    const rows: IServiceRow[] = Array.isArray(data.rows) ? data.rows : [];
    const patchRow = (i: number, patch: Partial<IServiceRow>) =>
        update({rows: rows.map((r, j) => j === i ? {...r, ...patch} : r)});
    const addRow = () => update({rows: [...rows, {number: String(rows.length + 1).padStart(2, '0'), title: '', description: '', ctaLabel: '', ctaHref: '', iconGlyph: '', tags: []}]});
    const removeRow = (i: number) => update({rows: rows.filter((_, j) => j !== i)});
    const patchTags = (i: number, value: string) =>
        patchRow(i, {tags: value.split(',').map(s => s.trim()).filter(Boolean)});

    return (
        <div className={'admin-services'} style={{display: 'flex', flexDirection: 'column', gap: 14}}>
            <Space direction="vertical" style={{width: '100%'}} size={6}>
                <label>{t('Section number (e.g. § 03)')}</label>
                <Input
                    value={data.sectionNumber ?? ''}
                    onChange={e => update({sectionNumber: e.target.value})}
                    placeholder="§ 03"
                />
                <label>{t('Section title (wrap words in *asterisks* for italic accent)')}</label>
                <Input
                    value={data.sectionTitle ?? ''}
                    onChange={e => update({sectionTitle: e.target.value})}
                    placeholder="What I *do.*"
                />
                <Typography.Text type="secondary" style={{fontSize: 12}}>
                    {t('Example: "Solutions *architecture*" → "architecture" renders italic + accent color.')}
                </Typography.Text>
                <label>{t('Section subtitle (short right-aligned blurb)')}</label>
                <Input
                    value={data.sectionSubtitle ?? ''}
                    onChange={e => update({sectionSubtitle: e.target.value})}
                    placeholder="Four practices, one studio."
                />
            </Space>

            <div>
                <div style={{marginBottom: 6, fontWeight: 500}}>{t('Rows')}</div>
                <Space direction="vertical" style={{width: '100%'}} size={10}>
                    {rows.map((r, i) => (
                        <div key={i} style={{border: '1px solid rgba(0,0,0,0.1)', padding: 12, borderRadius: 4}}>
                            <Space direction="vertical" style={{width: '100%'}} size={6}>
                                <Space style={{width: '100%', justifyContent: 'space-between'}}>
                                    <Input
                                        value={r.number}
                                        onChange={e => patchRow(i, {number: e.target.value})}
                                        placeholder="01"
                                        style={{width: 80}}
                                    />
                                    <Button danger size="small" icon={<DeleteOutlined/>} onClick={() => removeRow(i)}/>
                                </Space>
                                <Input
                                    value={r.title}
                                    onChange={e => patchRow(i, {title: e.target.value})}
                                    placeholder="Solutions *architecture*"
                                    addonBefore={t('Title')}
                                />
                                <Input.TextArea
                                    value={r.description}
                                    onChange={e => patchRow(i, {description: e.target.value})}
                                    placeholder="Cloud and on-prem systems designed to last…"
                                    rows={2}
                                />
                                <Space style={{width: '100%'}}>
                                    <Input
                                        value={r.ctaLabel ?? ''}
                                        onChange={e => patchRow(i, {ctaLabel: e.target.value})}
                                        placeholder="Find out more"
                                        addonBefore={t('CTA')}
                                        style={{width: 260}}
                                    />
                                    <Input
                                        value={r.ctaHref ?? ''}
                                        onChange={e => patchRow(i, {ctaHref: e.target.value})}
                                        placeholder="#contact"
                                        addonBefore={t('Link')}
                                    />
                                </Space>
                                <Space style={{width: '100%'}}>
                                    <Input
                                        value={r.iconGlyph ?? ''}
                                        onChange={e => patchRow(i, {iconGlyph: e.target.value})}
                                        placeholder="▲ or 🧱 or free-text"
                                        addonBefore={t('Icon glyph')}
                                        style={{width: 240}}
                                    />
                                    <Input
                                        value={(r.tags ?? []).join(', ')}
                                        onChange={e => patchTags(i, e.target.value)}
                                        placeholder="AWS, Azure, Multi-cloud"
                                        addonBefore={t('Tags (comma-sep)')}
                                    />
                                </Space>
                            </Space>
                        </div>
                    ))}
                </Space>
                <Button type="dashed" icon={<PlusOutlined/>} onClick={addRow} block style={{marginTop: 10}}>
                    {t('Add service row')}
                </Button>
            </div>
        </div>
    );
};

export default InputServices;
