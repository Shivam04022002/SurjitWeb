import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import './EventGallery.css';
import GalleryModal from '../components/GalleryModal';
import { useGalleryAlbum, useAlbumImages } from '../hooks';

const EventGallery = () => {
    // The param is still named eventId because the legacy /career/gallery/:eventId
    // route also lands here.
    const { eventId, albumId } = useParams();
    const id = albumId || eventId;
    const navigate = useNavigate();

    const [lightboxIndex, setLightboxIndex] = useState(null);

    const { data: album, loading: albumLoading, error: albumError, refetch: refetchAlbum } = useGalleryAlbum(id);
    const { data: images, loading: imagesLoading, error: imagesError, refetch: refetchImages } = useAlbumImages(id);

    // One list for both media kinds — the lightbox pages through them together.
    const media = (images || []).map((item) => ({
        _id: item._id,
        url: item.image?.url,
        mediaType: item.mediaType === 'video' ? 'video' : 'image',
        caption: item.caption || '',
        altText: item.altText || ''
    }));

    if (albumLoading) {
        return (
            <div className="event-gallery-page">
                <section className="gallery-header-section">
                    <div className="container">
                        <button onClick={() => navigate('/gallery')} className="back-link">
                            <ArrowLeft size={18} />
                            Back to Gallery
                        </button>
                        <div style={{ height: 32, background: '#ffffff30', borderRadius: 4, width: '40%', marginBottom: 12 }} />
                        <div style={{ height: 16, background: '#ffffff20', borderRadius: 4, width: '60%' }} />
                    </div>
                </section>
                <section className="gallery-grid-section section">
                    <div className="container">
                        <div className="gallery-masonry">
                            {Array(8).fill(0).map((_, i) => (
                                <div key={i} className="gallery-item" style={{ background: '#e5e7eb', minHeight: 200, borderRadius: 8 }} />
                            ))}
                        </div>
                    </div>
                </section>
            </div>
        );
    }

    if (albumError || !album) {
        return (
            <div className="event-gallery-page">
                <div className="container" style={{ padding: '5rem 1rem', textAlign: 'center' }}>
                    <h2>Gallery Not Found</h2>
                    <p style={{ color: '#6b7280', marginBottom: '1rem' }}>This album may have been removed or doesn't exist.</p>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                        <button onClick={refetchAlbum} className="btn btn-primary">
                            <RefreshCw size={16} /> Retry
                        </button>
                        <button onClick={() => navigate('/gallery')} className="btn btn-secondary">
                            Back to Gallery
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="event-gallery-page">
            <section className="gallery-header-section">
                <div className="container">
                    <button onClick={() => navigate('/gallery')} className="back-link">
                        <ArrowLeft size={18} />
                        Back to Gallery
                    </button>
                    <h1>{album.title}</h1>
                    <p>{album.description}</p>
                </div>
            </section>

            <section className="gallery-grid-section section">
                <div className="container">
                    {imagesError ? (
                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                            <p>Failed to load images.</p>
                            <button onClick={refetchImages} className="btn btn-primary" style={{ marginTop: 8 }}>
                                <RefreshCw size={16} /> Retry
                            </button>
                        </div>
                    ) : (
                        <div className="gallery-masonry">
                            {imagesLoading
                                ? Array(8).fill(0).map((_, i) => (
                                    <div key={i} className="gallery-item" style={{ background: '#e5e7eb', minHeight: 200, borderRadius: 8 }} />
                                ))
                                : media.length > 0
                                    ? media.map((item, index) => (
                                        item.mediaType === 'video' ? (
                                            // Plays in place with the native player; it is also
                                            // reachable in the lightbox via prev/next.
                                            <div key={item._id} className="gallery-item gallery-item-video">
                                                <video
                                                    src={item.url}
                                                    controls
                                                    preload="metadata"
                                                    playsInline
                                                />
                                                {item.caption && <span className="gallery-item-caption">{item.caption}</span>}
                                            </div>
                                        ) : (
                                            <button
                                                key={item._id}
                                                type="button"
                                                className="gallery-item gallery-item-image"
                                                onClick={() => setLightboxIndex(index)}
                                                aria-label={`Open ${item.caption || album.title} ${index + 1}`}
                                            >
                                                <img
                                                    src={item.url}
                                                    alt={item.altText || item.caption || `${album.title} ${index + 1}`}
                                                    loading="lazy"
                                                />
                                            </button>
                                        )
                                    ))
                                    : (
                                        <p style={{ textAlign: 'center', color: '#6b7280', padding: '2rem' }}>
                                            Nothing in this album yet.
                                        </p>
                                    )
                            }
                        </div>
                    )}
                </div>
            </section>

            {/* Keyed by the tile that opened it, so each open starts a fresh
                modal already sitting on the right item. */}
            {lightboxIndex !== null && (
                <GalleryModal
                    key={lightboxIndex}
                    isOpen
                    startIndex={lightboxIndex}
                    onClose={() => setLightboxIndex(null)}
                    items={media}
                    title={album.title}
                />
            )}
        </div>
    );
};

export default EventGallery;
