import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import './GalleryModal.css';
import { useState } from 'react';

const GalleryModal = ({ isOpen, onClose, images, title }) => {
    const [currentIndex, setCurrentIndex] = useState(0);

    if (!isOpen || !images || images.length === 0) return null;

    const nextImage = (e) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev + 1) % images.length);
    };

    const prevImage = (e) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    };

    return (
        <div className="gallery-modal-overlay" onClick={onClose}>
            <div className="gallery-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="gallery-modal-header">
                    <h3>{title}</h3>
                    <button className="gallery-close-btn" onClick={onClose}>
                        <X size={24} />
                    </button>
                </div>
                
                <div className="gallery-main-view">
                    <button className="nav-btn prev" onClick={prevImage}>
                        <ChevronLeft size={32} />
                    </button>
                    
                    <div className="main-image-container">
                        <img src={images[currentIndex]} alt={`${title} ${currentIndex + 1}`} />
                    </div>

                    <button className="nav-btn next" onClick={nextImage}>
                        <ChevronRight size={32} />
                    </button>
                </div>

                <div className="gallery-thumbnails">
                    {images.map((img, index) => (
                        <div 
                            key={index} 
                            className={`thumbnail-item ${index === currentIndex ? 'active' : ''}`}
                            onClick={() => setCurrentIndex(index)}
                        >
                            <img src={img} alt={`Thumbnail ${index + 1}`} />
                        </div>
                    ))}
                </div>

                <div className="gallery-info">
                    <span>Image {currentIndex + 1} of {images.length}</span>
                </div>
            </div>
        </div>
    );
};

export default GalleryModal;
