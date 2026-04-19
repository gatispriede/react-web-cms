import React from "react";
import {Button, Input, Space, Typography} from "antd";
import {DeleteOutlined, PlusOutlined} from "@ant-design/icons";
import {IInputContent} from "../../../../Interfaces/IInputContent";
import {EItemType} from "../../../../enums/EItemType";
import {IStatsCard, IStatsCardFeature, IStatsCardStat, StatsCardContent} from "../../SectionComponents/StatsCard";

const InputStatsCard: React.FC<IInputContent> = ({content, setContent, t}) => {
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

    const features: IStatsCardFeature[] = Array.isArray(data.features) ? data.features : [];
    const patchFeature = (i: number, text: string) =>
        update({features: features.map((f, j) => j === i ? {text} : f)});
    const addFeature = () => update({features: [...features, {text: ''}]});
    const removeFeature = (i: number) => update({features: features.filter((_, j) => j !== i)});

    return (
        <div className={'admin-stats-card'} style={{display: 'flex', flexDirection: 'column', gap: 14}}>
            <Space direction="vertical" style={{width: '100%'}} size={6}>
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
                <Space direction="vertical" style={{width: '100%'}} size={6}>
                    {stats.map((s, i) => (
                        <Space key={i} align="start" style={{width: '100%'}}>
                            <Input
                                value={s.value}
                                onChange={e => patchStat(i, {value: e.target.value})}
                                placeholder="15+"
                                style={{width: 110}}
                            />
                            <Input
                                value={s.label}
                                onChange={e => patchStat(i, {label: e.target.value})}
                                placeholder="Years of experience"
                                style={{width: 260}}
                            />
                            <Button danger size="small" icon={<DeleteOutlined/>} onClick={() => removeStat(i)}/>
                        </Space>
                    ))}
                </Space>
                <Button type="dashed" icon={<PlusOutlined/>} onClick={addStat} block style={{marginTop: 8}}>
                    {t('Add stat')}
                </Button>
                <Typography.Text type="secondary" style={{fontSize: 12, display: 'block', marginTop: 4}}>
                    {t('Renders in a 2-column grid — add in pairs for an even layout.')}
                </Typography.Text>
            </div>

            <div>
                <div style={{marginBottom: 6, fontWeight: 500}}>{t('Features (checklist)')}</div>
                <Space direction="vertical" style={{width: '100%'}} size={6}>
                    {features.map((f, i) => (
                        <Space key={i} align="start" style={{width: '100%'}}>
                            <Input
                                value={f.text}
                                onChange={e => patchFeature(i, e.target.value)}
                                placeholder="Microsoft certified · ISO-compliant delivery"
                                style={{width: 420}}
                            />
                            <Button danger size="small" icon={<DeleteOutlined/>} onClick={() => removeFeature(i)}/>
                        </Space>
                    ))}
                </Space>
                <Button type="dashed" icon={<PlusOutlined/>} onClick={addFeature} block style={{marginTop: 8}}>
                    {t('Add feature')}
                </Button>
            </div>
        </div>
    );
};

export default InputStatsCard;
