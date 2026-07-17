// Migrate Company Info (singleton) + Directors + Leadership members.
const { CompanyInfo, Director, LeadershipMember } = require('../src/models');
const { MigrationContext, upsertSingleton, upsertOne } = require('./helpers/upsert');
const { loadData } = require('./helpers/dataLoader');
const { resolveAsset } = require('./helpers/assets');
const { uploadImage } = require('./helpers/s3');
const logger = require('./helpers/logger');

// Upload a person's portrait to S3 (idempotent) and return an image sub-doc.
async function uploadPhoto(fileName, folder, ctx) {
    if (!fileName) return { url: '', fileName: '', size: 0 };
    const localPath = resolveAsset(fileName);
    if (!localPath) {
        logger.warn(`photo not found on disk: ${fileName}`);
        return { url: '', fileName: '', size: 0 };
    }
    const res = await uploadImage(localPath, folder, fileName);
    if (!res) return { url: '', fileName: '', size: 0 };
    if (ctx) { res.reused ? (ctx.counts.reused += 1) : (ctx.counts.uploaded += 1); }
    return { url: res.url, fileName: res.fileName, size: res.size };
}

async function migrateCompany(ctx) {
    const { company, directors, leadership } = await loadData('company');

    // ── Company Info (singleton) ──────────────────────────────────────────────
    await upsertSingleton(CompanyInfo, {
        companyName: company.companyName,
        tagline: company.tagline,
        aboutDescription: company.aboutDescription,
        mission: company.mission,
        vision: company.vision,
        history: company.history,
        heroTitle: company.heroTitle,
        heroSubtitle: company.heroSubtitle
    }, ctx);
    logger.success('Company Info saved');

    // ── Directors ─────────────────────────────────────────────────────────────
    for (const d of directors) {
        const photo = await uploadPhoto(d.photo, 'directors', ctx);
        await upsertOne(Director, { name: d.name }, {
            name: d.name, designation: d.designation, description: d.description || '',
            displayOrder: d.displayOrder || 0, photo, isActive: true
        }, ctx);
    }
    logger.success(`${directors.length} Director(s) imported`);

    // ── Leadership ────────────────────────────────────────────────────────────
    for (const m of leadership) {
        const photo = await uploadPhoto(m.photo, 'leadership', ctx);
        await upsertOne(LeadershipMember, { name: m.name }, {
            name: m.name, designation: m.designation, description: m.description || '',
            displayOrder: m.displayOrder || 0, photo, isActive: true
        }, ctx);
    }
    logger.success(`${leadership.length} Leadership member(s) imported`);

    return `Company (created ${ctx.counts.created}, updated ${ctx.counts.updated}, images ${ctx.counts.uploaded} new / ${ctx.counts.reused} reused)`;
}

if (require.main === module) {
    const { connect, disconnect } = require('./helpers/db');
    (async () => {
        const ctx = new MigrationContext('company');
        logger.step('Company');
        try {
            await connect();
            logger.plain(await migrateCompany(ctx));
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

module.exports = migrateCompany;
