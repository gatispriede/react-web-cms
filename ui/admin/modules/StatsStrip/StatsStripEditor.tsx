import React from "react";
import {Button, Input, Space, Switch} from "antd";
import {DeleteOutlined, PlusOutlined} from "@client/lib/icons";
import {IInputContent} from "@interfaces/IInputContent";
import {EItemType} from "@enums/EItemType";
import {IStatsStrip, IStatsStripCell, StatsStripContent} from "@client/modules/StatsStrip";

const StatsStripEditor: React.FC<IInputContent> = ({content, setContent, t}) => {
    const mgr = new StatsStripContent(EItemType.StatsStrip, content);
    const data = mgr.data;
    const commit = (n: IStatsStrip) => { mgr.data = n; setContent(mgr.stringData); };
    const cells: IStatsStripCell[] = data.cells ?? [];
    const patch = (i: number, p: Partial<IStatsStripCell>) =>
        commit({cells: cells.map((c, j) => j === i ? {...c, ...p} : c)});
    const add = () => commit({cells: [...cells, {value: ''}]});
    const rm = (i: number) => commit({cells: cells.filter((_, j) => j !== i)});

    return (
        <Space direction="vertical" style={{width: '100%'}} size={6}>
            {cells.map((c, i) => (
                <Space key={i}>
                    <Input value={c.value} onChange={e => patch(i, {value: e.target.value})} placeholder="17" style={{width: 80}}/>
                    <Input value={c.unit ?? ''} onChange={e => patch(i, {unit: e.target.value})} placeholder="types" style={{width: 110}}/>
                    <Input {...(i === 0 ? {'data-testid': 'module-editor-primary-text-input'} : {})} value={c.label ?? ''} onChange={e => patch(i, {label: e.target.value})} placeholder="reusable item types" style={{width: 240}}/>
                    <Switch checkedChildren="HL" unCheckedChildren="—" checked={!!c.highlight} onChange={v => patch(i, {highlight: v})}/>
                    <Button danger size="small" icon={<DeleteOutlined/>} onClick={() => rm(i)}/>
                </Space>
            ))}
            <Button type="dashed" icon={<PlusOutlined/>} onClick={add} block>{t('Add stat')}</Button>
        </Space>
    );
};

export {StatsStripEditor};
export default StatsStripEditor;
