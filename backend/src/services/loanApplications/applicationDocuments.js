const fs = require('fs');
const path = require('path');
const { HeadObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const env = require('../../config/env');
const s3Client = require('../../config/s3');

// The documents an applicant can upload with a loan application, where each
// one is stored, and whether it is there.
//
// An application records each document only as the address multer stored it
// at — the S3 object URL in production, the disk path on a local install.
// That address is trusted only when it points inside this application's own
// storage, under loan-documents/: anything else is reported as unrecognised
// and is never fetched. Nothing here builds a public link to a document;
// files are read with the server's own credentials and streamed to signed-in
// staff (GET /api/loan-application/:id/documents/:type).

const FOLDER = 'loan-documents';
const CHECK_TIMEOUT_MS = 5000;

// In form order. `upload` is the multipart field name, `field` the model
// column holding the stored address, `type` the stable key used in URLs.
const DOCUMENT_TYPES = [
    { type: 'aadhaar', upload: 'aadhaarDoc', field: 'aadhaarCardUrl', label: 'Aadhaar Card' },
    { type: 'pan', upload: 'panDoc', field: 'panCardUrl', label: 'PAN Card' },
    { type: 'bank-statement', upload: 'bankStatementDoc', field: 'bankStatementUrl', label: 'Bank Statement' },
    { type: 'business-proof', upload: 'businessProofDoc', field: 'businessProofUrl', label: 'Business Proof' }
];
const BY_TYPE = new Map(DOCUMENT_TYPES.map((d) => [d.type, d]));

// Types the upload middleware accepts for loan documents. Only these are
// served, and only those a browser renders safely are served inline.
const CONTENT_TYPES = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
};
const INLINE = new Set(['pdf', 'jpg', 'jpeg', 'png', 'webp', 'gif']);

// A filename fit to show in an email or a page header: the last path segment
// only, no control or bidirectional-override characters, bounded length.
const sanitizeFilename = (name) => {
    const base = String(name ?? '').split(/[\\/]/).pop()
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u001F\u007F‪-‮⁦-⁩]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!base) return '';
    if (base.length <= 150) return base;
    const ext = path.extname(base).slice(0, 10);
    return `${base.slice(0, 150 - ext.length - 1)}…${ext}`;
};

const extensionOf = (name) => path.extname(String(name || '')).slice(1).toLowerCase();

const s3Configured = () => !!(env.AWS_S3_BUCKET_NAME && env.AWS_ACCESS_KEY_ID);

const uploadsRoot = path.join(__dirname, '..', '..', 'uploads');
const localFolder = path.join(uploadsRoot, FOLDER);

// The S3 key inside our bucket for a stored object URL, or null. Accepts the
// virtual-hosted and path-style addresses multer-s3 produces, and
// AWS_S3_BASE_URL when one is configured.
const s3KeyOf = (stored) => {
    let url;
    try { url = new URL(stored); } catch { return null; }
    if (url.protocol !== 'https:' || url.search || url.hash) return null;
    const bucket = env.AWS_S3_BUCKET_NAME;
    let keyPath = null;
    const host = url.hostname.toLowerCase();
    if (host === `${bucket}.s3.amazonaws.com` || (host.startsWith(`${bucket}.s3.`) && host.endsWith('.amazonaws.com'))) {
        keyPath = url.pathname;
    } else if (/^s3([.-][a-z0-9-]+)?\.amazonaws\.com$/.test(host) && url.pathname.startsWith(`/${bucket}/`)) {
        keyPath = url.pathname.slice(bucket.length + 1);
    } else if (env.AWS_S3_BASE_URL) {
        try {
            const base = new URL(env.AWS_S3_BASE_URL);
            const prefix = base.pathname.replace(/\/+$/, '');
            if (base.host === url.host && url.pathname.startsWith(`${prefix}/`)) keyPath = url.pathname.slice(prefix.length);
        } catch { /* not configured usefully */ }
    }
    if (!keyPath) return null;
    let key;
    try { key = decodeURIComponent(keyPath.replace(/^\/+/, '')); } catch { return null; }
    if (!key.startsWith(`${FOLDER}/`) || key.includes('..') || key.includes('\\')) return null;
    return key;
};

// Where a stored address lives: { kind: 's3', key } or { kind: 'local', file },
// or null when it is not inside this application's loan-documents storage.
const locate = (stored) => {
    if (!stored || typeof stored !== 'string') return null;
    if (s3Configured()) {
        const key = s3KeyOf(stored);
        return key ? { kind: 's3', key } : null;
    }
    // Local installs store multer's disk path (absolute), or occasionally an
    // /uploads/... URL; both must resolve inside uploads/loan-documents.
    const candidate = stored.startsWith('/uploads/')
        ? path.resolve(uploadsRoot, stored.slice('/uploads/'.length))
        : path.resolve(stored);
    return candidate.startsWith(localFolder + path.sep) ? { kind: 'local', file: candidate } : null;
};

// The stored file's own name (the generated one), for applications that
// predate original-filename recording.
const storedNameOf = (stored) => {
    if (!stored) return '';
    try {
        if (/^https?:\/\//i.test(stored)) return sanitizeFilename(decodeURIComponent(new URL(stored).pathname.split('/').pop()));
    } catch { /* fall through */ }
    return sanitizeFilename(stored);
};

// available | missing | unchecked (storage could not be asked in time).
const checkAvailability = async (location) => {
    if (location.kind === 'local') return fs.existsSync(location.file) ? 'available' : 'missing';
    try {
        await s3Client.send(
            new HeadObjectCommand({ Bucket: env.AWS_S3_BUCKET_NAME, Key: location.key }),
            { abortSignal: AbortSignal.timeout(CHECK_TIMEOUT_MS) }
        );
        return 'available';
    } catch (err) {
        const status = err?.$metadata?.httpStatusCode;
        if (err?.name === 'NotFound' || err?.name === 'NoSuchKey' || status === 404) return 'missing';
        return 'unchecked';
    }
};

// Every document slot for an application, with what is known about it:
//
//   available     recorded and present in storage
//   missing       recorded, but the file is no longer in storage
//   unrecognised  recorded at an address outside this app's document storage
//   unchecked     recorded; storage could not be asked (shown as unverified)
//   not_provided  the applicant did not upload this document
//
// `check: false` skips the storage round-trips (status then reports
// `recorded` for anything stored), for places that only need the list.
const describeDocuments = async (application, { check = true } = {}) => {
    const files = application.documentFiles instanceof Map
        ? Object.fromEntries(application.documentFiles)
        : (application.documentFiles || {});
    return Promise.all(DOCUMENT_TYPES.map(async (d) => {
        const stored = application[d.field];
        const meta = files[d.field] || {};
        const base = { type: d.type, label: d.label };
        if (!stored) return { ...base, status: 'not_provided', fileName: '', fileType: '', size: null };
        const fileName = sanitizeFilename(meta.originalName) || storedNameOf(stored);
        const ext = extensionOf(meta.originalName || storedNameOf(stored));
        const doc = { ...base, fileName, fileType: ext ? ext.toUpperCase() : '', size: typeof meta.size === 'number' ? meta.size : null };
        const location = locate(stored);
        if (!location) return { ...doc, status: 'unrecognised' };
        if (!check) return { ...doc, status: 'recorded' };
        return { ...doc, status: await checkAvailability(location) };
    }));
};

// Opens a document for streaming to a signed-in admin. Returns null when the
// application has no such document or it is not in our storage.
const openDocument = async (application, type) => {
    const def = BY_TYPE.get(type);
    if (!def) return null;
    const stored = application[def.field];
    const location = locate(stored);
    if (!location) return null;

    const files = application.documentFiles instanceof Map ? Object.fromEntries(application.documentFiles) : (application.documentFiles || {});
    const originalName = sanitizeFilename(files[def.field]?.originalName) || storedNameOf(stored);
    const ext = extensionOf(location.kind === 's3' ? location.key : location.file);
    const contentType = CONTENT_TYPES[ext];
    if (!contentType) return null;
    const meta = { fileName: originalName, contentType, inline: INLINE.has(ext) };

    if (location.kind === 'local') {
        if (!fs.existsSync(location.file)) return { missing: true };
        return { ...meta, length: fs.statSync(location.file).size, stream: fs.createReadStream(location.file) };
    }
    try {
        const object = await s3Client.send(new GetObjectCommand({ Bucket: env.AWS_S3_BUCKET_NAME, Key: location.key }));
        return { ...meta, length: object.ContentLength || null, stream: object.Body };
    } catch (err) {
        if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) return { missing: true };
        throw err;
    }
};

// Busboy (under multer) decodes multipart filenames as Latin-1, so a UTF-8
// name — "स्टेटमेंट.pdf" — arrives as mojibake. Re-reading those bytes as
// UTF-8 restores it; a name that does not decode cleanly is left as it came.
// Only the recorded display name is repaired: storage keys are unaffected.
const repairFilename = (name) => {
    const raw = String(name ?? '');
    if (!/[\u0080-ÿ]/.test(raw) || /[^\u0000-ÿ]/.test(raw)) return raw;
    const utf8 = Buffer.from(raw, 'latin1').toString('utf8');
    return utf8.includes('�') ? raw : utf8;
};

// What to record for each uploaded file at submission.
const fileMetaOf = (file) => ({
    originalName: sanitizeFilename(repairFilename(file.originalname)),
    size: typeof file.size === 'number' ? file.size : undefined,
    mimeType: String(file.mimetype || '').slice(0, 100)
});

module.exports = {
    DOCUMENT_TYPES,
    FOLDER,
    sanitizeFilename,
    locate,
    describeDocuments,
    openDocument,
    fileMetaOf
};
