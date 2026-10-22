const crypto = require('crypto');
const env = require('../../config/env');
const { describeApplication } = require('../loanApplications/applicationFields');

// The "New Loan Application Received" email, in HTML with a plain-text
// alternative, and the MIME message that carries both.
//
// It is a staff notification with everything needed to start work on the
// application: the summary, the selected product, every field the applicant
// submitted (applicationFields decides the list, so a field added to the form
// later still appears), and the status of each document.
//
// What it deliberately does not carry: PAN and Aadhaar in full (masked to the
// last four), document files or their storage addresses (the bucket that
// holds them is not private, so an address in an email would be a permanent
// public link), and any token, credential or session data. Documents are
// opened from the application in the CMS, behind its login and its Loan
// Applications permission; the email links there, built only from
// ADMIN_PANEL_URL and the application's own id — never from submitted data.

const BASE_SUBJECT = 'New Loan Application Received';
// Recorded on each delivery record, so the log can tell which layout was sent.
const TEMPLATE_VERSION = 'loan-application/v2';
const BRAND = '#1a237e';
const MAX_SUBJECT = 200;

const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Kept for compatibility: the submission time in the business timezone.
const formatSubmitted = (date) => new Intl.DateTimeFormat('en-IN', {
    timeZone: env.ANALYTICS_TIMEZONE,
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
}).format(new Date(date));

// The CMS address under ADMIN_PANEL_URL, or null. Only http(s) is used;
// anything else is treated as unset rather than put into an email.
const adminBase = (base = env.ADMIN_PANEL_URL) => {
    if (!base) return null;
    try {
        const url = new URL(base);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
        url.search = '';
        url.hash = '';
        return url;
    } catch {
        return null;
    }
};

// The Loan Applications page.
const adminApplicationsUrl = (base = env.ADMIN_PANEL_URL) => {
    const url = adminBase(base);
    if (!url) return null;
    url.pathname = `${url.pathname.replace(/\/+$/, '')}/loan-applications`;
    return url.toString();
};

// The application itself, opened in the Loan Applications page. The id is the
// database id (24 hex characters), checked here so nothing else can be used.
const adminApplicationUrl = (applicationId, base = env.ADMIN_PANEL_URL) => {
    const list = adminApplicationsUrl(base);
    const id = String(applicationId ?? '');
    if (!list || !/^[a-f0-9]{24}$/i.test(id)) return list;
    const url = new URL(list);
    url.searchParams.set('application', id);
    return url.toString();
};

// One line, printable, bounded — a subject is a header and must never carry
// a line break, whatever a product name contains.
const subjectOf = (description, application) => {
    const product = description.product.name || description.product.typeLabel;
    const parts = [BASE_SUBJECT, product, application.applicationNumber].filter(Boolean);
    // eslint-disable-next-line no-control-regex
    const clean = parts.join(' – ').replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/\s+/g, ' ').trim();
    return clean.length > MAX_SUBJECT ? `${clean.slice(0, MAX_SUBJECT - 1)}…` : clean;
};

// ── Documents ─────────────────────────────────────────────────────────────────

const DOCUMENT_STATUS_TEXT = {
    available: 'Received',
    recorded: 'Received',
    missing: 'Recorded, but the file is missing from storage',
    unrecognised: 'Recorded, but not held in the CMS document storage',
    unchecked: 'Recorded; could not be verified when this email was prepared',
    not_provided: 'Not attached'
};
const DOCUMENT_STATUS_COLOR = {
    available: '#137333', recorded: '#137333', missing: '#b3261e', unrecognised: '#b3261e', unchecked: '#b06000', not_provided: '#5f6368'
};

const documentStatusText = (status) => DOCUMENT_STATUS_TEXT[status] || status;

// ── Rendering ─────────────────────────────────────────────────────────────────

const cell = 'padding:8px 12px;border-bottom:1px solid #eeeeee;vertical-align:top;font-size:14px;line-height:20px';

const rowsHtml = (rows) => rows.map((r) => (
    `<tr><td width="38%" style="${cell};color:#5f6368">${escapeHtml(r.label)}</td>`
    + `<td style="${cell};color:${r.provided === false ? '#80868b' : '#202124'};word-break:break-word">${escapeHtml(r.value).replace(/\n/g, '<br>')}</td></tr>`
)).join('');

const sectionHtml = (title, inner) => (
    `<tr><td style="padding:20px 24px 0"><h2 style="margin:0 0 8px;font-size:16px;line-height:22px;color:${BRAND}">${escapeHtml(title)}</h2>`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #eeeeee">${inner}</table></td></tr>`
);

const documentsHtml = (documents, appUrl) => {
    if (!documents.some((d) => d.status !== 'not_provided')) {
        return `<tr><td style="${cell};color:#5f6368">No documents were attached to this application.</td></tr>`;
    }
    return documents.map((d) => {
        const file = d.fileName ? `${escapeHtml(d.fileName)}${d.fileType ? ` <span style="color:#80868b">(${escapeHtml(d.fileType)})</span>` : ''}` : '<span style="color:#80868b">—</span>';
        const open = (d.status === 'available' || d.status === 'recorded') && appUrl
            ? `<br><a href="${escapeHtml(appUrl)}" style="color:${BRAND}">Open in the CMS</a>`
            : '';
        return `<tr><td width="38%" style="${cell};color:#5f6368">${escapeHtml(d.label)}</td>`
            + `<td style="${cell};word-break:break-word">${file}<br><span style="color:${DOCUMENT_STATUS_COLOR[d.status] || '#5f6368'};font-weight:600">${escapeHtml(documentStatusText(d.status))}</span>${open}</td></tr>`;
    }).join('');
};

const documentsText = (documents) => (documents.some((d) => d.status !== 'not_provided')
    ? documents.map((d) => `- ${d.label}: ${d.fileName ? `${d.fileName} — ` : ''}${documentStatusText(d.status)}`)
    : ['No documents were attached to this application.']);

// The email for one saved application. `documents` comes from
// applicationDocuments.describeDocuments; `adminUrl` defaults to the
// application's own page in the CMS.
const buildLoanApplicationEmail = ({ application, documents = [], adminUrl } = {}) => {
    const description = describeApplication(application);
    const appUrl = adminUrl === undefined ? adminApplicationUrl(application._id) : adminUrl;
    const subject = subjectOf(description, application);
    const reference = application.applicationNumber;

    const text = [
        'A new loan application has been submitted on the Surjit Finance website.',
        '',
        appUrl ? `View the application in the admin panel (sign-in required):\n${appUrl}` : `Open Loan Applications in the CMS and search for ${reference}.`,
        '',
        'APPLICATION SUMMARY',
        ...description.summary.map((r) => `${r.label}: ${r.value}`),
        ...description.sections.flatMap((s) => ['', s.title.toUpperCase(), ...s.rows.map((r) => `${r.label}: ${r.value}`)]),
        '',
        'DOCUMENTS SUBMITTED',
        ...documentsText(documents),
        '',
        'PAN and Aadhaar are masked. Documents are not attached to this email; open them from the application in the CMS.',
        'This is an automatic message from the Surjit Finance CMS.'
    ].join('\n');

    const button = appUrl
        ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0 0"><tr><td style="background:${BRAND};border-radius:4px">`
          + `<a href="${escapeHtml(appUrl)}" style="display:inline-block;padding:11px 20px;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px">View Application in Admin Panel</a></td></tr></table>`
          + '<p style="margin:8px 0 0;color:#5f6368;font-size:12px">Sign-in required. The application opens only for staff with access to Loan Applications.</p>'
        : `<p style="margin:16px 0 0;color:#5f6368;font-size:13px">Open Loan Applications in the CMS and search for <strong>${escapeHtml(reference)}</strong>.</p>`;

    const html = [
        '<!doctype html>',
        '<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
        '<meta name="x-apple-disable-message-reformatting">',
        `<title>${escapeHtml(subject)}</title></head>`,
        '<body style="margin:0;padding:0;background:#f5f5f5;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%">',
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5"><tr><td align="center" style="padding:24px 8px">',
        '<!--[if mso]><table role="presentation" width="640" cellpadding="0" cellspacing="0"><tr><td><![endif]-->',
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border:1px solid #e0e0e0">',
        `<tr><td style="background:${BRAND};color:#ffffff;padding:16px 24px;font-size:18px;font-weight:700">Surjit Finance</td></tr>`,
        '<tr><td style="padding:24px 24px 0">',
        `<h1 style="margin:0 0 6px;font-size:20px;line-height:26px;color:#202124">${escapeHtml(BASE_SUBJECT)}</h1>`,
        `<p style="margin:0;color:#3c4043;font-size:14px;line-height:20px">Reference <strong>${escapeHtml(reference)}</strong> · ${escapeHtml(description.product.label)}</p>`,
        button,
        '</td></tr>',
        sectionHtml('Application summary', rowsHtml(description.summary)),
        ...description.sections.map((s) => sectionHtml(s.title, rowsHtml(s.rows))),
        sectionHtml('Documents submitted', documentsHtml(documents, appUrl)),
        '<tr><td style="padding:20px 24px;color:#80868b;font-size:12px;line-height:18px">PAN and Aadhaar are masked. Documents are not attached to this email; open them from the application in the CMS. This is an automatic message from the Surjit Finance CMS.</td></tr>',
        '</table>',
        '<!--[if mso]></td></tr></table><![endif]-->',
        '</td></tr></table></body></html>'
    ].join('');

    return {
        subject,
        text,
        html,
        templateVersion: TEMPLATE_VERSION,
        description
    };
};

// ── MIME ─────────────────────────────────────────────────────────────────────

// RFC 2047 for a header value that is not plain ASCII (the en dash in the
// subject, a sender name in Hindi). Header values here never contain line
// breaks: the sender name is validated for that, addresses are validated, and
// the subject is built by subjectOf().
const encodeHeaderText = (value) => (/^[\x20-\x7E]*$/.test(value)
    ? value
    : `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`);

const quoteDisplayName = (name) => {
    const encoded = encodeHeaderText(name);
    return encoded === name ? `"${name.replace(/["\\]/g, '\\$&')}"` : encoded;
};

const base64Lines = (content) => Buffer.from(content, 'utf8').toString('base64').match(/.{1,76}/g).join('\r\n');

const buildMime = ({ from, to, subject, text, html }) => {
    const boundary = `=_surjit_${crypto.randomBytes(12).toString('hex')}`;
    const fromHeader = from.name ? `${quoteDisplayName(from.name)} <${from.address}>` : from.address;
    return [
        `From: ${fromHeader}`,
        `To: ${to.join(', ')}`,
        `Subject: ${encodeHeaderText(subject)}`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        'Content-Type: text/plain; charset=utf-8',
        'Content-Transfer-Encoding: base64',
        '',
        base64Lines(text),
        `--${boundary}`,
        'Content-Type: text/html; charset=utf-8',
        'Content-Transfer-Encoding: base64',
        '',
        base64Lines(html),
        `--${boundary}--`,
        ''
    ].join('\r\n');
};

module.exports = {
    SUBJECT: BASE_SUBJECT,
    BASE_SUBJECT,
    TEMPLATE_VERSION,
    DOCUMENT_STATUS_TEXT,
    buildLoanApplicationEmail,
    buildMime,
    escapeHtml,
    adminApplicationsUrl,
    adminApplicationUrl,
    formatSubmitted,
    subjectOf
};
