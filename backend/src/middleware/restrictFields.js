const { sendError } = require('../utils/response');
const HTTP_STATUS = require('../constants/httpStatus');
const { ROLES } = require('../constants/roles');

// Fields a Content Manager must never change through an edit endpoint.
//
// Content Manager may edit the *content* of an existing record but not its
// lifecycle: publication, visibility, ordering, or identity. Those live behind
// dedicated status/publish/reorder routes that Content Manager cannot reach,
// so without this guard an edit request could be used to reach them anyway by
// simply including the field in the body.
const PROTECTED_FIELDS = [
    // publication / visibility
    'status', 'isActive', 'isPublished', 'published', 'publishedAt',
    'approvedAt', 'active',
    // ordering
    'displayOrder', 'order', 'sortOrder',
    // identity / lifecycle, never client-controlled for any role
    '_id', 'id', '__v', 'createdAt', 'updatedAt', 'deletedAt'
];

// Rejects rather than silently stripping: a Content Manager who tries to
// publish through an edit form should be told the request was refused, not
// left believing it succeeded.
const blockProtectedFields = (req, res, next) => {
    if (!req.user || req.user.role !== ROLES.CONTENT_MANAGER) return next();
    if (!req.body || typeof req.body !== 'object') return next();

    const attempted = PROTECTED_FIELDS.filter((f) => req.body[f] !== undefined);
    if (attempted.length > 0) {
        return sendError(
            res,
            `You do not have permission to change: ${attempted.join(', ')}`,
            [],
            HTTP_STATUS.FORBIDDEN
        );
    }

    return next();
};

module.exports = { blockProtectedFields, PROTECTED_FIELDS };
