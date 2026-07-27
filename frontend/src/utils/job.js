// ─────────────────────────────────────────────────────────────────────────────
// Job opening helpers.
//
// The CMS stores a job with the exact field names declared on the JobOpening
// schema (jobTitle, fullDescription, skillsRequired, …). Every read of a job
// document on the public site goes through these helpers so the two pages that
// render one — the Career listing and the Job Details page — agree on the key
// names and on how a missing value is presented.
// ─────────────────────────────────────────────────────────────────────────────

export const NOT_SPECIFIED = 'Not Specified';

const EMPLOYMENT_TYPE_LABELS = {
    full_time: 'Full Time',
    part_time: 'Part Time',
    internship: 'Internship',
    contract: 'Contract',
};

/** A trimmed string, or null when the value is absent/blank. Never "undefined". */
export const toText = (value) => {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    return text.length ? text : null;
};

/** A clean array of non-blank strings. Tolerates a single string or null. */
export const toList = (value) => {
    if (Array.isArray(value)) return value.map(toText).filter(Boolean);
    const single = toText(value);
    return single ? [single] : [];
};

/** Location is a string on the schema; older records may hold an array. */
export const formatLocation = (value) => {
    const parts = toList(value);
    return parts.length ? parts.join(', ') : null;
};

export const formatEmploymentType = (value) => {
    const key = toText(value);
    if (!key) return null;
    return EMPLOYMENT_TYPE_LABELS[key] || key.replace(/_/g, ' ');
};

/** Vacancies is a positive Number on the schema; guard against 0/NaN/strings. */
export const formatVacancies = (value) => {
    const count = Number(value);
    if (!Number.isFinite(count) || count < 1) return null;
    return `${count} ${count === 1 ? 'Opening' : 'Openings'}`;
};

export const formatDate = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

/** True once the deadline day has fully passed, so the UI can mark it closed. */
export const isDeadlinePassed = (value) => {
    if (!value) return false;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    date.setHours(23, 59, 59, 999);
    return date.getTime() < Date.now();
};

/** Title used for headings and for the /apply-job/:jobTitle URL segment. */
export const jobTitleOf = (job) => toText(job?.jobTitle) || 'Open Position';

export const jobDetailPath = (job) => `/career/jobs/${job?._id}`;

export const jobApplyPath = (job) =>
    `/apply-job/${encodeURIComponent(jobTitleOf(job))}?jobId=${encodeURIComponent(job?._id || '')}`;
