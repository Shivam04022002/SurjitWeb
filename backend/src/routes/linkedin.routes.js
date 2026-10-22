const express = require('express');
const auth = require('../middleware/auth');
const { canView: viewPage, canEdit: editPage } = require('../middleware/permission');
const validate = require('../middleware/validate');
const { linkedinPublishLimiter } = require('../middleware/rateLimiters');
const controller = require('../controllers/linkedin.controller');
const { blogIdParam, publishValidation, resolveValidation, saveConfigValidation } = require('../validators/linkedin.validator');

const router = express.Router();

// The connection is an integration credential, managed from the API Settings
// page under its permission, like the Email and Pexels keys. Sharing a blog
// is publishing it, so it takes the Blogs page's edit permission — the same
// permission that publishes it on the website.

// App settings: read with API Settings view (the secret is never returned);
// saving and testing need edit. A test may call LinkedIn, so it is limited.
router.get('/config', [auth, viewPage('integrations')], controller.getConfig);
router.put('/config', [auth, editPage('integrations')], saveConfigValidation, validate, controller.saveConfig);
router.post('/config/test', [auth, editPage('integrations'), linkedinPublishLimiter], controller.testConfig);

router.get('/connection', [auth, viewPage('integrations')], controller.getConnection);
router.post('/connection/authorize', [auth, editPage('integrations'), linkedinPublishLimiter], controller.startAuthorization);
router.delete('/connection', [auth, editPage('integrations')], controller.disconnect);

// LinkedIn redirects the admin's browser here. No CMS authorization header
// arrives with it; the single-use state issued by /connection/authorize is
// what authenticates it.
router.get('/oauth/callback', controller.oauthCallback);

router.get('/blogs/:blogId/preview', [auth, editPage('blogs')], blogIdParam, validate, controller.getPreview);
router.get('/blogs/:blogId/publication', [auth, viewPage('blogs')], blogIdParam, validate, controller.getPublication);
router.post('/blogs/:blogId/publish', [auth, editPage('blogs'), linkedinPublishLimiter], publishValidation, validate, controller.publish);
router.post('/blogs/:blogId/resolve', [auth, editPage('blogs'), linkedinPublishLimiter], resolveValidation, validate, controller.resolve);

module.exports = router;
