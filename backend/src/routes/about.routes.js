const express = require('express');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { createUpload } = require('../middleware/upload');
const { ROLES } = require('../constants/roles');

const companyController = require('../controllers/about/company.controller');
const directorController = require('../controllers/about/director.controller');
const leadershipController = require('../controllers/about/leadership.controller');

const {
    updateCompanyValidation
} = require('../validators/about/company.validator');
const {
    createDirectorValidation,
    updateDirectorValidation,
    reorderValidation: directorReorderValidation,
    transferValidation: directorTransferValidation
} = require('../validators/about/director.validator');
const {
    createLeadershipValidation,
    updateLeadershipValidation,
    reorderValidation: leadershipReorderValidation,
    transferValidation: leadershipTransferValidation
} = require('../validators/about/leadership.validator');

const router = express.Router();

const canManage = authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR);
const canRead = authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR, ROLES.CONTENT_MANAGER);

const imageUpload = createUpload({ folder: 'about', fileTypes: 'images' });

// ── Company Information ──────────────────────────────────────────────────────

router.get(
    '/company',
    auth,
    canRead,
    companyController.getCompanyInfo
);

router.put(
    '/company',
    auth,
    canManage,
    imageUpload.fields([
        { name: 'heroImage', maxCount: 1 },
        { name: 'aboutImage', maxCount: 1 }
    ]),
    updateCompanyValidation,
    validate,
    companyController.updateCompanyInfo
);

// ── Board of Directors ───────────────────────────────────────────────────────

router.get(
    '/directors',
    auth,
    canRead,
    directorController.getAllDirectors
);

router.post(
    '/directors',
    auth,
    canManage,
    imageUpload.single('photo'),
    createDirectorValidation,
    validate,
    directorController.createDirector
);

router.put(
    '/directors/:id',
    auth,
    canManage,
    imageUpload.single('photo'),
    updateDirectorValidation,
    validate,
    directorController.updateDirector
);

router.delete(
    '/directors/:id',
    auth,
    canManage,
    directorController.deleteDirector
);

router.patch(
    '/directors/reorder',
    auth,
    canManage,
    directorReorderValidation,
    validate,
    directorController.reorderDirectors
);

router.patch(
    '/directors/:id/status',
    auth,
    canManage,
    directorController.toggleStatus
);

router.post(
    '/directors/:id/transfer',
    auth,
    canManage,
    directorTransferValidation,
    validate,
    directorController.transferDirector
);

// ── Leadership Team ──────────────────────────────────────────────────────────

router.get(
    '/leadership',
    auth,
    canRead,
    leadershipController.getAllLeadershipMembers
);

router.post(
    '/leadership',
    auth,
    canManage,
    imageUpload.single('photo'),
    createLeadershipValidation,
    validate,
    leadershipController.createLeadershipMember
);

router.put(
    '/leadership/:id',
    auth,
    canManage,
    imageUpload.single('photo'),
    updateLeadershipValidation,
    validate,
    leadershipController.updateLeadershipMember
);

router.delete(
    '/leadership/:id',
    auth,
    canManage,
    leadershipController.deleteLeadershipMember
);

router.patch(
    '/leadership/reorder',
    auth,
    canManage,
    leadershipReorderValidation,
    validate,
    leadershipController.reorderLeadershipMembers
);

router.patch(
    '/leadership/:id/status',
    auth,
    canManage,
    leadershipController.toggleStatus
);

router.post(
    '/leadership/:id/transfer',
    auth,
    canManage,
    leadershipTransferValidation,
    validate,
    leadershipController.transferLeadershipMember
);

module.exports = router;
