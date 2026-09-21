const mongoose = require('mongoose');
const { EVENT_ACTION_KEYS } = require('../constants/analyticsEvents');

// One document per tracked user action (a CTA, phone, email or content click)
// on the public website. The companion of WebsiteVisit, and just as anonymous:
// the same browser-generated sessionId, no IP, no user-agent, and nothing the
// visitor typed. For tel:/mailto:/external links the destination is not stored
// at all — only that the action happened and on which page.
const websiteEventSchema = new mongoose.Schema({
    sessionId: {
        type: String,
        required: true,
        trim: true,
        maxlength: 64
    },
    action: {
        type: String,
        required: true,
        enum: EVENT_ACTION_KEYS
    },
    // The page the click happened on. Route path only.
    path: {
        type: String,
        required: true,
        trim: true,
        maxlength: 300
    },
    // Internal destination path, when the click led to another page on this
    // site. Empty for phone, email, map and other external targets.
    target: {
        type: String,
        trim: true,
        default: '',
        maxlength: 300
    },
    occurredAt: { type: Date, default: Date.now }
}, {
    timestamps: false
});

websiteEventSchema.index({ occurredAt: -1 });
websiteEventSchema.index({ action: 1, occurredAt: -1 });
websiteEventSchema.index({ sessionId: 1, occurredAt: -1 });

module.exports = mongoose.model('WebsiteEvent', websiteEventSchema);
