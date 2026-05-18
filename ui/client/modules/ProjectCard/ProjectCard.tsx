import React from "react";
import {Button, Card, Space, Tag} from "antd";
import {ExportOutlined, GithubOutlined, LinkOutlined} from "@client/lib/icons";
import {EItemType} from "@enums/EItemType";
import {IItem} from "@interfaces/IItem";
import ContentManager from "@client/lib/ContentManager";
import {TFunction} from "i18next";
import {InlineTranslatable} from "@client/lib/InlineTranslatable";
import {slugifyAnchor} from "@utils/stringFunctions";
import {toImageRef} from "@interfaces/IImageRef";
import {toLinkRef} from "@interfaces/ILinkRef";
import {inlineEditAttr} from "@client/lib/inlineEditAttr";
import type {IProjectCard, IProjectCardLegacy} from "./ProjectCard.types";
export type {IProjectCard, IProjectLink} from "./ProjectCard.types";
export {EProjectCardStyle} from "./ProjectCard.types";

const defaults = (): IProjectCard => ({title: '', description: '', image: {src: ''}, tags: []});

const normalize = (raw: IProjectCard | IProjectCardLegacy | undefined): IProjectCard => {
    const r = (raw ?? {}) as IProjectCardLegacy;
    const result: IProjectCard = {
        ...defaults(),
        title: r.title ?? '',
        description: r.description ?? '',
        tags: Array.isArray(r.tags) ? r.tags : [],
        image: toImageRef(r.image),
    };
    if (r.primaryLink) result.primaryLink = toLinkRef(r.primaryLink);
    if (r.secondaryLink) result.secondaryLink = toLinkRef(r.secondaryLink);
    return result;
};

export class ProjectCardContent extends ContentManager {
    public _parsedContent: IProjectCard = defaults();
    get data(): IProjectCard {
        this.parse();
        this._parsedContent = normalize(this._parsedContent as unknown as IProjectCard | IProjectCardLegacy);
        return this._parsedContent;
    }
    set data(v: IProjectCard) { this._parsedContent = v; }
    setField<K extends keyof IProjectCard>(k: K, v: IProjectCard[K]) { this._parsedContent[k] = v; }
}

const iconFor = (url: string) => {
    if (/github\.com/i.test(url)) return <GithubOutlined/>;
    if (/^https?:\/\//i.test(url)) return <ExportOutlined/>;
    return <LinkOutlined/>;
};

// `PUBLIC_IMAGE_PATH` is `'api/'` (no leading slash) — the picker writes
// values like `api/foo.jpg`. Pass through absolute / data / http(s) as-is.
const resolveCoverSrc = (raw: string): string => {
    if (!raw) return raw;
    if (/^(https?:|data:|blob:|\/)/i.test(raw)) return raw;
    return `/${raw}`;
};

const ProjectCard = ({item, tApp, admin}: {
    item: IItem;
    t: TFunction<"translation", undefined>;
    tApp: TFunction<string, undefined>;
    admin?: boolean;
}) => {
    const c = new ProjectCardContent(EItemType.ProjectCard, item.content).data;
    const tr = (v: string) => <InlineTranslatable tApp={tApp as any} source={v}/>;
    const anchorId = slugifyAnchor(c.title) || undefined;
    const editId = item.name || EItemType.ProjectCard;
    const cover = c.image.src ? (
        <img
            alt={c.image.alt ?? c.title}
            src={resolveCoverSrc(c.image.src)}
            style={{
                objectFit: 'cover',
                maxHeight: 200,
                width: c.image.width ? (typeof c.image.width === 'number' ? `${c.image.width}px` : c.image.width) : undefined,
                height: c.image.height ? (typeof c.image.height === 'number' ? `${c.image.height}px` : c.image.height) : undefined,
            }}
        />
    ) : undefined;
    return (
        <Card
            id={anchorId}
            className={`project-card ${item.style ?? ''}`}
            cover={cover}
            hoverable
        >
            <Card.Meta
                title={<span {...inlineEditAttr(admin, editId, 'title')}>{tr(c.title)}</span>}
                description={
                    <Space orientation="vertical" size={8} style={{width: '100%'}}>
                        {c.description && <span {...inlineEditAttr(admin, editId, 'description')}>{tr(c.description)}</span>}
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
