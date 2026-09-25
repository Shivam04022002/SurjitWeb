const { body, param } = require('express-validator');
const { ROLE_STATUS } = require('../models/Role');

// Shape only. What the permission values mean, and whether a page exists, is
// decided in the service against the catalogue — one place, not two.

const roleIdRule = [param('id').isMongoId().withMessage('Invalid role id')];

const nameRule = (required) => {
    const chain = body('name').trim();
    return (required
        ? chain.notEmpty().withMessage('Role name is required')
        : chain.optional().notEmpty().withMessage('Role name cannot be empty'))
        .isLength({ max: 60 }).withMessage('Role name must not exceed 60 characters');
};

const sharedRules = (required) => [
    nameRule(required),

    body('description').optional({ checkFalsy: true }).trim()
        .isLength({ max: 250 }).withMessage('Description must not exceed 250 characters'),

    body('status').optional().isIn(ROLE_STATUS)
        .withMessage(`Status must be one of: ${ROLE_STATUS.join(', ')}`),

    body('permissions').optional().isObject()
        .withMessage('Permissions must be a map of page to access level'),

    // The key and the stored permission list belong to the server: a role is
    // described by pages and access levels, never by raw permission strings.
    body('key').not().exists().withMessage('The role key is derived from its name'),
    body('isSystem').not().exists().withMessage('System roles are defined by the application')
];

const createRoleValidation = [
    ...sharedRules(true),
    body('permissions').optional()
];

const updateRoleValidation = [...roleIdRule, ...sharedRules(false)];

module.exports = { roleIdRule, createRoleValidation, updateRoleValidation };
