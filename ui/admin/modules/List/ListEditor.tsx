import React, {useMemo} from "react";
import {Button, Input, Space} from "antd";
import {DeleteOutlined, PlusOutlined} from "@client/lib/icons";
import {IInputContent} from "@interfaces/IInputContent";
import {EItemType} from "@enums/EItemType";
import {IList, IListItem, ListContent} from "@client/modules/List";
import {SortableHandleItem, SortableList, arrayMove} from "@client/lib/SortableList";
import LinkTargetPicker from "@admin/lib/LinkTargetPicker";

/**
 * Editor for the `List` module. Mirrors the data shape 1:1:
 *   - `title` (optional) — rendered at the top of the list.
 *   - `items[]` of `{label, value?, href?}` — free-form rows.
 *
 * Visual output is driven by the per-item `style` picked on the Style tab
 * (`default` / `facts` / `inline`). This editor only shapes the data.
 */
const ListEditor: React.FC<IInputContent> = ({content, setContent, t}) => {
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
    const reorderItems = (from: number, to: number) =>
        commit({...data, items: arrayMove(data.items, from, to)});

    // Stable per-item ids — `${index}` is fine because the `<DndContext>`
    // re-mounts when the list length changes, so a delete-then-rerender
    // doesn't smear the active drag state across rows.
    const itemIds = useMemo(() => data.items.map((_, i) => `list-${i}`), [data.items.length]);

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
                <SortableList ids={itemIds} onReorder={reorderItems}>
                    <Space orientation="vertical" style={{width: '100%'}}>
                        {data.items.map((it, i) => (
                            <SortableHandleItem key={itemIds[i]} id={itemIds[i]}>
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
                                <div style={{width: 220}}>
                                    <LinkTargetPicker
                                        value={it.href ?? ''}
                                        onChange={(v) => patchItem(i, {href: v})}
                                        placeholder="Link (optional)"
                                    />
                                </div>
                                <Button danger size="small" icon={<DeleteOutlined/>} onClick={() => removeItem(i)}/>
                            </SortableHandleItem>
                        ))}
                    </Space>
                </SortableList>
            </div>

            <Button type="dashed" icon={<PlusOutlined/>} onClick={addItem} block>
                {t('Add list item')}
            </Button>
        </div>
    );
};

export {ListEditor};
export default ListEditor;
