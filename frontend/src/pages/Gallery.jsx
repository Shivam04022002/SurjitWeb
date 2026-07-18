import { Link } from 'react-router-dom';
import { Camera, ChevronRight, Images } from 'lucide-react';
import './Gallery.css';
import SEO from '../components/SEO';
import { useGalleryAlbums } from '../hooks';

// Albums come from the CMS gallery module — creating one there publishes it
// here with no code change.
const Gallery = () => {
    const { data: albums, loading: albumsLoading } = useGalleryAlbums();

    return (
        <div className="gallery-page">
            <SEO
                title="Gallery"
                description="Moments from life at Surjit Finance — events, celebrations and the people behind the company."
            />

            <section className="gallery-page-header">
                <div className="container">
                    <h1>Gallery</h1>
                    <p>A look inside Surjit Finance — our events, our celebrations and our people.</p>
                </div>
            </section>

            {/* Life @ Surjit Finance — moved here from the Career page. */}
            <section id="life-surjit" className="life-section section">
                <div className="container">
                    <div className="section-header">
                        <h2>Life @ Surjit Finance</h2>
                        <p>Experience the vibrant culture and team spirit at Surjit Finance</p>
                    </div>

                    <div className="life-grid">
                        {albumsLoading
                            ? Array(4).fill(0).map((_, i) => (
                                <div key={i} className="life-card" style={{ opacity: 0.5 }}>
                                    <div className="life-image" style={{ background: '#e5e7eb' }} />
                                    <div className="life-content">
                                        <div style={{ height: 16, background: '#e5e7eb', borderRadius: 4, width: '70%', marginBottom: 8 }} />
                                        <div style={{ height: 12, background: '#e5e7eb', borderRadius: 4, width: '100%' }} />
                                    </div>
                                </div>
                            ))
                            : (albums && albums.length > 0)
                                ? albums.map((album) => (
                                    <div key={album._id} className="life-card">
                                        <div className="life-image">
                                            {album.coverImage?.url ? (
                                                <img src={album.coverImage.url} alt={album.title} />
                                            ) : (
                                                <Camera size={40} />
                                            )}
                                            {album.imagesCount > 0 && (
                                                <span className="life-media-count">
                                                    <Images size={13} />
                                                    {album.imagesCount}
                                                </span>
                                            )}
                                        </div>
                                        <div className="life-content">
                                            <h4>{album.title}</h4>
                                            <p>{album.description}</p>
                                            <Link to={`/gallery/${album._id}`} className="view-link">
                                                View
                                                <ChevronRight size={16} />
                                            </Link>
                                        </div>
                                    </div>
                                ))
                                : (
                                    <p style={{ gridColumn: '1/-1', textAlign: 'center', color: '#6b7280' }}>
                                        Gallery coming soon.
                                    </p>
                                )
                        }
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Gallery;
