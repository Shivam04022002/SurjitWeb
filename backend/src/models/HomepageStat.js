const mongoose = require('mongoose');

const STAT_STATUS = ['Published', 'Draft'];

const homepageStatSchema = new mongoose.Schema({
    // The label under the number, e.g. "Branches".
    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true,
        maxlength: [100, 'Title must not exceed 100 characters']
    },
    // The figure as it should read, e.g. "35+", "10K+", "₹50Cr+". Stored as one
    // string so an editor types exactly what a visitor sees; the homepage splits
    // it into prefix / number / suffix to drive the existing count-up animation.
    value: {
        type: String,
        required: [true, 'Value is required'],
        trim: true,
        maxlength: [20, 'Value must not exceed 20 characters']
    },
    // Reserved: not rendered anywhere yet.
    icon: {
        type: String,
        trim: true,
        default: '',
        maxlength: [50, 'Icon must not exceed 50 characters']
    },
    status: {
        type: String,
        enum: STAT_STATUS,
        default: 'Draft',
        index: true
    },
    displayOrder: { type: Number, default: 0 }
}, {
    timestamps: true
});

// Backs the homepage: published, in display order, oldest first as a stable
// tie-break so equal orders never shuffle between requests.
homepageStatSchema.index({ status: 1, displayOrder: 1, createdAt: 1 });

module.exports = mongoose.model('HomepageStat', homepageStatSchema);
module.exports.STAT_STATUS = STAT_STATUS;
