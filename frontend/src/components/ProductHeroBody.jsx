import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Breadcrumbs from './Breadcrumbs';

// The hero copy for one product: trail, badge, title, description, the primary
// call to action and the in-page section links.
//
// Shared by the single-product hero and by every carousel slide. The two used
// to be hand-kept copies of each other; sharing the component is what actually
// guarantees a slide is indistinguishable from the standalone page.
const ProductHeroBody = ({ product, category }) => {
    const cat = category || product?.category;

    return (
        <div className="product-hero-content">
            <div className="product-hero-text">
                <div className="breadcrumbs-on-hero" style={{ marginBottom: '1rem' }}>
                    <Breadcrumbs
                        items={[
                            { name: 'Home', path: '/' },
                            { name: 'Products', path: '/products' },
                            ...(cat ? [{ name: cat.name, path: `/products/${cat.slug}` }] : []),
                            { name: product.name },
                        ]}
                    />
                </div>
                <span className="product-badge">{cat?.name || product.subtitle || 'Product'}</span>
                <h1>{product.name || product.title}</h1>
                <p>{product.heroDescription || product.description}</p>
                <div className="product-hero-actions">
                    <Link
                        to={product._id ? `/loan-application?productId=${product._id}` : '/loan-application'}
                        className="btn btn-accent btn-lg"
                    >
                        Apply Loan
                        <ArrowRight size={20} />
                    </Link>
                </div>
                <div className="product-quick-links">
                    <a href="#features-and-benefits">Features &amp; Benefits</a>
                    <a href="#eligibility">Eligibility</a>
                    <a href="#interest-rate-and-charges">Interest Rate &amp; Charges</a>
                    <a href="#emi-calculator">EMI Calculator</a>
                    <a href="#faq">FAQ</a>
                </div>
            </div>
        </div>
    );
};

export default ProductHeroBody;
