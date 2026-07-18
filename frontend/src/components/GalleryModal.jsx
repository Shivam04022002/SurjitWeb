import { X, ChevronLeft, ChevronRight, Play } from 'lucide-react';
import './GalleryModal.css';
import { useCallback, useEffect, useState } from 'react';

// `items` are gallery media: { url, mediaType: 'image' | 'video', caption, altText }.
// Plain URL strings are still accepted so any older caller keeps working.
const normalise = (item) => (
    typeof item === 'string'
        ? { url: item, mediaType: 'image', caption: '', altText: '' }
        : item
);

// The caller mounts this with a key tied to the tile that opened it, so
// startIndex only ever needs to seed the initial state — no effect syncing.
const GalleryModal = ({ isOpen, onClose, items, title, startIndex = 0 }) => {
    const [currentIndex, setCurrentIndex] = useState(startIndex);

    const media = (items || []).map(normalise);
    const count = media.length;

    const next = useCallback(() => setCurrentIndex((i) => (i + 1) % count), [count]);
    const prev = useCallback(() => setCurrentIndex((i) => (i - 1 + count) % count), [count]);

    // Arrow keys and Escape, which is what people reach for in a lightbox.
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight') next();
            if (e.key === 'ArrowLeft') prev();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, onClose, next, prev]);

    // The page behind must not scroll while the overlay is up.
    useEffect(() => {
        if (!isOpen) return;
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = previous; };
    }, [isOpen]);

    if (!isOpen || count === 0) return null;

    const current = media[Math.min(currentIndex, count - 1)];

    return (
        <div className="gallery-modal-overlay" onClick={onClose}>
            <div className="gallery-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="gallery-modal-header">
                    <h3>{current.caption || title}</h3>
                    <button className="gallery-close-btn" onClick={onClose} aria-label="Close gallery">
                        <X size={24} />
                    </button>
                </div>

                <div className="gallery-main-view">
                    {count > 1 && (
                        <button className="nav-btn prev" onClick={(e) => { e.stopPropagation(); prev(); }} aria-label="Previous">
                            <ChevronLeft size={32} />
                        </button>
                    )}

                    <div className="main-image-container">
                        {current.mediaType === 'video' ? (
                            <video
                                // Keyed so switching media tears down the old element
                                // instead of leaving the previous video playing.
                                key={current.url}
                                src={current.url}
                                controls
                                autoPlay
                                playsInline
                                className="gallery-modal-video"
                            />
                        ) : (
                            <img
                                src={current.url}
                                alt={current.altText || current.caption || `${title} ${currentIndex + 1}`}
                            />
                        )}
                    </div>

                    {count > 1 && (
                        <button className="nav-btn next" onClick={(e) => { e.stopPropagation(); next(); }} aria-label="Next">
                            <ChevronRight size={32} />
                        </button>
                    )}
                </div>

                <div className="gallery-thumbnails">
                    {media.map((item, index) => (
                        <div
                            key={item._id || index}
                            className={`thumbnail-item ${index === currentIndex ? 'active' : ''}`}
                            onClick={() => setCurrentIndex(index)}
                        >
                            {item.mediaType === 'video' ? (
                                <div className="thumbnail-video">
                                    <Play size={18} />
                                </div>
                            ) : (
                                <img src={item.url} alt={`Thumbnail ${index + 1}`} />
                            )}
                        </div>
                    ))}
                </div>

                <div className="gallery-info">
                    <span>{current.mediaType === 'video' ? 'Video' : 'Image'} {currentIndex + 1} of {count}</span>
                </div>
            </div>
        </div>
    );
};

export default GalleryModal;
