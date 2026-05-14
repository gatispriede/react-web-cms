/**
 * admin-module-composed — admin view-module shapes.
 *
 * Companion to `EItemType` (customer-side content modules). Where the
 * customer modules are operator-authored *content* components, these
 * are the ~7 generic *view* shapes admin panes are re-composed from
 * (`admin-module-composed.md`). The shapes are pure view capacity —
 * the pane's ViewModel + service calls stay unchanged; a per-pane
 * `AdminLoader` bridge wires VM data into the shape's props.
 *
 * Shapes land batch-by-batch — only the ones whose batch has shipped
 * appear here.
 */
export enum EAdminModuleType {
    /** Read-only info surface — titled blocks of key/value rows, status
     *  pill rows, or tables. Diagnostics / Audit / Errors. */
    AdminInfo = 'ADMIN_INFO',
}

export default EAdminModuleType;
