export interface ProjectTile {
    key: string;
    title: string;
    caption?: string;
    imageUrl: string;
    href: string;
    /** Optional tag set rendered as small chips on the overlay. */
    tags?: string[];
}

export interface ProjectTileGridProps {
    testId: string;
    tiles: ProjectTile[];
    /** Desktop columns. Default 3. */
    columns?: 2 | 3 | 4;
}
