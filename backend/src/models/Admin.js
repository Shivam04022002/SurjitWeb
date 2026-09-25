const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES } = require('../constants/roles');
const env = require('../config/env');

const adminSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [8, 'Password must be at least 8 characters long']
    },
    // The key of a role in the roles collection. Roles are created and
    // renamed by administrators, so the set of valid keys is not fixed here;
    // assignment is checked against the roles collection where it happens, and
    // a key that no longer resolves simply carries no permissions.
    role: {
        type: String,
        required: [true, 'Role is required'],
        trim: true,
        lowercase: true,
        default: ROLES.CONTENT_MANAGER
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastLoginAt: {
        type: Date
    },
    deletedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

adminSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.password;
    return obj;
};

adminSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        return next();
    }
    const isAlreadyHashed = this.password.startsWith('$2a$') || this.password.startsWith('$2b$');
    if (!isAlreadyHashed) {
        this.password = await bcrypt.hash(this.password, env.BCRYPT_SALT_ROUNDS);
    }
    next();
});

adminSchema.pre(/^find/, function (next) {
    if (this.getFilter().deletedAt === undefined) {
        this.where({ deletedAt: null });
    }
    next();
});

adminSchema.index({ role: 1 });
adminSchema.index({ isActive: 1 });
adminSchema.index({ deletedAt: 1 });

module.exports = mongoose.model('Admin', adminSchema);
