import React from "react";
import {Button, Card, Space, Tag} from "antd";
import {ExportOutlined, GithubOutlined, LinkOutlined} from "@client/lib/icons";
import {EItemType} from "@enums/EItemType";
import {IItem} from "@interfaces/IItem";
import ContentManager from "@client/lib/ContentManager";
import {TFunction} from "i18next";
import {InlineTranslatable} from "@client/lib/InlineTranslatable";
import type {IProjectCard} from "./ProjectCard.types";
export type {IProjectCard, IProjectLink} from "./ProjectCard.types";
export {EProjectCardStyle} from "./ProjectCard.types";

const defaultCard: IProjectCard = {title: '', description: '', image: '', tags: []};

export class ProjectCardContent extends ContentManager {
    public _parsedContent: IProjectCard = {...defaultCard};
    get data(): IProjectCard {
        this.parse();
        return {...defaultCard, ...this._parsedContent, tags: this._parsedContent?.tags ?? []};
    }
    set data(v: IProjectCard) { this._parsedContent = v; }
    setField<K extends keyof IProjectCard>(k: K, v: IProjectCard[K]) { this._parsedContent[k] = v; }
}

const iconFor = (url: string) => {
    if (/github\.com/i.test(url)) return <GithubOutlined/>;
    if (/^https?:\/\//i.test(url)) return <ExportOutlined/>;
    return <LinkOutlined/>;
};

const ProjectCard = ({item, tApp}: {
    item: IItem;
    t: TFunction<"translation", undefined>;
    tApp: TFunction<string, undefined>;
}) => {
    const c = new ProjectCardContent(EItemType.ProjectCard, item.content).data;
    const tr = (v: string) => <InlineTranslatable tApp={tApp as any} source={v}/>;
    return (
        <Card
            className={`project-card ${item.style ?? ''}`}
            cover={c.image ? <img alt={c.title} src={c.image} style={{objectFit: 'cover', maxHeight: 200}}/> : undefined}
            hoverable
        >
            <Card.Meta
                title={tr(c.title)}
                description={
                    <Space orientation="vertical" size={8} style={{width: '100%'}}>
                        {c.description && <span>{tr(c.description)}</span>}
                        {c.tags?.length > 0 && (
                            <Space wrap size={[4, 4]}>
                                {c.tags.map((tag, i) => <Tag key={i}>{tr(tag)}</Tag>)}
                            </Space>
                        )}
                        <Space wrap>
                            {c.primaryLink?.url && (
                                <Button type="primary" size="small" icon={iconFor(c.primaryLink.url)} href={c.primaryLink.url} target="_blank" rel="noopener noreferrer">
                                    {tr(c.primaryLink.label || 'Open')}
                                </Button>
                            )}
                            {c.secondaryLink?.url && (
                                <Button size="small" icon={iconFor(c.secondaryLink.url)} href={c.secondaryLink.url} target="_blank" rel="noopener noreferrer">
                                    {tr(c.secondaryLink.label || 'More')}
                                </Button>
                            )}
                        </Space>
                    </Space>
                }
            />
        </Card>
    );
};

export default ProjectCard;
