import React from "react";
import {EItemType} from "../../../enums/EItemType";
import {IItem} from "../../../Interfaces/IItem";
import ContentManager from "../ContentManager";
import {TFunction} from "i18next";
import {translateOrKeep} from "../../../utils/translateOrKeep";
import RevealOnScroll from "../common/RevealOnScroll";
import {GithubOutlined, LinkedinOutlined, MailOutlined, PhoneOutlined, TwitterOutlined, GlobalOutlined, YoutubeOutlined} from "@ant-design/icons";

export type SocialPlatform = 'github' | 'linkedin' | 'email' | 'phone' | 'twitter' | 'website' | 'youtube' | 'other';

export interface ISocialLink {
    platform: SocialPlatform;
    url: string;
    label?: string;
}

export interface ISocialLinks {
    links: ISocialLink[];
}

export enum ESocialLinksStyle {
    Default = "default",
    Large = "large",
}

const defaults: ISocialLinks = {links: []};

export class SocialLinksContent extends ContentManager {
    public _parsedContent: ISocialLinks = {...defaults};
    get data(): ISocialLinks {
        this.parse();
        return {links: this._parsedContent?.links ?? []};
    }
    set data(v: ISocialLinks) { this._parsedContent = v; }
    setField<K extends keyof ISocialLinks>(k: K, v: ISocialLinks[K]) { this._parsedContent[k] = v; }
}

export const PLATFORM_ICONS: Record<SocialPlatform, React.ReactNode> = {
    github: <GithubOutlined/>,
    linkedin: <LinkedinOutlined/>,
    email: <MailOutlined/>,
    phone: <PhoneOutlined/>,
    twitter: <TwitterOutlined/>,
    youtube: <YoutubeOutlined/>,
    website: <GlobalOutlined/>,
    other: <GlobalOutlined/>,
};

const hrefFor = (link: ISocialLink): string => {
    if (link.platform === 'email') return link.url.startsWith('mailto:') ? link.url : `mailto:${link.url}`;
    if (link.platform === 'phone') return link.url.startsWith('tel:') ? link.url : `tel:${link.url.replace(/\s+/g, '')}`;
    return link.url;
};

const SocialLinks = ({item, tApp}: {
    item: IItem;
    t: TFunction<"translation", undefined>;
    tApp: TFunction<string, undefined>;
}) => {
    const c = new SocialLinksContent(EItemType.SocialLinks, item.content).data;
    const tr = (v: string) => translateOrKeep(tApp, v);
    return (
        <RevealOnScroll className={`social-links ${item.style ?? ''}`}>
            {c.links.map((link, i) => {
                const isExternal = !['email', 'phone'].includes(link.platform);
                return (
                    <a
                        key={i}
                        href={hrefFor(link)}
                        {...(isExternal ? {target: '_blank', rel: 'noopener noreferrer'} : {})}
                    >
                        {PLATFORM_ICONS[link.platform] ?? PLATFORM_ICONS.other}
                        <span>{tr(link.label || link.platform)}</span>
                    </a>
                );
            })}
        </RevealOnScroll>
    );
};

export default SocialLinks;
