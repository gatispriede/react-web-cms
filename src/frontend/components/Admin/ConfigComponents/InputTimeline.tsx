import React, {useMemo} from "react";
import {Button, Card, Col, Collapse, Input, Row, Select, Space} from "antd";
import {DeleteOutlined, PlusOutlined} from "../../common/icons";
import {IInputContent} from "../../../../Interfaces/IInputContent";
import {EItemType} from "../../../../enums/EItemType";
import {ITimelineEntry, TimelineContent} from "../../SectionComponents/Timeline";
import {SortableHandleItem, SortableList, arrayMove} from "../../common/SortableList";

const blank: ITimelineEntry = {start: '', end: '', company: '', role: '', location: '', achievements: []};

const InputTimeline = ({content, setContent, t}: IInputContent) => {
    const tl = new TimelineContent(EItemType.Timeline, content);
    const entries = tl.data.entries;

    const update = (next: ITimelineEntry[]) => {
        tl.setField('entries', next);
        setContent(tl.stringData);
    };

    const addEntry = () => update([...entries, {...blank}]);
    const removeEntry = (i: number) => update(entries.filter((_, j) => j !== i));
    const patchEntry = (i: number, patch: Partial<ITimelineEntry>) =>
        update(entries.map((e, j) => j === i ? {...e, ...patch} : e));
    const reorderEntries = (from: number, to: number) => update(arrayMove(entries, from, to));
    const entryIds = useMemo(() => entries.map((_, i) => `timeline-${i}`), [entries.length]);

    return (
        <div className={'timeline-editor'}>
            <SortableList ids={entryIds} onReorder={reorderEntries}>
            <Space direction="vertical" size={12} style={{width: '100%'}}>
                {entries.map((entry, i) => (
                    <SortableHandleItem key={entryIds[i]} id={entryIds[i]}>
                    <Card
                        size="small"
                        style={{flex: 1}}
                        title={`#${i + 1} ${entry.company || ''}`}
                        extra={<Button size="small" danger icon={<DeleteOutlined/>} onClick={() => removeEntry(i)}/>}
                    >
                        <Row gutter={[8, 8]}>
                            <Col xs={12}><label>{t('Start')}</label><Input value={entry.start} onChange={e => patchEntry(i, {start: e.target.value})} placeholder="2024-01"/></Col>
                            <Col xs={12}><label>{t('End')}</label><Input value={entry.end} onChange={e => patchEntry(i, {end: e.target.value})} placeholder="present"/></Col>
                            <Col xs={12}><label>{t('Company')}</label><Input value={entry.company} onChange={e => patchEntry(i, {company: e.target.value})}/></Col>
                            <Col xs={12}><label>{t('Role')}</label><Input value={entry.role} onChange={e => patchEntry(i, {role: e.target.value})}/></Col>
                            <Col xs={24}>
                                <label>{t('Achievements / highlights (Enter to add)')}</label>
                                <Select
                                    mode="tags"
                                    style={{width: '100%'}}
                                    value={entry.achievements || []}
                                    onChange={v => patchEntry(i, {achievements: v})}
                                    tokenSeparators={['\n']}
                                />
                            </Col>
                            <Col xs={24}>
                                <Collapse
                                    ghost
                                    size="small"
                                    items={[{
                                        key: 'more',
                                        label: t('More options'),
                                        children: (
                                            <>
                                                <label>{t('Location')}</label>
                                                <Input value={entry.location || ''} onChange={e => patchEntry(i, {location: e.target.value})}/>
                                            </>
                                        ),
                                    }]}
                                />
                            </Col>
                        </Row>
                    </Card>
                    </SortableHandleItem>
                ))}
                <Button icon={<PlusOutlined/>} onClick={addEntry}>{t('Add entry')}</Button>
            </Space>
            </SortableList>
        </div>
    );
};

export default InputTimeline;
