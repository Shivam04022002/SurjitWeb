import axios from 'axios';

const BASE_URL = `${import.meta.env.VITE_API_URL}/public`;

const api = axios.create({
    baseURL: BASE_URL,
    timeout: 15000,
    withCredentials: false,
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response) {
            console.error(`API Error [${error.response.status}]:`, error.response.data?.message || error.message);
        } else if (error.request) {
            console.error('API Error: No response from server');
        } else {
            console.error('API Error:', error.message);
        }
        return Promise.reject(error);
    }
);

// ── Global Settings ────────────────────────────────────────────────────────────
export const getSettings = () => api.get('/settings').then(r => r.data.data.settings);

// ── About ──────────────────────────────────────────────────────────────────────
export const getCompanyInfo = () => api.get('/about/company').then(r => r.data.data.company);
export const getDirectors = () => api.get('/about/directors').then(r => r.data.data.directors);
export const getLeadership = () => api.get('/about/leadership').then(r => r.data.data.members);

// ── Product Categories ─────────────────────────────────────────────────────────
// Active categories only, ordered by displayOrder — drives the nav and /products.
export const getActiveProductCategories = () =>
    api.get('/product-categories').then(r => r.data.data.categories);

// Category plus its products in one request — drives /products/:categorySlug.
export const getCategoryWithProducts = (categorySlug) =>
    api.get(`/product-categories/${categorySlug}/products`).then(r => r.data.data);

// ── Products ───────────────────────────────────────────────────────────────────
export const getProductCategories = () => api.get('/products/categories').then(r => r.data.data.categories);
export const getProducts = () => api.get('/products').then(r => r.data.data.products);
export const getProductBySlug = (slug) => api.get(`/products/by-slug/${slug}`).then(r => r.data.data.product);
export const getProductFeatures = (productId) => api.get(`/products/${productId}/features`).then(r => r.data.data.features);
export const getProductEligibility = (productId) => api.get(`/products/${productId}/eligibility`).then(r => r.data.data.eligibility);
export const getProductDocuments = (productId) => api.get(`/products/${productId}/documents`).then(r => r.data.data.documents);
export const getProductInterestRates = (productId) => api.get(`/products/${productId}/interest-rates`).then(r => r.data.data.rates);
export const getProductFaqs = (productId) => api.get(`/products/${productId}/faqs`).then(r => r.data.data.faqs);
export const getProductEmi = (productId) => api.get(`/products/${productId}/emi`).then(r => r.data.data.emi);
export const getProductSeo = (productId) => api.get(`/products/${productId}/seo`).then(r => r.data.data.seo);

// ── Career ─────────────────────────────────────────────────────────────────────
export const getCareerSettings = () => api.get('/careers/settings').then(r => r.data.data.settings);
export const getJobs = () => api.get('/careers/jobs').then(r => r.data.data.jobs);
export const getJobById = (id) => api.get(`/careers/jobs/${id}`).then(r => r.data.data.job);

// ── Gallery ────────────────────────────────────────────────────────────────────
export const getGalleryAlbums = () => api.get('/gallery/albums').then(r => r.data.data.albums);
export const getGalleryAlbum = (id) => api.get(`/gallery/albums/${id}`).then(r => r.data.data.album);
export const getAlbumImages = (albumId) => api.get(`/gallery/albums/${albumId}/images`).then(r => r.data.data.images);

// ── Contact / Application (existing non-public endpoints) ─────────────────────
const rawApi = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    timeout: 30000,
    withCredentials: false,
});

export const submitJobApplication = (formData) =>
    rawApi.post('/v1/careers/applications', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });

export const submitContact = (data) => rawApi.post('/contact', data);

export const submitLoanApplication = (data) => rawApi.post('/loan-application', data);

export default api;

// ── Blogs ──────────────────────────────────────────────────────────────────────
// The listing is paginated server-side, so the whole envelope is returned here
// rather than just the rows.
export const getBlogs = (params = {}) => api.get('/blogs', { params }).then(r => r.data.data);
export const getBlogCategories = () => api.get('/blogs/categories').then(r => r.data.data.categories);
export const getBlogBySlug = (slug) => api.get(`/blogs/${slug}`).then(r => r.data.data.blog);
export const getRelatedBlogs = (slug, limit = 3) =>
    api.get(`/blogs/${slug}/related`, { params: { limit } }).then(r => r.data.data.blogs);
export const getAdjacentBlogs = (slug) => api.get(`/blogs/${slug}/adjacent`).then(r => r.data.data);

// ── Customer reviews ───────────────────────────────────────────────────────────
// Passing `limit` returns a plain array; omit it for the paginated envelope.
export const getReviews = (params = {}) => api.get('/reviews', { params }).then(r => r.data.data.reviews);

// Customer submission. Multipart because an optional photo rides along. The
// server creates every submission as Pending — nothing here can publish.
export const submitReview = (formData) =>
    api.post('/reviews', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
        .then(r => r.data);
