import { useParams, Navigate, Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import PageLoader from '../components/PageLoader';
import { useProductNavTarget } from '../hooks';

// Neither /products nor /products/:categorySlug renders a page of its own — a
// category resolves straight to a product. Both paths stay routed so existing
// links, bookmarks and indexed URLs land on a real page instead of 404ing:
//
//   /products                  -> first active product of the first category
//   /products/:categorySlug    -> first active product of that category
//   /products/:productSlug     -> that product, under its category (legacy URL)
//
// A category with no active products has nothing to open, so it says so rather
// than bouncing the visitor somewhere unrelated.
const ProductsRedirect = () => {
    const { categorySlug } = useParams();
    const { data, loading, error, refetch } = useProductNavTarget(categorySlug);

    // `data` still holds the previous slug's result on the render after the URL
    // changes, which would redirect to the product we just navigated away from.
    const resolved = data?.forSlug === (categorySlug || null) ? data : null;

    if (loading || (!resolved && !error)) return <PageLoader />;

    if (error) {
        return (
            <Message title="Something went wrong" body="We couldn't load our products. Please try again.">
                <button onClick={refetch} className="btn btn-secondary">
                    <RefreshCw size={16} /> Retry
                </button>
                <Link to="/" className="btn btn-primary">Go Home</Link>
            </Message>
        );
    }

    if (resolved.kind === 'product') {
        return <Navigate to={`/products/${resolved.categorySlug}/${resolved.productSlug}`} replace />;
    }

    if (resolved.kind === 'empty-category') {
        return (
            <Message
                title={resolved.category.name}
                body="No products available in this category yet. Please check back soon."
            >
                <Link to="/" className="btn btn-primary">Go Home</Link>
                <Link to="/contact" className="btn btn-secondary">Contact Us</Link>
            </Message>
        );
    }

    if (resolved.kind === 'no-products') {
        return (
            <Message title="No products available" body="We're preparing our products. Please check back soon.">
                <Link to="/" className="btn btn-primary">Go Home</Link>
            </Message>
        );
    }

    // Unknown slug: neither a category nor a product.
    return <Navigate to="/" replace />;
};

const Message = ({ title, body, children }) => (
    <div className="container" style={{ padding: '5rem 1rem', textAlign: 'center' }}>
        <h1>{title}</h1>
        <p style={{ color: '#6b7280', marginBottom: '1rem' }}>{body}</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>{children}</div>
    </div>
);

export default ProductsRedirect;
