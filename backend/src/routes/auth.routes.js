const express = require('express');
const authController = require('../controllers/auth.controller');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { authValidator } = require('../validators');
const { loginLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

// loginLimiter runs after body parsing, so it can key by IP + email and only
// count failed attempts. It is applied to /login only (not logout/refresh).
router.post('/login', loginLimiter, authValidator.loginValidation, validate, authController.login);
router.post('/logout', auth, authController.logout);
router.get('/profile', auth, authController.getProfile);
router.post('/change-password', auth, authValidator.changePasswordValidation, validate, authController.changePassword);
router.post('/refresh-token', authValidator.refreshTokenValidation, validate, authController.refreshToken);

module.exports = router;
