import React from 'react';
import type {ProjectTileGridProps} from './ProjectTileGrid.types';

const ProjectTileGrid: React.FC<ProjectTileGridProps> = ({testId, tiles, columns = 3}) => {
    if (tiles.length === 0) return null;

    return (
        <div
            className={`project-tile-grid project-tile-grid--cols-${columns}`}
            data-testid={testId}
            style={{['--cols' as string]: columns} as React.CSSProperties}
        >
            {tiles.map(tile => (
                <figure
                    key={tile.key}
                    className="project-tile-grid__tile"
                    data-testid={`${testId}-tile-${tile.key}`}
                >
                    <a
                        className="project-tile-grid__link"
                        data-testid={`${testId}-link-${tile.key}`}
                        href={tile.href}
                    >
                        <img
                            className="project-tile-grid__img"
                            src={tile.imageUrl}
                            alt={tile.title}
                            loading="lazy"
                        />
                        <figcaption className="project-tile-grid__overlay">
                            <span className="project-tile-grid__title">{tile.title}</span>
                            {tile.caption ? (
                                <span className="project-tile-grid__caption">{tile.caption}</span>
                            ) : null}
                            {tile.tags && tile.tags.length > 0 ? (
                                <span className="project-tile-grid__tags">
                                    {tile.tags.map((tag, index) => (
                                        <span
                                            key={`${tag}-${index}`}
                                            className="project-tile-grid__tag"
                                            data-testid={`${testId}-tag-${tile.key}-${index}`}
                                        >{tag}</span>
                                    ))}
                                </span>
                            ) : null}
                        </figcaption>
                    </a>
                </figure>
            ))}
        </div>
    );
};

export default ProjectTileGrid;
export {ProjectTileGrid};
