import React, {useMemo} from "react";
import {Button, Input, Space, Typography} from "antd";
import {DeleteOutlined, PlusOutlined} from "@client/lib/icons";
import {IInputContent} from "@interfaces/IInputContent";
import {EItemType} from "@enums/EItemType";
import {IStatsCard, IStatsCardFeature, IStatsCardStat, StatsCardContent} from "@client/modules/StatsCard";
import {SortableHandleItem, SortableList, arrayMove} from "@client/lib/SortableList";

const StatsCardEditor: React.FC<IInputContent> = ({content, setContent, t}) => {
    const mgr = new StatsCardContent(EItemType.StatsCard, content);
    const data = mgr.data;

    const commit = (next: IStatsCard) => {
        mgr.data = next;
        setContent(mgr.stringData);
    };
    const update = (patch: Partial<IStatsCard>) => commit({...data, ...patch});

    const stats: IStatsCardStat[] = Array.isArray(data.stats) ? data.stats : [];
    const patchStat = (i: number, patch: Partial<IStatsCardStat>) =>
        update({stats: stats.map((s, j) => j === i ? {...s, ...patch} : s)});
    const addStat = () => update({stats: [...stats, {value: '', label: ''}]});
    const removeStat = (i: number) => update({stats: stats.filter((_, j) => j !== i)});
    const reorderStats = (from: number, to: number) => update({stats: arrayMove(stats, from, to)});
    const statIds = useMemo(() => stats.map((_, i) => `stat-${i}`), [stats.length]);

    const features: IStatsCardFeature[] = Array.isArray(data.features) ? data.features : [];
    const patchFeature = (i: number, text: string) =>
        update({features: features.map((f, j) => j === i ? {text} : f)});
    const addFeature = () => update({features: [...features, {text: ''}]});
    const removeFeature = (i: number) => update({features: features.filter((_, j) => j !== i)});
    const reorderFeatures = (from: number, to: number) => update({features: arrayMove(features, from, to)});
    const featureIds = useMemo(() => features.map((_, i) => `feature-${i}`), [features.length]);

    return (
        <div className={'admin-stats-card'} style={{display: 'flex', flexDirection: 'column', gap: 14}}>
            <Space orientation="vertical" style={{width: '100%'}} size={6}>
                <label>{t('Tag (small pill above the title)')}</label>
                <Input
                    value={data.tag ?? ''}
                    onChange={e => update({tag: e.target.value})}
                    placeholder="SUMMARY"
                />
                <label>{t('Title')}</label>
                <Input
                    value={data.title ?? ''}
                    onChange={e => update({title: e.target.value})}
                    placeholder="15+ years in digital"
                />
            </Space>

            <div>
                <div style={{marginBottom: 6, fontWeight: 500}}>{t('Stats')}</div>
                <SortableList ids={statIds} onReorder={reorderStats}>
                <Space orientation="vertical" style={{width: '100%'}} size={6}>
                    {stats.map((s, i) => (
                        <SortableHandleItem key={statIds[i]} id={statIds[i]}>
                            <Input
                                value={s.value}
                                onChange={e => patchStat(i, {value: e.target.value})}
                                placeholder="15+"
                                style={{width: 110}}
                            />
                            <Input
                                {...(i === 0 ? {'data-testid': 'module-editor-primary-text-input'} : {})}
                                value={s.label}
                                onChange={e => patchStat(i, {label: e.target.value})}
                                placeholder="Years of experience"
                                style={{width: 260}}
                            />
                            <Button danger size="small" icon={<DeleteOutlined/>} onClick={() => removeStat(i)}/>
                        </SortableHandleItem>
                    ))}
                </Space>
                </SortableList>
                <Button type="dashed" icon={<PlusOutlined/>} onClick={addStat} block style={{marginTop: 8}}>
                    {t('Add stat')}
                </Button>
                <Typography.Text type="secondary" style={{fontSize: 12, display: 'block', marginTop: 4}}>
                    {t('Renders in a 2-column grid — add in pairs for an even layout.')}
                </Typography.Text>
            </div>

            <div>
                <div style={{marginBottom: 6, fontWeight: 500}}>{t('Features (checklist)')}</div>
                <SortableList ids={featureIds} onReorder={reorderFeatures}>
                <Space orientation="vertical" style={{width: '100%'}} size={6}>
                    {features.map((f, i) => (
                        <SortableHandleItem key={featureIds[i]} id={featureIds[i]}>
                            <Input
                                value={f.text}
                                onChange={e => patchFeature(i, e.target.value)}
                                placeholder="Microsoft certified · ISO-compliant delivery"
                                style={{width: 420}}
                            />
                            <Button danger size="small" icon={<DeleteOutlined/>} onClick={() => removeFeature(i)}/>
                        </SortableHandleItem>
                    ))}
                </Space>
                </SortableList>
                <Button type="dashed" icon={<PlusOutlined/>} onClick={addFeature} block style={{marginTop: 8}}>
                    {t('Add feature')}
                </Button>
            </div>
        </div>
    );
};

export {StatsCardEditor};
export default StatsCardEditor;
