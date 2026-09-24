const mongoose = require('mongoose');

// The CMS uses 'Published' / 'Draft' across content modules; advertisements
// follow the same vocabulary rather than introducing a second one.
const AD_STATUS = ['Published', 'Draft'];

// A promotional advertisement the website will later show as a popup.
//
// Exactly one advertisement may be Published at a time: the partial unique
// index below is what guarantees it. Every Published document has the same
// index key ('Published'), so the database refuses a second one — the rule
// holds even if two admins publish at the same moment, and it cannot be
// bypassed from the CMS.
//
// The image is added in a later phase, so `imageUrl` stays empty for now.
const advertisementSchema = new mongoose.Schema({
    // What the advertisement is called in the CMS list; never shown publicly.
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        maxlength: [150, 'Name must not exceed 150 characters']
    },
    // The advertisement artwork, uploaded through the CMS: the address the
    // browser loads, and the storage key beside it so a replaced image can be
    // removed safely. Both empty until an image is uploaded.
    imageUrl: {
        type: String,
        trim: true,
        default: '',
        maxlength: [500, 'Image URL must not exceed 500 characters']
    },
    // S3 object key, or the path under the local uploads root. Internal.
    imageFileName: {
        type: String,
        trim: true,
        default: '',
        maxlength: [500, 'Image file name must not exceed 500 characters']
    },
    // Where the advertisement's button sends a visitor: a page on this site
    // ("/loan-application") or a full http(s) address.
    applyUrl: {
        type: String,
        trim: true,
        default: '',
        maxlength: [500, 'Apply URL must not exceed 500 characters']
    },
    applyButtonText: {
        type: String,
        trim: true,
        default: 'Apply',
        maxlength: [40, 'Apply button text must not exceed 40 characters']
    },
    status: {
        type: String,
        enum: AD_STATUS,
        default: 'Draft'
    },
    // When this advertisement was published; null whenever it is a draft.
    publishedAt: { type: Date, default: null }
}, {
    timestamps: true
});

// The CMS list: newest first, optionally filtered by status.
advertisementSchema.index({ createdAt: -1 });
advertisementSchema.index({ status: 1, createdAt: -1 });

// At most one Published advertisement, enforced by the database itself.
advertisementSchema.index(
    { status: 1 },
    { unique: true, partialFilterExpression: { status: 'Published' }, name: 'one_published_advertisement' }
);

module.exports = mongoose.model('Advertisement', advertisementSchema);
module.exports.AD_STATUS = AD_STATUS;
