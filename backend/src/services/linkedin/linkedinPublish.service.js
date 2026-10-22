const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const env = require('../../config/env');
const s3Client = require('../../config/s3');
const Blog = require('../../models/Blog');
const LinkedInPublication = require('../../models/LinkedInPublication');
const { AppError } = require('../../middleware/errorHandler');
const HTTP_STATUS = require('../../constants/httpStatus');
const logger = require('../../utils/logger');
const client = require('./linkedinClient');
const connection = require('./linkedinConnection.service');

const { LinkedInError } = client;

// Share to LinkedIn: a published blog becomes one article post on the company
// page — the admin's caption and the blog's canonical address as the
// commentary, with an article card carrying the blog title, a short
// description, the link, and the featured image uploaded as its thumbnail.
//
// Everything that reaches LinkedIn is taken from the stored blog and the
// server configuration. The browser supplies only the blog ID and the caption:
// not the page, not the URL, not the image. The image is read from the CMS's
// own storage (S3 by key, or the local uploads folder), never fetched from an
// address, so nothing here can be pointed at an arbitrary URL.
//
// A publication runs in the background after the request is accepted (the
// whole sequence can take longer than the proxy in front of the API waits);
// the CMS follows it through GET .../publication.

const MAX_CAPTION = 2800;
const MAX_DESCRIPTION = 200;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
// A publication still "publishing" after this long was interrupted (the
// server restarted mid-way). Far longer than the slowest possible run.
const STALE_MS = 10 * 60 * 1000;
const DESTINATION_LABEL = 'Surjit Finance Company Page';

// ── Errors the CMS acts on ────────────────────────────────────────────────────

// An AppError whose first error entry carries a stable code, so the CMS can
// tell "already published" from "reconnect required" without parsing text.
const fail = (status, code, message) => new AppError(message, status, [{ field: 'linkedin', code, message }]);

// ── Text ──────────────────────────────────────────────────────────────────────

// LinkedIn's "little" text format reserves these characters; each must be
// backslash-escaped to appear as itself. A '#' that starts a word is left as
// a hashtag, which is how the format marks one.
const RESERVED = /[|{}@[\]()<>#\\*_~]/g;
const HAS_RESERVED = /[|{}@[\]()<>#\\*_~]/;

const escapeLittle = (text) => String(text).replace(RESERVED, (ch, offset, whole) => {
    if (ch === '#') {
        const before = offset === 0 ? '' : whole[offset - 1];
        const after = whole[offset + 1] || '';
        if ((before === '' || /\s/.test(before)) && /[\p{L}\p{N}]/u.test(after)) return ch;
    }
    return `\\${ch}`;
});

// The caption as it will be stored and sent: line endings normalised, control
// characters removed, runs of blank lines collapsed. Throws on empty or long.
const normalizeCaption = (input) => {
    if (typeof input !== 'string') throw fail(HTTP_STATUS.BAD_REQUEST, 'CAPTION_INVALID', 'The caption must be text.');
    const text = input
        .replace(/\r\n?/g, '\n')
        .replace(/\t/g, ' ')
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    if (!text) throw fail(HTTP_STATUS.BAD_REQUEST, 'CAPTION_REQUIRED', 'Write a caption for the LinkedIn post.');
    if (text.length > MAX_CAPTION) {
        throw fail(HTTP_STATUS.BAD_REQUEST, 'CAPTION_TOO_LONG', `The caption must be at most ${MAX_CAPTION} characters (it is ${text.length}).`);
    }
    return text;
};

const shorten = (text, max) => {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (clean.length <= max) return clean;
    const cut = clean.slice(0, max - 1);
    const space = cut.lastIndexOf(' ');
    return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
};

const defaultCaption = (blog) => shorten(blog.summary, 700);

// ── The blog's address and image ──────────────────────────────────────────────

const SLUG_RX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// {PUBLIC_SITE_URL}/blogs/{slug} — the address the website serves the blog at.
// Checked to contain nothing LinkedIn's text format would reinterpret, since
// it goes into the commentary unescaped (escaping would break the link).
const canonicalUrlFor = (blog) => {
    let base;
    try {
        base = new URL(env.PUBLIC_SITE_URL);
    } catch {
        throw fail(HTTP_STATUS.CONFLICT, 'SITE_URL_NOT_CONFIGURED', 'PUBLIC_SITE_URL is not set on the server, so the blog\'s public address is unknown.');
    }
    const httpsOk = base.protocol === 'https:' || (env.NODE_ENV !== 'production' && base.protocol === 'http:');
    if (!httpsOk || base.search || base.hash || base.username) {
        throw fail(HTTP_STATUS.CONFLICT, 'SITE_URL_NOT_CONFIGURED', 'PUBLIC_SITE_URL must be the website\'s HTTPS address, e.g. https://surjitfinance.com.');
    }
    if (!SLUG_RX.test(blog.slug || '')) {
        throw fail(HTTP_STATUS.CONFLICT, 'BLOG_SLUG_INVALID', 'This blog\'s slug is not a plain lowercase, hyphenated slug, so a safe public address cannot be built for it.');
    }
    const url = `${base.origin}${base.pathname.replace(/\/+$/, '')}/blogs/${blog.slug}`;
    if (HAS_RESERVED.test(url)) {
        throw fail(HTTP_STATUS.CONFLICT, 'SITE_URL_NOT_CONFIGURED', 'PUBLIC_SITE_URL contains characters LinkedIn would not keep in a link.');
    }
    return url;
};

// The image type from its first bytes, not from a file name or a header.
// LinkedIn's Images API accepts JPG, PNG and GIF.
const sniffImageType = (buf) => {
    if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
    if (buf.length >= 8 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
    if (buf.length >= 6 && (buf.slice(0, 6).toString('ascii') === 'GIF87a' || buf.slice(0, 6).toString('ascii') === 'GIF89a')) return 'image/gif';
    if (buf.length >= 12 && buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
    return '';
};

const uploadsRoot = path.join(__dirname, '..', '..', 'uploads');

const streamToBuffer = async (stream) => {
    const chunks = [];
    let size = 0;
    for await (const chunk of stream) {
        size += chunk.length;
        if (size > MAX_IMAGE_BYTES) throw fail(HTTP_STATUS.CONFLICT, 'IMAGE_TOO_LARGE', 'The featured image is larger than 10 MB.');
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
};

// Reads the blog's featured image from the CMS's own storage.
const readFeaturedImage = async (blog) => {
    const image = blog.featuredImage || {};
    if (!image.url) throw fail(HTTP_STATUS.CONFLICT, 'IMAGE_MISSING', 'This blog has no featured image. Add one before sharing it to LinkedIn.');

    let buffer;
    const isS3 = !!(env.AWS_S3_BUCKET_NAME && env.AWS_ACCESS_KEY_ID);
    if (isS3) {
        const key = String(image.fileName || '');
        if (!key || key.startsWith('/') || key.includes('..')) {
            throw fail(HTTP_STATUS.CONFLICT, 'IMAGE_UNAVAILABLE', 'The featured image is not stored in the CMS\'s storage, so it cannot be shared.');
        }
        try {
            const object = await s3Client.send(new GetObjectCommand({ Bucket: env.AWS_S3_BUCKET_NAME, Key: key }));
            if (object.ContentLength && object.ContentLength > MAX_IMAGE_BYTES) {
                throw fail(HTTP_STATUS.CONFLICT, 'IMAGE_TOO_LARGE', 'The featured image is larger than 10 MB.');
            }
            buffer = await streamToBuffer(object.Body);
        } catch (err) {
            if (err instanceof AppError) throw err;
            throw fail(HTTP_STATUS.CONFLICT, 'IMAGE_UNAVAILABLE', 'The featured image could not be read from storage.');
        }
    } else {
        // Local uploads: "/uploads/<folder>/<file>", resolved under the
        // uploads folder and refused if it would leave it.
        if (!String(image.url).startsWith('/uploads/')) {
            throw fail(HTTP_STATUS.CONFLICT, 'IMAGE_UNAVAILABLE', 'The featured image is not stored in the CMS\'s storage, so it cannot be shared.');
        }
        const filePath = path.resolve(uploadsRoot, String(image.url).slice('/uploads/'.length));
        if (!filePath.startsWith(uploadsRoot + path.sep) || !fs.existsSync(filePath)) {
            throw fail(HTTP_STATUS.CONFLICT, 'IMAGE_UNAVAILABLE', 'The featured image file is missing from storage.');
        }
        if (fs.statSync(filePath).size > MAX_IMAGE_BYTES) {
            throw fail(HTTP_STATUS.CONFLICT, 'IMAGE_TOO_LARGE', 'The featured image is larger than 10 MB.');
        }
        buffer = fs.readFileSync(filePath);
    }

    const contentType = sniffImageType(buffer);
    if (contentType === 'image/webp') {
        throw fail(HTTP_STATUS.CONFLICT, 'IMAGE_FORMAT_UNSUPPORTED', 'The featured image is a WebP file, which LinkedIn does not accept. Replace it with a JPG or PNG.');
    }
    if (!contentType) {
        throw fail(HTTP_STATUS.CONFLICT, 'IMAGE_FORMAT_UNSUPPORTED', 'The featured image is not a JPG, PNG or GIF file.');
    }
    return { buffer, contentType };
};

// ── Lookups ───────────────────────────────────────────────────────────────────

const loadPublishedBlog = async (blogId) => {
    if (!mongoose.Types.ObjectId.isValid(blogId)) throw fail(HTTP_STATUS.BAD_REQUEST, 'BLOG_ID_INVALID', 'That is not a valid blog ID.');
    const blog = await Blog.findById(blogId).select('title slug summary status featuredImage publishedAt');
    if (!blog) throw fail(HTTP_STATUS.NOT_FOUND, 'BLOG_NOT_FOUND', 'Blog not found.');
    if (blog.status !== 'published') {
        throw fail(HTTP_STATUS.CONFLICT, 'BLOG_NOT_PUBLISHED', 'Only a published blog can be shared to LinkedIn. Publish it on the website first.');
    }
    return blog;
};

// Marks a publication the server stopped working on (a restart mid-way) so it
// does not stay "publishing" for ever. Interrupted before the post request:
// known not to be on LinkedIn. Interrupted during it: unknown.
const recoverStale = async (blogId) => {
    const cutoff = new Date(Date.now() - STALE_MS);
    await LinkedInPublication.updateOne(
        { blog: blogId, status: 'publishing', lastAttemptAt: { $lt: cutoff }, stage: { $ne: 'creating_post' } },
        { $set: { status: 'failed', error: { code: 'INTERRUPTED', message: 'The server stopped before the post was sent to LinkedIn. Nothing was published; it can be retried.', httpStatus: null } } }
    );
    await LinkedInPublication.updateOne(
        { blog: blogId, status: 'publishing', lastAttemptAt: { $lt: cutoff }, stage: 'creating_post' },
        { $set: { status: 'unknown', error: { code: 'INTERRUPTED', message: 'The server stopped while the post was being sent to LinkedIn, so it may have been published. Check the company page before deciding.', httpStatus: null } } }
    );
};

const toView = (pub) => {
    if (!pub) return null;
    const by = (a) => (a && a.name ? { name: a.name } : null);
    return {
        id: String(pub._id),
        blogId: String(pub.blog),
        status: pub.status,
        stage: pub.stage,
        organizationId: pub.organizationId,
        caption: pub.caption,
        canonicalUrl: pub.canonicalUrl,
        postUrn: pub.postUrn || '',
        postUrl: pub.postUrl || '',
        publishedAt: pub.publishedAt,
        publishedBy: by(pub.publishedBy),
        lastAttemptAt: pub.lastAttemptAt,
        lastAttemptBy: by(pub.lastAttemptBy),
        error: pub.error?.code ? { code: pub.error.code, message: pub.error.message } : null,
        attemptCount: pub.attempts?.length || 0
    };
};

const getPublication = async (blogId) => {
    if (!mongoose.Types.ObjectId.isValid(blogId)) throw fail(HTTP_STATUS.BAD_REQUEST, 'BLOG_ID_INVALID', 'That is not a valid blog ID.');
    await recoverStale(blogId);
    const pub = await LinkedInPublication.findOne({ blog: blogId })
        .populate('publishedBy', 'name').populate('lastAttemptBy', 'name');
    return toView(pub);
};

// ── Preview ───────────────────────────────────────────────────────────────────

// Everything the share dialog shows before anything is sent, plus what stands
// in the way of publishing. Publishes nothing and writes nothing.
const getPreview = async (blogId) => {
    const blog = await loadPublishedBlog(blogId);
    const blockers = [];
    const note = (err) => blockers.push({ code: err.errors?.[0]?.code || 'UNKNOWN', message: err.message });

    let canonicalUrl = '';
    try { canonicalUrl = canonicalUrlFor(blog); } catch (err) { note(err); }
    try { await readFeaturedImage(blog); } catch (err) { note(err); }

    const status = await connection.getStatus();
    if (status.state !== 'connected') {
        const messages = {
            not_configured: 'LinkedIn is not configured on the server yet.',
            not_connected: 'LinkedIn is not connected. An admin with API Settings access must connect it first.',
            reconnect_required: 'The LinkedIn connection must be renewed on the API Settings page.'
        };
        blockers.push({ code: status.state.toUpperCase(), message: messages[status.state] });
    }

    const publication = await getPublication(blogId);
    return {
        blog: { id: String(blog._id), title: blog.title, slug: blog.slug, publishedAt: blog.publishedAt },
        defaultCaption: defaultCaption(blog),
        maxCaptionLength: MAX_CAPTION,
        canonicalUrl,
        image: { url: blog.featuredImage?.url || '' },
        destination: {
            label: DESTINATION_LABEL,
            organizationId: status.organizationId,
            organizationUrn: status.organizationUrn
        },
        connection: { state: status.state, reconnectCode: status.reconnectCode || '' },
        publication,
        ready: blockers.length === 0 && !(publication && ['published', 'publishing', 'unknown'].includes(publication.status)),
        blockers
    };
};

// ── Publishing ────────────────────────────────────────────────────────────────

const inFlight = new Set();
// Tests (and a graceful shutdown) can wait for background publications.
const waitForIdle = () => Promise.allSettled([...inFlight]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Only ugcPost URNs have a viewing URL documented by LinkedIn (Posts API:
// https://www.linkedin.com/feed/update/urn:li:ugcPost:<id>/). For anything
// else the URN is shown without a link rather than a guessed address.
const postUrlFor = (postUrn) => (/^urn:li:ugcPost:[0-9]+$/.test(postUrn) ? `https://www.linkedin.com/feed/update/${postUrn}/` : '');

const attemptFilter = (startedAt) => ({ arrayFilters: [{ 'a.startedAt': startedAt }] });

const setStage = (id, stage, extra = {}) => LinkedInPublication.updateOne(
    { _id: id, status: 'publishing' },
    { $set: { stage, ...extra } }
);

const finishFailed = async (id, startedAt, err) => {
    const ambiguous = err instanceof LinkedInError && err.ambiguous;
    const code = err instanceof LinkedInError ? err.code : (err?.errors?.[0]?.code || 'UNEXPECTED');
    const message = (err instanceof LinkedInError || err instanceof AppError)
        ? err.message
        : 'An unexpected error stopped the publication before it completed.';
    const status = ambiguous ? 'unknown' : 'failed';
    await LinkedInPublication.updateOne(
        { _id: id, status: 'publishing' },
        {
            $set: {
                status,
                error: { code, message: message.slice(0, 500), httpStatus: err?.status || null },
                'attempts.$[a].outcome': status,
                'attempts.$[a].finishedAt': new Date(),
                'attempts.$[a].code': code
            }
        },
        attemptFilter(startedAt)
    );
    if (code === 'TOKEN_REJECTED') await connection.markReconnectRequired('TOKEN_REJECTED');
    logger.warn('LinkedIn publication did not complete', { publication: String(id), status, code, httpStatus: err?.status || null });
};

// The background part: upload the image, wait for LinkedIn to finish
// processing it, then create the post — once. Every failure before the post
// request is a known failure; only the post request itself can be ambiguous.
const runPublication = async ({ id, startedAt, cfg, accessToken, organizationId, adminId, image, post }) => {
    const ownerUrn = connection.organizationUrn(organizationId);
    try {
        await setStage(id, 'uploading_image');
        const { uploadUrl, imageUrn } = await client.initializeImageUpload(cfg, accessToken, ownerUrn);
        await client.uploadImage(accessToken, uploadUrl, image.buffer, image.contentType);

        await setStage(id, 'processing_image', { imageUrn });
        let available = false;
        for (let i = 0; i < env.LINKEDIN_IMAGE_POLL_ATTEMPTS && !available; i++) {
            const status = await client.getImageStatus(cfg, accessToken, imageUrn);
            if (status === 'AVAILABLE') available = true;
            else if (status === 'PROCESSING_FAILED') {
                throw new LinkedInError('IMAGE_PROCESSING_FAILED', 'LinkedIn could not process the featured image. Try a different JPG or PNG.');
            } else await sleep(env.LINKEDIN_IMAGE_POLL_MS);
        }
        if (!available) {
            throw new LinkedInError('IMAGE_PROCESSING_TIMEOUT', 'LinkedIn was still processing the image after waiting. Nothing was published; try again in a few minutes.');
        }

        await setStage(id, 'creating_post');
        const { postUrn } = await client.createPost(cfg, accessToken, {
            author: ownerUrn,
            commentary: post.commentary,
            visibility: 'PUBLIC',
            distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
            content: {
                article: {
                    source: post.canonicalUrl,
                    thumbnail: imageUrn,
                    title: post.title,
                    description: post.description
                }
            },
            lifecycleState: 'PUBLISHED',
            isReshareDisabledByAuthor: false
        });

        // A post LinkedIn confirmed is recorded whatever else has happened to
        // the record meanwhile: losing the URN would invite a duplicate.
        const now = new Date();
        await LinkedInPublication.updateOne(
            { _id: id },
            {
                $set: {
                    status: 'published',
                    stage: 'done',
                    postUrn,
                    postUrl: postUrlFor(postUrn),
                    publishedAt: now,
                    publishedBy: adminId,
                    error: { code: '', message: '', httpStatus: null },
                    'attempts.$[a].outcome': 'published',
                    'attempts.$[a].finishedAt': now,
                    'attempts.$[a].code': ''
                }
            },
            attemptFilter(startedAt)
        );
        logger.info('LinkedIn publication completed', { publication: String(id), postUrn });
    } catch (err) {
        try {
            await finishFailed(id, startedAt, err);
        } catch (recordErr) {
            // The record stays "publishing" and is recovered as interrupted.
            logger.error('Could not record a LinkedIn publication failure', { publication: String(id), error: recordErr.message });
        }
    }
};

// Claims the blog's publication for this request, or explains why not.
// Exactly one request can move a record into "publishing".
const claim = async ({ blogId, organizationId, adminId, fields }) => {
    const startedAt = new Date();
    const attempt = { startedAt, by: adminId, outcome: 'publishing', code: '' };
    const fresh = {
        organizationId,
        status: 'publishing',
        stage: 'preparing',
        ...fields,
        imageUrn: '',
        lastAttemptAt: startedAt,
        lastAttemptBy: adminId,
        error: { code: '', message: '', httpStatus: null }
    };

    await recoverStale(blogId);
    const existing = await LinkedInPublication.findOne({ blog: blogId }).select('status');
    if (!existing) {
        try {
            const doc = await LinkedInPublication.create({ blog: blogId, ...fresh, attempts: [attempt] });
            return { id: doc._id, startedAt };
        } catch (err) {
            if (err?.code !== 11000) throw err;
            // Another request created it a moment ago.
            throw fail(HTTP_STATUS.CONFLICT, 'PUBLISH_IN_PROGRESS', 'This blog is already being shared to LinkedIn.');
        }
    }
    if (existing.status === 'failed') {
        const doc = await LinkedInPublication.findOneAndUpdate(
            { _id: existing._id, status: 'failed' },
            { $set: fresh, $push: { attempts: { $each: [attempt], $slice: -25 } } },
            { new: true }
        );
        if (doc) return { id: doc._id, startedAt };
        throw fail(HTTP_STATUS.CONFLICT, 'PUBLISH_IN_PROGRESS', 'This blog is already being shared to LinkedIn.');
    }
    if (existing.status === 'published') {
        throw fail(HTTP_STATUS.CONFLICT, 'ALREADY_PUBLISHED', 'This blog has already been published to LinkedIn.');
    }
    if (existing.status === 'publishing') {
        throw fail(HTTP_STATUS.CONFLICT, 'PUBLISH_IN_PROGRESS', 'This blog is already being shared to LinkedIn.');
    }
    throw fail(HTTP_STATUS.CONFLICT, 'OUTCOME_UNKNOWN', 'The last attempt may have published this blog. Check the company page and record the outcome before trying again.');
};

// Validates everything, claims the blog, then hands the LinkedIn calls to the
// background. Returns the publication in its "publishing" state.
const publish = async (blogId, { caption, confirm }, admin) => {
    if (confirm !== true) {
        throw fail(HTTP_STATUS.BAD_REQUEST, 'CONFIRMATION_REQUIRED', 'Publishing to LinkedIn needs explicit confirmation.');
    }
    const text = normalizeCaption(caption);
    const blog = await loadPublishedBlog(blogId);
    const canonicalUrl = canonicalUrlFor(blog);

    let token;
    try {
        token = await connection.getUsableAccessToken();
    } catch (err) {
        if (err instanceof LinkedInError) throw fail(HTTP_STATUS.CONFLICT, err.code, err.message);
        throw err;
    }
    const image = await readFeaturedImage(blog);

    const { id, startedAt } = await claim({
        blogId: blog._id,
        organizationId: token.organizationId,
        adminId: admin._id,
        fields: { caption: text, canonicalUrl, title: blog.title }
    });

    const job = runPublication({
        id,
        startedAt,
        cfg: token.cfg,
        accessToken: token.accessToken,
        organizationId: token.organizationId,
        adminId: admin._id,
        image,
        post: {
            commentary: `${escapeLittle(text)}\n\n${canonicalUrl}`,
            canonicalUrl,
            title: blog.title,
            description: shorten(blog.summary, MAX_DESCRIPTION)
        }
    }).finally(() => inFlight.delete(job));
    inFlight.add(job);

    return getPublication(blog._id);
};

// After an "unknown" outcome an admin checks the company page and records what
// they found: not there (the blog may then be shared again), or there, with
// the post's URN so the record is complete.
const resolveUnknown = async (blogId, { outcome, postUrn }, admin) => {
    if (!mongoose.Types.ObjectId.isValid(blogId)) throw fail(HTTP_STATUS.BAD_REQUEST, 'BLOG_ID_INVALID', 'That is not a valid blog ID.');
    const now = new Date();
    let update;
    if (outcome === 'not_published') {
        update = {
            status: 'failed',
            error: { code: 'CONFIRMED_NOT_PUBLISHED', message: `Confirmed not on LinkedIn by ${admin.name || 'an admin'}; it can be shared again.`, httpStatus: null }
        };
    } else if (outcome === 'published') {
        if (!/^urn:li:(share|ugcPost):[0-9]+$/.test(String(postUrn || ''))) {
            throw fail(HTTP_STATUS.BAD_REQUEST, 'POST_URN_INVALID', 'Enter the post URN, e.g. urn:li:share:1234567890.');
        }
        update = {
            status: 'published', stage: 'done', postUrn, postUrl: postUrlFor(postUrn),
            publishedAt: now, publishedBy: admin._id,
            error: { code: '', message: '', httpStatus: null }
        };
    } else {
        throw fail(HTTP_STATUS.BAD_REQUEST, 'OUTCOME_INVALID', 'Choose whether the post is on LinkedIn or not.');
    }
    const doc = await LinkedInPublication.findOneAndUpdate(
        { blog: blogId, status: 'unknown' },
        { $set: update, $push: { attempts: { $each: [{ startedAt: now, finishedAt: now, by: admin._id, outcome: 'resolved', code: outcome.toUpperCase() }], $slice: -25 } } },
        { new: true }
    );
    if (!doc) throw fail(HTTP_STATUS.CONFLICT, 'NOTHING_TO_RESOLVE', 'There is no uncertain LinkedIn publication for this blog.');
    return getPublication(blogId);
};

module.exports = {
    MAX_CAPTION,
    DESTINATION_LABEL,
    escapeLittle,
    normalizeCaption,
    canonicalUrlFor,
    sniffImageType,
    postUrlFor,
    getPreview,
    getPublication,
    publish,
    resolveUnknown,
    waitForIdle
};
