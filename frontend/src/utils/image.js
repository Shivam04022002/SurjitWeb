// ─────────────────────────────────────────────────────────────────────────────
// Resolve a CMS image reference to a URL the browser can actually request.
//
// The API's buildFileResult() returns one of two shapes depending on how the
// host is configured:
//
//   S3 configured (production) -> { url: "https://<bucket>.s3.<region>.amazonaws.com/products/…" }
//   local disk fallback        -> { url: "/uploads/products/1699…-123.jpg" }
//
// The second is root-relative to the *API* origin, not the website's. Rendered
// as-is the browser would ask surjitfinance.com for it and get the SPA's HTML
// fallback back instead of an image. Rebasing it here means a deployment that
// has no S3 credentials keeps working with no code change.
//
// The origin is derived from VITE_API_URL — the same variable the API client
// already uses — so nothing about the host is hardcoded.
// ─────────────────────────────────────────────────────────────────────────────

const API_ORIGIN = (import.meta.env.VITE_API_URL || '')
    .trim()
    .replace(/\/+$/, '')      // trailing slash
    .replace(/\/api$/i, '');  // VITE_API_URL points at /api; uploads sit beside it

/**
 * Accepts an image sub-document ({ url, fileName, size }) or a bare string.
 * Returns an absolute URL, or null when no image is set — callers use the null
 * to decide whether to render at all, so an absent image stays absent rather
 * than becoming a broken <img>.
 */
export const imageUrl = (image) => {
    const raw = typeof image === 'string' ? image : image?.url;
    if (!raw) return null;

    const url = String(raw).trim();
    if (!url) return null;

    // Already absolute (S3, a CDN, or an inline preview) — leave it alone.
    if (/^(https?:|data:|blob:|\/\/)/i.test(url)) return url;

    return `${API_ORIGIN}/${url.replace(/^\/+/, '')}`;
};

export default imageUrl;
