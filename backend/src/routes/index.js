const express = require('express');
const publicRoutes = require('./public.routes');
const authRoutes = require('./auth.routes');
const contactRoutes = require('./contact.routes');
const loanApplicationRoutes = require('./loanApplication.routes');
const careerRoutes = require('./career.routes');
const aboutRoutes = require('./about.routes');
const productsRoutes = require('./products.routes');
const galleryRoutes = require('./gallery.routes');
const settingsRoutes = require('./settings.routes');
const blogRoutes = require('./blog.routes');
const reviewRoutes = require('./review.routes');
const reportRoutes = require('./report.routes');
const userRoutes = require('./user.routes');

const router = express.Router();

router.use('/public', publicRoutes);
router.use('/v1/auth', authRoutes);
router.use('/contact', contactRoutes);
router.use('/loan-application', loanApplicationRoutes);
router.use('/v1/careers', careerRoutes);
router.use('/v1/about', aboutRoutes);
router.use('/v1/products', productsRoutes);
router.use('/v1/gallery', galleryRoutes);
router.use('/v1/settings', settingsRoutes);
router.use('/v1/blogs', blogRoutes);
router.use('/v1/reviews', reviewRoutes);
router.use('/v1/reports', reportRoutes);
router.use('/v1/users', userRoutes);

module.exports = router;
