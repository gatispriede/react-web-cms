import React from "react";
import {Button, Col, Input, Row, Select, Space} from "antd";
import {DeleteOutlined, PlusOutlined} from "@ant-design/icons";
import {IInputContent} from "../../../../Interfaces/IInputContent";
import {EItemType} from "../../../../enums/EItemType";
import {ISocialLink, SocialLinksContent, SocialPlatform} from "../../SectionComponents/SocialLinks";

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

const InputSocialLinks = ({content, setContent, t}: IInputContent) => {
    const sl = new SocialLinksContent(EItemType.SocialLinks, content);
    const links = sl.data.links;
    const update = (next: ISocialLink[]) => { sl.setField('links', next); setContent(sl.stringData); };
    const add = () => update([...links, {...blank}]);
    const remove = (i: number) => update(links.filter((_, j) => j !== i));
    const patch = (i: number, p: Partial<ISocialLink>) => update(links.map((l, j) => j === i ? {...l, ...p} : l));

    return (
        <Space direction="vertical" size={8} style={{width: '100%'}}>
            {links.map((link, i) => (
                <Row key={i} gutter={6} align="middle">
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
            ))}
            <Button icon={<PlusOutlined/>} onClick={add}>{t('Add link')}</Button>
        </Space>
    );
};

export default InputSocialLinks;
