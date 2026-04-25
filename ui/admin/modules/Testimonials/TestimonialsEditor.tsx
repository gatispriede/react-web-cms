import React, {useMemo} from "react";
import {Button, Input, Space, Typography} from "antd";
import {DeleteOutlined, PlusOutlined} from "@client/lib/icons";
import {LabeledInput} from "@client/lib/LabeledInput";
import {IInputContent} from "@interfaces/IInputContent";
import {EItemType} from "@enums/EItemType";
import {ITestimonial, ITestimonials, TestimonialsContent} from "@client/modules/Testimonials";
import {SortableHandleItem, SortableList, arrayMove} from "@client/lib/SortableList";

const TestimonialsEditor: React.FC<IInputContent> = ({content, setContent, t}) => {
    const mgr = new TestimonialsContent(EItemType.Testimonials, content);
    const data = mgr.data;

    const commit = (next: ITestimonials) => {
        mgr.data = next;
        setContent(mgr.stringData);
    };
    const update = (patch: Partial<ITestimonials>) => commit({...data, ...patch});

    const items: ITestimonial[] = Array.isArray(data.items) ? data.items : [];
    const patchItem = (i: number, patch: Partial<ITestimonial>) =>
        update({items: items.map((q, j) => j === i ? {...q, ...patch} : q)});
    const addItem = () => update({items: [...items, {quote: '', name: '', role: '', avatarInitial: ''}]});
    const removeItem = (i: number) => update({items: items.filter((_, j) => j !== i)});
    const reorderItems = (from: number, to: number) => update({items: arrayMove(items, from, to)});
    const itemIds = useMemo(() => items.map((_, i) => `testimonial-${i}`), [items.length]);

    return (
        <div className={'admin-testimonials'} style={{display: 'flex', flexDirection: 'column', gap: 14}}>
            <Space orientation="vertical" style={{width: '100%'}} size={6}>
                <label>{t('Section title (wrap words in *asterisks* for italic accent)')}</label>
                <Input
                    value={data.sectionTitle ?? ''}
                    onChange={e => update({sectionTitle: e.target.value})}
                    placeholder="Stories worth *shipping.*"
                />
                <Typography.Text type="secondary" style={{fontSize: 12}}>
                    {t('Example: "Stories worth *shipping.*" → "shipping." renders italic + accent.')}
                </Typography.Text>
                <label>{t('Section subtitle')}</label>
                <Input.TextArea
                    value={data.sectionSubtitle ?? ''}
                    onChange={e => update({sectionSubtitle: e.target.value})}
                    placeholder="The most rewarding part of building software…"
                    rows={2}
                />
            </Space>

            <div>
                <div style={{marginBottom: 6, fontWeight: 500}}>{t('Testimonials')}</div>
                <SortableList ids={itemIds} onReorder={reorderItems}>
                <Space orientation="vertical" style={{width: '100%'}} size={10}>
                    {items.map((q, i) => (
                        <SortableHandleItem key={itemIds[i]} id={itemIds[i]}>
                        <div style={{flex: 1, border: '1px solid rgba(0,0,0,0.1)', padding: 12, borderRadius: 4}}>
                            <Space orientation="vertical" style={{width: '100%'}} size={6}>
                                <Space style={{width: '100%', justifyContent: 'space-between'}}>
                                    <Typography.Text strong>{t('Testimonial')} #{i + 1}</Typography.Text>
                                    <Button danger size="small" icon={<DeleteOutlined/>} onClick={() => removeItem(i)}/>
                                </Space>
                                <Input.TextArea
                                    value={q.quote}
                                    onChange={e => patchItem(i, {quote: e.target.value})}
                                    placeholder="Delivered architecture that reads like C# in the browser…"
                                    rows={3}
                                />
                                <Space style={{width: '100%'}}>
                                    <LabeledInput
                                        value={q.name}
                                        onChange={e => patchItem(i, {name: e.target.value})}
                                        placeholder="Andrew Burnett-Thompson"
                                        label={t('Name')}
                                        wrapperStyle={{width: 300}}
                                    />
                                    <LabeledInput
                                        value={q.role ?? ''}
                                        onChange={e => patchItem(i, {role: e.target.value})}
                                        placeholder="Founder · SciChart"
                                        label={t('Role')}
                                    />
                                </Space>
                                <Input
                                    value={q.avatarInitial ?? ''}
                                    onChange={e => patchItem(i, {avatarInitial: e.target.value})}
                                    placeholder={t('Avatar initial (defaults to first letter of name)')}
                                    style={{maxWidth: 280}}
                                />
                            </Space>
                        </div>
                        </SortableHandleItem>
                    ))}
                </Space>
                </SortableList>
                <Button type="dashed" icon={<PlusOutlined/>} onClick={addItem} block style={{marginTop: 10}}>
                    {t('Add testimonial')}
                </Button>
            </div>
        </div>
    );
};

export {TestimonialsEditor};
export default TestimonialsEditor;
