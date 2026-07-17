import { Link } from 'react-router-dom';
import { ArrowRight, RefreshCw } from 'lucide-react';
import SEO from '../components/SEO';
import Breadcrumbs from '../components/Breadcrumbs';
import { useActiveProductCategories } from '../hooks';
import './ProductCategories.css';

const SITE_URL = 'https://surjitfinance.com';

const ProductCategories = () => {
    const { data: categories, loading, error, refetch } = useActiveProductCategories();

    return (
        <div className="product-categories-page">
            <SEO
                title="Our Loan Products"
                description="Explore the full range of loan products from Surjit Finance — business loans, commercial vehicle loans, loans against property and more. Compare options and apply online."
                canonical={`${SITE_URL}/products`}
            />

            <section className="product-categories-hero">
                <div className="container">
                    <div className="breadcrumbs-on-hero">
                        <Breadcrumbs items={[{ name: 'Home', path: '/' }, { name: 'Products' }]} />
                    </div>
                    <h1>Our Loan Products</h1>
                    <p>Choose a category to explore the products that fit your needs.</p>
                </div>
            </section>

            <section className="section">
                <div className="container">
                    {loading && (
                        <div className="product-categories-grid">
                            {[0, 1, 2].map((i) => (
                                <div key={i} className="category-tile" style={{ opacity: 0.5 }}>
                                    <div style={{ height: 22, background: '#e5e7eb', borderRadius: 4, width: '55%', marginBottom: 12 }} />
                                    <div style={{ height: 14, background: '#e5e7eb', borderRadius: 4, width: '100%', marginBottom: 8 }} />
                                    <div style={{ height: 14, background: '#e5e7eb', borderRadius: 4, width: '75%' }} />
                                </div>
                            ))}
                        </div>
                    )}

                    {!loading && error && (
                        <div style={{ padding: '3rem 1rem', textAlign: 'center' }}>
                            <h2>Couldn't load products</h2>
                            <p style={{ color: '#6b7280', marginBottom: '1rem' }}>Please try again in a moment.</p>
                            <button onClick={refetch} className="btn btn-secondary"><RefreshCw size={16} /> Retry</button>
                        </div>
                    )}

                    {!loading && !error && (!categories || categories.length === 0) && (
                        <div style={{ padding: '3rem 1rem', textAlign: 'center' }}>
                            <h2>No product categories available</h2>
                            <p style={{ color: '#6b7280' }}>Please check back soon.</p>
                        </div>
                    )}

                    {!loading && !error && categories && categories.length > 0 && (
                        <div className="product-categories-grid">
                            {categories.map((category) => (
                                <Link
                                    key={category._id}
                                    to={`/products/${category.slug}`}
                                    className="category-tile"
                                >
                                    {category.icon?.url && (
                                        <img className="category-tile-icon" src={category.icon.url} alt="" loading="lazy" />
                                    )}
                                    <h2 className="category-tile-title">{category.name}</h2>
                                    {category.shortDescription && (
                                        <p className="category-tile-desc">{category.shortDescription}</p>
                                    )}
                                    <span className="category-tile-cta">
                                        View Products <ArrowRight size={16} />
                                    </span>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};

export default ProductCategories;
