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

// Fire-and-forget. Analytics must never delay a page or surface an error to a
// visitor, so failures are swallowed deliberately.
export const trackPageView = (pathname) => {
    const base = import.meta.env.VITE_API_URL;
    if (!base) return;

    const session = currentSession();
    const body = JSON.stringify({
        sessionId: session.id,
        path: cleanPath(pathname),
        referrer: document.referrer || '',
        sessionStartedAt: new Date(session.startedAt).toISOString()
    });

    try {
        fetch(`${base}/public/analytics/track`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
            keepalive: true
        }).catch(() => {});
    } catch {
        // ignored on purpose
    }
};

export const SESSION_TIMEOUT = SESSION_TIMEOUT_MS;
