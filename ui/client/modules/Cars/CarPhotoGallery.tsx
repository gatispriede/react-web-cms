/**
 * Car photo gallery — Wave 7b. Style-light grid + lightbox-less single
 * focus image with thumbnail strip. Per-theme styling (Wave 5) will
 * replace this with a richer carousel.
 */
import React, {useState} from 'react';

interface Props {
    images: string[];
    title: string;
    testId?: string;
}

const CarPhotoGallery: React.FC<Props> = ({images, title, testId}) => {
    const [active, setActive] = useState(0);
    if (!images?.length) {
        return (
            <div
                data-testid={testId ?? 'car-photo-gallery-empty'}
                style={{width: '100%', height: 360, background: 'var(--theme-surface-muted, #eee)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}
            >
                No photos
            </div>
        );
    }
    const current = images[Math.min(active, images.length - 1)];
    return (
        <div data-testid={testId ?? 'car-photo-gallery'}>
            <img
                src={current}
                alt={title}
                style={{width: '100%', maxHeight: 480, objectFit: 'cover', borderRadius: 8}}
            />
            {images.length > 1 ? (
                <div style={{display: 'flex', gap: 8, marginTop: 8, overflowX: 'auto'}}>
                    {images.map((src, i) => (
                        <button
                            key={src}
                            type="button"
                            data-testid={`car-photo-thumb-${i}`}
                            onClick={() => setActive(i)}
                            style={{
                                border: i === active ? '2px solid var(--theme-accent, #333)' : '2px solid transparent',
                                padding: 0,
                                background: 'transparent',
                                cursor: 'pointer',
                                flex: '0 0 96px',
                            }}
                        >
                            <img src={src} alt={`${title} ${i + 1}`} width={96} height={72} style={{objectFit: 'cover', display: 'block'}}/>
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    );
};

export default CarPhotoGallery;
