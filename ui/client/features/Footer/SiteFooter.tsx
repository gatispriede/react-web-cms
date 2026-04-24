import React from "react";
import Link from "next/link";
import {buildFooterColumns, IFooterColumn, IFooterConfig} from "@interfaces/IFooter";
import RevealOnScroll from "@client/lib/RevealOnScroll";

interface Props {
    config: IFooterConfig;
    pages: {page: string}[];
    hasPosts: boolean;
    blogEnabled?: boolean;
    t?: (s: string) => string;
}

const isExternal = (url: string) => /^https?:\/\/|^mailto:|^tel:/i.test(url);

const renderEntry = (entry: {label: string; url?: string}, key: string | number) => {
    if (!entry.url) return <li key={key}><span>{entry.label}</span></li>;
    if (isExternal(entry.url)) {
        return <li key={key}><a href={entry.url} target="_blank" rel="noopener noreferrer">{entry.label}</a></li>;
    }
    return <li key={key}><Link href={entry.url}>{entry.label}</Link></li>;
};

const SiteFooter: React.FC<Props> = ({config, pages, hasPosts, blogEnabled, t}) => {
    if (!config.enabled) return null;
    const columns: IFooterColumn[] = buildFooterColumns(config, {pages, hasPosts, blogEnabled}, t);
    return (
        <footer className="site-footer">
            <RevealOnScroll className="site-footer__columns">
                {columns.map((col, i) => (
                    <div className="site-footer__column" key={i}>
                        <h4>{col.title}</h4>
                        <ul>
                            {col.entries.map((entry, j) => renderEntry(entry, j))}
                        </ul>
                    </div>
                ))}
            </RevealOnScroll>
            {config.bottom && <div className="site-footer__bottom">{config.bottom}</div>}
        </footer>
    );
};

export default SiteFooter;
