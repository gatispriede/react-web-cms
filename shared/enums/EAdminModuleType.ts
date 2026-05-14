/**
 * admin-module-composed — admin view-module shapes.
 *
 * Companion to `EItemType` (customer-side content modules). Where the
 * customer modules are operator-authored *content* components, these
 * are the 7 generic *view* shapes admin panes are re-composed from
 * (`admin-module-composed.md`). The shapes are pure view capacity —
 * the pane's ViewModel + service calls stay unchanged; a per-pane
 * `AdminLoader` bridge wires VM data into the shape's props.
 */
export enum EAdminModuleType {
    /** Read-only info surface — titled blocks of key/value rows, status
     *  pill rows, or tables. Diagnostics / Audit / Errors. */
    AdminInfo = 'ADMIN_INFO',
    /** CRUD list with row actions + add button + empty state.
     *  Users / Posts / Products / Themes / Languages / Orders / Inquiries. */
    AdminCrudList = 'ADMIN_CRUD_LIST',
    /** Single-doc form editor — title + audit badge + save bar + a form
     *  body slot. Email config / SEO defaults / Site flags / Logo. */
    AdminForm = 'ADMIN_FORM',
    /** Import / export action panel — title + description + action
     *  controls slot + result summary. Bundle / Themes import-export. */
    AdminActionPanel = 'ADMIN_ACTION_PANEL',
    /** Wizard / multi-step — step indicator + per-step body + Next/Back.
     *  Onboarding. */
    AdminWizard = 'ADMIN_WIZARD',
    /** Embedded preview — preview slot + controls (theme picker /
     *  viewport toggle). Modules-preview / Template-preview / Theme-preview. */
    AdminPreview = 'ADMIN_PREVIEW',
    /** Conflict surface — peer-version diff + take-mine / take-theirs.
     *  Centralises the inline `ConflictDialog`. */
    AdminConflict = 'ADMIN_CONFLICT',
}

export default EAdminModuleType;
