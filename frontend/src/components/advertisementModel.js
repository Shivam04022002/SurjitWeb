// What the popup needs before it is willing to show anything.
//
// The advertisement is optional content on a finance website: if the response
// is not exactly what the popup can render, the visitor sees the site as it
// always looks, with no popup and no error. So this checks the shape rather
// than trusting it, and returns either a complete advertisement or null.

const text = (value) => (typeof value === 'string' ? value.trim() : '');

// The image address the browser will load: this site, or a full http(s) URL
// (S3, a CDN). Nothing else — a data: or javascript: value has no business in
// an <img> the CMS filled in.
export const isUsableImageUrl = (value) => {
    const url = text(value);
    if (!url) return false;
    if (url.startsWith('//')) return false;
    if (url.startsWith('/')) return true;
    try {
        const { protocol } = new URL(url);
        return protocol === 'https:' || protocol === 'http:';
    } catch {
        return false;
    }
};

// Where the Apply button goes. The backend validates this on the way in; the
// same rule is applied on the way out, because a value that slipped past
// becomes a click a visitor makes.
export const isUsableApplyUrl = (value) => {
    const url = text(value);
    if (!url) return false;
    if (url.startsWith('//')) return false;
    if (url.startsWith('/')) return true;
    try {
        const { protocol } = new URL(url);
        return protocol === 'https:' || protocol === 'http:';
    } catch {
        return false;
    }
};

// Whether Apply stays inside this website.
//
// A path is obviously internal, and so is a full URL to this same site — which
// is what an admin pastes and what the CMS stores. Getting this wrong is not
// cosmetic: an internal destination opened as an external one lands in a new
// tab with its own empty sessionStorage, and the advertisement the visitor
// just acted on appears all over again.
export const isInternalApplyUrl = (value) => {
    const url = text(value);
    if (!url) return false;
    if (url.startsWith('//')) return false;
    if (url.startsWith('/')) return true;
    try {
        return new URL(url).origin === window.location.origin;
    } catch {
        // No window (or an unparseable value): treat it as off-site, which is
        // the safer of the two — a new tab still works, it just leaves this one.
        return false;
    }
};

// What the router navigates to: the path, query and hash of an internal URL,
// never its origin. The query string is carried through — a product id on the
// apply link is part of where the visitor asked to go.
export const internalApplyPath = (value) => {
    const url = text(value);
    if (url.startsWith('/')) return url;
    try {
        const { pathname, search, hash } = new URL(url);
        return `${pathname}${search}${hash}`;
    } catch {
        return url;
    }
};

// The advertisement the popup will render, or null.
//
// Every field the popup uses must be present and usable: a missing image, a
// missing link or a malformed response all mean "no advertisement", never a
// half-rendered popup. Nothing is invented — a missing button text is the one
// exception, and only because the backend's own default is 'Apply'.
export const displayableAdvertisement = (advertisement) => {
    if (!advertisement || typeof advertisement !== 'object') return null;

    const id = text(advertisement.id);
    const name = text(advertisement.name);
    const imageUrl = text(advertisement.imageUrl);
    const applyUrl = text(advertisement.applyUrl);
    const applyButtonText = text(advertisement.applyButtonText) || 'Apply';

    if (!id || !name) return null;
    if (!isUsableImageUrl(imageUrl)) return null;
    if (!isUsableApplyUrl(applyUrl)) return null;

    return { id, name, imageUrl, applyUrl, applyButtonText };
};

// The advertisement inside the API envelope, checked the same way. A response
// that is not the expected shape reads as "nothing to show".
export const advertisementFromResponse = (payload) => {
    if (!payload || typeof payload !== 'object') return null;
    // Callers pass either the envelope or the advertisement the service already
    // unwrapped, so both are accepted.
    const advertisement = 'advertisement' in payload ? payload.advertisement : payload;
    return displayableAdvertisement(advertisement);
};


// ── Once per browser session ──────────────────────────────────────────────────
//
// An advertisement a visitor has already been shown does not come back while
// the tab is open. The key carries the advertisement's own id, so publishing a
// different advertisement reaches the same visitor immediately — there is no
// single "already seen an ad" flag.
//
// sessionStorage deliberately: it ends with the tab, which is the visit. It is
// also the first thing a privacy mode takes away, so every access is guarded
// and a failure means the popup behaves as it did before this existed — shown
// again on the next load, rather than a broken website.

export const seenKey = (id) => `sf_ad_seen_${id}`;

// Reading is the permissive direction: if storage cannot be read, the visitor
// counts as not having seen it. The advertisement showing twice is a far
// smaller problem than a page that will not render.
export const hasSeenAdvertisement = (id) => {
    if (!id) return false;
    try {
        return window.sessionStorage.getItem(seenKey(id)) !== null;
    } catch {
        return false;
    }
};

// Writing is best effort. Where storage is unavailable nothing is remembered
// and the popup simply appears again on the next load.
export const markAdvertisementSeen = (id) => {
    if (!id) return false;
    try {
        window.sessionStorage.setItem(seenKey(id), '1');
        return true;
    } catch {
        return false;
    }
};
