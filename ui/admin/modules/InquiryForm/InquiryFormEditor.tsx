import React, {useMemo} from "react";
import {Button, Input, Select, Space, Switch, Typography} from "antd";
import {DeleteOutlined, PlusOutlined} from "@client/lib/icons";
import {IInputContent} from "@interfaces/IInputContent";
import {EItemType} from "@enums/EItemType";
import {
    IInquiryForm,
    IInquiryFormField,
    IInquiryFormTopic,
    InquiryFormContent,
} from "@client/modules/InquiryForm";
import {SortableHandleItem, SortableList, arrayMove} from "@client/lib/SortableList";

const InquiryFormEditor: React.FC<IInputContent> = ({content, setContent, t}) => {
    const mgr = new InquiryFormContent(EItemType.InquiryForm, content);
    const data = mgr.data;
    const commit = (next: IInquiryForm) => { mgr.data = next; setContent(mgr.stringData); };
    const update = (patch: Partial<IInquiryForm>) => commit({...data, ...patch});

    const topics: IInquiryFormTopic[] = data.topics ?? [];
    const patchTopic = (i: number, p: Partial<IInquiryFormTopic>) =>
        update({topics: topics.map((tp, j) => j === i ? {...tp, ...p} : tp)});
    const addTopic = () => update({topics: [...topics, {value: '', label: ''}]});
    const rmTopic = (i: number) => update({topics: topics.filter((_, j) => j !== i)});
    const reorderTopics = (a: number, b: number) => update({topics: arrayMove(topics, a, b)});
    const topicIds = useMemo(() => topics.map((_, i) => `topic-${i}`), [topics.length]);

    const fields: IInquiryFormField[] = data.fields ?? [];
    const patchField = (i: number, p: Partial<IInquiryFormField>) =>
        update({fields: fields.map((f, j) => j === i ? {...f, ...p} : f)});
    const addField = () => update({fields: [...fields, {name: '', label: '', kind: 'text'}]});
    const rmField = (i: number) => update({fields: fields.filter((_, j) => j !== i)});
    const reorderFields = (a: number, b: number) => update({fields: arrayMove(fields, a, b)});
    const fieldIds = useMemo(() => fields.map((_, i) => `field-${i}`), [fields.length]);

    return (
        <div className="admin-inquiry-form" style={{display: 'flex', flexDirection: 'column', gap: 14}}>
            <Space orientation="vertical" style={{width: '100%'}} size={6}>
                <label>{t('Eyebrow')}</label>
                <Input value={data.eyebrow ?? ''} onChange={e => update({eyebrow: e.target.value})} placeholder="INQUIRY · 002"/>
                <label>{t('Title')}</label>
                <Input data-testid="module-editor-primary-text-input" value={data.title ?? ''} onChange={e => update({title: e.target.value})}/>
                <label>{t('Subtitle')}</label>
                <Input value={data.subtitle ?? ''} onChange={e => update({subtitle: e.target.value})}/>
                <label>{t('Side note')}</label>
                <Input value={data.sideNote ?? ''} onChange={e => update({sideNote: e.target.value})}/>
                <label>{t('Submit label')}</label>
                <Input value={data.submitLabel ?? ''} onChange={e => update({submitLabel: e.target.value})} placeholder="Send inquiry"/>
                <label>{t('Success message')}</label>
                <Input value={data.successMessage ?? ''} onChange={e => update({successMessage: e.target.value})}/>
            </Space>

            <div>
                <div style={{marginBottom: 6, fontWeight: 500}}>{t('Topics label + chips')}</div>
                <Input
                    value={data.topicsLabel ?? ''}
                    onChange={e => update({topicsLabel: e.target.value})}
                    placeholder="WHAT'S THIS ABOUT"
                    style={{marginBottom: 8}}
                />
                <SortableList ids={topicIds} onReorder={reorderTopics}>
                    <Space orientation="vertical" style={{width: '100%'}} size={6}>
                        {topics.map((tp, i) => (
                            <SortableHandleItem key={topicIds[i]} id={topicIds[i]}>
                                <Input value={tp.value} onChange={e => patchTopic(i, {value: e.target.value})} placeholder="value" style={{width: 140}}/>
                                <Input value={tp.label} onChange={e => patchTopic(i, {label: e.target.value})} placeholder="Label" style={{width: 240}}/>
                                <Button danger size="small" icon={<DeleteOutlined/>} onClick={() => rmTopic(i)}/>
                            </SortableHandleItem>
                        ))}
                    </Space>
                </SortableList>
                <Button type="dashed" icon={<PlusOutlined/>} onClick={addTopic} block style={{marginTop: 8}}>
                    {t('Add topic')}
                </Button>
            </div>

            <div>
                <div style={{marginBottom: 6, fontWeight: 500}}>{t('Fields')}</div>
                <SortableList ids={fieldIds} onReorder={reorderFields}>
                    <Space orientation="vertical" style={{width: '100%'}} size={6}>
                        {fields.map((f, i) => (
                            <SortableHandleItem key={fieldIds[i]} id={fieldIds[i]}>
                                <Input value={f.name} onChange={e => patchField(i, {name: e.target.value})} placeholder="name" style={{width: 120}}/>
                                <Input value={f.label} onChange={e => patchField(i, {label: e.target.value})} placeholder="Full name" style={{width: 200}}/>
                                <Input value={f.placeholder ?? ''} onChange={e => patchField(i, {placeholder: e.target.value})} placeholder="placeholder" style={{width: 180}}/>
                                <Select
                                    value={f.kind ?? 'text'}
                                    onChange={(v: 'text' | 'email' | 'textarea') => patchField(i, {kind: v})}
                                    options={[{value: 'text', label: 'text'}, {value: 'email', label: 'email'}, {value: 'textarea', label: 'textarea'}]}
                                    style={{width: 120}}
                                />
                                <Space>
                                    <Typography.Text style={{fontSize: 11}}>{t('req')}</Typography.Text>
                                    <Switch size="small" checked={!!f.required} onChange={v => patchField(i, {required: v})}/>
                                </Space>
                                <Button danger size="small" icon={<DeleteOutlined/>} onClick={() => rmField(i)}/>
                            </SortableHandleItem>
                        ))}
                    </Space>
                </SortableList>
                <Button type="dashed" icon={<PlusOutlined/>} onClick={addField} block style={{marginTop: 8}}>
                    {t('Add field')}
                </Button>
            </div>
        </div>
    );
};

export {InquiryFormEditor};
export default InquiryFormEditor;
