const mongoose = require('mongoose');

// A blog's publication to the LinkedIn Company Page: at most one per blog,
// kept apart from the blog itself so the blog document is untouched.
//
// The unique index on `blog` is what stops a blog being posted twice: a second
// publish request cannot create a second record, and the status transitions
// below are made with conditional updates, so only one request can ever be
// running a publication for a blog.
//
//   publishing  a request is running; `stage` says how far it has got
//   published   LinkedIn returned the post's URN, stored in `postUrn`
//   failed      LinkedIn refused, or the request stopped before the post was
//               sent — known not to be on LinkedIn, so it may be retried
//   unknown     the post request was sent but no answer came back (timeout,
//               dropped connection, server error). The post may exist, so it
//               is NOT retried automatically: an admin checks the page and
//               then records the outcome.
//
// No token or credential is ever stored here.
const STATUSES = ['publishing', 'published', 'failed', 'unknown'];
const STAGES = ['preparing', 'uploading_image', 'processing_image', 'creating_post', 'done'];

const attemptSchema = new mongoose.Schema({
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date, default: null },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
    outcome: { type: String, enum: [...STATUSES, 'resolved'], default: 'publishing' },
    code: { type: String, default: '', maxlength: 60 }
}, { _id: false });

const linkedInPublicationSchema = new mongoose.Schema({
    blog: { type: mongoose.Schema.Types.ObjectId, ref: 'Blog', required: true, unique: true },
    organizationId: { type: String, required: true, maxlength: 30 },
    status: { type: String, enum: STATUSES, required: true, index: true },
    stage: { type: String, enum: STAGES, default: 'preparing' },

    // What was sent, as the admin approved it.
    caption: { type: String, default: '', maxlength: 3000 },
    canonicalUrl: { type: String, default: '', maxlength: 500 },
    title: { type: String, default: '', maxlength: 300 },

    imageUrn: { type: String, default: '', maxlength: 200 },
    postUrn: { type: String, default: '', maxlength: 200 },
    // Only set when LinkedIn documents a viewing URL for the returned URN type.
    postUrl: { type: String, default: '', maxlength: 300 },

    lastAttemptAt: { type: Date, default: null },
    lastAttemptBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
    publishedAt: { type: Date, default: null },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },

    // A safe code and a message written by this application — never a raw
    // LinkedIn response body.
    error: {
        _id: false,
        code: { type: String, default: '', maxlength: 60 },
        message: { type: String, default: '', maxlength: 500 },
        httpStatus: { type: Number, default: null }
    },

    // Every attempt, newest last, capped so the record cannot grow without bound.
    attempts: {
        type: [attemptSchema],
        default: [],
        validate: { validator: (v) => v.length <= 25, message: 'At most 25 attempts are kept' }
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('LinkedInPublication', linkedInPublicationSchema);
module.exports.STATUSES = STATUSES;
module.exports.STAGES = STAGES;
