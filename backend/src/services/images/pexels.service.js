const logger = require('../../utils/logger');
const { AppError } = require('../../middleware/errorHandler');
const HTTP_STATUS = require('../../constants/httpStatus');

// Free featured images from Pexels (https://www.pexels.com/api/documentation/).
//
//   findImage  topic/title/scene -> one relevant landscape photo, downloaded,
//              with the photographer credit Pexels asks us to show
//
// The photo is returned to the CMS as file data and stored through the normal
// draft upload only when the draft is saved, like any image an admin picks.
//
// Quota: Pexels allows a limited number of requests per hour and month.
// Identical searches are answered from a cache; after a 429 no request is
// sent until Pexels' own reset time has passed. The limit is waited out, never
// worked around. The key goes only in the Authorization header Pexels expects.
//
// The key is passed in by the caller (pexelsConfig.resolveApiKey: the key
// saved on the API page, else PEXELS_API_KEY); this module never stores it.

const SEARCH_URL = 'https://api.pexels.com/v1/search';
const IMAGE_HOST = 'images.pexels.com';
const PEXELS_SITE = 'https://www.pexels.com/';
const TIMEOUT_MS = 10000;
const DOWNLOAD_TIMEOUT_MS = 15000;
const PER_PAGE = 15;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX = 200;
const RECENT_MAX = 300;
const DEFAULT_BLOCK_MS = 60 * 1000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // the blog upload limit
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const cache = new Map();   // query -> { at, photos }
const recent = [];         // ids of photos handed out lately, to vary images
const state = { blockedUntil: 0 };

const STOPWORDS = new Set(('a an and are as at be by for from how in into is it its of on or that the this to with your you '
    + 'what why when which who can will should do does our we us about vs versus guide tips ways simple best top new '
    + 'understanding know need needs using use get make every').split(' '));

const keywords = (text, max) => [...new Set(String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w)))].slice(0, max);

// The scene Gemini described first (it names what a photo should show), then
// the title, then the topic — at most two searches per image.
const buildQueries = ({ imagePrompt, title, topic }) => [...new Set([
    keywords(imagePrompt, 5).join(' '),
    keywords(title, 5).join(' '),
    keywords(topic, 4).join(' ')
].filter(Boolean))].slice(0, 2);

const minutes = (ms) => Math.max(1, Math.ceil(ms / 60000));

const rateLimited = () => new AppError(
    `Pexels rate limit reached. Automatic images resume in about ${minutes(state.blockedUntil - Date.now())} min — upload an image, or try again later.`,
    HTTP_STATUS.TOO_MANY_REQUESTS
);

// Redirects are refused: the search goes only to api.pexels.com and images
// come only from images.pexels.com, so a redirect elsewhere is never followed.
const withTimeout = async (url, init, ms) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
        return await fetch(url, { ...init, redirect: 'error', signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
};

const search = async (query, apiKey, { fresh = false } = {}) => {
    const cached = cache.get(query);
    if (!fresh && cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.photos;
    if (state.blockedUntil > Date.now()) throw rateLimited();

    const url = `${SEARCH_URL}?${new URLSearchParams({ query, orientation: 'landscape', per_page: String(PER_PAGE) })}`;
    let res;
    try {
        res = await withTimeout(url, { headers: { Authorization: apiKey } }, TIMEOUT_MS);
    } catch (err) {
        throw new AppError(err.name === 'AbortError'
            ? 'Pexels took too long to respond. Upload an image, or try again.'
            : 'Could not reach Pexels. Upload an image, or try again.', HTTP_STATUS.BAD_GATEWAY);
    }

    if (res.status === 429) {
        // Pexels sends the reset time as a Unix timestamp in seconds.
        const reset = Number(res.headers.get('x-ratelimit-reset')) * 1000;
        state.blockedUntil = reset > Date.now() ? reset : Date.now() + DEFAULT_BLOCK_MS;
        logger.warn('Pexels rate limit reached', { resumeAt: new Date(state.blockedUntil).toISOString() });
        throw rateLimited();
    }
    if (res.status === 401 || res.status === 403) {
        throw new AppError('Pexels rejected the API key. Check the Pexels key on the API page, or upload an image instead.', HTTP_STATUS.UNPROCESSABLE_ENTITY);
    }
    if (res.status >= 500) {
        throw new AppError(`Pexels is temporarily unavailable (HTTP ${res.status}). Upload an image, or try again shortly.`, HTTP_STATUS.BAD_GATEWAY);
    }
    if (!res.ok) {
        throw new AppError(`Pexels refused the search (HTTP ${res.status}). Upload an image instead.`, HTTP_STATUS.BAD_GATEWAY);
    }

    let json = null;
    try { json = await res.json(); } catch { json = null; }
    const photos = Array.isArray(json?.photos) ? json.photos : [];

    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(query, { at: Date.now(), photos });
    return photos;
};

// A featured image must be clearly landscape and large enough for a header.
// Among those, the photo whose description shares most words with the search
// wins; photos handed out recently lose ties, so similar topics in one batch
// do not all get the same picture.
const pick = (photos, query, exclude) => {
    const words = new Set(query.split(' '));
    const usable = photos.filter((p) => p && p.id && p.src
        && !exclude.has(String(p.id))
        && Number(p.width) >= 1000
        && Number(p.width) >= Number(p.height) * 1.25);
    const score = (p) => keywords(p.alt, 30).filter((w) => words.has(w)).length * 10
        - (recent.includes(String(p.id)) ? 5 : 0);
    return usable.map((p, i) => ({ p, s: score(p) - i * 0.01 })).sort((a, b) => b.s - a.s)[0]?.p || null;
};

// Only a Pexels page may be stored as a credit link.
const pexelsLink = (value) => (typeof value === 'string' && value.startsWith(PEXELS_SITE) ? value.slice(0, 300) : PEXELS_SITE);

const download = async (photo) => {
    const src = photo.src.landscape || photo.src.large2x || photo.src.large;
    let url;
    try {
        url = new URL(src);
    } catch {
        url = null;
    }
    // Downloads come only from Pexels' own image host.
    if (!url || url.protocol !== 'https:' || url.hostname !== IMAGE_HOST) {
        throw new AppError('Pexels returned an image address outside images.pexels.com. Upload an image instead.', HTTP_STATUS.BAD_GATEWAY);
    }
    let res;
    try {
        res = await withTimeout(url.toString(), {}, DOWNLOAD_TIMEOUT_MS);
    } catch {
        throw new AppError('The Pexels image could not be downloaded. Upload an image, or try again.', HTTP_STATUS.BAD_GATEWAY);
    }
    if (!res.ok) throw new AppError(`The Pexels image could not be downloaded (HTTP ${res.status}).`, HTTP_STATUS.BAD_GATEWAY);
    const mimeType = String(res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!IMAGE_TYPES.includes(mimeType)) {
        throw new AppError('Pexels returned an unsupported image format. Upload an image instead.', HTTP_STATUS.BAD_GATEWAY);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) {
        throw new AppError('The Pexels image is empty or larger than the 10 MB upload limit. Upload an image instead.', HTTP_STATUS.BAD_GATEWAY);
    }
    return { mimeType, data: buffer.toString('base64'), size: buffer.length };
};

const findImage = async ({ title, topic, imagePrompt, excludeIds = [], apiKey }) => {
    if (!apiKey) {
        throw new AppError('Automatic featured images need a Pexels API key (add one on the API page). Upload an image instead.', HTTP_STATUS.UNPROCESSABLE_ENTITY);
    }
    const queries = buildQueries({ imagePrompt, title, topic });
    if (!queries.length) {
        throw new AppError('There is not enough text to search Pexels for an image. Upload an image instead.', HTTP_STATUS.UNPROCESSABLE_ENTITY);
    }

    const exclude = new Set(excludeIds.map(String));
    let chosen = null;
    let usedQuery = '';
    for (const q of queries) {
        chosen = pick(await search(q, apiKey), q, exclude);
        if (chosen) { usedQuery = q; break; }
    }
    if (!chosen) {
        throw new AppError('Pexels has no suitable landscape photo for this topic. Upload an image instead.', HTTP_STATUS.UNPROCESSABLE_ENTITY);
    }

    const image = await download(chosen);
    recent.push(String(chosen.id));
    if (recent.length > RECENT_MAX) recent.shift();

    return {
        ...image,
        source: 'pexels',
        query: usedQuery,
        credit: {
            source: 'pexels',
            photoId: String(chosen.id),
            photoUrl: pexelsLink(chosen.url),
            photographer: String(chosen.photographer || 'Pexels').replace(/[<>]/g, '').trim().slice(0, 120) || 'Pexels',
            photographerUrl: pexelsLink(chosen.photographer_url),
            alt: String(chosen.alt || '').slice(0, 200)
        }
    };
};

// For Test Connection: proves the key works now, with one small search that
// bypasses the cache (a cached answer could hide a revoked key).
const verify = async (apiKey) => {
    if (!apiKey) return { configured: false };
    await search('office desk', apiKey, { fresh: true });
    return { configured: true };
};

module.exports = {
    findImage, verify, buildQueries,
    clearRateLimit: () => { state.blockedUntil = 0; },
    _reset: () => { cache.clear(); recent.length = 0; state.blockedUntil = 0; },
    SEARCH_URL, IMAGE_HOST
};
