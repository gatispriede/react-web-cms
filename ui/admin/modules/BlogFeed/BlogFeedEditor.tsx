import React from "react";
import {Col, Collapse, Input, InputNumber, Row} from "antd";
import {IInputContent} from "@interfaces/IInputContent";
import {EItemType} from "@enums/EItemType";
import {BlogFeedContent, IBlogFeed} from "@client/modules/BlogFeed";

const BlogFeedEditor = ({content, setContent, t}: IInputContent) => {
    const feed = new BlogFeedContent(EItemType.BlogFeed, content);
    const data = feed.data;
    const update = <K extends keyof IBlogFeed>(k: K, v: IBlogFeed[K]) => {
        feed.setField(k, v);
        setContent(feed.stringData);
    };
    return (
        <div>
            <label>{t('Post count')}</label>
            <InputNumber min={1} max={24} value={data.limit} onChange={v => update('limit', Number(v) || 6)}/>
            <Collapse
                ghost
                size="small"
                style={{marginTop: 8}}
                items={[{
                    key: 'more',
                    label: t('More options'),
                    children: (
                        <Row gutter={[8, 8]}>
                            <Col xs={24}>
                                <label>{t('Section heading (optional)')}</label>
                                <Input value={data.heading} onChange={e => update('heading', e.target.value)} placeholder={t('Latest writing')}/>
                            </Col>
                            <Col xs={24}>
                                <label>{t('Filter by tag (optional)')}</label>
                                <Input value={data.tag} onChange={e => update('tag', e.target.value)}/>
                            </Col>
                        </Row>
                    ),
                }]}
            />
        </div>
    );
};

export {BlogFeedEditor};
export default BlogFeedEditor;
