import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import './ProductNav.css';

// Every active product in the category, straight from the CMS — a product added
// there becomes a pill here with no further configuration.
const ProductNav = ({ categorySlug, products, currentSlug }) => {
    const trackRef = useRef(null);
    const activeRef = useRef(null);

    // On mobile the row scrolls, so the current product can start off-screen.
    // Setting scrollLeft directly rather than scrollIntoView, which would also
    // scroll the page vertically and fight ScrollToTop on every navigation.
    // The track's left padding is part of the pill's offset, so it comes back
    // off — otherwise the first pill never rests flush at scrollLeft 0.
    useEffect(() => {
        const track = trackRef.current;
        const pill = activeRef.current;
        if (!track || !pill) return;

        const padLeft = parseFloat(getComputedStyle(track).paddingLeft) || 0;
        const target = pill.offsetLeft - track.offsetLeft - padLeft;
        // Centre it where there is room to; clamped by the browser anyway.
        track.scrollLeft = Math.max(0, target - (track.clientWidth - pill.offsetWidth) / 2);
    }, [currentSlug, products]);

    if (!products || products.length === 0) return null;

    return (
        <nav className="product-nav" aria-label="Products in this category">
            <div className="container">
                <ul className="product-nav-track" ref={trackRef}>
                    {products.map((product) => {
                        const isCurrent = product.slug === currentSlug;
                        return (
                            <li key={product._id || product.slug}>
                                <Link
                                    to={`/products/${categorySlug}/${product.slug}`}
                                    className={`product-nav-pill ${isCurrent ? 'is-active' : ''}`}
                                    aria-current={isCurrent ? 'page' : undefined}
                                    ref={isCurrent ? activeRef : null}
                                >
                                    {product.name}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </nav>
    );
};

export default ProductNav;
