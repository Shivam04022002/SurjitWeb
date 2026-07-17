const express = require('express');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { createUpload } = require('../middleware/upload');
const { ROLES } = require('../constants/roles');
const settingsController = require('../controllers/settings.controller');
const { updateSettingsValidation } = require('../validators/settings.validator');

const router = express.Router();

const canManage = [auth, authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR)];
const canRead = [auth, authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR, ROLES.CONTENT_MANAGER)];

const brandingUpload = createUpload({ folder: 'settings/branding', fileTypes: 'images' }).fields([
    { name: 'primaryLogo', maxCount: 1 },
    { name: 'whiteLogo', maxCount: 1 },
    { name: 'mobileLogo', maxCount: 1 },
    { name: 'favicon', maxCount: 1 }
]);

router.get('/', canRead, settingsController.getSettings);
router.put('/', canManage, brandingUpload, updateSettingsValidation, validate, settingsController.updateSettings);

module.exports = router;
