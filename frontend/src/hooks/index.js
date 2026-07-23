import { useApi } from './useApi';
import * as apiService from '../services/api';

export const useSettings = () =>
    useApi(apiService.getSettings, [], { cacheKey: 'settings' });

export const useCompanyInfo = () =>
    useApi(apiService.getCompanyInfo, [], { cacheKey: 'company' });

export const useDirectors = () =>
    useApi(apiService.getDirectors, [], { cacheKey: 'directors' });

export const useLeadership = () =>
    useApi(apiService.getLeadership, [], { cacheKey: 'leadership' });

export const useProductCategories = () =>
    useApi(apiService.getProductCategories, [], { cacheKey: 'product-categories' });

// Active categories, ordered by displayOrder. Backs the header dropdown.
export const useActiveProductCategories = () =>
    useApi(apiService.getActiveProductCategories, [], { cacheKey: 'active-product-categories' });

// A category and all of its active products. Backs the product slider, which
// lists every sibling of the product being viewed.
export const useCategoryWithProducts = (categorySlug) =>
    useApi(() => apiService.getCategoryWithProducts(categorySlug), [categorySlug], {
        cacheKey: `category-products-${categorySlug}`,
        enabled: !!categorySlug,
    });

// Works out which product /products or /products/:slug should open. Categories
// and products are all the API offers, so the choice of landing product is made
// here: the category's product list already arrives active-only and ordered by
// displayOrder, so the first entry is the one to open.
//
// `slug` may be a category slug, a legacy product slug, or absent for bare
// /products. Categories win over products where the two collide, matching the
// URL scheme. Returns a tagged result so the route can redirect or explain
// itself; `forSlug` lets the caller ignore a result left over from a previous
// slug while the next one is still in flight.
export const useProductNavTarget = (slug) =>
    useApi(async () => {
        const forSlug = slug || null;
        const target = (categorySlug, productSlug) =>
            ({ kind: 'product', categorySlug, productSlug, forSlug });

        // Bare /products: open the first category that has anything to show,
        // rather than dead-ending on an empty one that happens to sort first.
        if (!slug) {
            const categories = await apiService.getActiveProductCategories();
            for (const category of categories) {
                const { products } = await apiService.getCategoryWithProducts(category.slug);
                if (products?.length) return target(category.slug, products[0].slug);
            }
            return { kind: 'no-products', forSlug };
        }

        try {
            const { category, products } = await apiService.getCategoryWithProducts(slug);
            if (products?.length) return target(category.slug, products[0].slug);
            return { kind: 'empty-category', category, forSlug };
        } catch (err) {
            if (err?.response?.status !== 404) throw err;
        }

        // Not a category — fall back to a legacy /products/:productSlug link.
        try {
            const product = await apiService.getProductBySlug(slug);
            return product?.category?.slug
                ? target(product.category.slug, product.slug)
                : { kind: 'not-found', forSlug };
        } catch (err) {
            if (err?.response?.status === 404) return { kind: 'not-found', forSlug };
            throw err;
        }
    }, [slug], { cacheKey: `product-nav-${slug || 'root'}` });

export const useProducts = () =>
    useApi(apiService.getProducts, [], { cacheKey: 'products' });

export const useProductBySlug = (slug) =>
    useApi(() => apiService.getProductBySlug(slug), [slug], {
        cacheKey: `product-slug-${slug}`,
        enabled: !!slug,
    });

export const useProductFeatures = (productId) =>
    useApi(() => apiService.getProductFeatures(productId), [productId], {
        cacheKey: `features-${productId}`,
        enabled: !!productId,
    });

export const useProductEligibility = (productId) =>
    useApi(() => apiService.getProductEligibility(productId), [productId], {
        cacheKey: `eligibility-${productId}`,
        enabled: !!productId,
    });

export const useProductDocuments = (productId) =>
    useApi(() => apiService.getProductDocuments(productId), [productId], {
        cacheKey: `documents-${productId}`,
        enabled: !!productId,
    });

export const useProductInterestRates = (productId) =>
    useApi(() => apiService.getProductInterestRates(productId), [productId], {
        cacheKey: `interest-rates-${productId}`,
        enabled: !!productId,
    });

export const useProductFaqs = (productId) =>
    useApi(() => apiService.getProductFaqs(productId), [productId], {
        cacheKey: `faqs-${productId}`,
        enabled: !!productId,
    });

export const useProductEmi = (productId) =>
    useApi(() => apiService.getProductEmi(productId), [productId], {
        cacheKey: `emi-${productId}`,
        enabled: !!productId,
    });

export const useProductSeo = (productId) =>
    useApi(() => apiService.getProductSeo(productId), [productId], {
        cacheKey: `seo-${productId}`,
        enabled: !!productId,
    });

export const useCareerSettings = () =>
    useApi(apiService.getCareerSettings, [], { cacheKey: 'career-settings' });

export const useJobs = () =>
    useApi(apiService.getJobs, [], { cacheKey: 'jobs' });

export const useGalleryAlbums = () =>
    useApi(apiService.getGalleryAlbums, [], { cacheKey: 'gallery-albums' });

export const useGalleryAlbum = (id) =>
    useApi(() => apiService.getGalleryAlbum(id), [id], {
        cacheKey: `gallery-album-${id}`,
        enabled: !!id,
    });

export const useAlbumImages = (albumId) =>
    useApi(() => apiService.getAlbumImages(albumId), [albumId], {
        cacheKey: `album-images-${albumId}`,
        enabled: !!albumId,
    });

// ── Blogs ──────────────────────────────────────────────────────────────────────
// Cache key carries the query, so paging and filtering do not collide and
// stepping back to a page already seen is instant.
export const useBlogs = (params = {}) => {
    const key = JSON.stringify(params);
    return useApi(() => apiService.getBlogs(params), [key], { cacheKey: `blogs-${key}` });
};

export const useBlogCategories = () =>
    useApi(apiService.getBlogCategories, [], { cacheKey: 'blog-categories' });

export const useBlog = (slug) =>
    useApi(() => apiService.getBlogBySlug(slug), [slug], {
        cacheKey: `blog-${slug}`,
        enabled: !!slug,
    });

export const useRelatedBlogs = (slug, limit = 3) =>
    useApi(() => apiService.getRelatedBlogs(slug, limit), [slug, limit], {
        cacheKey: `blog-related-${slug}-${limit}`,
        enabled: !!slug,
    });

export const useAdjacentBlogs = (slug) =>
    useApi(() => apiService.getAdjacentBlogs(slug), [slug], {
        cacheKey: `blog-adjacent-${slug}`,
        enabled: !!slug,
    });

// ── Customer reviews ───────────────────────────────────────────────────────────
export const useReviews = (params = {}) => {
    const key = JSON.stringify(params);
    return useApi(() => apiService.getReviews(params), [key], { cacheKey: `reviews-${key}` });
};

// ── Annual reports ─────────────────────────────────────────────────────────────
export const useReports = () =>
    useApi(apiService.getReports, [], { cacheKey: 'reports' });

// ── Branches ───────────────────────────────────────────────────────────────────
export const useBranches = () =>
    useApi(apiService.getBranches, [], { cacheKey: 'branches' });

// ── Homepage statistics ────────────────────────────────────────────────────────
export const useHomepageStats = () =>
    useApi(apiService.getHomepageStats, [], { cacheKey: 'homepage-stats' });

// ── Legal pages ────────────────────────────────────────────────────────────────
export const useLegalPage = (slug) =>
    useApi(() => apiService.getLegalPage(slug), [slug], { cacheKey: `legal-${slug}`, enabled: !!slug });
