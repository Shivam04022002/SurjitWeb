// Migrate Gallery Albums + Images. Each image file is uploaded to S3
// idempotently (deterministic key + HeadObject reuse) and stored as a
// GalleryImage; the first image of an album becomes its cover.
const { GalleryAlbum, GalleryImage } = require('../src/models');
const { MigrationContext, upsertOne } = require('./helpers/upsert');
const { loadData } = require('./helpers/dataLoader');
const { resolveAsset } = require('./helpers/assets');
const { uploadImage } = require('./helpers/s3');
const logger = require('./helpers/logger');

async function migrateGallery(ctx) {
    const { albums } = await loadData('gallery');
    let totalImages = 0;

    for (const album of albums) {
        const folder = `gallery/${album.slug}`;

        // Upload every image first so we can set the cover.
        const uploaded = [];
        for (const fileName of album.images) {
            const localPath = resolveAsset(fileName);
            if (!localPath) { logger.warn(`missing image: ${fileName}`); continue; }
            const res = await uploadImage(localPath, folder, fileName);
            if (!res) { logger.warn(`upload skipped (S3 not configured): ${fileName}`); continue; }
            res.reused ? (ctx.counts.reused += 1) : (ctx.counts.uploaded += 1);
            uploaded.push(res);
        }

        // Album (by slug); cover = first image.
        const cover = uploaded[0] ? { url: uploaded[0].url, fileName: uploaded[0].fileName } : { url: '', fileName: '' };
        const { doc: albumDoc } = await upsertOne(GalleryAlbum, { slug: album.slug }, {
            title: album.title,
            slug: album.slug,
            description: album.description || '',
            coverImage: cover,
            displayOrder: album.displayOrder || 0,
            isActive: true
        }, ctx);

        // Images (by album + S3 key), preserving order.
        let order = 0;
        for (const img of uploaded) {
            order += 1;
            await upsertOne(GalleryImage, { album: albumDoc._id, 'image.fileName': img.fileName }, {
                album: albumDoc._id,
                image: { url: img.url, fileName: img.fileName },
                caption: '',
                altText: album.title,
                displayOrder: order,
                isActive: true
            }, ctx);
            totalImages += 1;
        }
        logger.success(`${album.title}: ${uploaded.length} image(s)`);
    }

    logger.success(`${totalImages} Images imported across ${albums.length} album(s)`);
    return `Gallery (albums ${albums.length}, images ${totalImages}; ${ctx.counts.uploaded} uploaded / ${ctx.counts.reused} reused)`;
}

if (require.main === module) {
    const { connect, disconnect } = require('./helpers/db');
    (async () => {
        const ctx = new MigrationContext('gallery');
        logger.step('Gallery');
        try {
            await connect();
            logger.plain(await migrateGallery(ctx));
        } catch (e) {
            logger.error(e.message);
            const n = await ctx.rollback();
            logger.warn(`Rolled back ${n} newly-created record(s).`);
            process.exitCode = 1;
        } finally {
            await disconnect();
        }
    })();
}

module.exports = migrateGallery;
