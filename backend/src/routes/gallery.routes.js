const express = require('express');
const multer = require('multer');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { createUpload } = require('../middleware/upload');
const { ROLES } = require('../constants/roles');

const albumsController = require('../controllers/gallery/albums.controller');
const imagesController = require('../controllers/gallery/images.controller');
const zipController = require('../controllers/gallery/zip.controller');

const {
    createAlbumValidation,
    updateAlbumValidation,
    reorderAlbumsValidation
} = require('../validators/gallery/albums.validator');

const {
    updateImageValidation,
    reorderImagesValidation
} = require('../validators/gallery/images.validator');

const router = express.Router();

const canManage = [auth, authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR)];
const canRead = [auth, authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR, ROLES.CONTENT_MANAGER)];
const superAdminOnly = [auth, authorize(ROLES.SUPER_ADMIN)];

// Cover image upload (single)
const coverUpload = createUpload({ folder: 'gallery/covers', fileTypes: 'images' }).single('coverImage');

// Multiple image upload
const imagesUpload = createUpload({ folder: 'gallery/images', fileTypes: 'images', maxSize: 15 * 1024 * 1024 }).array('images', 50);

// ZIP upload – memory storage so we can pass the buffer to adm-zip
const zipUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 200 * 1024 * 1024 }
}).single('zipFile');

// ── Albums ─────────────────────────────────────────────────────────────────────
// reorder BEFORE :id routes to avoid param clash
router.get('/albums', canRead, albumsController.getAllAlbums);
router.patch('/albums/reorder', canManage, reorderAlbumsValidation, validate, albumsController.reorderAlbums);
router.get('/albums/:id', canRead, albumsController.getAlbumById);
router.post('/albums', canManage, coverUpload, createAlbumValidation, validate, albumsController.createAlbum);
router.put('/albums/:id', canManage, coverUpload, updateAlbumValidation, validate, albumsController.updateAlbum);
router.delete('/albums/:id', superAdminOnly, albumsController.deleteAlbum);
router.patch('/albums/:id/status', canManage, albumsController.toggleAlbumStatus);

// ── Images ─────────────────────────────────────────────────────────────────────
// reorder BEFORE /images/:id routes to avoid param clash
router.get('/albums/:albumId/images', canRead, imagesController.getImagesByAlbum);
router.post('/albums/:albumId/images', canManage, imagesUpload, imagesController.createImages);
router.patch('/images/reorder', canManage, reorderImagesValidation, validate, imagesController.reorderImages);
router.put('/images/:id', canManage, updateImageValidation, validate, imagesController.updateImage);
router.delete('/images/:id', canManage, imagesController.deleteImage);
router.patch('/images/:id/status', canManage, imagesController.toggleImageStatus);

// ── ZIP Import ─────────────────────────────────────────────────────────────────
router.post('/albums/:albumId/import-zip', canManage, zipUpload, zipController.importZip);

module.exports = router;
