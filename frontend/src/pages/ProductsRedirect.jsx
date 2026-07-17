import { useParams, Navigate } from 'react-router-dom';
import PageLoader from '../components/PageLoader';
import { useActiveProductCategories, useProductBySlug } from '../hooks';

// Neither /products nor /products/:categorySlug renders a page of its own — a
// category resolves straight to a product. Both paths stay routed so existing
// links, bookmarks and indexed URLs land on a real page instead of 404ing:
//
//   /products                  -> first active product of the first category
//   /products/:categorySlug    -> first active product of that category
//   /products/:productSlug     -> that product, under its category (legacy URL)
//
// Category slugs win over product slugs when the two collide, matching the URL
// scheme where the first segment after /products is a category.
const ProductsRedirect = () => {
    const { categorySlug } = useParams();
    const { data: categories, loading: categoriesLoading } = useActiveProductCategories();

    const category = categories && (categorySlug
        ? categories.find(c => c.slug === categorySlug)
        // Bare /products: the first category that actually has a product to open.
        : categories.find(c => c.firstProductSlug));

    // The slug matched no category, so it may be a legacy /products/:productSlug.
    const tryLegacyProduct = !!categorySlug && !!categories && !category;
    const { data: legacyProduct, loading: legacyLoading, error: legacyError } = useProductBySlug(
        tryLegacyProduct ? categorySlug : null
    );

    // `legacyLoading` is still false on the render that enables the lookup, since
    // useApi only raises it inside its effect. Waiting on a settled result
    // instead keeps that render from falling through to the redirect below.
    const legacyPending = tryLegacyProduct && !legacyProduct && !legacyError;

    if (categoriesLoading || legacyLoading || legacyPending) {
        return <PageLoader />;
    }

    if (category?.firstProductSlug) {
        return <Navigate to={`/products/${category.slug}/${category.firstProductSlug}`} replace />;
    }

    if (legacyProduct?.category?.slug) {
        return <Navigate to={`/products/${legacyProduct.category.slug}/${legacyProduct.slug}`} replace />;
    }

    // Nothing to show: an empty category, an unknown slug, or the categories
    // request failed. Fall back to home, as the catch-all route does.
    return <Navigate to="/" replace />;
};

export default ProductsRedirect;
