const mongoose = require('mongoose');
const { ROLES } = require('../constants/roles');
const { normalisePermissions } = require('../constants/permissions');

// A CMS role and what it may reach.
//
// `key` is the stable identifier. Every admin already stores its role as one
// of these keys, and tokens, tests and existing records all use them, so the
// key is what a role is referred to by — never its database id, and never its
// display name, which an administrator may change at any time.
//
// The three roles the CMS shipped with are system roles: they are created if
// missing, never deleted, and Super Admin's reach cannot be reduced.

const SYSTEM_ROLE_KEYS = [ROLES.SUPER_ADMIN, ROLES.EDITOR, ROLES.CONTENT_MANAGER];

const ROLE_STATUS = ['Active', 'Inactive'];

// "HR Admin", " hr admin " and "HR  ADMIN" are the same name. Comparison is
// done on this form, so casing and spacing cannot produce two roles an
// administrator would read as one.
const normaliseName = (name) => String(name || '').trim().replace(/\s+/g, ' ');
const comparableName = (name) => normaliseName(name).toLowerCase();

// The key generated for a new role, from its name: lower case, words joined by
// underscores, matching the shape of the keys already in the database.
const keyFromName = (name) => comparableName(name)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);

const roleSchema = new mongoose.Schema({
    key: {
        type: String,
        required: [true, 'Role key is required'],
        trim: true,
        lowercase: true,
        maxlength: [40, 'Role key must not exceed 40 characters'],
        match: [/^[a-z0-9_]+$/, 'Role key may contain only lowercase letters, numbers and underscores']
    },
    name: {
        type: String,
        required: [true, 'Role name is required'],
        trim: true,
        maxlength: [60, 'Role name must not exceed 60 characters']
    },
    // Set from `name` on every save, and the field the unique index is built
    // on, so duplicates differing only in case or spacing cannot be created.
    nameKey: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    description: {
        type: String,
        trim: true,
        default: '',
        maxlength: [250, 'Description must not exceed 250 characters']
    },
    // Page permissions, stored flat: 'blogs.view', 'blogs.edit', … Always
    // normalised on save, so an edit is never stored without its view.
    permissions: {
        type: [String],
        default: []
    },
    // A system role exists because the application depends on it. It cannot be
    // deleted or renamed out of existence, and Super Admin cannot be reduced.
    isSystem: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ROLE_STATUS,
        default: 'Active'
    }
}, {
    timestamps: true
});

roleSchema.index({ key: 1 }, { unique: true });
roleSchema.index({ nameKey: 1 }, { unique: true });
roleSchema.index({ status: 1, name: 1 });

roleSchema.pre('validate', function setDerivedFields(next) {
    if (this.name) {
        this.name = normaliseName(this.name);
        this.nameKey = comparableName(this.name);
    }
    // Super Admin is the role that can repair everything else, including a
    // mistake made on this page. Its reach is not editable, here or anywhere.
    if (this.key === ROLES.SUPER_ADMIN) {
        this.isSystem = true;
        this.status = 'Active';
    }
    this.permissions = normalisePermissions(this.permissions);
    next();
});

module.exports = mongoose.model('Role', roleSchema);
module.exports.SYSTEM_ROLE_KEYS = SYSTEM_ROLE_KEYS;
module.exports.ROLE_STATUS = ROLE_STATUS;
module.exports.normaliseName = normaliseName;
module.exports.comparableName = comparableName;
module.exports.keyFromName = keyFromName;
