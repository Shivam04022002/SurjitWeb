const express = require('express');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { createUpload } = require('../middleware/upload');
const { ROLES } = require('../constants/roles');

const reviewController = require('../controllers/review.controller');
const {
    createReviewValidation,
    updateReviewValidation,
    reorderReviewsValidation
} = require('../validators/review.validator');

const router = express.Router();

const canManage = [auth, authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR)];
const canRead = [auth, authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR, ROLES.CONTENT_MANAGER)];
const superAdminOnly = [auth, authorize(ROLES.SUPER_ADMIN)];

// Customer photos go through the shared upload middleware, so they land in S3
// (or on disk) on the same path every other module uses.
const photoUpload = createUpload({ folder: 'reviews', fileTypes: 'images' }).single('customerImage');

// reorder before /:id so the word is never read as an id
router.get('/', canRead, reviewController.listReviews);
router.patch('/reorder', canManage, reorderReviewsValidation, validate, reviewController.reorderReviews);
router.get('/:id', canRead, reviewController.getReviewById);
router.post('/', canManage, photoUpload, createReviewValidation, validate, reviewController.createReview);
router.put('/:id', canManage, photoUpload, updateReviewValidation, validate, reviewController.updateReview);
router.delete('/:id', superAdminOnly, reviewController.deleteReview);
router.patch('/:id/status', canManage, reviewController.toggleReviewStatus);

module.exports = router;
