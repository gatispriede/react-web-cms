export interface INewLanguage {
    label: string
    symbol: string,
    default?: boolean
    /** Unicode flag emoji (e.g. 🇩🇪) or image URL; optional, shown next to the label. */
    flag?: string
    editedBy?: string
    editedAt?: string
}