export type SavedSearchCadence = 'realtime' | 'daily' | 'weekly' | 'off';

export interface SavedSearch {
    id: string;
    name: string;
    /** href the row links to (filter pre-applied). */
    href: string;
    /** Result count at last scan. Optional — show em-dash when null/undefined. */
    lastResultCount?: number | null;
    /** When was last scan (ISO). */
    lastScannedAt?: string;
    cadence: SavedSearchCadence;
}

export interface SavedSearchEmptyState {
    title: string;
    description?: string;
    primary?: {label: string; href?: string; onClick?: () => void};
}

export interface SavedSearchListProps {
    testId: string;
    searches: SavedSearch[];
    onEdit: (id: string) => void;
    onDelete: (id: string) => void | Promise<void>;
    emptyState?: SavedSearchEmptyState;
}
