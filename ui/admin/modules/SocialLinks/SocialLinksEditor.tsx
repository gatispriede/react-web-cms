import React, {useMemo} from "react";
import {Button, Col, Input, Row, Select, Space} from "antd";
import {DeleteOutlined, PlusOutlined} from "@client/lib/icons";
import {IInputContent} from "@interfaces/IInputContent";
import {EItemType} from "@enums/EItemType";
import {ISocialLink, SocialLinksContent, SocialPlatform} from "@client/modules/SocialLinks";
import {SortableHandleItem, SortableList, arrayMove} from "@client/lib/SortableList";

const PLATFORMS: {value: SocialPlatform; label: string}[] = [
    {value: 'github', label: 'GitHub'},
    {value: 'linkedin', label: 'LinkedIn'},
    {value: 'email', label: 'Email'},
    {value: 'phone', label: 'Phone'},
    {value: 'twitter', label: 'X / Twitter'},
    {value: 'youtube', label: 'YouTube'},
    {value: 'website', label: 'Website'},
    {value: 'other', label: 'Other'},
];

const blank: ISocialLink = {platform: 'website', url: '', label: ''};

const SocialLinksEditor = ({content, setContent, t}: IInputContent) => {
    const sl = new SocialLinksContent(EItemType.SocialLinks, content);
    const links = sl.data.links;
    const update = (next: ISocialLink[]) => { sl.setField('links', next); setContent(sl.stringData); };
    const add = () => update([...links, {...blank}]);
    const remove = (i: number) => update(links.filter((_, j) => j !== i));
    const patch = (i: number, p: Partial<ISocialLink>) => update(links.map((l, j) => j === i ? {...l, ...p} : l));
    const reorder = (from: number, to: number) => update(arrayMove(links, from, to));
    const linkIds = useMemo(() => links.map((_, i) => `social-${i}`), [links.length]);

    return (
        <SortableList ids={linkIds} onReorder={reorder}>
            <Space direction="vertical" size={8} style={{width: '100%'}}>
                {links.map((link, i) => (
                    <SortableHandleItem key={linkIds[i]} id={linkIds[i]}>
                        <Row gutter={6} align="middle" style={{flex: 1, width: '100%'}}>
                            <Col xs={6}>
                                <Select
                                    style={{width: '100%'}}
                                    value={link.platform}
                                    options={PLATFORMS}
                                    onChange={v => patch(i, {platform: v})}
                                />
                            </Col>
                            <Col xs={10}><Input value={link.url} onChange={e => patch(i, {url: e.target.value})} placeholder={t('URL or email')}/></Col>
                            <Col xs={6}><Input value={link.label || ''} onChange={e => patch(i, {label: e.target.value})} placeholder={t('Label (optional)')}/></Col>
                            <Col xs={2}><Button size="small" danger icon={<DeleteOutlined/>} onClick={() => remove(i)}/></Col>
                        </Row>
                    </SortableHandleItem>
                ))}
                <Button icon={<PlusOutlined/>} onClick={add}>{t('Add link')}</Button>
            </Space>
        </SortableList>
    );
};

export {SocialLinksEditor};
export default SocialLinksEditor;
