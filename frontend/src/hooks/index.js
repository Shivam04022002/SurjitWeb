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

// Active categories, ordered by displayOrder. Backs the header dropdown and
// the /products landing page.
export const useActiveProductCategories = () =>
    useApi(apiService.getActiveProductCategories, [], { cacheKey: 'active-product-categories' });

// Resolves the first path segment of /products/:slug, which may be either a
// category slug (the new scheme) or a product slug (a legacy URL still in the
// wild). Categories win: a slug shared by both resolves to the category page.
// Returns a tagged result so the route can render or redirect accordingly.
export const useCategoryOrLegacyProduct = (slug) =>
    useApi(async () => {
        try {
            const { category, products } = await apiService.getCategoryWithProducts(slug);
            return { kind: 'category', category, products };
        } catch (err) {
            if (err?.response?.status !== 404) throw err;
        }

        // Not a category — fall back to a legacy product URL so old links survive.
        try {
            const product = await apiService.getProductBySlug(slug);
            return { kind: 'legacy-product', product };
        } catch (err) {
            if (err?.response?.status === 404) return { kind: 'not-found' };
            throw err;
        }
    }, [slug], {
        cacheKey: `category-resolve-${slug}`,
        enabled: !!slug,
    });

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
