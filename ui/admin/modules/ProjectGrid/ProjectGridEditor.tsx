import React, {useMemo} from "react";
import {Button, Input, Space, Typography} from "antd";
import {DeleteOutlined, PlusOutlined} from "@client/lib/icons";
import {LabeledInput} from "@client/lib/LabeledInput";
import {IInputContent} from "@interfaces/IInputContent";
import {EItemType} from "@enums/EItemType";
import {IProjectGrid, IProjectGridItem, ProjectGridContent} from "@client/modules/ProjectGrid";
import {SortableHandleItem, SortableList, arrayMove} from "@client/lib/SortableList";
import LinkTargetPicker from "@admin/lib/LinkTargetPicker";

const ProjectGridEditor: React.FC<IInputContent> = ({content, setContent, t}) => {
    const mgr = new ProjectGridContent(EItemType.ProjectGrid, content);
    const data = mgr.data;

    const commit = (next: IProjectGrid) => {
        mgr.data = next;
        setContent(mgr.stringData);
    };
    const update = (patch: Partial<IProjectGrid>) => commit({...data, ...patch});

    const items: IProjectGridItem[] = Array.isArray(data.items) ? data.items : [];
    const patchItem = (i: number, patch: Partial<IProjectGridItem>) =>
        update({items: items.map((it, j) => j === i ? {...it, ...patch} : it)});
    const addItem = () => update({items: [...items, {title: '', stack: '', kind: '', year: '', coverArt: '', coverColor: '', moreLabel: 'View engagement ↗', href: ''}]});
    const removeItem = (i: number) => update({items: items.filter((_, j) => j !== i)});
    const reorderItems = (from: number, to: number) => update({items: arrayMove(items, from, to)});
    const itemIds = useMemo(() => items.map((_, i) => `project-${i}`), [items.length]);

    return (
        <div className={'admin-project-grid'} style={{display: 'flex', flexDirection: 'column', gap: 14}}>
            <Space orientation="vertical" style={{width: '100%'}} size={6}>
                <label>{t('Section number')}</label>
                <Input value={data.sectionNumber ?? ''} onChange={e => update({sectionNumber: e.target.value})} placeholder="§ 01"/>
                <label>{t('Section title (supports *italic-accent*)')}</label>
                <Input value={data.sectionTitle ?? ''} onChange={e => update({sectionTitle: e.target.value})} placeholder="See it in *action.*"/>
                <label>{t('Section subtitle')}</label>
                <Input.TextArea value={data.sectionSubtitle ?? ''} onChange={e => update({sectionSubtitle: e.target.value})} placeholder="A curated sample…" rows={2}/>
            </Space>

            <div>
                <div style={{marginBottom: 6, fontWeight: 500}}>{t('Projects')}</div>
                <SortableList ids={itemIds} onReorder={reorderItems}>
                <Space orientation="vertical" style={{width: '100%'}} size={10}>
                    {items.map((p, i) => (
                        <SortableHandleItem key={itemIds[i]} id={itemIds[i]}>
                        <div style={{flex: 1, border: '1px solid rgba(0,0,0,0.1)', padding: 12, borderRadius: 4}}>
                            <Space orientation="vertical" style={{width: '100%'}} size={6}>
                                <Space style={{width: '100%', justifyContent: 'space-between'}}>
                                    <Typography.Text strong>{t('Project')} #{i + 1}</Typography.Text>
                                    <Button danger size="small" icon={<DeleteOutlined/>} onClick={() => removeItem(i)}/>
                                </Space>
                                <LabeledInput value={p.title} onChange={e => patchItem(i, {title: e.target.value})} label={t('Title')} placeholder="SciChart"/>
                                <LabeledInput value={p.stack ?? ''} onChange={e => patchItem(i, {stack: e.target.value})} label={t('Stack / domain')} placeholder="3D/2D browser charts · large data"/>
                                <LabeledInput value={p.kind ?? ''} onChange={e => patchItem(i, {kind: e.target.value})} label={t('Kind')} placeholder="Contract<br/>UK / USA"/>
                                <Space style={{width: '100%'}}>
                                    <LabeledInput value={p.year ?? ''} onChange={e => patchItem(i, {year: e.target.value})} label={t('Year')} placeholder="2024 — PRESENT" wrapperStyle={{width: 280}}/>
                                    <LabeledInput value={p.coverArt ?? ''} onChange={e => patchItem(i, {coverArt: e.target.value})} label={t('Art')} placeholder="SC" wrapperStyle={{width: 140}}/>
                                </Space>
                                <LabeledInput value={p.coverColor ?? ''} onChange={e => patchItem(i, {coverColor: e.target.value})} label={t('Cover CSS')} placeholder="radial-gradient(circle at 20% 80%, #1E5A6B, #0B1E24 70%)"/>
                                <Space style={{width: '100%'}}>
                                    <LabeledInput value={p.moreLabel ?? ''} onChange={e => patchItem(i, {moreLabel: e.target.value})} label={t('More label')} placeholder="View engagement ↗" wrapperStyle={{width: 300}}/>
                                    <div style={{minWidth: 220}}>
                                        <LinkTargetPicker
                                            value={p.href ?? ''}
                                            onChange={(v) => patchItem(i, {href: v})}
                                            placeholder="#scichart"
                                            label={t('Link')}
                                        />
                                    </div>
                                </Space>
                            </Space>
                        </div>
                        </SortableHandleItem>
                    ))}
                </Space>
                </SortableList>
                <Button type="dashed" icon={<PlusOutlined/>} onClick={addItem} block style={{marginTop: 10}}>
                    {t('Add project')}
                </Button>
            </div>
        </div>
    );
};

export {ProjectGridEditor};
export default ProjectGridEditor;
