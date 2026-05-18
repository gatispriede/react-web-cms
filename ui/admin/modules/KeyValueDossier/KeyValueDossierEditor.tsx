import React from "react";
import {Button, Input, Space} from "antd";
import {DeleteOutlined, PlusOutlined} from "@client/lib/icons";
import {IInputContent} from "@interfaces/IInputContent";
import {EItemType} from "@enums/EItemType";
import {
    IKeyValueDossier,
    IKeyValueDossierItem,
    KeyValueDossierContent,
} from "@client/modules/KeyValueDossier";

/**
 * KeyValueDossier admin form. Operator authors `title` (optional H4) +
 * a list of `{label, value, href?}` rows. Style variant picked separately
 * via the standard `item.style` Select (editor harness owns that).
 */
const KeyValueDossierEditor: React.FC<IInputContent> = ({content, setContent, t}) => {
    const mgr = new KeyValueDossierContent(EItemType.KeyValueDossier, content);
    const data = mgr.data;
    const commit = (n: IKeyValueDossier) => { mgr.data = n; setContent(mgr.stringData); };
    const items: IKeyValueDossierItem[] = data.items ?? [];
    const patch = (i: number, p: Partial<IKeyValueDossierItem>) =>
        commit({...data, items: items.map((it, j) => j === i ? {...it, ...p} : it)});
    const add = () => commit({...data, items: [...items, {label: '', value: ''}]});
    const rm = (i: number) => commit({...data, items: items.filter((_, j) => j !== i)});

    return (
        <Space direction="vertical" style={{width: '100%'}} size={6}>
            <Input
                value={data.title ?? ''}
                onChange={e => commit({...data, title: e.target.value || undefined})}
                placeholder={t('Title (optional)')}
                data-testid="kvd-title-input"
            />
            {items.map((it, i) => (
                <Space key={i}>
                    <Input
                        value={it.label}
                        onChange={e => patch(i, {label: e.target.value})}
                        placeholder={t('Label')}
                        style={{width: 140}}
                        {...(i === 0 ? {'data-testid': 'module-editor-primary-text-input'} : {'data-testid': `kvd-row-${i}-label`})}
                    />
                    <Input
                        value={it.value}
                        onChange={e => patch(i, {value: e.target.value})}
                        placeholder={t('Value')}
                        style={{width: 320}}
                        data-testid={`kvd-row-${i}-value`}
                    />
                    <Input
                        value={it.href ?? ''}
                        onChange={e => patch(i, {href: e.target.value || undefined})}
                        placeholder={t('Optional link URL')}
                        style={{width: 200}}
                        data-testid={`kvd-row-${i}-href`}
                    />
                    <Button danger size="small" icon={<DeleteOutlined/>} onClick={() => rm(i)} data-testid={`kvd-row-${i}-delete`}/>
                </Space>
            ))}
            <Button type="dashed" icon={<PlusOutlined/>} onClick={add} block data-testid="kvd-add-row-btn">
                {t('Add row')}
            </Button>
        </Space>
    );
};

export {KeyValueDossierEditor};
export default KeyValueDossierEditor;
