const crypto = require('crypto');
const env = require('../../config/env');

// The "New Loan Application Received" email, in HTML with a plain-text
// alternative, and the MIME message that carries both.
//
// What it contains is deliberately little: the reference, the applicant's
// name, the loan type or product, and when it arrived. Contact details, PAN,
// Aadhaar, date of birth, address, income and document links stay in the CMS,
// behind its login and its Loan Applications permission — an email is copied
// to inboxes, phones and backups the CMS cannot control.

const SUBJECT = 'New Loan Application Received';

const LOAN_TYPE_LABELS = {
    business: 'Business Loan',
    vehicle: 'Commercial Vehicle Loan',
    lap: 'Loan Against Property'
};

const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// In the business timezone, which is how the team reads its own calendar.
const formatSubmitted = (date) => new Intl.DateTimeFormat('en-IN', {
    timeZone: env.ANALYTICS_TIMEZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
}).format(new Date(date));

// The CMS page for loan applications, under ADMIN_PANEL_URL — or null. Only
// an http(s) address is used; anything else is treated as unset rather than
// put into an email.
const adminApplicationsUrl = (base = env.ADMIN_PANEL_URL) => {
    if (!base) return null;
    try {
        const url = new URL(base);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
        url.pathname = `${url.pathname.replace(/\/+$/, '')}/loan-applications`;
        url.search = '';
        url.hash = '';
        return url.toString();
    } catch {
        return null;
    }
};

// The rows the email shows. Built from the saved application only.
const detailsOf = ({ application, productName }) => [
    ['Reference', application.applicationNumber],
    ['Applicant', application.fullName],
    ['Loan', productName || LOAN_TYPE_LABELS[application.loanType] || application.loanType],
    ['Submitted', formatSubmitted(application.createdAt)]
].filter(([, value]) => value);

const buildLoanApplicationEmail = ({ application, productName = null, adminUrl = adminApplicationsUrl() }) => {
    const rows = detailsOf({ application, productName });
    const reference = application.applicationNumber;

    const text = [
        'A new loan application has been submitted on the Surjit Finance website.',
        '',
        ...rows.map(([label, value]) => `${label}: ${value}`),
        '',
        adminUrl
            ? `Open Loan Applications in the CMS and search for ${reference}:\n${adminUrl}`
            : `Open Loan Applications in the CMS and search for ${reference}.`,
        '',
        'This is an automatic message from the Surjit Finance CMS. Applicant documents and contact details are available in the CMS only.'
    ].join('\n');

    const rowHtml = rows.map(([label, value]) => (
        `<tr><td style="padding:6px 16px 6px 0;color:#5f6368;white-space:nowrap;vertical-align:top">${escapeHtml(label)}</td>`
        + `<td style="padding:6px 0;color:#202124;font-weight:600">${escapeHtml(value)}</td></tr>`
    )).join('');

    const action = adminUrl
        ? `<p style="margin:24px 0 8px"><a href="${escapeHtml(adminUrl)}" style="display:inline-block;background:#1a237e;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:4px;font-weight:600">Open Loan Applications</a></p>`
          + `<p style="margin:0;color:#5f6368;font-size:13px">Search for <strong>${escapeHtml(reference)}</strong> in the CMS.</p>`
        : `<p style="margin:24px 0 0;color:#5f6368;font-size:13px">Open Loan Applications in the CMS and search for <strong>${escapeHtml(reference)}</strong>.</p>`;

    const html = [
        '<!doctype html>',
        '<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
        `<title>${escapeHtml(SUBJECT)}</title></head>`,
        '<body style="margin:0;padding:0;background:#f5f5f5;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif">',
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 12px"><tr><td align="center">',
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e0e0e0;border-radius:6px">',
        '<tr><td style="background:#1a237e;color:#ffffff;padding:16px 24px;font-size:18px;font-weight:700;border-radius:6px 6px 0 0">Surjit Finance</td></tr>',
        '<tr><td style="padding:24px">',
        `<h1 style="margin:0 0 8px;font-size:20px;color:#202124">${escapeHtml(SUBJECT)}</h1>`,
        '<p style="margin:0 0 16px;color:#3c4043">A new loan application has been submitted on the Surjit Finance website.</p>',
        `<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px">${rowHtml}</table>`,
        action,
        '</td></tr>',
        '<tr><td style="padding:16px 24px;border-top:1px solid #e0e0e0;color:#80868b;font-size:12px">This is an automatic message from the Surjit Finance CMS. Applicant documents and contact details are available in the CMS only.</td></tr>',
        '</table></td></tr></table></body></html>'
    ].join('');

    return { subject: SUBJECT, text, html };
};

// ── MIME ─────────────────────────────────────────────────────────────────────

// RFC 2047 for a header value that is not plain ASCII (a sender name in Hindi,
// say). Header values here never contain line breaks: the sender name is
// validated for that, addresses are validated, and the subject is fixed.
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
    SUBJECT,
    buildLoanApplicationEmail,
    buildMime,
    escapeHtml,
    adminApplicationsUrl,
    formatSubmitted
};
