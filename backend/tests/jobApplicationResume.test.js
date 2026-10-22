// Job applicants' CVs: the public submission, what the CMS is told about a
// CV, the signed-in CV route, and the CSV export — through the real app and an
// in-memory MongoDB, with fake applicants and generated test files only.
// Uploaded test files are removed afterwards.
//
//   npm test

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://placeholder';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-for-resume-suite';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-resume-suite';
process.env.CORS_ORIGIN = 'http://localhost:5174';
process.env.AWS_S3_BUCKET_NAME = '';

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

const app = require('../app');
const Admin = require('../src/models/Admin');
const Role = require('../src/models/Role');
const JobApplication = require('../src/models/JobApplication');
const LoanApplication = require('../src/models/LoanApplication');
const roleService = require('../src/services/role.service');
const { generateAccessToken } = require('../src/utils/token');
const logger = require('../src/utils/logger');
const { sanitizeFilename, locate } = require('../src/services/storage/privateFiles');

const logLines = [];
for (const level of ['info', 'warn', 'error', 'debug']) {
    logger[level] = (...args) => { logLines.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')); };
}

let mongo;
let server;
let baseUrl;
const tokens = {};
const createdFiles = new Set();
const resumesDir = path.join(__dirname, '..', 'src', 'uploads', 'resumes');

const api = async (method, url, { token, body, form, raw = false } = {}) => {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    let payload;
    if (form) payload = form;
    else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    const res = await fetch(`${baseUrl}/api${url}`, { method, headers, body: payload });
    if (raw) return res;
    const text = await res.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch { /* not JSON */ }
    return { status: res.status, body: parsed, text, headers: res.headers };
};

const PDF = Buffer.from('%PDF-1.4\n% fake test CV\n');
let seq = 0;

// Submits through the public route, as the website does (multipart).
const submit = async ({ fields = {}, file } = {}) => {
    seq += 1;
    const form = new FormData();
    for (const [k, v] of Object.entries({ applicantName: `Test Applicant ${seq}`, email: `applicant${seq}@example.com`, phone: '9876543210', ...fields })) form.append(k, String(v));
    if (file) form.append('resume', new Blob([file.data], { type: file.type }), file.name);
    const res = await api('POST', '/v1/careers/applications', { form });
    const saved = await JobApplication.findOne({ email: `applicant${seq}@example.com` });
    if (saved?.resumeUrl) createdFiles.add(path.join(resumesDir, path.basename(saved.resumeUrl)));
    return { res, saved };
};

before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await roleService.ensureSystemRoles();
    await Role.create({ key: 'careers_viewer', name: 'Careers Viewer', permissions: ['jobApplications.view'] });
    await Role.create({ key: 'loans_viewer', name: 'Loans Viewer', permissions: ['loanApplications.view'] });
    for (const [k, role] of Object.entries({ super: 'super_admin', editor: 'editor', careers: 'careers_viewer', loans: 'loans_viewer' })) {
        const a = await Admin.create({ name: `Cv ${k}`, email: `cv-${k}@test.local`, password: 'Password@123', role, isActive: true });
        tokens[k] = generateAccessToken({ id: a._id, role });
    }
    server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    for (const f of createdFiles) { try { fs.unlinkSync(f); } catch { /* gone */ } }
    server?.close();
    await mongoose.disconnect();
    await mongo?.stop();
});

describe('Public submission', () => {
    test('stores the CV and its original name, and returns no record or storage address', async () => {
        const { res, saved } = await submit({ file: { name: 'मेरा CV (final).pdf', type: 'application/pdf', data: PDF } });
        assert.equal(res.status, 201, res.text);
        assert.deepEqual(res.body.data, {});
        assert.ok(!res.text.includes('resumes') && !res.text.includes('uploads'));
        assert.equal(saved.resumeOriginalName, 'मेरा CV (final).pdf');
        assert.ok(saved.resumeUrl.startsWith('/uploads/resumes/'));
    });

    test('a submission cannot set its own CV address, status or deletion', async () => {
        const { res, saved } = await submit({
            fields: { resumeUrl: '/uploads/resumes/someone-elses.pdf', resumeFileName: 'x', status: 'selected', deletedAt: '2020-01-01' }
        });
        assert.equal(res.status, 201, res.text);
        assert.equal(saved.resumeUrl, '');
        assert.equal(saved.status, 'new');
        assert.equal(saved.deletedAt, null);
    });
});

describe('What the CMS is told about a CV', () => {
    test('list, detail and status change describe the CV without its address', async () => {
        const { saved } = await submit({ file: { name: 'cv.pdf', type: 'application/pdf', data: PDF } });
        const list = await api('GET', '/v1/careers/applications', { token: tokens.editor });
        assert.equal(list.status, 200, list.text);
        const row = list.body.data.applications.find((a) => a._id === String(saved._id));
        assert.deepEqual(row.resume, { fileName: 'cv.pdf', fileType: 'PDF', status: 'recorded' });

        const detail = await api('GET', `/v1/careers/applications/${saved._id}`, { token: tokens.editor });
        assert.equal(detail.body.data.application.resume.status, 'available');

        const changed = await api('PATCH', `/v1/careers/applications/${saved._id}/status`, { token: tokens.editor, body: { status: 'reviewed' } });
        assert.equal(changed.status, 200, changed.text);
        for (const r of [list, detail, changed]) {
            assert.ok(!r.text.includes('resumeUrl') && !r.text.includes('resumeFileName') && !r.text.includes('/uploads/resumes'), 'no storage address');
        }
    });

    test('the CSV export says whether a CV is attached, never where it is', async () => {
        const csv = await api('GET', '/v1/careers/applications/export', { token: tokens.editor });
        assert.equal(csv.status, 200);
        const [header] = csv.text.split('\n');
        assert.equal(header, 'applicantName,email,phone,appliedPositionTitle,status,resume,createdAt');
        assert.ok(csv.text.includes('"Attached"'));
        assert.ok(!csv.text.includes('/uploads/') && !csv.text.includes('amazonaws'));
    });
});

describe('The signed-in CV route', () => {
    test('only staff with Job Applications access can open a CV; the file and headers are right', async () => {
        const { saved } = await submit({ file: { name: 'Priya Sharma CV.pdf', type: 'application/pdf', data: PDF } });
        // Multipart clients percent-encode quotes in filenames, so set one directly.
        await JobApplication.updateOne({ _id: saved._id }, { $set: { resumeOriginalName: 'Priya "Sharma" CV.pdf' } });
        const url = `/v1/careers/applications/${saved._id}/resume`;
        assert.equal((await api('GET', url)).status, 401);
        assert.equal((await api('GET', url, { token: 'forged.x.y' })).status, 401);
        assert.equal((await api('GET', url, { token: tokens.loans })).status, 403, 'Loan Applications access does not include CVs');

        for (const who of ['editor', 'careers']) {
            const res = await api('GET', url, { token: tokens[who], raw: true });
            assert.equal(res.status, 200, who);
            assert.ok(Buffer.from(await res.arrayBuffer()).equals(PDF));
            assert.equal(res.headers.get('content-type'), 'application/pdf');
            assert.equal(res.headers.get('content-disposition'), `inline; filename="Priya _Sharma_ CV.pdf"; filename*=UTF-8''${encodeURIComponent('Priya "Sharma" CV.pdf')}`);
            assert.equal(res.headers.get('cache-control'), 'no-store, private');
            assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
            assert.match(res.headers.get('content-security-policy'), /sandbox/);
        }
    });

    test('Job Applications access does not open loan documents either', async () => {
        const loan = await LoanApplication.create({
            fullName: 'Fake Borrower', email: 'fake@example.com', phone: '9000000000', dob: '1990-01-01', gender: 'male', pan: 'AAAAA1111A',
            aadhaar: '111122223333', address: 'Test', city: 'Test', state: 'Test', pincode: '111111', loanType: 'business', loanAmount: 1,
            loanPurpose: 'Test', tenure: 1, employmentType: 'salaried', monthlyIncome: 1, workExperience: '1'
        });
        assert.equal((await api('GET', `/loan-application/${loan._id}/documents/aadhaar`, { token: tokens.careers })).status, 403);
    });

    test('a CV belongs to its own application: no substitution, no foreign or crafted address', async () => {
        const { saved: withCv } = await submit({ file: { name: 'a.pdf', type: 'application/pdf', data: PDF } });
        const { saved: without } = await submit();
        assert.equal((await api('GET', `/v1/careers/applications/${without._id}/resume`, { token: tokens.editor })).status, 404, 'another application\'s id gives its own (absent) CV');

        const crafted = [
            '/etc/hosts',
            path.join(resumesDir, '..', 'loan-documents', 'x.pdf'),
            '/uploads/loan-documents/x.pdf',
            '/uploads/resumes/../../.env',
            'https://evil.example/resumes/a.pdf',
            'https://surjit-finance-cms-storage.s3.ap-south-1.amazonaws.com/loan-documents/a.pdf'
        ];
        for (const value of crafted) {
            await JobApplication.updateOne({ _id: without._id }, { $set: { resumeUrl: value } });
            assert.equal((await api('GET', `/v1/careers/applications/${without._id}/resume`, { token: tokens.editor })).status, 404, value);
        }
        for (const bad of ['/v1/careers/applications/not-an-id/resume', `/v1/careers/applications/${new mongoose.Types.ObjectId()}/resume`]) {
            assert.equal((await api('GET', bad, { token: tokens.editor })).status, 404, bad);
        }

        fs.unlinkSync(path.join(resumesDir, path.basename(withCv.resumeUrl)));
        const gone = await api('GET', `/v1/careers/applications/${withCv._id}/resume`, { token: tokens.editor });
        assert.equal(gone.status, 404);
        assert.equal(gone.body.message, 'The CV file is missing from storage');
        assert.equal((await api('GET', `/v1/careers/applications/${withCv._id}`, { token: tokens.editor })).body.data.application.resume.status, 'missing');
    });

    test('Word CVs download; unknown types are never served; filenames cannot inject headers', async () => {
        const { saved } = await submit({ file: { name: 'cv.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', data: Buffer.from('PK fake docx') } });
        const docx = await api('GET', `/v1/careers/applications/${saved._id}/resume`, { token: tokens.editor, raw: true });
        assert.equal(docx.status, 200);
        assert.match(docx.headers.get('content-disposition'), /^attachment;/);
        assert.equal(docx.headers.get('content-type'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

        await JobApplication.updateOne({ _id: saved._id }, { $set: { resumeOriginalName: 'evil\r\nSet-Cookie: a=b.pdf' } });
        const injected = await api('GET', `/v1/careers/applications/${saved._id}/resume`, { token: tokens.editor, raw: true });
        assert.equal(injected.status, 200);
        assert.equal(injected.headers.get('set-cookie'), null);
        assert.ok(!/[\r\n]/.test(injected.headers.get('content-disposition')));

        const html = path.join(resumesDir, `test-${process.pid}.html`);
        fs.writeFileSync(html, '<script>alert(1)</script>');
        createdFiles.add(html);
        await JobApplication.updateOne({ _id: saved._id }, { $set: { resumeUrl: `/uploads/resumes/${path.basename(html)}` } });
        assert.equal((await api('GET', `/v1/careers/applications/${saved._id}/resume`, { token: tokens.editor })).status, 404, 'an HTML file is never served');
    });
});

describe('Helpers and logs', () => {
    test('filenames are sanitised; addresses resolve only inside their folder', () => {
        assert.equal(sanitizeFilename('../../a‮gnp.pdf'), 'agnp.pdf');
        assert.equal(sanitizeFilename('a\r\nb.pdf'), 'ab.pdf');
        assert.equal(locate('/uploads/resumes/x.pdf', 'resumes').kind, 'local');
        assert.equal(locate('/uploads/resumes/x.pdf', 'loan-documents'), null);
        assert.equal(locate('/uploads/loan-documents/x.pdf', 'resumes'), null);
    });

    test('logs carry ids only — no names, emails or storage paths', () => {
        const all = logLines.join('\n');
        assert.ok(all.includes('Job application CV opened'));
        for (const s of ['Test Applicant', 'example.com', '/uploads/resumes', 'Priya']) assert.ok(!all.includes(s), `log contains ${s}`);
    });
});
