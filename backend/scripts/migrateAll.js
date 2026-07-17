// One-shot orchestrator: runs every migration inside a single DB connection.
// Each migration gets its own MigrationContext; if one fails it is rolled back
// (its newly-created docs are deleted) and the remaining migrations still run.
// All migrations are idempotent, so this file is safe to run repeatedly.
const { connect, disconnect } = require('./helpers/db');
const { MigrationContext } = require('./helpers/upsert');
const { isConfigured, BUCKET } = require('./helpers/s3');
const logger = require('./helpers/logger');

const migrations = [
    { name: 'Company', fn: require('./migrateCompany') },
    { name: 'Products', fn: require('./migrateProducts') },
    { name: 'Career', fn: require('./migrateCareer') },
    { name: 'Gallery', fn: require('./migrateGallery') },
    { name: 'Settings', fn: require('./migrateSettings') }
];

(async () => {
    logger.heading('══════════════════════════════════════════════');
    logger.heading('  Surjit Finance — Data Migration');
    logger.heading('══════════════════════════════════════════════');
    logger.info(isConfigured ? `S3 uploads: enabled (bucket ${BUCKET})` : 'S3 uploads: DISABLED (AWS not configured) — image URLs will be blank');

    const results = [];
    try {
        await connect();
        logger.success('Connected to MongoDB');

        for (const { name, fn } of migrations) {
            const ctx = new MigrationContext(name.toLowerCase());
            logger.step(name);
            try {
                const summary = await fn(ctx);
                results.push({ name, ok: true, summary });
            } catch (err) {
                logger.error(err.message);
                const removed = await ctx.rollback();
                logger.warn(`Rolled back ${removed} newly-created record(s) for ${name}.`);
                results.push({ name, ok: false, summary: err.message });
            }
        }
    } catch (fatal) {
        logger.error(`Fatal: ${fatal.message}`);
        process.exitCode = 1;
    } finally {
        await disconnect();
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    logger.heading('──────────────── Summary ────────────────');
    let failures = 0;
    for (const r of results) {
        if (r.ok) logger.success(`${r.name}: ${r.summary}`);
        else { logger.error(`${r.name}: FAILED — ${r.summary}`); failures += 1; }
    }
    logger.heading(failures === 0 ? '\n✓ Migration Complete' : `\n⚠ Migration finished with ${failures} failed section(s)`);
    if (failures > 0) process.exitCode = 1;
})();
