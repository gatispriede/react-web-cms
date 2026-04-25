import React, {useMemo} from "react";
import {Button, Input, Space} from "antd";
import {DeleteOutlined, PlusOutlined} from "@client/lib/icons";
import {IInputContent} from "@interfaces/IInputContent";
import {EItemType} from "@enums/EItemType";
import {IPipelineFlow, IPipelineStep, PipelineFlowContent} from "@client/modules/PipelineFlow";
import {SortableHandleItem, SortableList, arrayMove} from "@client/lib/SortableList";

const {TextArea} = Input;

const PipelineFlowEditor: React.FC<IInputContent> = ({content, setContent, t}) => {
    const mgr = new PipelineFlowContent(EItemType.PipelineFlow, content);
    const data = mgr.data;
    const commit = (n: IPipelineFlow) => { mgr.data = n; setContent(mgr.stringData); };
    const update = (p: Partial<IPipelineFlow>) => commit({...data, ...p});

    const steps: IPipelineStep[] = data.steps ?? [];
    const ids = useMemo(() => steps.map((_, i) => `s-${i}`), [steps.length]);
    const patch = (i: number, p: Partial<IPipelineStep>) =>
        update({steps: steps.map((s, j) => j === i ? {...s, ...p} : s)});
    const add = () => update({steps: [...steps, {label: ''}]});
    const rm = (i: number) => update({steps: steps.filter((_, j) => j !== i)});

    return (
        <div style={{display: 'flex', flexDirection: 'column', gap: 14}}>
            <Space orientation="vertical" style={{width: '100%'}} size={6}>
                <label>{t('Eyebrow')}</label>
                <Input value={data.eyebrow ?? ''} onChange={e => update({eyebrow: e.target.value})}/>
                <label>{t('Title')}</label>
                <Input value={data.title ?? ''} onChange={e => update({title: e.target.value})}/>
                <label>{t('Subtitle')}</label>
                <Input value={data.subtitle ?? ''} onChange={e => update({subtitle: e.target.value})}/>
                <label>{t('Side notes label')}</label>
                <Input value={data.sideNotesLabel ?? ''} onChange={e => update({sideNotesLabel: e.target.value})}/>
                <label>{t('Side notes (one per line)')}</label>
                <TextArea
                    value={(data.sideNotes ?? []).join('\n')}
                    onChange={e => update({sideNotes: e.target.value.split('\n').map(s => s.trim()).filter(Boolean)})}
                    rows={4}
                />
            </Space>

            <div>
                <div style={{marginBottom: 6, fontWeight: 500}}>{t('Pipeline steps')}</div>
                <SortableList ids={ids} onReorder={(a, b) => update({steps: arrayMove(steps, a, b)})}>
                    <Space orientation="vertical" style={{width: '100%'}} size={6}>
                        {steps.map((s, i) => (
                            <SortableHandleItem key={ids[i]} id={ids[i]}>
                                <Input value={s.label} onChange={e => patch(i, {label: e.target.value})} placeholder="Stage" style={{width: 200}}/>
                                <Input value={s.status ?? ''} onChange={e => patch(i, {status: e.target.value})} placeholder="ok | warn | fail" style={{width: 130}}/>
                                <Input value={s.meta ?? ''} onChange={e => patch(i, {meta: e.target.value})} placeholder="0:42" style={{width: 110}}/>
                                <Input value={s.notes ?? ''} onChange={e => patch(i, {notes: e.target.value})} placeholder="Notes" style={{width: 280}}/>
                                <Button danger size="small" icon={<DeleteOutlined/>} onClick={() => rm(i)}/>
                            </SortableHandleItem>
                        ))}
                    </Space>
                </SortableList>
                <Button type="dashed" icon={<PlusOutlined/>} onClick={add} block style={{marginTop: 8}}>{t('Add step')}</Button>
            </div>
        </div>
    );
};

export {PipelineFlowEditor};
export default PipelineFlowEditor;
