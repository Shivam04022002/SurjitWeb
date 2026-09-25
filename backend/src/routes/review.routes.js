const express = require('express');
const auth = require('../middleware/auth');
const { canView: viewPage, canEdit: editPage } = require('../middleware/permission');
const validate = require('../middleware/validate');

const reviewController = require('../controllers/review.controller');
const { reorderReviewsValidation } = require('../validators/review.validator');

const router = express.Router();

const canManage = [auth, editPage('reviews')];
const canRead = [auth, viewPage('reviews')];
const superAdminOnly = [auth, editPage('reviews')];

// Moderation only — reviews are written by customers through the public
// endpoint, so there is deliberately no create or update route here.
// reorder before /:id so the word is never read as an id.
router.get('/', canRead, reviewController.listReviews);
router.patch('/reorder', canManage, reorderReviewsValidation, validate, reviewController.reorderReviews);
router.get('/:id', canRead, reviewController.getReviewById);
router.patch('/:id/approve', canManage, reviewController.approveReview);
router.patch('/:id/reject', canManage, reviewController.rejectReview);
router.delete('/:id', superAdminOnly, reviewController.deleteReview);

module.exports = router;
