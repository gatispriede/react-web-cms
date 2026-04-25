import React, {useMemo} from "react";
import DOMPurify from "isomorphic-dompurify";
import {EItemType} from "@enums/EItemType";
import {IItem} from "@interfaces/IItem";
import ContentManager from "@client/lib/ContentManager";
import {TFunction} from "i18next";
import {InlineTranslatable} from "@client/lib/InlineTranslatable";
import RevealOnScroll from "@client/lib/RevealOnScroll";
import {slugifyAnchor} from "@utils/stringFunctions";
import type {IInfraTopology} from "./InfraTopology.types";
export type {IInfraTopology, IInfraDroplet} from "./InfraTopology.types";
export {EInfraTopologyStyle} from "./InfraTopology.types";

const defaults: IInfraTopology = {droplets: []};

export class InfraTopologyContent extends ContentManager {
    public _parsedContent: IInfraTopology = {...defaults};
    get data(): IInfraTopology {
        this.parse();
        return {...defaults, ...this._parsedContent, droplets: this._parsedContent?.droplets ?? []};
    }
    set data(v: IInfraTopology) { this._parsedContent = v; }
    setField<K extends keyof IInfraTopology>(k: K, v: IInfraTopology[K]) { this._parsedContent[k] = v; }
}

const InfraTopology = ({item, tApp}: {
    item: IItem;
    t: TFunction<"translation", undefined>;
    tApp: TFunction<string, undefined>;
}) => {
    const c = new InfraTopologyContent(EItemType.InfraTopology, item.content).data;
    const tr = (v: string) => <InlineTranslatable tApp={tApp as any} source={v}/>;

    // Authors paste raw SVG; we sanitise to drop scripts/event handlers but
    // keep the structural markup (path/circle/rect/text/etc.) intact. Any
    // sanitiser failure = empty string so we never throw on render.
    const sanitisedSvg = useMemo(() => {
        if (!c.topologySvg) return '';
        try {
            return DOMPurify.sanitize(c.topologySvg, {USE_PROFILES: {svg: true, svgFilters: true}});
        } catch {
            return '';
        }
    }, [c.topologySvg]);

    return (
        <RevealOnScroll className={`infra-topology ${item.style ?? ''}`}>
            {(c.eyebrow || c.title || c.subtitle) && (
                <header className="infra-topology__head">
                    {c.eyebrow && <div className="infra-topology__eyebrow">{tr(c.eyebrow)}</div>}
                    {c.title && <h2 id={slugifyAnchor(c.title)} className="infra-topology__title">{tr(c.title)}</h2>}
                    {c.subtitle && <p className="infra-topology__subtitle">{tr(c.subtitle)}</p>}
                </header>
            )}
            {(c.droplets?.length ?? 0) > 0 && (
                <div className="infra-topology__droplets-block">
                    {c.dropletsLabel && <div className="infra-topology__sub">{tr(c.dropletsLabel)}</div>}
                    <div className="infra-topology__droplets">
                        {(c.droplets ?? []).map((d, i) => (
                            <div
                                key={i}
                                className="infra-topology__droplet"
                                style={d.accent ? {borderLeftColor: d.accent} : undefined}
                            >
                                <div className="infra-topology__droplet-name">{tr(d.name)}</div>
                                {d.role && <div className="infra-topology__droplet-role">{tr(d.role)}</div>}
                                {d.specs && d.specs.length > 0 && (
                                    <ul className="infra-topology__specs">
                                        {d.specs.map((s, j) => <li key={j}>{tr(s)}</li>)}
                                    </ul>
                                )}
                                {d.services && d.services.length > 0 && (
                                    <ul className="infra-topology__services">
                                        {d.services.map((s, j) => <li key={j}>{tr(s)}</li>)}
                                    </ul>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {sanitisedSvg && (
                <div className="infra-topology__topology">
                    {c.topologyLabel && <div className="infra-topology__sub">{tr(c.topologyLabel)}</div>}
                    <div
                        className="infra-topology__svg"
                        // eslint-disable-next-line react/no-danger
                        dangerouslySetInnerHTML={{__html: sanitisedSvg}}
                    />
                    {c.topologyCaption && (
                        <p className="infra-topology__caption">{tr(c.topologyCaption)}</p>
                    )}
                </div>
            )}
        </RevealOnScroll>
    );
};

export default InfraTopology;
