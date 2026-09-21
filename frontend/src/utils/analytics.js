// Anonymous page-view tracking for the public website.
//
// The session id is a random value the browser generates for itself and keeps
// in localStorage. It is not derived from anything about the visitor, is never
// sent anywhere but this site's own API, and expires after 30 minutes of
// inactivity — which is what makes a refresh part of the same visit while a
// return the next day starts a new one.

const SESSION_KEY = 'sf_session';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

const newId = () => {
    try {
        if (window.crypto?.randomUUID) return window.crypto.randomUUID().replace(/-/g, '');
    } catch {
        // fall through to the Math.random path
    }
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
};

// Reads the current session, starting a new one if none exists or the last
// activity is older than the timeout. Every call refreshes lastSeen, so the
// window slides with the visitor rather than expiring mid-browse.
const currentSession = () => {
    const now = Date.now();
    let session = null;

    try {
        const raw = window.localStorage.getItem(SESSION_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed?.id && parsed?.startedAt && parsed?.lastSeen &&
                now - parsed.lastSeen < SESSION_TIMEOUT_MS) {
                session = parsed;
            }
        }
    } catch {
        // Private mode, disabled storage, or corrupt value: fall back to a
        // fresh in-memory session rather than breaking the page.
    }

    if (!session) {
        session = { id: newId(), startedAt: now, lastSeen: now };
    }
    session.lastSeen = now;

    try {
        window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {
        // Non-fatal — the view is still reported, it just will not be grouped
        // with the next one.
    }

    return session;
};

// Route path only: no query string or fragment, so ids a visitor was linked
// with never reach the analytics collection.
const cleanPath = (pathname) => {
    if (!pathname || typeof pathname !== 'string') return '/';
    const path = pathname.split('?')[0].split('#')[0];
    return (path.startsWith('/') ? path : `/${path}`).slice(0, 300);
};

// A referrer from this same site (a reload, or a link opened in a new tab) is
// not a traffic source, so it is reported as none.
const externalReferrer = () => {
    try {
        if (!document.referrer) return '';
        return new URL(document.referrer).origin === window.location.origin ? '' : document.referrer;
    } catch {
        return '';
    }
};

// Fire-and-forget. Analytics must never delay a page or surface an error to a
// visitor, so failures are swallowed deliberately. keepalive lets the request
// finish even when the click that triggered it navigates away.
const send = (endpoint, payload) => {
    const base = import.meta.env.VITE_API_URL;
    if (!base) return;

    try {
        fetch(`${base}/public/analytics/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            keepalive: true
        }).catch(() => {});
    } catch {
        // ignored on purpose
    }
};

export const trackPageView = (pathname) => {
    const session = currentSession();
    send('track', {
        sessionId: session.id,
        path: cleanPath(pathname),
        referrer: externalReferrer(),
        sessionStartedAt: new Date(session.startedAt).toISOString()
    });
};

// ── User actions ────────────────────────────────────────────────────────────

// Mirrors the backend allowlist in constants/analyticsEvents.js.
export const ACTIONS = {
    LOAN_APPLICATION: 'loan_application_click',
    CONTACT: 'contact_click',
    PHONE: 'phone_click',
    EMAIL: 'email_click',
    WHATSAPP: 'whatsapp_click',
    MAP: 'map_click',
    PRODUCT: 'product_click',
    BLOG_READ: 'blog_read_click',
    CAREER: 'career_click',
    DOWNLOAD: 'download_click'
};

const KNOWN_ACTIONS = new Set(Object.values(ACTIONS));

// The same click reported twice within this window (a double-click, or a
// handler firing on both a parent and a child) counts once.
const DEDUPE_MS = 1000;
let lastEvent = { key: '', at: 0 };

// `target` is an internal route path, or omitted. Phone numbers, email
// addresses and external URLs are never sent — only that the action happened.
export const trackEvent = (action, { target } = {}) => {
    if (!KNOWN_ACTIONS.has(action)) return;

    const path = cleanPath(window.location.pathname);
    const cleanTarget = target ? cleanPath(target) : '';
    const key = `${action}|${path}|${cleanTarget}`;
    const now = Date.now();
    if (lastEvent.key === key && now - lastEvent.at < DEDUPE_MS) return;
    lastEvent = { key, at: now };

    const payload = { sessionId: currentSession().id, action, path };
    if (cleanTarget) payload.target = cleanTarget;
    send('event', payload);
};

const MAP_HOST = /(^|\.)(maps\.google\.[a-z.]+|maps\.app\.goo\.gl)$/;
const WHATSAPP_HOST = /(^|\.)(wa\.me|whatsapp\.com)$/;

// Works out which tracked action, if any, a clicked link represents — from its
// destination, so every existing and future CTA pointing at the same place is
// counted the same way without each one needing its own handler.
//
// An element (or an ancestor) with data-track="<action>" overrides this. That
// is for CTAs whose destination is CMS-configurable, e.g. an "Apply Now" button
// an admin may point at an external form.
export const classifyClick = (element) => {
    const explicit = element.closest('[data-track]');
    if (explicit) {
        const action = explicit.getAttribute('data-track');
        if (!KNOWN_ACTIONS.has(action)) return null;
        const anchor = explicit.closest('a[href]') || explicit.querySelector('a[href]');
        const target = anchor ? internalPath(anchor.getAttribute('href')) : '';
        return { action, target };
    }

    const anchor = element.closest('a[href]');
    if (!anchor) return null;
    const href = anchor.getAttribute('href') || '';
    const scheme = href.split(':')[0].toLowerCase();

    if (scheme === 'tel') return { action: ACTIONS.PHONE };
    if (scheme === 'mailto') return { action: ACTIONS.EMAIL };
    if (scheme === 'whatsapp') return { action: ACTIONS.WHATSAPP };

    let url;
    try {
        url = new URL(href, window.location.href);
    } catch {
        return null;
    }

    if (anchor.hasAttribute('download') || /\.pdf$/i.test(url.pathname) || /\/reports\/[^/]+\/download$/.test(url.pathname)) {
        return { action: ACTIONS.DOWNLOAD };
    }

    if (url.origin !== window.location.origin) {
        const host = url.hostname.toLowerCase();
        if (WHATSAPP_HOST.test(host)) return { action: ACTIONS.WHATSAPP };
        if (MAP_HOST.test(host) || (/(^|\.)google\.[a-z.]+$/.test(host) && url.pathname.startsWith('/maps'))) {
            return { action: ACTIONS.MAP };
        }
        return null;
    }

    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (path === '/loan-application') return { action: ACTIONS.LOAN_APPLICATION, target: path };
    if (path === '/contact') return { action: ACTIONS.CONTACT, target: path };
    if (/^\/products\/[^/]+(\/[^/]+)?$/.test(path)) return { action: ACTIONS.PRODUCT, target: path };
    if (/^\/blogs\/[^/]+$/.test(path)) return { action: ACTIONS.BLOG_READ, target: path };
    if (path === '/career' || path.startsWith('/career/jobs/') || path.startsWith('/apply-job/')) {
        return { action: ACTIONS.CAREER, target: path };
    }
    return null;
};

// Same-origin route path of an href, or '' for anything external.
function internalPath(href) {
    try {
        const url = new URL(href, window.location.href);
        return url.origin === window.location.origin ? url.pathname : '';
    } catch {
        return '';
    }
}

export const SESSION_TIMEOUT = SESSION_TIMEOUT_MS;
