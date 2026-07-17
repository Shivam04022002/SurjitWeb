// Migrate Career Settings (singleton) + Job Openings.
const { CareerSettings, JobOpening } = require('../src/models');
const { MigrationContext, upsertSingleton, upsertOne } = require('./helpers/upsert');
const { loadData } = require('./helpers/dataLoader');
const logger = require('./helpers/logger');

async function migrateCareer(ctx) {
    const { careerSettings, jobOpenings } = await loadData('career');

    // ── Career Settings (singleton) ───────────────────────────────────────────
    await upsertSingleton(CareerSettings, {
        heroTitle: careerSettings.heroTitle,
        heroSubtitle: careerSettings.heroSubtitle,
        joinOurTeamTitle: careerSettings.joinOurTeamTitle,
        joinOurTeamDescription: careerSettings.joinOurTeamDescription,
        whyJoinTitle: careerSettings.whyJoinTitle,
        whyJoinDescription: careerSettings.whyJoinDescription,
        seo: careerSettings.seo || {}
    }, ctx);
    logger.success('Career Settings saved');

    // ── Job Openings (by jobTitle) ────────────────────────────────────────────
    for (const job of (jobOpenings || [])) {
        await upsertOne(JobOpening, { jobTitle: job.jobTitle }, {
            ...job,
            isPublished: job.isPublished !== undefined ? job.isPublished : true,
            isActive: true
        }, ctx);
    }
    logger.success(`${(jobOpenings || []).length} Job Opening(s) imported`);

    return `Career (created ${ctx.counts.created}, updated ${ctx.counts.updated})`;
}

if (require.main === module) {
    const { connect, disconnect } = require('./helpers/db');
    (async () => {
        const ctx = new MigrationContext('career');
        logger.step('Career');
        try {
            await connect();
            logger.plain(await migrateCareer(ctx));
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

module.exports = migrateCareer;
