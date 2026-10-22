const files = require('../storage/privateFiles');

// The documents an applicant can upload with a loan application, where each
// one is stored, and whether it is there. Storage resolution, reading and the
// response headers are shared with job applicants' CVs (storage/privateFiles):
// an address is trusted only inside loan-documents/ of this app's own storage,
// and documents reach signed-in staff only through
// GET /api/loan-application/:id/documents/:type.

const FOLDER = 'loan-documents';

// In form order. `upload` is the multipart field name, `field` the model
// column holding the stored address, `type` the stable key used in URLs.
const DOCUMENT_TYPES = [
    { type: 'aadhaar', upload: 'aadhaarDoc', field: 'aadhaarCardUrl', label: 'Aadhaar Card' },
    { type: 'pan', upload: 'panDoc', field: 'panCardUrl', label: 'PAN Card' },
    { type: 'bank-statement', upload: 'bankStatementDoc', field: 'bankStatementUrl', label: 'Bank Statement' },
    { type: 'business-proof', upload: 'businessProofDoc', field: 'businessProofUrl', label: 'Business Proof' }
];
const BY_TYPE = new Map(DOCUMENT_TYPES.map((d) => [d.type, d]));

const locate = (stored) => files.locate(stored, FOLDER);

const metaOf = (application) => (application.documentFiles instanceof Map
    ? Object.fromEntries(application.documentFiles)
    : (application.documentFiles || {}));

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
    const meta = metaOf(application);
    return Promise.all(DOCUMENT_TYPES.map(async (d) => {
        const stored = application[d.field];
        const m = meta[d.field] || {};
        const base = { type: d.type, label: d.label };
        if (!stored) return { ...base, status: 'not_provided', fileName: '', fileType: '', size: null };
        const fileName = files.sanitizeFilename(m.originalName) || files.storedNameOf(stored);
        const ext = files.extensionOf(m.originalName || files.storedNameOf(stored));
        const doc = { ...base, fileName, fileType: ext ? ext.toUpperCase() : '', size: typeof m.size === 'number' ? m.size : null };
        const location = locate(stored);
        if (!location) return { ...doc, status: 'unrecognised' };
        if (!check) return { ...doc, status: 'recorded' };
        return { ...doc, status: await files.checkAvailability(location) };
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
    const name = files.sanitizeFilename(metaOf(application)[def.field]?.originalName) || files.storedNameOf(stored);
    return files.openLocated(location, name);
};

// What to record for each uploaded file at submission.
const fileMetaOf = (file) => ({
    originalName: files.originalNameOf(file),
    size: typeof file.size === 'number' ? file.size : undefined,
    mimeType: String(file.mimetype || '').slice(0, 100)
});

module.exports = {
    DOCUMENT_TYPES,
    FOLDER,
    sanitizeFilename: files.sanitizeFilename,
    locate,
    describeDocuments,
    openDocument,
    fileMetaOf
};
