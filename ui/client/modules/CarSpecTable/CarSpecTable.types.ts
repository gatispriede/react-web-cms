export type CarSpecVariant = 'dl' | 'table';

export type CarSpecGroup = 'identity' | 'engine' | 'body' | 'history' | 'location';

export interface CarSpecAttribute {
    key: string;
    label: string;
    value: string | number;
    group?: CarSpecGroup;
    /** Optional unit appended after value, e.g. 'km', 'L', 'hp'. */
    unit?: string;
}

export interface CarSpecTableProps {
    testId: string;
    attributes: CarSpecAttribute[];
    /** Default 'dl'. */
    variant?: CarSpecVariant;
    /** When true, group rows by `group` field with sub-headings. Default false. */
    grouped?: boolean;
    /** Override group display order. Defaults to identity / engine / body / history / location. */
    groupOrder?: CarSpecGroup[];
}

export const DEFAULT_GROUP_ORDER: ReadonlyArray<CarSpecGroup> = ['identity', 'engine', 'body', 'history', 'location'];

export const GROUP_LABELS: Record<CarSpecGroup, string> = {
    identity: 'Identity',
    engine: 'Engine',
    body: 'Body',
    history: 'History',
    location: 'Location',
};
