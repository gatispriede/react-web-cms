/**
 * Build the `{editedAt, editedBy?}` patch every content-edit service merges
 * into its `$set`. `editedBy` is omitted when the caller didn't supply one
 * (standalone/anonymous path) so Mongo doesn't store an explicit `null`.
 */
export function auditStamp(editedBy?: string): {editedAt: string; editedBy?: string} {
    const editedAt = new Date().toISOString();
    return editedBy ? {editedAt, editedBy} : {editedAt};
}
