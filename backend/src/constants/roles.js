const ROLES = {
    SUPER_ADMIN: 'super_admin',
    EDITOR: 'editor',
    CONTENT_MANAGER: 'content_manager'
};

const ROLE_LABELS = {
    [ROLES.SUPER_ADMIN]: 'Super Admin',
    [ROLES.EDITOR]: 'Editor',
    [ROLES.CONTENT_MANAGER]: 'Content Manager'
};

module.exports = { ROLES, ROLE_LABELS };
