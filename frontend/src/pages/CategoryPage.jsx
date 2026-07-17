import { useParams, Link, Navigate } from 'react-router-dom';
import { ArrowRight, RefreshCw } from 'lucide-react';
import SEO from '../components/SEO';
import Breadcrumbs from '../components/Breadcrumbs';
import { useCategoryOrLegacyProduct } from '../hooks';
import './CategoryPage.css';

const SITE_URL = 'https://surjitfinance.com';

const CardSkeleton = () => (
    <div className="category-product-card" style={{ opacity: 0.5 }}>
        <div className="category-product-media" style={{ background: '#e5e7eb' }} />
        <div className="category-product-body">
            <div style={{ height: 20, background: '#e5e7eb', borderRadius: 4, width: '60%', marginBottom: 12 }} />
            <div style={{ height: 14, background: '#e5e7eb', borderRadius: 4, width: '100%', marginBottom: 8 }} />
            <div style={{ height: 14, background: '#e5e7eb', borderRadius: 4, width: '80%' }} />
        </div>
    </div>
);

const CategoryPage = () => {
    const { categorySlug } = useParams();
    const { data, loading, error, refetch } = useCategoryOrLegacyProduct(categorySlug);

    if (loading) {
        return (
            <div className="category-page">
                <section className="category-hero">
                    <div className="container">
                        <div style={{ height: 18, background: '#ffffff30', borderRadius: 4, width: '30%', marginBottom: 16 }} />
                        <div style={{ height: 40, background: '#ffffff40', borderRadius: 4, width: '45%', marginBottom: 14 }} />
                        <div style={{ height: 16, background: '#ffffff20', borderRadius: 4, width: '65%' }} />
                    </div>
                </section>
                <section className="section">
                    <div className="container">
                        <div className="category-products-grid">
                            {[0, 1, 2].map((i) => <CardSkeleton key={i} />)}
                        </div>
                    </div>
                </section>
            </div>
        );
    }

    if (error) {
        return (
            <div className="container" style={{ padding: '5rem 1rem', textAlign: 'center' }}>
                <h1>Something went wrong</h1>
                <p style={{ color: '#6b7280', marginBottom: '1rem' }}>We couldn't load this page. Please try again.</p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                    <button onClick={refetch} className="btn btn-secondary"><RefreshCw size={16} /> Retry</button>
                    <Link to="/products" className="btn btn-primary">All Products</Link>
                </div>
            </div>
        );
    }

    // A legacy /products/:productSlug link: send it to its category-scoped home.
    if (data?.kind === 'legacy-product') {
        const product = data.product;
        const target = product?.category?.slug
            ? `/products/${product.category.slug}/${product.slug}`
            : '/products';
        return <Navigate to={target} replace />;
    }

    if (data?.kind === 'not-found' || !data?.category) {
        return (
            <div className="container" style={{ padding: '5rem 1rem', textAlign: 'center' }}>
                <h1>Category Not Found</h1>
                <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
                    The category you're looking for doesn't exist or may have been removed.
                </p>
                <Link to="/products" className="btn btn-primary">Browse All Products</Link>
            </div>
        );
    }

    const { category, products = [] } = data;
    const canonical = `${SITE_URL}/products/${category.slug}`;
    const metaDescription = category.shortDescription
        || `Explore ${category.name} options from Surjit Finance. Compare products, check eligibility and apply online.`;

    return (
        <div className="category-page">
            <SEO
                title={`${category.name} — Loan Products`}
                description={metaDescription}
                canonical={canonical}
                ogImage={category.bannerImage?.url || undefined}
            />

            <section
                className="category-hero"
                style={category.bannerImage?.url
                    ? { backgroundImage: `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.55)), url(${category.bannerImage.url})` }
                    : undefined}
            >
                <div className="container">
                    <div className="breadcrumbs-on-hero">
                        <Breadcrumbs
                            items={[
                                { name: 'Home', path: '/' },
                                { name: 'Products', path: '/products' },
                                { name: category.name },
                            ]}
                        />
                    </div>
                    <h1>{category.name}</h1>
                    {category.shortDescription && <p>{category.shortDescription}</p>}
                </div>
            </section>

            <section className="section">
                <div className="container">
                    {products.length === 0 ? (
                        <div className="category-empty">
                            <h2>No products available yet</h2>
                            <p>We're preparing products for this category. Please check back soon.</p>
                            <Link to="/products" className="btn btn-primary">Browse Other Categories</Link>
                        </div>
                    ) : (
                        <div className="category-products-grid">
                            {products.map((product) => {
                                const productUrl = `/products/${category.slug}/${product.slug}`;
                                const image = product.thumbnailImage?.url || product.heroImage?.url || product.bannerImage?.url;
                                return (
                                    <article key={product._id} className="category-product-card">
                                        <Link to={productUrl} className="category-product-media-link" aria-label={product.name}>
                                            <div className="category-product-media">
                                                {image
                                                    ? <img src={image} alt={product.name} loading="lazy" />
                                                    : <span className="category-product-initial">{product.name?.charAt(0)}</span>}
                                            </div>
                                        </Link>
                                        <div className="category-product-body">
                                            <h2 className="category-product-title">
                                                <Link to={productUrl}>{product.name}</Link>
                                            </h2>
                                            <p className="category-product-desc">
                                                {product.shortDescription || product.heroDescription}
                                            </p>
                                            <div className="category-product-actions">
                                                <Link to="/loan-application" className="btn btn-primary">
                                                    Apply Now
                                                </Link>
                                                <Link to={productUrl} className="btn btn-secondary">
                                                    Learn More <ArrowRight size={16} />
                                                </Link>
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};

export default CategoryPage;
