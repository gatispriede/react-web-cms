import React, {useContext} from "react";
import {EItemType} from "@enums/EItemType";
import {IItem} from "@interfaces/IItem";
import ContentManager from "@client/lib/ContentManager";
import {TFunction} from "i18next";
import {translateOrKeep} from "@utils/translateOrKeep";
import {ProductContext} from "@client/lib/ProductContext";
import type {IDownloadablePdf} from "./DownloadablePdf.types";
export type {IDownloadablePdf} from "./DownloadablePdf.types";

const normalize = (raw: IDownloadablePdf | undefined): IDownloadablePdf => {
    const r = (raw ?? {}) as IDownloadablePdf;
    return {
        label: r.label ?? 'Download spec sheet (PDF)',
        href: r.href,
    };
};

export class DownloadablePdfContent extends ContentManager {
    public _parsedContent: IDownloadablePdf = {};
    get data(): IDownloadablePdf {
        this.parse();
        this._parsedContent = normalize(this._parsedContent as IDownloadablePdf);
        return this._parsedContent;
    }
    set data(v: IDownloadablePdf) { this._parsedContent = v; }
    setField<K extends keyof IDownloadablePdf>(k: K, v: IDownloadablePdf[K]) {
        this._parsedContent[k] = v;
    }
}

const DownloadablePdf: React.FC<{
    item: IItem;
    t: TFunction<"translation", undefined>;
    tApp: TFunction<string, undefined>;
    admin?: boolean;
}> = ({item, tApp}) => {
    const c = new DownloadablePdfContent(EItemType.DownloadablePdf, item.content).data;
    const product = useContext(ProductContext)?.product;
    const tr = (v: string) => translateOrKeep(tApp, v);

    // TODO Phase 1.F follow-up: wire to InvoiceService PDF renderer
    // (W8g VAT-compliant invoice primitives). Until that lands the link
    // points at the canonical endpoint so the route handler can be added
    // independently.
    const href = c.href || (product?.id ? `/api/products/${product.id}/spec-sheet.pdf` : '#');

    return (
        <section
            className={`downloadable-pdf ${item.style ?? ''}`}
            data-testid={`module-downloadable-pdf-${item.name || ''}`}
        >
            <a
                className="downloadable-pdf__link"
                href={href}
                download={product?.sku ? `${product.sku}-spec.pdf` : undefined}
                data-testid="downloadable-pdf-link"
                rel="nofollow"
            >
                <span className="downloadable-pdf__icon" aria-hidden>📄</span>
                <span className="downloadable-pdf__label">{tr(c.label ?? '')}</span>
            </a>
        </section>
    );
};

export default DownloadablePdf;
