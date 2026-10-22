const fs = require('fs');
const path = require('path');
const { HeadObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const env = require('../../config/env');
const s3Client = require('../../config/s3');

// Private files held in the CMS's own storage — loan documents and job
// applicants' CVs — and how the server reads them for signed-in staff.
//
// A record stores only the address multer gave the upload: the S3 object URL
// in production, a disk path or /uploads/... URL on a local install. That
// address is trusted only when it resolves inside the expected folder of this
// application's own storage (`loan-documents/`, `resumes/`); anything else —
// another bucket, another folder, a crafted URL — is treated as not ours and
// is never read. Nothing here builds a public link: files are read with the
// server's credentials and streamed by the routes that check permissions.

const CHECK_TIMEOUT_MS = 5000;

// Types the upload middleware accepts for private documents. Only these are
// served; only those a browser renders safely open inline.
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

// A filename fit to show or send in a header: the last path segment only, no
// control or bidirectional-override characters, bounded length.
const sanitizeFilename = (name) => {
    const base = String(name ?? '').split(/[\\/]/).pop()
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!base) return '';
    if (base.length <= 150) return base;
    const ext = path.extname(base).slice(0, 10);
    return `${base.slice(0, 150 - ext.length - 1)}…${ext}`;
};

// Busboy (under multer) decodes multipart filenames as Latin-1, so a UTF-8
// name — "स्टेटमेंट.pdf" — arrives as mojibake. Re-reading those bytes as
// UTF-8 restores it; a name that does not decode cleanly is left as it came.
const repairFilename = (name) => {
    const raw = String(name ?? '');
    if (!/[\u0080-\u00FF]/.test(raw) || /[^\u0000-\u00FF]/.test(raw)) return raw;
    const utf8 = Buffer.from(raw, 'latin1').toString('utf8');
    return utf8.includes('\uFFFD') ? raw : utf8;
};

// The original name of an uploaded file, as recorded for display.
const originalNameOf = (file) => sanitizeFilename(repairFilename(file?.originalname));

const extensionOf = (name) => path.extname(String(name || '')).slice(1).toLowerCase();

const s3Configured = () => !!(env.AWS_S3_BUCKET_NAME && env.AWS_ACCESS_KEY_ID);

const uploadsRoot = path.join(__dirname, '..', '..', 'uploads');

// The S3 key inside our bucket and `folder` for a stored object URL, or null.
// Accepts the virtual-hosted and path-style addresses multer-s3 produces, and
// AWS_S3_BASE_URL when one is configured.
const s3KeyOf = (stored, folder) => {
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
    if (!key.startsWith(`${folder}/`) || key.includes('..') || key.includes('\\')) return null;
    return key;
};

// Where a stored address lives — { kind: 's3', key } or { kind: 'local',
// file } — or null when it is not inside `folder` of this app's storage.
const locate = (stored, folder) => {
    if (!stored || typeof stored !== 'string' || !folder) return null;
    if (s3Configured()) {
        const key = s3KeyOf(stored, folder);
        return key ? { kind: 's3', key } : null;
    }
    const local = path.join(uploadsRoot, folder);
    const candidate = stored.startsWith('/uploads/')
        ? path.resolve(uploadsRoot, stored.slice('/uploads/'.length))
        : path.resolve(stored);
    return candidate.startsWith(local + path.sep) ? { kind: 'local', file: candidate } : null;
};

// The stored file's own (generated) name, for records without an original.
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

// Opens a located file for streaming. `displayName` is what the download is
// called. Returns null for a type that is not served, { missing: true } when
// the file is gone, otherwise { stream, length, contentType, inline, fileName }.
// The content type comes from the stored file's own extension — never from
// the request or the original upload's claimed type.
const openLocated = async (location, displayName) => {
    const ext = extensionOf(location.kind === 's3' ? location.key : location.file);
    const contentType = CONTENT_TYPES[ext];
    if (!contentType) return null;
    const meta = { fileName: sanitizeFilename(displayName) || `document.${ext}`, contentType, inline: INLINE.has(ext) };

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

// Sends an opened file with the headers every private document gets: its own
// type, an RFC 6266 filename (ASCII fallback plus UTF-8), never cached, never
// sniffed, and sandboxed so nothing in it can run or reach anything.
const sendOpenedFile = (res, file) => {
    const ascii = file.fileName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_') || 'document';
    res.set({
        'Content-Type': file.contentType,
        'Content-Disposition': `${file.inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
        'Cache-Control': 'no-store, private',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
        'Referrer-Policy': 'no-referrer'
    });
    if (file.length) res.set('Content-Length', String(file.length));
    file.stream.on('error', () => res.destroy());
    return file.stream.pipe(res);
};

module.exports = {
    CONTENT_TYPES,
    sanitizeFilename,
    repairFilename,
    originalNameOf,
    extensionOf,
    locate,
    storedNameOf,
    checkAvailability,
    openLocated,
    sendOpenedFile
};
