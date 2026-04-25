/**
 * DataModel — schema visualiser for the CMS case-study page.
 * Renders a fields table on the left, a collections aside on the right,
 * and a 3-up audit/notes card row underneath.
 */
export interface IDataModelField {
    name: string;
    type: string;
    /** "yes" / "no" / "fk" — rendered as a small mono pill. */
    nullable?: string;
    notes?: string;
}

export interface IDataModelCollection {
    name: string;
    /** Optional row-count or note (e.g. "1.2k rows"). */
    count?: string;
}

export interface IDataModelAudit {
    title: string;
    body: string;
    /** Optional mono caps tag rendered above the title. */
    tag?: string;
}

export interface IDataModel {
    /** Mono caps eyebrow (e.g. "§ 04 · DATA MODEL"). */
    eyebrow?: string;
    title?: string;
    subtitle?: string;
    /** Heading rendered above the fields table. */
    tableTitle?: string;
    fields?: IDataModelField[];
    /** Heading above the collections side panel. */
    collectionsTitle?: string;
    collections?: IDataModelCollection[];
    /** Free-text aside rendered under the collections list. */
    asideNote?: string;
    audits?: IDataModelAudit[];
}

export enum EDataModelStyle {
    Default = "default",
    Editorial = "editorial",
}
