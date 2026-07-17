import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import './EventGallery.css';
import { useGalleryAlbum, useAlbumImages } from '../hooks';

const EventGallery = () => {
    const { eventId } = useParams();
    const navigate = useNavigate();

    const { data: album, loading: albumLoading, error: albumError, refetch: refetchAlbum } = useGalleryAlbum(eventId);
    const { data: images, loading: imagesLoading, error: imagesError, refetch: refetchImages } = useAlbumImages(eventId);

    if (albumLoading) {
        return (
            <div className="event-gallery-page">
                <section className="gallery-header-section">
                    <div className="container">
                        <button onClick={() => navigate('/career')} className="back-link">
                            <ArrowLeft size={18} />
                            Back to Careers
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
                        <button onClick={() => navigate('/career')} className="btn btn-secondary">
                            Back to Career
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
                    <button onClick={() => navigate('/career')} className="back-link">
                        <ArrowLeft size={18} />
                        Back to Careers
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
                                : (images && images.length > 0)
                                    ? images.map((img, index) => (
                                        <div key={img._id} className="gallery-item">
                                            <img
                                                src={img.image?.url}
                                                alt={img.altText || img.caption || `${album.title} ${index + 1}`}
                                                loading="lazy"
                                            />
                                        </div>
                                    ))
                                    : (
                                        <p style={{ textAlign: 'center', color: '#6b7280', padding: '2rem', gridColumn: '1/-1' }}>
                                            No images in this album yet.
                                        </p>
                                    )
                            }
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};

export default EventGallery;
