import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import './ProductSlider.css';

// Every active product in the category, straight from the CMS — a product added
// there shows up here with no further configuration.
const ProductSlider = ({ categoryName, categorySlug, products, currentSlug }) => {
    const trackRef = useRef(null);
    const currentCardRef = useRef(null);
    const [atStart, setAtStart] = useState(true);
    const [atEnd, setAtEnd] = useState(true);

    // Arrows are pointless when the cards already fit, and each one has to
    // disable itself at its end of the track.
    const syncArrows = useCallback(() => {
        const track = trackRef.current;
        if (!track) return;
        const maxScroll = track.scrollWidth - track.clientWidth;
        setAtStart(track.scrollLeft <= 1);
        setAtEnd(track.scrollLeft >= maxScroll - 1);
    }, []);

    useEffect(() => {
        const track = trackRef.current;
        if (!track) return;

        syncArrows();
        track.addEventListener('scroll', syncArrows, { passive: true });

        // Card widths are percentage-based, so the ends move when the track does.
        const observer = new ResizeObserver(syncArrows);
        observer.observe(track);

        return () => {
            track.removeEventListener('scroll', syncArrows);
            observer.disconnect();
        };
    }, [syncArrows, products]);

    // Open the slider on the product being viewed. Setting scrollLeft directly
    // rather than scrollIntoView, which would also scroll the page vertically
    // and fight ScrollToTop on every navigation. The track's left padding is
    // part of the card's offset, so it comes back off — otherwise the first
    // card lands at scrollLeft 8 and the left arrow never reads as "at start".
    useEffect(() => {
        const track = trackRef.current;
        const card = currentCardRef.current;
        if (!track || !card) return;
        const padLeft = parseFloat(getComputedStyle(track).paddingLeft) || 0;
        track.scrollLeft = Math.max(0, card.offsetLeft - track.offsetLeft - padLeft);
    }, [currentSlug, products]);

    const scrollByCard = (direction) => {
        const track = trackRef.current;
        if (!track) return;
        const card = track.querySelector('.product-slide');
        // Fall back to most of the viewport when there is no card to measure.
        const step = card ? card.offsetWidth + 32 : track.clientWidth * 0.8;
        track.scrollBy({ left: direction * step, behavior: 'smooth' });
    };

    if (!products || products.length === 0) return null;

    return (
        <section className="product-slider-section section">
            <div className="container">
                <div className="product-slider-header">
                    <h2>{categoryName} Products</h2>
                    <div className="product-slider-arrows">
                        <button
                            type="button"
                            className="product-slider-arrow"
                            onClick={() => scrollByCard(-1)}
                            disabled={atStart}
                            aria-label={`Previous ${categoryName} products`}
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <button
                            type="button"
                            className="product-slider-arrow"
                            onClick={() => scrollByCard(1)}
                            disabled={atEnd}
                            aria-label={`Next ${categoryName} products`}
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>

                <div className="product-slider-track" ref={trackRef}>
                    {products.map((product) => {
                        const isCurrent = product.slug === currentSlug;
                        const productUrl = `/products/${categorySlug}/${product.slug}`;
                        const image = product.thumbnailImage?.url || product.heroImage?.url || product.bannerImage?.url;

                        return (
                            <article
                                key={product._id || product.slug}
                                ref={isCurrent ? currentCardRef : null}
                                className={`product-slide ${isCurrent ? 'is-current' : ''}`}
                                aria-current={isCurrent ? 'page' : undefined}
                            >
                                <Link to={productUrl} className="product-slide-media" aria-label={product.name}>
                                    {image
                                        ? <img src={image} alt={product.name} loading="lazy" />
                                        : <span className="product-slide-initial">{product.name?.charAt(0)}</span>}
                                    {isCurrent && <span className="product-slide-badge">Viewing</span>}
                                </Link>
                                <div className="product-slide-body">
                                    <h3 className="product-slide-title">
                                        <Link to={productUrl}>{product.name}</Link>
                                    </h3>
                                    <p className="product-slide-desc">
                                        {product.shortDescription || product.heroDescription}
                                    </p>
                                    <div className="product-slide-actions">
                                        <Link to="/loan-application" className="btn btn-primary btn-sm">
                                            Apply Now
                                        </Link>
                                        {!isCurrent && (
                                            <Link to={productUrl} className="product-slide-more">
                                                View <ArrowRight size={14} />
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};

export default ProductSlider;
