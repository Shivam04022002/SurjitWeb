import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Swiper, SwiperSlide } from 'swiper/react';
import { FreeMode, Mousewheel } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/free-mode';
import './ProductNav.css';

// Every active product in the category, straight from the CMS — a product added
// there becomes a pill here with no further configuration.
const ProductNav = ({ categorySlug, products, currentSlug }) => {
    const [swiper, setSwiper] = useState(null);

    const activeIndex = products
        ? products.findIndex((p) => p.slug === currentSlug)
        : -1;

    // The row scrolls, so the current product can start out of sight. slideTo
    // rather than scrollIntoView, which would also scroll the page vertically
    // and fight ScrollToTop on every navigation.
    useEffect(() => {
        if (!swiper || swiper.destroyed || activeIndex < 0) return;
        swiper.slideTo(activeIndex);
    }, [swiper, activeIndex, products]);

    if (!products || products.length === 0) return null;

    return (
        <nav className="product-nav" aria-label="Products in this category">
            <div className="container">
                <Swiper
                    className="product-nav-track"
                    modules={[FreeMode, Mousewheel]}
                    // Pills size to their own label rather than a column width.
                    slidesPerView="auto"
                    spaceBetween={12}
                    // Free drag with momentum — this is a scrollable list, not a
                    // carousel, so it must not snap to slide boundaries.
                    freeMode={{ enabled: true, momentum: true, sticky: false }}
                    grabCursor
                    // Trackpad: a two-finger sideways swipe arrives as a wheel
                    // event, which Swiper ignores unless this is on. forceToAxis
                    // limits it to horizontal gestures so scrolling the page
                    // over the strip still scrolls the page, and releaseOnEdges
                    // hands the scroll back once the strip reaches either end.
                    mousewheel={{ forceToAxis: true, releaseOnEdges: true, sensitivity: 1 }}
                    // Keeps the row centred, as it was, whenever the pills fit;
                    // it only becomes a left-aligned draggable strip once they
                    // overflow.
                    centerInsufficientSlides
                    watchSlidesProgress
                    onSwiper={setSwiper}
                >
                    {products.map((product) => {
                        const isCurrent = product.slug === currentSlug;
                        return (
                            <SwiperSlide key={product._id || product.slug}>
                                <Link
                                    to={`/products/${categorySlug}/${product.slug}`}
                                    className={`product-nav-pill ${isCurrent ? 'is-active' : ''}`}
                                    aria-current={isCurrent ? 'page' : undefined}
                                >
                                    {product.name}
                                </Link>
                            </SwiperSlide>
                        );
                    })}
                </Swiper>
            </div>
        </nav>
    );
};

export default ProductNav;
