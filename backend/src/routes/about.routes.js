const express = require('express');
const auth = require('../middleware/auth');
const { canView: viewPage, canEdit: editPage } = require('../middleware/permission');
const { blockProtectedFields } = require('../middleware/restrictFields');
const validate = require('../middleware/validate');
const { createUpload } = require('../middleware/upload');

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

// Editing an existing record is open to Content Manager; creating,
// deleting, publishing, changing status and reordering are not. The
// blockProtectedFields guard stops an edit body reaching those anyway.

const imageUpload = createUpload({ folder: 'about', fileTypes: 'images' });

// ── Company Information ──────────────────────────────────────────────────────

router.get(
    '/company',
    auth,
    viewPage('company'),
    companyController.getCompanyInfo
);

router.put(
    '/company',
    auth,
    editPage('company'), blockProtectedFields,
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
    viewPage('directors'),
    directorController.getAllDirectors
);

router.post(
    '/directors',
    auth,
    editPage('directors'),
    imageUpload.single('photo'),
    createDirectorValidation,
    validate,
    directorController.createDirector
);

router.put(
    '/directors/:id',
    auth,
    editPage('directors'), blockProtectedFields,
    imageUpload.single('photo'),
    updateDirectorValidation,
    validate,
    directorController.updateDirector
);

router.delete(
    '/directors/:id',
    auth,
    editPage('directors'),
    directorController.deleteDirector
);

router.patch(
    '/directors/reorder',
    auth,
    editPage('directors'),
    directorReorderValidation,
    validate,
    directorController.reorderDirectors
);

router.patch(
    '/directors/:id/status',
    auth,
    editPage('directors'),
    directorController.toggleStatus
);

router.post(
    '/directors/:id/transfer',
    auth,
    editPage('directors'),
    directorTransferValidation,
    validate,
    directorController.transferDirector
);

// ── Leadership Team ──────────────────────────────────────────────────────────

router.get(
    '/leadership',
    auth,
    viewPage('leadership'),
    leadershipController.getAllLeadershipMembers
);

router.post(
    '/leadership',
    auth,
    editPage('leadership'),
    imageUpload.single('photo'),
    createLeadershipValidation,
    validate,
    leadershipController.createLeadershipMember
);

router.put(
    '/leadership/:id',
    auth,
    editPage('leadership'), blockProtectedFields,
    imageUpload.single('photo'),
    updateLeadershipValidation,
    validate,
    leadershipController.updateLeadershipMember
);

router.delete(
    '/leadership/:id',
    auth,
    editPage('leadership'),
    leadershipController.deleteLeadershipMember
);

router.patch(
    '/leadership/reorder',
    auth,
    editPage('leadership'),
    leadershipReorderValidation,
    validate,
    leadershipController.reorderLeadershipMembers
);

router.patch(
    '/leadership/:id/status',
    auth,
    editPage('leadership'),
    leadershipController.toggleStatus
);

router.post(
    '/leadership/:id/transfer',
    auth,
    editPage('leadership'),
    leadershipTransferValidation,
    validate,
    leadershipController.transferLeadershipMember
);

module.exports = router;
