// The richer "New Loan Application Received" email, the documents it
// describes, the signed-in document route, and the Email Delivery Log detail —
// through the real app, the real public submission route (multipart, with
// files) and an in-memory MongoDB. Only Microsoft is replaced; no real email is
// sent. Uploaded test files are removed afterwards.
//
//   npm test

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://placeholder';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-for-loan-email-suite';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-loan-email-suite';
process.env.CORS_ORIGIN = 'http://localhost:5174';
process.env.AWS_S3_BUCKET_NAME = '';
process.env.LOAN_RATE_LIMIT_MAX = '10000';
process.env.EMAIL_TEST_RATE_LIMIT_MAX = '1000';
process.env.LOAN_NOTIFICATION_MAX_ATTEMPTS = '3';
process.env.ADMIN_PANEL_URL = 'https://cms.surjitfinance.com';

const { test, before, after, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

const app = require('../app');
const Admin = require('../src/models/Admin');
const Role = require('../src/models/Role');
const Product = require('../src/models/Product');
const ProductCategory = require('../src/models/ProductCategory');
const LoanApplication = require('../src/models/LoanApplication');
const LoanApplicationNotification = require('../src/models/LoanApplicationNotification');
const roleService = require('../src/services/role.service');
const { generateAccessToken } = require('../src/utils/token');
const graph = require('../src/services/email/microsoftGraph');
const emailConfig = require('../src/services/email/emailConfig.service');
const notifications = require('../src/services/email/loanNotification.service');
const logger = require('../src/utils/logger');
const { buildLoanApplicationEmail, subjectOf, TEMPLATE_VERSION } = require('../src/services/email/loanApplicationEmail');
const { describeApplication, maskPan, maskAadhaar, MAX_VALUE_LENGTH } = require('../src/services/loanApplications/applicationFields');
const { describeDocuments, sanitizeFilename, locate } = require('../src/services/loanApplications/applicationDocuments');

const logLines = [];
for (const level of ['info', 'warn', 'error', 'debug']) {
    logger[level] = (...args) => { logLines.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')); };
}

// ── Fake Microsoft: captures each MIME message ────────────────────────────────
const realFetch = global.fetch;
const ms = { sends: [], next: [], reset() { this.sends = []; this.next = []; } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
global.fetch = async (url, init) => {
    const u = String(url);
    if (u.startsWith(graph.LOGIN_BASE)) {
        return new Response(JSON.stringify({ access_token: `${b64({})}.${b64({ roles: ['Mail.Send'] })}.sig`, expires_in: 3599 }), { status: 200 });
    }
    if (u.startsWith(graph.GRAPH_BASE)) {
        const status = ms.next.length ? ms.next.shift() : 202;
        ms.sends.push(Buffer.from(String(init.body), 'base64').toString('utf8'));
        return status === 202 ? new Response(null, { status: 202 }) : new Response(JSON.stringify({ error: { code: 'Busy' } }), { status });
    }
    return realFetch(url, init);
};

// The decoded parts of a captured MIME message.
const partsOf = (raw) => {
    const out = { headers: {} };
    const [head] = raw.split('\r\n\r\n');
    for (const line of head.split('\r\n')) { const i = line.indexOf(':'); if (i > 0) out.headers[line.slice(0, i).toLowerCase()] = line.slice(i + 1).trim(); }
    for (const type of ['text/plain', 'text/html']) {
        const m = raw.split(`Content-Type: ${type}; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n`)[1];
        out[type] = m ? Buffer.from(m.split('\r\n--')[0].replace(/\r\n/g, ''), 'base64').toString('utf8') : '';
    }
    out.subject = out.headers.subject.replace(/=\?UTF-8\?B\?([^?]+)\?=/g, (_, s) => Buffer.from(s, 'base64').toString('utf8'));
    return out;
};

// ── App and fixtures ──────────────────────────────────────────────────────────
let mongo;
let server;
let baseUrl;
const tokens = {};
let product;
const createdFiles = new Set();

const api = async (method, url, { token, body, form, raw = false } = {}) => {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    let payload;
    if (form) payload = form;
    else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    const res = await realFetch(`${baseUrl}/api${url}`, { method, headers, body: payload });
    if (raw) return res;
    const text = await res.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch { /* not JSON */ }
    return { status: res.status, body: parsed, text, headers: res.headers };
};

let seq = 0;
const FIELDS = () => ({
    fullName: `Meera Nair ${++seq}`, email: `meera${seq}@example.com`, phone: '+91 91234 56789', dob: '1988-11-03', gender: 'female',
    pan: 'PQRSX6789K', aadhaar: '987698769876', address: 'Flat 4, Gomti Nagar', city: 'Lucknow', state: 'Uttar Pradesh', pincode: '226010',
    loanType: 'vehicle', loanAmount: '135000', loanPurpose: 'Buy an e-rickshaw for my own route', tenure: '18',
    employmentType: 'self-employed', businessName: 'Nair Transport', businessType: 'Transport', monthlyIncome: '42000', workExperience: '4 years',
    consentAccepted: 'true'
});
const PDF = Buffer.from('%PDF-1.4\n% test document\n');
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

// Submits through the public route, as the website does (multipart).
const submit = async ({ fields = {}, files = {}, productId } = {}) => {
    const form = new FormData();
    for (const [k, v] of Object.entries({ ...FIELDS(), ...fields })) form.append(k, String(v));
    if (productId) form.append('productId', String(productId));
    for (const [field, { name, type, data }] of Object.entries(files)) form.append(field, new Blob([data], { type }), name);
    const res = await api('POST', '/loan-application', { form });
    assert.equal(res.status, 201, res.text);
    await notifications.whenIdle();
    const saved = await LoanApplication.findOne({ applicationNumber: res.body.data.applicationNumber });
    for (const f of ['aadhaarCardUrl', 'panCardUrl', 'bankStatementUrl', 'businessProofUrl']) if (saved[f]) createdFiles.add(saved[f]);
    return saved;
};

before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await roleService.ensureSystemRoles();
    await LoanApplicationNotification.init();
    await Role.create({ key: 'integrations_viewer', name: 'Integrations Viewer', permissions: ['integrations.view'] });
    for (const [k, role] of Object.entries({ super: 'super_admin', editor: 'editor', content: 'content_manager', viewer: 'integrations_viewer' })) {
        const a = await Admin.create({ name: `Mail ${k}`, email: `mail-${k}@test.local`, password: 'Password@123', role, isActive: true });
        tokens[k] = generateAccessToken({ id: a._id, role });
    }
    await emailConfig.save({
        provider: 'microsoft365', authMethod: 'graph', senderName: 'Surjit Finance', senderEmail: 'loans@surjitfinance.com',
        tenantId: '72f988bf-86f1-41af-91ab-2d7cd011db47', clientId: '11111111-2222-3333-4444-555555555555', clientSecret: 'Qx8~LoanEmail.Secret_Value-0123456789ab',
        primaryRecipient: 'ops@surjitfinance.com', additionalRecipients: ['credit@surjitfinance.com'], notifyNewLoanApplication: true
    }, null);
    const category = await ProductCategory.create({ name: 'Commercial Vehicle Loan', slug: 'commercial-vehicle-loan' });
    product = await Product.create({ category: category._id, name: 'E-Rickshaw Loan', slug: 'e-rickshaw-loan', isActive: true });
    server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    await notifications.whenIdle();
    global.fetch = realFetch;
    for (const f of createdFiles) { try { fs.unlinkSync(f); } catch { /* already gone */ } }
    server?.close();
    await mongoose.disconnect();
    await mongo?.stop();
});

beforeEach(() => ms.reset());

// ── The email ─────────────────────────────────────────────────────────────────
describe('The notification email', () => {
    test('names the selected product and reference in the subject, and carries every submitted field', async () => {
        const saved = await submit({
            productId: product._id,
            files: {
                aadhaarDoc: { name: 'my aadhaar.pdf', type: 'application/pdf', data: PDF },
                bankStatementDoc: { name: 'स्टेटमेंट <Q1> & co.png', type: 'image/png', data: PNG }
            }
        });
        assert.equal(ms.sends.length, 1);
        const mail = partsOf(ms.sends[0]);
        const text = mail['text/plain'];
        const html = mail['text/html'];

        assert.equal(mail.subject, `New Loan Application Received – E-Rickshaw Loan – ${saved.applicationNumber}`);
        assert.ok(!/[\r\n]/.test(mail.headers.subject));

        const expected = [
            `Application number: ${saved.applicationNumber}`, 'Loan product: E-Rickshaw Loan', 'Loan category: Commercial Vehicle Loan',
            'Requested amount: ₹1,35,000', 'Requested tenure: 18 months', 'Application status: Pending',
            `Full name: ${saved.fullName}`, 'Mobile number: +91 91234 56789', `Email address: ${saved.email}`, 'Date of birth: 3 Nov 1988',
            'Gender: Female', 'PAN (masked): XXXXXX789K', 'Aadhaar (masked): XXXX XXXX 9876', 'Address: Flat 4, Gomti Nagar', 'City: Lucknow',
            'State: Uttar Pradesh', 'PIN code: 226010', 'Loan type: Commercial Vehicle Loan', 'Purpose of loan: Buy an e-rickshaw for my own route',
            'Employment type: Self-employed', 'Business / company name: Nair Transport', 'Business type: Transport', 'Monthly income: ₹42,000',
            'Work experience: 4 years', 'Terms accepted: Yes ('
        ];
        for (const line of expected) assert.ok(text.includes(line), `missing: ${line}`);

        // Documents: names and statuses, never a storage address.
        assert.ok(text.includes('- Aadhaar Card: my aadhaar.pdf — Received'), `aadhaar line in: ${text.split('DOCUMENTS SUBMITTED')[1]}`);
        // The Hindi characters arrive intact after the Latin-1 repair.
        assert.ok(text.includes('- Bank Statement: स्टेटमेंट <Q1> & co.png — Received'), `unicode filename: ${JSON.stringify(text.split('DOCUMENTS SUBMITTED')[1])}`);
        assert.ok(text.includes('- PAN Card: Not attached'));
        assert.ok(html.includes('स्टेटमेंट &lt;Q1&gt; &amp; co.png'), 'escaped filename in html');
        assert.ok(!html.includes('<Q1>'), 'no raw filename markup');
        for (const leak of ['loan-documents', 'uploads', 'PQRSX6789K', '987698769876', path.sep === '\\' ? 'C:\\' : '/home/']) {
            assert.ok(!ms.sends[0].includes(leak) && !text.includes(leak) && !html.includes(leak), `"${leak}" must not be in the email`);
        }

        const link = `https://cms.surjitfinance.com/loan-applications?application=${saved._id}`;
        assert.ok(html.includes(`href="${link}"`) && text.includes(link), 'admin link');
        assert.ok(html.includes('View Application in Admin Panel'), 'button text');
    });

    test('the delivery record keeps what the email contained — not the applicant\'s values', async () => {
        const saved = await submit({ productId: product._id, files: { panDoc: { name: 'pan.pdf', type: 'application/pdf', data: PDF } } });
        const r = await LoanApplicationNotification.findOne({ application: saved._id }).lean();
        assert.equal(r.status, 'sent');
        assert.deepEqual(r.recipients, ['ops@surjitfinance.com', 'credit@surjitfinance.com']);
        assert.equal(r.content.templateVersion, TEMPLATE_VERSION);
        assert.equal(r.content.subject, `New Loan Application Received – E-Rickshaw Loan – ${saved.applicationNumber}`);
        assert.ok(r.content.fields.includes('pan') && r.content.fields.includes('monthlyIncome'));
        assert.deepEqual(r.content.documents.map((d) => [d.type, d.status]), [['aadhaar', 'not_provided'], ['pan', 'available'], ['bank-statement', 'not_provided'], ['business-proof', 'not_provided']]);
        assert.deepEqual(r.events.map((e) => [e.attempt, e.status, e.code]), [[1, 'sent', 'SENT']]);
        const stored = JSON.stringify(r);
        for (const v of [saved.fullName, saved.email, 'PQRSX6789K', 'Gomti Nagar']) assert.ok(!stored.includes(v), `"${v}" must not be stored on the delivery record`);
    });

    test('without a product, and with a product deleted since, the email says so instead of inventing one', async () => {
        const plain = await submit();
        assert.equal(partsOf(ms.sends[0]).subject, `New Loan Application Received – Commercial Vehicle Loan – ${plain.applicationNumber}`);
        assert.ok(partsOf(ms.sends[0])['text/plain'].includes('Loan product: Commercial Vehicle Loan (no specific product selected)'));

        const gone = await LoanApplication.findById(plain._id).lean();
        const email = buildLoanApplicationEmail({ application: { ...gone, product: new mongoose.Types.ObjectId() } });
        assert.ok(email.text.includes('Loan product: Commercial Vehicle Loan (selected product no longer exists)'));
    });

    test('a product name can never inject a header', () => {
        const d = describeApplication({ applicationNumber: 'SF1', loanType: 'business', product: { name: 'Shop\r\nBcc: attacker@evil.test' } });
        const subject = subjectOf(d, { applicationNumber: 'SF1' });
        assert.ok(!/[\r\n]/.test(subject));
        assert.equal(subject, 'New Loan Application Received – Shop Bcc: attacker@evil.test – SF1');
    });

    test('fields added to the schema later appear under "Other details", nested and bounded', () => {
        const LoanSchema = LoanApplication.schema;
        LoanSchema.add({ referralCode: String, coApplicant: { name: String, phone: String } });
        try {
            const long = 'x'.repeat(MAX_VALUE_LENGTH + 50);
            const d = describeApplication({ applicationNumber: 'SF2', loanType: 'lap', referralCode: long, coApplicant: { name: 'Anil <i>', phone: '9000000000' }, loanPurpose: 'y'.repeat(5000) });
            const other = d.sections.find((s) => s.id === 'other');
            assert.ok(other, 'an "Other details" section');
            const referral = other.rows.find((r) => r.key === 'referralCode');
            assert.equal(referral.label, 'Referral code');
            assert.equal(referral.value.length, MAX_VALUE_LENGTH);
            assert.ok(other.rows.some((r) => r.label === 'Co applicant name' && r.value === 'Anil <i>'));
            const email = buildLoanApplicationEmail({ application: { applicationNumber: 'SF2', loanType: 'lap', coApplicant: { name: 'Anil <i>' } }, adminUrl: null });
            assert.ok(email.html.includes('Anil &lt;i&gt;') && !email.html.includes('Anil <i>'));
            assert.ok(d.sections.find((s) => s.id === 'loan').rows.find((r) => r.key === 'loanPurpose').value.endsWith('…'));
        } finally {
            LoanSchema.remove(['referralCode', 'coApplicant']);
        }
    });

    test('masking helpers', () => {
        assert.equal(maskPan('ABCDE1234F'), 'XXXXXX234F');
        assert.equal(maskAadhaar('123412341234'), 'XXXX XXXX 1234');
        assert.equal(maskAadhaar(''), '');
    });
});

// ── Documents ─────────────────────────────────────────────────────────────────
describe('Document statuses and the signed-in document route', () => {
    test('available, missing, unrecognised and not provided are told apart', async () => {
        const saved = await submit({ files: { aadhaarDoc: { name: 'a.pdf', type: 'application/pdf', data: PDF }, panDoc: { name: 'p.pdf', type: 'application/pdf', data: PDF } } });
        fs.unlinkSync(saved.panCardUrl);
        const docs = await describeDocuments({ ...saved.toObject(), bankStatementUrl: 'https://evil.example/statement.pdf' });
        assert.deepEqual(docs.map((d) => [d.type, d.status]), [['aadhaar', 'available'], ['pan', 'missing'], ['bank-statement', 'unrecognised'], ['business-proof', 'not_provided']]);
        assert.equal(docs[0].fileName, 'a.pdf');
        assert.equal(locate('/etc/passwd'), null);
        assert.equal(locate(path.join(__dirname, '..', 'src', 'uploads', 'loan-documents', '..', 'blog', 'x.png')), null);
        assert.equal(sanitizeFilename('../../evil\u202Egnp.pdf'), 'evilgnp.pdf');
    });

    test('the detail route returns document statuses but no storage addresses', async () => {
        const saved = await submit({ files: { aadhaarDoc: { name: 'a.pdf', type: 'application/pdf', data: PDF } } });
        const res = await api('GET', `/loan-application/${saved._id}`, { token: tokens.editor });
        assert.equal(res.status, 200, res.text);
        assert.equal(res.body.data.application.aadhaarCardUrl, undefined);
        assert.equal(res.body.data.documents[0].status, 'available');
        assert.ok(!res.text.includes('loan-documents'));
    });

    test('documents stream only to signed-in staff with Loan Applications access, with safe headers', async () => {
        const saved = await submit({ files: {
            aadhaarDoc: { name: 'aadhaar front.pdf', type: 'application/pdf', data: PDF },
            businessProofDoc: { name: 'proof.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', data: Buffer.from('PK docx') }
        } });
        const url = `/loan-application/${saved._id}/documents/aadhaar`;
        assert.equal((await api('GET', url)).status, 401);
        assert.equal((await api('GET', url, { token: tokens.viewer })).status, 403);

        const res = await api('GET', url, { token: tokens.editor, raw: true });
        assert.equal(res.status, 200);
        assert.ok(Buffer.from(await res.arrayBuffer()).equals(PDF));
        assert.equal(res.headers.get('content-type'), 'application/pdf');
        assert.match(res.headers.get('content-disposition'), /^inline; filename="aadhaar front.pdf"/);
        assert.equal(res.headers.get('cache-control'), 'no-store, private');
        assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
        assert.match(res.headers.get('content-security-policy'), /sandbox/);

        const docx = await api('GET', `/loan-application/${saved._id}/documents/business-proof`, { token: tokens.editor, raw: true });
        assert.match(docx.headers.get('content-disposition'), /^attachment;/);

        for (const bad of [`/loan-application/${saved._id}/documents/pan`, `/loan-application/${saved._id}/documents/passport`, '/loan-application/not-an-id/documents/aadhaar', `/loan-application/${new mongoose.Types.ObjectId()}/documents/aadhaar`]) {
            assert.equal((await api('GET', bad, { token: tokens.editor })).status, 404, bad);
        }
        await LoanApplication.updateOne({ _id: saved._id }, { $set: { aadhaarCardUrl: '/etc/hosts' } });
        assert.equal((await api('GET', url, { token: tokens.editor })).status, 404, 'an address outside the document folder is never read');
    });
});

// ── Delivery log detail ───────────────────────────────────────────────────────
describe('Email Delivery Log detail', () => {
    const detail = (id, token) => api('GET', `/v1/email-settings/notifications/${id}`, { token });

    test('with Loan Applications access: the application, documents and a regenerated preview, labelled as such', async () => {
        const saved = await submit({ productId: product._id, files: { aadhaarDoc: { name: 'a.pdf', type: 'application/pdf', data: PDF } } });
        const r = await LoanApplicationNotification.findOne({ application: saved._id });
        const sendsBefore = ms.sends.length;
        const res = await detail(r._id, tokens.super);
        assert.equal(res.status, 200, res.text);
        const d = res.body.data;
        assert.equal(d.application.applicantName, saved.fullName);
        assert.equal(d.application.product, 'E-Rickshaw Loan');
        assert.equal(d.application.adminUrl, `https://cms.surjitfinance.com/loan-applications?application=${saved._id}`);
        assert.equal(d.documents[0].status, 'available');
        assert.deepEqual([d.preview.exact, d.preview.kind, d.preview.sentTemplateVersion, d.preview.templateVersion], [false, 'regenerated', TEMPLATE_VERSION, TEMPLATE_VERSION]);
        assert.equal(d.preview.applicationChangedSinceSent, false);
        assert.equal(d.preview.subject, r.content.subject, 'same subject as the email sent');
        assert.deepEqual(d.delivery.recipients, ['ops@surjitfinance.com', 'credit@surjitfinance.com']);
        assert.equal(d.delivery.events.length, 1);
        assert.ok(!res.text.includes('PQRSX6789K') && !res.text.includes('loan-documents'));
        assert.equal(ms.sends.length, sendsBefore, 'viewing the detail sends nothing');

        await LoanApplication.updateOne({ _id: saved._id }, { $set: { status: 'approved' } });
        const later = (await detail(r._id, tokens.super)).body.data;
        assert.equal(later.preview.applicationChangedSinceSent, true, 'a later change to the application is flagged');
    });

    test('without Loan Applications access: delivery history only', async () => {
        const saved = await submit();
        const r = await LoanApplicationNotification.findOne({ application: saved._id });
        const res = await detail(r._id, tokens.viewer);
        assert.equal(res.status, 200, res.text);
        const d = res.body.data;
        assert.equal(d.applicantHidden, true);
        assert.equal(d.application, null);
        assert.equal(d.preview, null);
        assert.equal(d.delivery.status, 'sent');
        assert.ok(!res.text.includes(saved.fullName) && !res.text.includes(saved.email));
        assert.equal((await detail(r._id, tokens.editor)).status, 403, 'the log itself needs API Settings view');
        assert.equal((await detail('not-an-id', tokens.super)).status, 400);
        assert.equal((await detail(new mongoose.Types.ObjectId(), tokens.super)).status, 404);
    });

    test('a record whose application was deleted still opens, saying so', async () => {
        const saved = await submit();
        const r = await LoanApplicationNotification.findOne({ application: saved._id });
        await LoanApplication.updateOne({ _id: saved._id }, { $set: { deletedAt: new Date() } });
        const d = (await detail(r._id, tokens.super)).body.data;
        assert.equal(d.applicationMissing, true);
        assert.equal(d.delivery.status, 'sent');
        const row = (await api('GET', '/v1/email-settings/notifications?limit=100', { token: tokens.super })).body.data.notifications.find((x) => x.id === String(r._id));
        assert.equal(row.applicationMissing, true);
    });

    test('a historical record without the new fields still lists and opens', async () => {
        const saved = await submit();
        const old = await LoanApplicationNotification.create({ application: new mongoose.Types.ObjectId(), applicationNumber: 'SFOLD0001', status: 'sent', outcomeCode: 'SENT', attempts: 1, recipientCount: 2 });
        await LoanApplicationNotification.collection.updateOne({ _id: old._id }, { $unset: { recipients: '', content: '', events: '' } });
        const list = await api('GET', '/v1/email-settings/notifications?limit=100', { token: tokens.super });
        const row = list.body.data.notifications.find((x) => x.id === String(old._id));
        assert.equal(row.recipientSummary, '2 recipients');
        const d = (await detail(old._id, tokens.super)).body.data;
        assert.equal(d.delivery.sent, null);
        assert.deepEqual(d.delivery.events, []);
        assert.ok(saved);
    });

    test('the list adds applicant columns with a fixed number of queries, whatever the page size', async () => {
        for (let i = 0; i < 3; i++) await submit();
        let finds = 0;
        const original = LoanApplication.find.bind(LoanApplication);
        LoanApplication.find = (...args) => { finds += 1; return original(...args); };
        try {
            const res = await api('GET', '/v1/email-settings/notifications?limit=100', { token: tokens.super });
            assert.equal(res.status, 200);
            assert.ok(res.body.data.notifications.length >= 4);
            assert.equal(finds, 1, 'one LoanApplication query for the whole page');
            assert.ok(res.body.data.notifications.filter((r) => r.applicant).every((r) => typeof r.applicant.name === 'string'));
        } finally {
            LoanApplication.find = original;
        }
    });
});

// ── Delivery semantics ────────────────────────────────────────────────────────
describe('Delivery and retry semantics are unchanged', () => {
    test('a temporary failure schedules a retry with the content recorded; the retry sends once', async () => {
        ms.next = [503];
        const saved = await submit({ productId: product._id });
        let r = await LoanApplicationNotification.findOne({ application: saved._id });
        assert.equal(r.status, 'retrying');
        assert.equal(r.content.subject.includes(saved.applicationNumber), true);
        assert.deepEqual(r.events.map((e) => e.status), ['retrying']);

        await LoanApplicationNotification.updateOne({ _id: r._id }, { $set: { nextAttemptAt: new Date(Date.now() - 1000) } });
        await notifications.sweep();
        r = await LoanApplicationNotification.findById(r._id);
        assert.equal(r.status, 'sent');
        assert.equal(r.attempts, 2);
        assert.deepEqual(r.events.map((e) => [e.attempt, e.status]), [[1, 'retrying'], [2, 'sent']]);
        assert.equal(ms.sends.length, 2);
    });

    test('an interrupted send is closed as unconfirmed, recorded in its history, and never resent', async () => {
        const saved = await submit();
        const r = await LoanApplicationNotification.findOne({ application: saved._id });
        await LoanApplicationNotification.updateOne({ _id: r._id }, { $set: { status: 'sending', lockedUntil: new Date(Date.now() - 1000) } });
        const before = ms.sends.length;
        await notifications.sweep();
        const after = await LoanApplicationNotification.findById(r._id);
        assert.deepEqual([after.status, after.outcomeCode], ['failed', 'SEND_UNCONFIRMED']);
        assert.equal(after.events.at(-1).code, 'SEND_UNCONFIRMED');
        assert.equal(ms.sends.length, before, 'nothing was resent');
    });

    test('listing and opening the log never sends', async () => {
        await submit();
        const before = ms.sends.length;
        const list = await api('GET', '/v1/email-settings/notifications', { token: tokens.super });
        for (const row of list.body.data.notifications.slice(0, 3)) await api('GET', `/v1/email-settings/notifications/${row.id}`, { token: tokens.super });
        await notifications.whenIdle();
        assert.equal(ms.sends.length, before);
    });

    test('nothing sensitive reached the logs', () => {
        const all = logLines.join('\n');
        for (const s of ['PQRSX6789K', '987698769876', 'Gomti Nagar', 'meera', 'loan-documents']) assert.ok(!all.includes(s), `log contains ${s}`);
    });
});
