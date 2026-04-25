import React, {useMemo} from "react";
import {Button, Input, Space} from "antd";
import {DeleteOutlined, PlusOutlined} from "@client/lib/icons";
import {IInputContent} from "@interfaces/IInputContent";
import {EItemType} from "@enums/EItemType";
import {
    IDataModel,
    IDataModelAudit,
    IDataModelCollection,
    IDataModelField,
    DataModelContent,
} from "@client/modules/DataModel";
import {SortableHandleItem, SortableList, arrayMove} from "@client/lib/SortableList";

const {TextArea} = Input;

const DataModelEditor: React.FC<IInputContent> = ({content, setContent, t}) => {
    const mgr = new DataModelContent(EItemType.DataModel, content);
    const data = mgr.data;
    const commit = (n: IDataModel) => { mgr.data = n; setContent(mgr.stringData); };
    const update = (p: Partial<IDataModel>) => commit({...data, ...p});

    const fields: IDataModelField[] = data.fields ?? [];
    const collections: IDataModelCollection[] = data.collections ?? [];
    const audits: IDataModelAudit[] = data.audits ?? [];

    const fieldIds = useMemo(() => fields.map((_, i) => `f-${i}`), [fields.length]);
    const colIds = useMemo(() => collections.map((_, i) => `c-${i}`), [collections.length]);
    const auditIds = useMemo(() => audits.map((_, i) => `a-${i}`), [audits.length]);

    const patchField = (i: number, p: Partial<IDataModelField>) =>
        update({fields: fields.map((f, j) => j === i ? {...f, ...p} : f)});
    const addField = () => update({fields: [...fields, {name: '', type: ''}]});
    const rmField = (i: number) => update({fields: fields.filter((_, j) => j !== i)});

    const patchCol = (i: number, p: Partial<IDataModelCollection>) =>
        update({collections: collections.map((c, j) => j === i ? {...c, ...p} : c)});
    const addCol = () => update({collections: [...collections, {name: ''}]});
    const rmCol = (i: number) => update({collections: collections.filter((_, j) => j !== i)});

    const patchAudit = (i: number, p: Partial<IDataModelAudit>) =>
        update({audits: audits.map((a, j) => j === i ? {...a, ...p} : a)});
    const addAudit = () => update({audits: [...audits, {title: '', body: ''}]});
    const rmAudit = (i: number) => update({audits: audits.filter((_, j) => j !== i)});

    return (
        <div style={{display: 'flex', flexDirection: 'column', gap: 14}}>
            <Space orientation="vertical" style={{width: '100%'}} size={6}>
                <label>{t('Eyebrow')}</label>
                <Input value={data.eyebrow ?? ''} onChange={e => update({eyebrow: e.target.value})}/>
                <label>{t('Title')}</label>
                <Input value={data.title ?? ''} onChange={e => update({title: e.target.value})}/>
                <label>{t('Subtitle')}</label>
                <Input value={data.subtitle ?? ''} onChange={e => update({subtitle: e.target.value})}/>
                <label>{t('Table title')}</label>
                <Input value={data.tableTitle ?? ''} onChange={e => update({tableTitle: e.target.value})}/>
                <label>{t('Collections title')}</label>
                <Input value={data.collectionsTitle ?? ''} onChange={e => update({collectionsTitle: e.target.value})}/>
                <label>{t('Aside note')}</label>
                <TextArea value={data.asideNote ?? ''} onChange={e => update({asideNote: e.target.value})} rows={2}/>
            </Space>

            <div>
                <div style={{marginBottom: 6, fontWeight: 500}}>{t('Fields')}</div>
                <SortableList ids={fieldIds} onReorder={(a, b) => update({fields: arrayMove(fields, a, b)})}>
                    <Space orientation="vertical" style={{width: '100%'}} size={6}>
                        {fields.map((f, i) => (
                            <SortableHandleItem key={fieldIds[i]} id={fieldIds[i]}>
                                <Input value={f.name} onChange={e => patchField(i, {name: e.target.value})} placeholder="name" style={{width: 140}}/>
                                <Input value={f.type} onChange={e => patchField(i, {type: e.target.value})} placeholder="type" style={{width: 120}}/>
                                <Input value={f.nullable ?? ''} onChange={e => patchField(i, {nullable: e.target.value})} placeholder="no/yes/fk" style={{width: 100}}/>
                                <Input value={f.notes ?? ''} onChange={e => patchField(i, {notes: e.target.value})} placeholder="notes" style={{width: 240}}/>
                                <Button danger size="small" icon={<DeleteOutlined/>} onClick={() => rmField(i)}/>
                            </SortableHandleItem>
                        ))}
                    </Space>
                </SortableList>
                <Button type="dashed" icon={<PlusOutlined/>} onClick={addField} block style={{marginTop: 8}}>{t('Add field')}</Button>
            </div>

            <div>
                <div style={{marginBottom: 6, fontWeight: 500}}>{t('Collections')}</div>
                <SortableList ids={colIds} onReorder={(a, b) => update({collections: arrayMove(collections, a, b)})}>
                    <Space orientation="vertical" style={{width: '100%'}} size={6}>
                        {collections.map((c, i) => (
                            <SortableHandleItem key={colIds[i]} id={colIds[i]}>
                                <Input value={c.name} onChange={e => patchCol(i, {name: e.target.value})} placeholder="name" style={{width: 200}}/>
                                <Input value={c.count ?? ''} onChange={e => patchCol(i, {count: e.target.value})} placeholder="count" style={{width: 140}}/>
                                <Button danger size="small" icon={<DeleteOutlined/>} onClick={() => rmCol(i)}/>
                            </SortableHandleItem>
                        ))}
                    </Space>
                </SortableList>
                <Button type="dashed" icon={<PlusOutlined/>} onClick={addCol} block style={{marginTop: 8}}>{t('Add collection')}</Button>
            </div>

            <div>
                <div style={{marginBottom: 6, fontWeight: 500}}>{t('Audit cards')}</div>
                <SortableList ids={auditIds} onReorder={(a, b) => update({audits: arrayMove(audits, a, b)})}>
                    <Space orientation="vertical" style={{width: '100%'}} size={6}>
                        {audits.map((a, i) => (
                            <SortableHandleItem key={auditIds[i]} id={auditIds[i]}>
                                <Input value={a.tag ?? ''} onChange={e => patchAudit(i, {tag: e.target.value})} placeholder="tag" style={{width: 120}}/>
                                <Input value={a.title} onChange={e => patchAudit(i, {title: e.target.value})} placeholder="Title" style={{width: 200}}/>
                                <Input value={a.body} onChange={e => patchAudit(i, {body: e.target.value})} placeholder="Body" style={{width: 320}}/>
                                <Button danger size="small" icon={<DeleteOutlined/>} onClick={() => rmAudit(i)}/>
                            </SortableHandleItem>
                        ))}
                    </Space>
                </SortableList>
                <Button type="dashed" icon={<PlusOutlined/>} onClick={addAudit} block style={{marginTop: 8}}>{t('Add audit card')}</Button>
            </div>
        </div>
    );
};

export {DataModelEditor};
export default DataModelEditor;
