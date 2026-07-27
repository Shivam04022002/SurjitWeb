import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Keyboard, Mousewheel } from 'swiper/modules';
import ProductHeroBody from './ProductHeroBody';
import 'swiper/css';
import './ProductHeroCarousel.css';

// One slide per active product in the category, straight from the CMS.
// Swiping publishes the new product to the URL, which is what drives every
// section below — so a swipe and a card click end in exactly the same state.
//
// The surrounding <section> belongs to ProductHero, which owns the background
// image and the scrim; this renders only the swipeable copy inside it.
const ProductHeroCarousel = ({ products, category, currentSlug }) => {
    const navigate = useNavigate();
    const [swiper, setSwiper] = useState(null);

    const activeIndex = products.findIndex((p) => p.slug === currentSlug);

    // URL -> carousel. Covers card clicks, deep links and the back button.
    // Guarded on index equality so the slideTo below cannot bounce back into
    // the navigate above and loop.
    useEffect(() => {
        if (!swiper || swiper.destroyed || activeIndex < 0) return;
        if (swiper.activeIndex !== activeIndex) swiper.slideTo(activeIndex);
    }, [swiper, activeIndex]);

    // Carousel -> URL. Same guard in the other direction: a slide landing on
    // the product already in the URL navigates nowhere.
    const handleSlideChange = (sw) => {
        const next = products[sw.activeIndex];
        if (next && next.slug !== currentSlug) {
            navigate(`/products/${category?.slug}/${next.slug}`);
        }
    };

    return (
        <div className="product-hero-carousel">
            <div className="container">
                <Swiper
                    modules={[Keyboard, Mousewheel]}
                    effect="slide"
                    speed={450}
                    slidesPerView={1}
                    // Descriptions differ in length, so the section grows and
                    // shrinks with the slide rather than padding every product
                    // out to the tallest one.
                    autoHeight
                    // With a handful of products Swiper has too few slides to
                    // loop cleanly and would duplicate them into a jumping
                    // track, so looping stays off.
                    loop={false}
                    grabCursor
                    keyboard={{ enabled: true, onlyInViewport: true }}
                    // Trackpad. forceToAxis keeps vertical scrolling with the
                    // page instead of hijacking it into the carousel.
                    mousewheel={{ forceToAxis: true, releaseOnEdges: true }}
                    initialSlide={activeIndex > 0 ? activeIndex : 0}
                    onSwiper={setSwiper}
                    onSlideChange={handleSlideChange}
                >
                    {products.map((product) => (
                        <SwiperSlide key={product._id || product.slug}>
                            <ProductHeroBody product={product} category={category} />
                        </SwiperSlide>
                    ))}
                </Swiper>
            </div>
        </div>
    );
};

export default ProductHeroCarousel;
