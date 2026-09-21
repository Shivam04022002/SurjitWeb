const mongoose = require('mongoose');

// Idempotency record for saving a Gemini-generated draft.
//
// Saving a month of drafts means many requests, and any of them can succeed on
// the server while the response is lost on the way back. The CMS then retries
// that row with the same key, and this record turns the retry into "here is
// the draft you already saved" instead of a duplicate blog.
//
// It holds no blog content — only which admin sent which key and the blog it
// produced — and expires on its own after a week.
const geminiDraftRequestSchema = new mongoose.Schema({
    // `${adminId}:${clientKey}`, so one admin's keys never collide with another's.
    key: {
        type: String,
        required: true,
        unique: true,
        maxlength: 120
    },
    blog: { type: mongoose.Schema.Types.ObjectId, ref: 'Blog', default: null },
    createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 7 }
});

module.exports = mongoose.model('GeminiDraftRequest', geminiDraftRequestSchema);
