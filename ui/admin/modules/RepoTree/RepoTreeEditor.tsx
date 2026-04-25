import React, {useMemo} from "react";
import {Button, Input, Select, Space} from "antd";
import {DeleteOutlined, PlusOutlined} from "@client/lib/icons";
import {IInputContent} from "@interfaces/IInputContent";
import {EItemType} from "@enums/EItemType";
import {IRepoTree, IRepoNode, RepoTreeContent} from "@client/modules/RepoTree";
import {SortableHandleItem, SortableList, arrayMove} from "@client/lib/SortableList";

const {TextArea} = Input;

const RepoTreeEditor: React.FC<IInputContent> = ({content, setContent, t}) => {
    const mgr = new RepoTreeContent(EItemType.RepoTree, content);
    const data = mgr.data;
    const commit = (n: IRepoTree) => { mgr.data = n; setContent(mgr.stringData); };
    const update = (p: Partial<IRepoTree>) => commit({...data, ...p});

    const nodes: IRepoNode[] = data.nodes ?? [];
    const ids = useMemo(() => nodes.map((_, i) => `n-${i}`), [nodes.length]);
    const patch = (i: number, p: Partial<IRepoNode>) =>
        update({nodes: nodes.map((n, j) => j === i ? {...n, ...p} : n)});
    const add = () => update({nodes: [...nodes, {path: '', kind: 'dir'}]});
    const rm = (i: number) => update({nodes: nodes.filter((_, j) => j !== i)});

    return (
        <div style={{display: 'flex', flexDirection: 'column', gap: 14}}>
            <Space orientation="vertical" style={{width: '100%'}} size={6}>
                <label>{t('Eyebrow')}</label>
                <Input value={data.eyebrow ?? ''} onChange={e => update({eyebrow: e.target.value})}/>
                <label>{t('Title')}</label>
                <Input value={data.title ?? ''} onChange={e => update({title: e.target.value})}/>
                <label>{t('Subtitle')}</label>
                <Input value={data.subtitle ?? ''} onChange={e => update({subtitle: e.target.value})}/>
                <label>{t('Tree column label')}</label>
                <Input value={data.treeLabel ?? ''} onChange={e => update({treeLabel: e.target.value})}/>
            </Space>

            <div>
                <div style={{marginBottom: 6, fontWeight: 500}}>{t('Nodes')}</div>
                <SortableList ids={ids} onReorder={(a, b) => update({nodes: arrayMove(nodes, a, b)})}>
                    <Space orientation="vertical" style={{width: '100%'}} size={6}>
                        {nodes.map((n, i) => (
                            <SortableHandleItem key={ids[i]} id={ids[i]}>
                                <div style={{display: 'flex', flexDirection: 'column', gap: 6, flex: 1}}>
                                    <Space>
                                        <Input value={n.path} onChange={e => patch(i, {path: e.target.value})} placeholder="ui/client/modules/Hero" style={{width: 280}}/>
                                        <Select
                                            value={n.kind}
                                            onChange={(v: 'dir' | 'file') => patch(i, {kind: v})}
                                            options={[{value: 'dir', label: 'dir'}, {value: 'file', label: 'file'}]}
                                            style={{width: 90}}
                                        />
                                        <Input value={n.tag ?? ''} onChange={e => patch(i, {tag: e.target.value})} placeholder="tag" style={{width: 120}}/>
                                        <Button danger size="small" icon={<DeleteOutlined/>} onClick={() => rm(i)}/>
                                    </Space>
                                    <Input value={n.summary ?? ''} onChange={e => patch(i, {summary: e.target.value})} placeholder="One-liner summary"/>
                                    <TextArea value={n.body ?? ''} onChange={e => patch(i, {body: e.target.value})} placeholder="Long-form description" rows={2}/>
                                </div>
                            </SortableHandleItem>
                        ))}
                    </Space>
                </SortableList>
                <Button type="dashed" icon={<PlusOutlined/>} onClick={add} block style={{marginTop: 8}}>{t('Add node')}</Button>
            </div>
        </div>
    );
};

export {RepoTreeEditor};
export default RepoTreeEditor;
