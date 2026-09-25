const express = require('express');
const multer = require('multer');
const auth = require('../middleware/auth');
const { canView: viewPage, canEdit: editPage } = require('../middleware/permission');
const { blockProtectedFields } = require('../middleware/restrictFields');
const validate = require('../middleware/validate');
const { createUpload } = require('../middleware/upload');

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

const canManage = [auth, editPage('gallery')];
const canRead = [auth, viewPage('gallery')];
// Editing an existing record is open to Content Manager; creating,
// deleting, publishing, changing status and reordering are not. The
// blockProtectedFields guard stops an edit body reaching those anyway.
const canEdit = [auth, editPage('gallery')];
const superAdminOnly = [auth, editPage('gallery')];

// Cover image upload (single)
const coverUpload = createUpload({ folder: 'gallery/covers', fileTypes: 'images' }).single('coverImage');

// Multiple image/video upload. The field name stays "images" so the existing
// CMS upload call keeps working; the limit is raised to accommodate video.
const imagesUpload = createUpload({ folder: 'gallery/images', fileTypes: 'media', maxSize: 100 * 1024 * 1024 }).array('images', 50);

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
router.put('/albums/:id', canEdit, blockProtectedFields, coverUpload, updateAlbumValidation, validate, albumsController.updateAlbum);
router.delete('/albums/:id', superAdminOnly, albumsController.deleteAlbum);
router.patch('/albums/:id/status', canManage, albumsController.toggleAlbumStatus);

// ── Images ─────────────────────────────────────────────────────────────────────
// reorder BEFORE /images/:id routes to avoid param clash
router.get('/albums/:albumId/images', canRead, imagesController.getImagesByAlbum);
router.post('/albums/:albumId/images', canManage, imagesUpload, imagesController.createImages);
router.patch('/images/reorder', canManage, reorderImagesValidation, validate, imagesController.reorderImages);
router.put('/images/:id', canEdit, blockProtectedFields, updateImageValidation, validate, imagesController.updateImage);
router.delete('/images/:id', canManage, imagesController.deleteImage);
router.patch('/images/:id/status', canManage, imagesController.toggleImageStatus);

// ── ZIP Import ─────────────────────────────────────────────────────────────────
router.post('/albums/:albumId/import-zip', canManage, zipUpload, zipController.importZip);

module.exports = router;
