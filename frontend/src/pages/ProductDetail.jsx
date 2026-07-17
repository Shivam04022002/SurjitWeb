import { useParams, Link, Navigate } from 'react-router-dom';
import EMICalculator from '../components/EMICalculator';
import FAQAccordion from '../components/FAQAccordion';
import SEO from '../components/SEO';
import Breadcrumbs from '../components/Breadcrumbs';
import { ArrowRight, Check, FileText, RefreshCw } from 'lucide-react';
import './ProductPage.css';
import {
    useProductBySlug,
    useProductFeatures,
    useProductEligibility,
    useProductDocuments,
    useProductInterestRates,
    useProductFaqs,
    useProductSeo,
} from '../hooks';

const SectionSkeleton = ({ lines = 4 }) => (
    <div style={{ opacity: 0.5 }}>
        {Array(lines).fill(0).map((_, i) => (
            <div key={i} style={{ height: 16, background: '#e5e7eb', borderRadius: 4, marginBottom: 10, width: i === lines - 1 ? '60%' : '100%' }} />
        ))}
    </div>
);

const SITE_URL = 'https://surjitfinance.com';

const ProductDetail = () => {
    // Product slugs are globally unique, so the product resolves from productSlug
    // alone; categorySlug is validated below to keep one canonical URL per product.
    const { categorySlug, productSlug } = useParams();

    const { data: product, loading: productLoading, error: productError, refetch: refetchProduct } = useProductBySlug(productSlug);
    const productId = product?._id;

    const { data: features, loading: featuresLoading } = useProductFeatures(productId);
    const { data: eligibility, loading: eligibilityLoading } = useProductEligibility(productId);
    const { data: documents, loading: documentsLoading } = useProductDocuments(productId);
    const { data: interestRates, loading: ratesLoading } = useProductInterestRates(productId);
    const { data: faqs, loading: faqsLoading } = useProductFaqs(productId);
    const { data: seo } = useProductSeo(productId);

    if (productLoading) {
        return (
            <div className="product-page">
                <section className="product-hero">
                    <div className="container">
                        <div className="product-hero-content">
                            <div className="product-hero-text">
                                <div style={{ height: 24, background: '#ffffff30', borderRadius: 4, width: '20%', marginBottom: 12 }} />
                                <div style={{ height: 40, background: '#ffffff40', borderRadius: 4, width: '60%', marginBottom: 16 }} />
                                <div style={{ height: 16, background: '#ffffff20', borderRadius: 4, width: '100%', marginBottom: 8 }} />
                                <div style={{ height: 16, background: '#ffffff20', borderRadius: 4, width: '80%' }} />
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        );
    }

    if (productError || !product) {
        return (
            <div className="product-not-found">
                <div className="container" style={{ padding: '5rem 1rem', textAlign: 'center' }}>
                    <h1>Product Not Found</h1>
                    <p style={{ color: '#6b7280', marginBottom: '1rem' }}>The product you're looking for doesn't exist or may have been removed.</p>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                        <button onClick={refetchProduct} className="btn btn-secondary">
                            <RefreshCw size={16} /> Retry
                        </button>
                        <Link to="/" className="btn btn-primary">Go Home</Link>
                    </div>
                </div>
            </div>
        );
    }

    // The product moved category (or the URL was hand-edited): send the visitor to
    // the canonical path rather than serving the same product under two URLs.
    const actualCategorySlug = product.category?.slug;
    if (actualCategorySlug && actualCategorySlug !== categorySlug) {
        return <Navigate to={`/products/${actualCategorySlug}/${product.slug}`} replace />;
    }

    const displayFeatures = features && features.length > 0 ? features : (product.features || []);
    const displayEligibility = eligibility && eligibility.length > 0 ? eligibility : (product.eligibility || []);
    const displayDocuments = documents && documents.length > 0 ? documents : (product.documents || []);
    const displayFaqs = faqs && faqs.length > 0
        ? faqs.map(f => ({ question: f.question, answer: f.answer }))
        : (product.faqs || []);

    const primaryRate = interestRates && interestRates.length > 0
        ? `${interestRates[0].interestRate}% per annum${interestRates[0].tenure ? ` | Tenure: ${interestRates[0].tenure}` : ''}`
        : 'Competitive rates based on profile';

    return (
        <div className="product-page">
            <SEO
                title={seo?.metaTitle || product.name}
                description={seo?.metaDescription || product.shortDescription || product.heroDescription}
                keywords={seo?.metaKeywords}
                canonical={seo?.canonicalUrl || `${SITE_URL}/products/${actualCategorySlug}/${product.slug}`}
                ogImage={seo?.ogImage?.url}
            />
            {/* Hero */}
            <section className="product-hero">
                <div className="container">
                    <div className="product-hero-content">
                        <div className="product-hero-text">
                            <div className="breadcrumbs-on-hero" style={{ marginBottom: '1rem' }}>
                                <Breadcrumbs
                                    items={[
                                        { name: 'Home', path: '/' },
                                        { name: 'Products', path: '/products' },
                                        ...(product.category
                                            ? [{ name: product.category.name, path: `/products/${product.category.slug}` }]
                                            : []),
                                        { name: product.name },
                                    ]}
                                />
                            </div>
                            <span className="product-badge">{product.category?.name || product.subtitle || 'Product'}</span>
                            <h1>{product.name || product.title}</h1>
                            <p>{product.heroDescription || product.description}</p>
                            <div className="product-hero-actions">
                                <Link to="/loan-application" className="btn btn-accent btn-lg">
                                    Apply Loan
                                    <ArrowRight size={20} />
                                </Link>
                            </div>
                            <div className="product-quick-links">
                                <a href="#features-and-benefits">Features & Benefits</a>
                                <a href="#eligibility">Eligibility</a>
                                <a href="#interest-rate-and-charges">Interest Rate & Charges</a>
                                <a href="#emi-calculator">EMI Calculator</a>
                                <a href="#faq">FAQ</a>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features */}
            <section id="features-and-benefits" className="product-features section">
                <div className="container">
                    <div className="section-header">
                        <h2>Features & Benefits</h2>
                    </div>
                    {featuresLoading ? <SectionSkeleton lines={6} /> : (
                        <div className="features-grid-new">
                            {displayFeatures.map((feature, index) => (
                                <div key={feature._id || index} className="feature-card">
                                    <div className="feature-icon-box"><Check size={20} /></div>
                                    <span>{feature.title}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="features-cta">
                        <Link to="/loan-application" className="btn btn-primary btn-lg">
                            Apply Loan <ArrowRight size={18} />
                        </Link>
                    </div>
                </div>
            </section>

            {/* Eligibility */}
            <section id="eligibility" className="product-eligibility section">
                <div className="container">
                    <div className="section-header">
                        <h2>Eligibility</h2>
                        <p>We have diverse eligibility criteria for our loans. This includes your age, income, nature of your business, and more.</p>
                    </div>
                    {eligibilityLoading ? <SectionSkeleton lines={4} /> : (
                        <div className="eligibility-grid-new">
                            {displayEligibility.map((item, index) => (
                                <div key={item._id || index} className="eligibility-card-new">
                                    <span className="elig-label">{item.title}</span>
                                    <span className="elig-value">{item.description}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="eligibility-cta">
                        <Link to="/loan-application" className="btn btn-primary">
                            Apply Loan <ArrowRight size={18} />
                        </Link>
                    </div>
                </div>
            </section>

            {/* EMI Calculator */}
            <section id="emi-calculator">
                <EMICalculator loanType={product.name || product.title} />
            </section>

            {/* Interest Rate & Charges */}
            <section id="interest-rate-and-charges" className="product-rates section">
                <div className="container">
                    <div className="section-header">
                        <h2>Interest Rate & Charges</h2>
                        <p>Our interest rates are competitive and reasonable for customers. They depend on various factors:</p>
                    </div>
                    <div className="rates-features-list">
                        <div className="rate-feature-item"><span className="rate-check"><Check size={16} /></span><span>Easy and flexible criteria for eligibility</span></div>
                        <div className="rate-feature-item"><span className="rate-check"><Check size={16} /></span><span>Principal, tenure, and other factors influence the rate</span></div>
                        <div className="rate-feature-item"><span className="rate-check"><Check size={16} /></span><span>Get a good interest rate which is pocket-friendly</span></div>
                        <div className="rate-feature-item"><span className="rate-check"><Check size={16} /></span><span>Industry-standard rates with best service and assistance</span></div>
                    </div>
                    {ratesLoading ? <SectionSkeleton lines={1} /> : (
                        <div className="rate-highlight-card">
                            <span className="rate-label">Interest Rate</span>
                            <span className="rate-value">{primaryRate}</span>
                        </div>
                    )}
                    {interestRates && interestRates.length > 1 && (
                        <div className="eligibility-grid-new" style={{ marginTop: '1.5rem' }}>
                            {interestRates.map((rate, index) => (
                                <div key={rate._id || index} className="eligibility-card-new">
                                    <span className="elig-label">₹{rate.loanAmountFrom?.toLocaleString()} – ₹{rate.loanAmountTo?.toLocaleString()}</span>
                                    <span className="elig-value">{rate.interestRate}% p.a.{rate.tenure ? ` | ${rate.tenure}` : ''}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="rates-cta">
                        <Link to="/loan-application" className="btn btn-primary btn-lg">
                            Apply Loan <ArrowRight size={18} />
                        </Link>
                    </div>
                </div>
            </section>

            {/* Documents Required */}
            <section className="product-documents section">
                <div className="container">
                    <div className="section-header">
                        <h2>Documents Required</h2>
                    </div>
                    {documentsLoading ? <SectionSkeleton lines={4} /> : (
                        <div className="documents-grid">
                            {displayDocuments.map((doc, index) => (
                                <div key={doc._id || index} className="document-card">
                                    <div className="doc-icon"><FileText size={20} /></div>
                                    <span>{doc.title}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* FAQs */}
            <section id="faq" className="product-faqs section">
                <div className="container">
                    <div className="section-header">
                        <h2>Frequently Asked Questions</h2>
                    </div>
                    {faqsLoading ? <SectionSkeleton lines={6} /> : (
                        <div className="faqs-wrapper">
                            <FAQAccordion faqs={displayFaqs} />
                        </div>
                    )}
                </div>
            </section>

            {/* CTA */}
            <section className="product-cta-section">
                <div className="container">
                    <div className="cta-inner">
                        <h2>Ready to Apply?</h2>
                        <p>Start your loan application today and get quick approval</p>
                        <Link to="/loan-application" className="btn-cta-white">
                            Apply Now <ArrowRight size={20} />
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default ProductDetail;
