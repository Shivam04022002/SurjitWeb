const env = require('../../config/env');
const LoanApplication = require('../../models/LoanApplication');
const { DOCUMENT_TYPES } = require('./applicationDocuments');

// Every field of a saved loan application, labelled, formatted and grouped for
// staff — the one description used by the "New Loan Application Received"
// email and by the Email Delivery Log.
//
// The known fields are listed below in form order. Any other field the
// LoanApplication schema holds (one added to the form later) is not dropped:
// it appears under "Other details" with a label made from its name, unless it
// is internal (ids, audit trail, staff notes, document storage). So the email
// never silently loses a field the applicant filled in.
//
// Two values are never shown in full: PAN and Aadhaar are masked to their
// last four characters — enough to match a call or a document, not enough to
// reuse. Document addresses never appear at all; documents are described by
// type, name and status, and opened only through the signed-in CMS.

const MAX_VALUE_LENGTH = 2000;
const NOT_PROVIDED = 'Not provided';

const LOAN_TYPE_LABELS = {
    business: 'Business Loan',
    vehicle: 'Commercial Vehicle Loan',
    lap: 'Loan Against Property'
};
const EMPLOYMENT_LABELS = { 'self-employed': 'Self-employed', 'business-owner': 'Business owner', salaried: 'Salaried' };
const GENDER_LABELS = { male: 'Male', female: 'Female', other: 'Other' };
const STATUS_LABELS = { pending: 'Pending', 'under-review': 'Under review', approved: 'Approved', rejected: 'Rejected' };

// ── Formatting ────────────────────────────────────────────────────────────────

const truncate = (text) => (text.length > MAX_VALUE_LENGTH ? `${text.slice(0, MAX_VALUE_LENGTH - 1)}…` : text);

const formatDateTime = (date) => new Intl.DateTimeFormat('en-IN', {
    timeZone: env.ANALYTICS_TIMEZONE,
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
}).format(new Date(date));

// A date of birth is a calendar date: shown as stored (UTC), not shifted.
const formatDate = (date) => new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date));

const formatRupees = (n) => (Number.isFinite(Number(n)) ? `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '');

const maskTail = (value, keep, groupTo) => {
    const s = String(value ?? '').replace(/\s+/g, '');
    if (!s) return '';
    if (s.length <= keep) return 'X'.repeat(s.length);
    const masked = 'X'.repeat(s.length - keep) + s.slice(-keep);
    return groupTo ? masked.replace(/(.{4})(?=.)/g, '$1 ') : masked;
};
// XXXX XXXX 1234 — the masked form UIDAI itself uses.
const maskAadhaar = (v) => maskTail(v, 4, true);
const maskPan = (v) => maskTail(v, 4, false);

// "workExperience" → "Work experience"; "address.line2" → "Address line 2".
const humanize = (name) => String(name)
    .replace(/\./g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([a-zA-Z])([0-9])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());

// Any value as one line of display text (objects and arrays flattened).
const formatGeneric = (value) => {
    if (value === null || value === undefined || value === '') return '';
    if (value instanceof Date) return formatDateTime(value);
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (Array.isArray(value)) return value.map(formatGeneric).filter(Boolean).join(', ');
    if (value instanceof Map) return formatGeneric(Object.fromEntries(value));
    if (typeof value === 'object') {
        if (value._bsontype === 'ObjectId' || value._bsontype === 'ObjectID') return String(value);
        return Object.entries(value).map(([k, v]) => `${humanize(k)}: ${formatGeneric(v) || NOT_PROVIDED}`).join('; ');
    }
    return String(value);
};

// ── The known fields ──────────────────────────────────────────────────────────

const SECTIONS = [
    {
        id: 'applicant',
        title: 'Applicant information',
        fields: [
            { path: 'fullName', label: 'Full name' },
            { path: 'phone', label: 'Mobile number' },
            { path: 'email', label: 'Email address' },
            { path: 'dob', label: 'Date of birth', format: formatDate },
            { path: 'gender', label: 'Gender', format: (v) => GENDER_LABELS[v] || v },
            { path: 'pan', label: 'PAN (masked)', format: maskPan },
            { path: 'aadhaar', label: 'Aadhaar (masked)', format: maskAadhaar },
            { path: 'address', label: 'Address' },
            { path: 'city', label: 'City' },
            { path: 'state', label: 'State' },
            { path: 'pincode', label: 'PIN code' }
        ]
    },
    {
        id: 'loan',
        title: 'Loan details',
        fields: [
            { path: 'loanType', label: 'Loan type', format: (v) => LOAN_TYPE_LABELS[v] || v },
            { path: 'loanAmount', label: 'Requested amount', format: formatRupees },
            { path: 'tenure', label: 'Requested tenure', format: (v) => `${v} month${Number(v) === 1 ? '' : 's'}` },
            { path: 'loanPurpose', label: 'Purpose of loan' }
        ]
    },
    {
        id: 'employment',
        title: 'Employment and income',
        fields: [
            { path: 'employmentType', label: 'Employment type', format: (v) => EMPLOYMENT_LABELS[v] || v },
            { path: 'businessName', label: 'Business / company name' },
            { path: 'businessType', label: 'Business type' },
            { path: 'monthlyIncome', label: 'Monthly income', format: formatRupees },
            { path: 'workExperience', label: 'Work experience' }
        ]
    },
    {
        id: 'consent',
        title: 'Consent',
        fields: [
            { path: 'consentAccepted', label: 'Terms accepted', format: (v, app) => (v ? `Yes${app.consentAcceptedAt ? ` (${formatDateTime(app.consentAcceptedAt)})` : ''}` : 'No') }
        ]
    }
];

// Paths that are never shown as fields: identity, audit, staff-only notes,
// and document storage (documents have their own section).
const INTERNAL = new Set([
    '_id', '__v', 'id', 'product', 'applicationNumber', 'status', 'statusHistory', 'notes',
    'deletedAt', 'createdAt', 'updatedAt', 'consentAcceptedAt', 'documentFiles',
    ...DOCUMENT_TYPES.map((d) => d.field)
]);
const KNOWN = new Set(SECTIONS.flatMap((s) => s.fields.map((f) => f.path)));

const valueAt = (doc, p) => (typeof doc.get === 'function' ? doc.get(p) : p.split('.').reduce((o, k) => (o == null ? o : o[k]), doc));

const rowOf = (app, field) => {
    const raw = valueAt(app, field.path);
    const empty = raw === undefined || raw === null || raw === '';
    const text = empty ? '' : String(field.format ? field.format(raw, app) : formatGeneric(raw));
    return { key: field.path, label: field.label, value: text ? truncate(text) : NOT_PROVIDED, provided: !!text };
};

// Schema paths not in the list above — a later addition to the form.
const otherPaths = () => {
    const paths = [];
    LoanApplication.schema.eachPath((p) => {
        const top = p.split('.')[0];
        if (INTERNAL.has(top) || KNOWN.has(p) || INTERNAL.has(p) || p.includes('.$')) return;
        paths.push(p);
    });
    return paths;
};

// ── Product ───────────────────────────────────────────────────────────────────

// The product as the applicant chose it. `application.product` populated with
// a name means the product record still exists; an id with no record means it
// was deleted since; null means none was chosen (the generic Apply form, or an
// application from before products were recorded).
const productOf = (application) => {
    const typeLabel = LOAN_TYPE_LABELS[application.loanType] || humanize(application.loanType || '') || 'Loan';
    const p = application.product;
    if (p && typeof p === 'object' && p.name) {
        return { name: p.name, label: p.name, recorded: true, available: true, typeLabel };
    }
    if (p) return { name: '', label: `${typeLabel} (selected product no longer exists)`, recorded: true, available: false, typeLabel };
    return { name: '', label: `${typeLabel} (no specific product selected)`, recorded: false, available: false, typeLabel };
};

// ── Description ───────────────────────────────────────────────────────────────

// The whole application for staff: summary, the field sections (plus "Other
// details" when the schema holds fields not listed above), and the product.
const describeApplication = (application) => {
    const product = productOf(application);
    const summary = [
        { key: 'applicationNumber', label: 'Application number', value: application.applicationNumber || NOT_PROVIDED },
        { key: 'product', label: 'Loan product', value: product.label },
        ...(product.name ? [{ key: 'loanCategory', label: 'Loan category', value: product.typeLabel }] : []),
        { key: 'submittedAt', label: 'Submitted', value: application.createdAt ? formatDateTime(application.createdAt) : NOT_PROVIDED },
        { key: 'loanAmount', label: 'Requested amount', value: formatRupees(application.loanAmount) || NOT_PROVIDED },
        { key: 'tenure', label: 'Requested tenure', value: application.tenure ? `${application.tenure} months` : NOT_PROVIDED },
        { key: 'status', label: 'Application status', value: STATUS_LABELS[application.status] || application.status || NOT_PROVIDED }
    ];

    const sections = SECTIONS.map((s) => ({ id: s.id, title: s.title, rows: s.fields.map((f) => rowOf(application, f)) }));
    const other = otherPaths()
        .map((p) => rowOf(application, { path: p, label: humanize(p) }))
        .filter((r) => r.provided);
    if (other.length) sections.push({ id: 'other', title: 'Other details', rows: other });

    return { summary, sections, product };
};

// The field labels represented in a description, for the delivery record.
const fieldKeysOf = (description) => [
    ...description.summary.map((r) => r.key),
    ...description.sections.flatMap((s) => s.rows.map((r) => r.key))
];

module.exports = {
    LOAN_TYPE_LABELS,
    NOT_PROVIDED,
    MAX_VALUE_LENGTH,
    maskAadhaar,
    maskPan,
    humanize,
    formatDateTime,
    productOf,
    describeApplication,
    fieldKeysOf
};
