import { Link } from 'react-router-dom';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination } from 'swiper/modules';
import { ArrowRight } from 'lucide-react';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import './RelatedProducts.css';

// Every active product in the category, straight from the CMS — publishing a
// product there adds a card here with no further configuration. The list is
// passed in rather than fetched, so this shares the category request the page
// has already made instead of issuing its own.
const RelatedProducts = ({ categoryName, categorySlug, products, currentSlug }) => {
    // A "related" strip holding only the page you are already on is noise.
    if (!products || products.length <= 1) return null;

    // Swiper cannot loop while the slides fit the viewport — it needs more
    // slides than the widest breakpoint shows, or it duplicates them and the
    // track jumps. Above that it loops as asked.
    const canLoop = products.length > 4;

    return (
        <section className="related-products section">
            <div className="container">
                <div className="related-products-header">
                    <h2>Related Products</h2>
                    {categoryName && <p>More from {categoryName}</p>}
                </div>

                <Swiper
                    modules={[Navigation, Pagination]}
                    spaceBetween={24}
                    slidesPerView={1}
                    speed={450}
                    grabCursor
                    navigation
                    pagination={{ clickable: true }}
                    loop={canLoop}
                    autoplay={false}
                    breakpoints={{
                        768: { slidesPerView: 2 },
                        1024: { slidesPerView: 4 }
                    }}
                >
                    {products.map((product) => {
                        const isCurrent = product.slug === currentSlug;
                        const productUrl = `/products/${categorySlug}/${product.slug}`;
                        const image = product.thumbnailImage?.url || product.heroImage?.url || product.bannerImage?.url;

                        return (
                            <SwiperSlide key={product._id || product.slug}>
                                <article
                                    className={`related-card ${isCurrent ? 'is-current' : ''}`}
                                    aria-current={isCurrent ? 'page' : undefined}
                                >
                                    <Link to={productUrl} className="related-card-media" aria-label={product.name}>
                                        {image
                                            ? <img src={image} alt={product.name} loading="lazy" decoding="async" />
                                            : <span className="related-card-initial">{product.name?.charAt(0)}</span>}
                                        {isCurrent && <span className="related-card-badge">Active</span>}
                                    </Link>

                                    <div className="related-card-body">
                                        <h3 className="related-card-title">
                                            <Link to={productUrl}>{product.name}</Link>
                                        </h3>
                                        <p className="related-card-desc">
                                            {product.shortDescription || product.heroDescription}
                                        </p>
                                        <div className="related-card-actions">
                                            <Link to="/loan-application" className="btn btn-primary btn-sm">
                                                Apply Now
                                            </Link>
                                            <Link to={productUrl} className="related-card-more">
                                                Learn More <ArrowRight size={14} />
                                            </Link>
                                        </div>
                                    </div>
                                </article>
                            </SwiperSlide>
                        );
                    })}
                </Swiper>
            </div>
        </section>
    );
};

export default RelatedProducts;
