import React, {useMemo} from "react";
import {Button, Input, Space} from "antd";
import {DeleteOutlined, PlusOutlined} from "@client/lib/icons";
import {IInputContent} from "@interfaces/IInputContent";
import {EItemType} from "@enums/EItemType";
import {IInfraTopology, IInfraDroplet, InfraTopologyContent} from "@client/modules/InfraTopology";
import {SortableHandleItem, SortableList, arrayMove} from "@client/lib/SortableList";

const {TextArea} = Input;

const InfraTopologyEditor: React.FC<IInputContent> = ({content, setContent, t}) => {
    const mgr = new InfraTopologyContent(EItemType.InfraTopology, content);
    const data = mgr.data;
    const commit = (n: IInfraTopology) => { mgr.data = n; setContent(mgr.stringData); };
    const update = (p: Partial<IInfraTopology>) => commit({...data, ...p});

    const droplets: IInfraDroplet[] = data.droplets ?? [];
    const ids = useMemo(() => droplets.map((_, i) => `d-${i}`), [droplets.length]);

    const patch = (i: number, p: Partial<IInfraDroplet>) =>
        update({droplets: droplets.map((d, j) => j === i ? {...d, ...p} : d)});
    const add = () => update({droplets: [...droplets, {name: ''}]});
    const rm = (i: number) => update({droplets: droplets.filter((_, j) => j !== i)});

    return (
        <div style={{display: 'flex', flexDirection: 'column', gap: 14}}>
            <Space orientation="vertical" style={{width: '100%'}} size={6}>
                <label>{t('Eyebrow')}</label>
                <Input value={data.eyebrow ?? ''} onChange={e => update({eyebrow: e.target.value})}/>
                <label>{t('Title')}</label>
                <Input value={data.title ?? ''} onChange={e => update({title: e.target.value})}/>
                <label>{t('Subtitle')}</label>
                <Input value={data.subtitle ?? ''} onChange={e => update({subtitle: e.target.value})}/>
                <label>{t('Droplets label')}</label>
                <Input value={data.dropletsLabel ?? ''} onChange={e => update({dropletsLabel: e.target.value})}/>
                <label>{t('Topology label')}</label>
                <Input value={data.topologyLabel ?? ''} onChange={e => update({topologyLabel: e.target.value})}/>
                <label>{t('Topology SVG (raw, sanitised on render)')}</label>
                <TextArea value={data.topologySvg ?? ''} onChange={e => update({topologySvg: e.target.value})} rows={6}/>
                <label>{t('Topology caption')}</label>
                <Input value={data.topologyCaption ?? ''} onChange={e => update({topologyCaption: e.target.value})}/>
            </Space>

            <div>
                <div style={{marginBottom: 6, fontWeight: 500}}>{t('Droplets')}</div>
                <SortableList ids={ids} onReorder={(a, b) => update({droplets: arrayMove(droplets, a, b)})}>
                    <Space orientation="vertical" style={{width: '100%'}} size={6}>
                        {droplets.map((d, i) => (
                            <SortableHandleItem key={ids[i]} id={ids[i]}>
                                <div style={{display: 'flex', flexDirection: 'column', gap: 6, flex: 1}}>
                                    <Space>
                                        <Input value={d.name} onChange={e => patch(i, {name: e.target.value})} placeholder="Name" style={{width: 200}}/>
                                        <Input value={d.role ?? ''} onChange={e => patch(i, {role: e.target.value})} placeholder="WEB · API" style={{width: 160}}/>
                                        <Input value={d.accent ?? ''} onChange={e => patch(i, {accent: e.target.value})} placeholder="#color" style={{width: 110}}/>
                                        <Button danger size="small" icon={<DeleteOutlined/>} onClick={() => rm(i)}/>
                                    </Space>
                                    <Input
                                        value={(d.specs ?? []).join(' | ')}
                                        onChange={e => patch(i, {specs: e.target.value.split('|').map(s => s.trim()).filter(Boolean)})}
                                        placeholder="Specs (pipe-separated): 2 vCPU | 4GB RAM"
                                    />
                                    <Input
                                        value={(d.services ?? []).join(' | ')}
                                        onChange={e => patch(i, {services: e.target.value.split('|').map(s => s.trim()).filter(Boolean)})}
                                        placeholder="Services (pipe-separated): redis | mongo"
                                    />
                                </div>
                            </SortableHandleItem>
                        ))}
                    </Space>
                </SortableList>
                <Button type="dashed" icon={<PlusOutlined/>} onClick={add} block style={{marginTop: 8}}>{t('Add droplet')}</Button>
            </div>
        </div>
    );
};

export {InfraTopologyEditor};
export default InfraTopologyEditor;
