// The CMS's pages, and the two things a role may be allowed to do with each:
// see it, or change it. Everything that decides access reads this file —
// controllers and routes name a permission, never a page or a role.
//
// The vocabulary is deliberately small. A page is one of:
//
//   none   the page does not exist for this role: hidden, and its API refuses
//   view   the page opens and reads; every mutation is refused
//   edit   the page opens and reads, and may be changed
//
// EDIT IMPLIES VIEW. A role granted `blogs.edit` holds `blogs.view` as well,
// and nothing anywhere needs to ask for both.

const LEVELS = {
    NONE: 'none',
    VIEW: 'view',
    EDIT: 'edit'
};

const LEVEL_ORDER = [LEVELS.NONE, LEVELS.VIEW, LEVELS.EDIT];

// The pages, as the sidebar groups them. `key` is what a permission is built
// from; `path` is the admin route it guards, which is what lets the CMS decide
// menu and routing from the same catalogue the API enforces.
const PAGES = [
    // ── About Us ──────────────────────────────────────────────────────────────
    { key: 'company', label: 'Company Info', module: 'About Us', path: '/about/company' },
    { key: 'directors', label: 'Board of Directors', module: 'About Us', path: '/about/directors' },
    { key: 'leadership', label: 'Leadership Team', module: 'About Us', path: '/about/leadership' },

    // ── Products ──────────────────────────────────────────────────────────────
    { key: 'productCategories', label: 'Product Categories', module: 'Products', path: '/products/categories' },
    { key: 'products', label: 'Products', module: 'Products', path: '/products' },

    // ── Career ────────────────────────────────────────────────────────────────
    { key: 'careerSettings', label: 'Career Settings', module: 'Career', path: '/career/settings' },
    { key: 'jobs', label: 'Job Openings', module: 'Career', path: '/career/jobs' },
    { key: 'jobApplications', label: 'Job Applications', module: 'Career', path: '/career/applications' },

    // ── Gallery ───────────────────────────────────────────────────────────────
    { key: 'gallery', label: 'Gallery Albums', module: 'Gallery', path: '/gallery/albums' },

    // ── Content ───────────────────────────────────────────────────────────────
    { key: 'blogs', label: 'Blogs', module: 'Content', path: '/blogs' },
    { key: 'blogCategories', label: 'Blog Categories', module: 'Content', path: '/blogs/categories' },
    { key: 'reviews', label: 'Customer Reviews', module: 'Content', path: '/reviews' },
    { key: 'reports', label: 'Annual Reports', module: 'Content', path: '/reports' },
    { key: 'branches', label: 'Branches', module: 'Content', path: '/branches' },
    { key: 'homepageStats', label: 'Homepage Statistics', module: 'Content', path: '/homepage-stats' },
    { key: 'legalPages', label: 'Legal Pages', module: 'Content', path: '/legal-pages' },
    { key: 'nodalOfficers', label: 'Nodal Officers', module: 'Content', path: '/nodal-officers' },
    { key: 'advertisements', label: 'Advertisements', module: 'Content', path: '/advertisements' },
    { key: 'geminiBlogs', label: 'Gemini Blogs', module: 'Content', path: '/gemini-blogs' },

    // ── Operations ────────────────────────────────────────────────────────────
    { key: 'loanApplications', label: 'Loan Applications', module: 'Operations', path: '/loan-applications' },
    { key: 'analytics', label: 'Website Analytics', module: 'Operations', path: '/analytics' },
    // API only, deliberately: enquiries from the website's contact form are
    // read through GET /api/contact, and the CMS has no page for them. `path`
    // is null so nothing tries to route to one — granting this permission
    // affects that endpoint alone.
    { key: 'contacts', label: 'Contact Enquiries (API only)', module: 'Operations', path: null },

    // ── Administration ────────────────────────────────────────────────────────
    { key: 'users', label: 'CMS Users', module: 'Administration', path: '/users' },
    { key: 'roles', label: 'Roles & Permissions', module: 'Administration', path: '/roles' },
    { key: 'settings', label: 'Global Settings', module: 'Administration', path: '/settings' },
    { key: 'integrations', label: 'API Settings', module: 'Administration', path: '/integrations/api' }
];

const PAGE_KEYS = PAGES.map((p) => p.key);
const PAGE_BY_KEY = new Map(PAGES.map((p) => [p.key, p]));

const viewPermission = (pageKey) => `${pageKey}.${LEVELS.VIEW}`;
const editPermission = (pageKey) => `${pageKey}.${LEVELS.EDIT}`;

// Every permission this application recognises. A key outside this set is a
// typo or a stale reference, and is refused rather than quietly ignored.
const ALL_PERMISSIONS = PAGES.flatMap((p) => [viewPermission(p.key), editPermission(p.key)]);
const PERMISSION_SET = new Set(ALL_PERMISSIONS);

const isPermission = (key) => PERMISSION_SET.has(key);

const parsePermission = (key) => {
    const [pageKey, level] = String(key || '').split('.');
    if (!PAGE_BY_KEY.has(pageKey)) return null;
    if (level !== LEVELS.VIEW && level !== LEVELS.EDIT) return null;
    return { pageKey, level };
};

// A page's access level expanded into the permissions actually stored. This is
// the one place "edit implies view" is decided, so no caller can grant an edit
// without the view that must accompany it.
const permissionsForLevel = (pageKey, level) => {
    if (level === LEVELS.EDIT) return [viewPermission(pageKey), editPermission(pageKey)];
    if (level === LEVELS.VIEW) return [viewPermission(pageKey)];
    return [];
};

// The inverse: what a stored permission list means, page by page. An edit
// without its view is read back as edit rather than as a contradiction — the
// stored data cannot express "may change but may not see".
const levelsFromPermissions = (permissions = []) => {
    const held = new Set(permissions);
    const levels = {};
    for (const page of PAGES) {
        if (held.has(editPermission(page.key))) levels[page.key] = LEVELS.EDIT;
        else if (held.has(viewPermission(page.key))) levels[page.key] = LEVELS.VIEW;
        else levels[page.key] = LEVELS.NONE;
    }
    return levels;
};

// A page map ({ blogs: 'edit', reviews: 'view' }) turned into the permission
// list a role stores. Unknown pages and unknown levels are the caller's error
// and are reported, not dropped.
const permissionsFromLevels = (levels = {}) => {
    const permissions = new Set();
    const invalidPages = [];
    const invalidLevels = [];

    for (const [pageKey, level] of Object.entries(levels)) {
        if (!PAGE_BY_KEY.has(pageKey)) { invalidPages.push(pageKey); continue; }
        if (!LEVEL_ORDER.includes(level)) { invalidLevels.push(`${pageKey}: ${level}`); continue; }
        for (const permission of permissionsForLevel(pageKey, level)) permissions.add(permission);
    }

    return { permissions: [...permissions], invalidPages, invalidLevels };
};

// Normalises whatever is stored: drops anything unrecognised, and adds the
// view that an edit implies, so a permission check never has to reason about
// either case.
const normalisePermissions = (permissions = []) => {
    const out = new Set();
    for (const key of permissions) {
        const parsed = parsePermission(key);
        if (!parsed) continue;
        for (const permission of permissionsForLevel(parsed.pageKey, parsed.level)) out.add(permission);
    }
    return [...out].sort();
};

// Every page at one level — how the system roles below are described, and what
// "select all" in the CMS means.
const everyPageAt = (level) => Object.fromEntries(PAGE_KEYS.map((key) => [key, level]));

module.exports = {
    LEVELS,
    LEVEL_ORDER,
    PAGES,
    PAGE_KEYS,
    PAGE_BY_KEY,
    ALL_PERMISSIONS,
    viewPermission,
    editPermission,
    isPermission,
    parsePermission,
    permissionsForLevel,
    levelsFromPermissions,
    permissionsFromLevels,
    normalisePermissions,
    everyPageAt
};
