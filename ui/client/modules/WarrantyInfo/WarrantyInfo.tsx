import React, {useContext} from "react";
import {EItemType} from "@enums/EItemType";
import {IItem} from "@interfaces/IItem";
import ContentManager from "@client/lib/ContentManager";
import {TFunction} from "i18next";
import {translateOrKeep} from "@utils/translateOrKeep";
import {ProductContext} from "@client/lib/ProductContext";
import type {IWarrantyInfo} from "./WarrantyInfo.types";
export type {IWarrantyInfo} from "./WarrantyInfo.types";

const normalize = (raw: IWarrantyInfo | undefined): IWarrantyInfo => {
    const r = (raw ?? {}) as IWarrantyInfo;
    return {
        title: r.title ?? 'Warranty',
        body: r.body,
        years: typeof r.years === 'number' ? r.years : undefined,
    };
};

export class WarrantyInfoContent extends ContentManager {
    public _parsedContent: IWarrantyInfo = {};
    get data(): IWarrantyInfo {
        this.parse();
        this._parsedContent = normalize(this._parsedContent as IWarrantyInfo);
        return this._parsedContent;
    }
    set data(v: IWarrantyInfo) { this._parsedContent = v; }
    setField<K extends keyof IWarrantyInfo>(k: K, v: IWarrantyInfo[K]) {
        this._parsedContent[k] = v;
    }
}

const WarrantyInfo: React.FC<{
    item: IItem;
    t: TFunction<"translation", undefined>;
    tApp: TFunction<string, undefined>;
    admin?: boolean;
}> = ({item, tApp}) => {
    const c = new WarrantyInfoContent(EItemType.WarrantyInfo, item.content).data;
    const product = useContext(ProductContext)?.product;
    const tr = (v: string) => translateOrKeep(tApp, v);

    const attrYears = product?.attributes?.warrantyYears;
    const years = c.years
        ?? (attrYears !== undefined && attrYears !== '' ? Number(attrYears) : undefined);
    const body = c.body ?? product?.attributes?.warrantyTerms;

    if (!years && !body) {
        return null;
    }

    return (
        <section
            className={`warranty-info ${item.style ?? ''}`}
            data-testid={`module-warranty-info-${item.name || ''}`}
        >
            <h2 className="warranty-info__title" data-testid="warranty-info-title">
                {tr(c.title ?? '')}
            </h2>
            {years !== undefined && Number.isFinite(years) && (
                <p className="warranty-info__years" data-testid="warranty-info-years">
                    <strong>{years}</strong> {tr('year(s)')}
                </p>
            )}
            {body && (
                <p className="warranty-info__body" data-testid="warranty-info-body">
                    {tr(body)}
                </p>
            )}
        </section>
    );
};

export default WarrantyInfo;
