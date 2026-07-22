const express = require('express');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { ROLES } = require('../constants/roles');

const statController = require('../controllers/homepageStat.controller');
const {
    createStatValidation,
    updateStatValidation,
    reorderStatsValidation
} = require('../validators/homepageStat.validator');

const router = express.Router();

const canManage = [auth, authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR)];
const canRead = [auth, authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR, ROLES.CONTENT_MANAGER)];
const superAdminOnly = [auth, authorize(ROLES.SUPER_ADMIN)];

// reorder before /:id so the word is never read as an id
router.get('/', canRead, statController.listStats);
router.patch('/reorder', canManage, reorderStatsValidation, validate, statController.reorderStats);
router.get('/:id', canRead, statController.getStatById);

router.post('/', canManage, createStatValidation, validate, statController.createStat);
router.put('/:id', canManage, updateStatValidation, validate, statController.updateStat);

router.delete('/:id', superAdminOnly, statController.deleteStat);
router.patch('/:id/publish', canManage, statController.publishStat);
router.patch('/:id/unpublish', canManage, statController.unpublishStat);

module.exports = router;
