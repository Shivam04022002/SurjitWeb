const express = require('express');
const auth = require('../middleware/auth');
const { canView: viewPage, canEdit: editPage } = require('../middleware/permission');
const { blockProtectedFields } = require('../middleware/restrictFields');
const validate = require('../middleware/validate');
const { createUpload } = require('../middleware/upload');
const settingsController = require('../controllers/settings.controller');
const { updateSettingsValidation } = require('../validators/settings.validator');

const router = express.Router();

const canManage = [auth, editPage('settings')];
const canRead = [auth, viewPage('settings')];
// Editing an existing record is open to Content Manager; creating,
// deleting, publishing, changing status and reordering are not. The
// blockProtectedFields guard stops an edit body reaching those anyway.
const canEdit = [auth, editPage('settings')];

const brandingUpload = createUpload({ folder: 'settings/branding', fileTypes: 'images' }).fields([
    { name: 'primaryLogo', maxCount: 1 },
    { name: 'whiteLogo', maxCount: 1 },
    { name: 'mobileLogo', maxCount: 1 },
    { name: 'favicon', maxCount: 1 }
]);

router.get('/', canRead, settingsController.getSettings);
router.put('/', canEdit, blockProtectedFields, brandingUpload, updateSettingsValidation, validate, settingsController.updateSettings);

module.exports = router;
