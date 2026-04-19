import React from "react";
import {Button, Input, Space} from "antd";
import {DeleteOutlined, PlusOutlined} from "@ant-design/icons";
import {IInputContent} from "../../../../Interfaces/IInputContent";
import {EItemType} from "../../../../enums/EItemType";
import {IList, IListItem, ListContent} from "../../SectionComponents/List";

/**
 * Editor for the `List` module. Mirrors the data shape 1:1:
 *   - `title` (optional) — rendered at the top of the list.
 *   - `items[]` of `{label, value?, href?}` — free-form rows.
 *
 * Visual output is driven by the per-item `style` picked on the Style tab
 * (`default` / `facts` / `inline`). This editor only shapes the data.
 */
const InputList: React.FC<IInputContent> = ({content, setContent, t}) => {
    const mgr = new ListContent(EItemType.List, content);
    const data = mgr.data;

    const commit = (next: IList) => {
        mgr.data = next;
        setContent(mgr.stringData);
    };

    const update = (patch: Partial<IList>) => commit({...data, ...patch});

    const patchItem = (index: number, patch: Partial<IListItem>) => {
        const next = [...data.items];
        next[index] = {...next[index], ...patch};
        commit({...data, items: next});
    };

    const addItem = () => commit({...data, items: [...data.items, {label: '', value: '', href: ''}]});
    const removeItem = (index: number) => commit({...data, items: data.items.filter((_, i) => i !== index)});

    return (
        <div className={'admin-list'} style={{display: 'flex', flexDirection: 'column', gap: 12}}>
            <label>
                <div>{t('Title')}</div>
                <Input
                    value={data.title ?? ''}
                    onChange={e => update({title: e.target.value})}
                    placeholder="Contact"
                />
            </label>

            <div>
                <div style={{marginBottom: 6}}>{t('Items')}</div>
                <Space direction="vertical" style={{width: '100%'}}>
                    {data.items.map((it, i) => (
                        <Space key={i} align="start" style={{width: '100%', gap: 6}}>
                            <Input
                                value={it.label}
                                onChange={e => patchItem(i, {label: e.target.value})}
                                placeholder="Label (E-mail)"
                                style={{width: 140}}
                            />
                            <Input
                                value={it.value ?? ''}
                                onChange={e => patchItem(i, {value: e.target.value})}
                                placeholder="Value (you@example.com)"
                                style={{flex: 1, minWidth: 180}}
                            />
                            <Input
                                value={it.href ?? ''}
                                onChange={e => patchItem(i, {href: e.target.value})}
                                placeholder="Link (optional)"
                                style={{width: 180}}
                            />
                            <Button danger size="small" icon={<DeleteOutlined/>} onClick={() => removeItem(i)}/>
                        </Space>
                    ))}
                </Space>
            </div>

            <Button type="dashed" icon={<PlusOutlined/>} onClick={addItem} block>
                {t('Add list item')}
            </Button>
        </div>
    );
};

export default InputList;
