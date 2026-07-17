const mongoose = require('mongoose');

const leadershipMemberSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true
    },
    designation: {
        type: String,
        required: [true, 'Designation is required'],
        trim: true
    },
    photo: {
        url: { type: String, default: '' },
        fileName: { type: String, default: '' },
        size: { type: Number, default: 0 }
    },
    description: {
        type: String,
        trim: true,
        default: ''
    },
    // Optional, and not surfaced on the Leadership admin page. It exists so a
    // director's LinkedIn URL survives a transfer to the Leadership Team and a
    // transfer back; existing records simply have no value for it.
    linkedinUrl: {
        type: String,
        trim: true,
        default: ''
    },
    displayOrder: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

leadershipMemberSchema.index({ displayOrder: 1 });
leadershipMemberSchema.index({ isActive: 1 });

module.exports = mongoose.model('LeadershipMember', leadershipMemberSchema);
