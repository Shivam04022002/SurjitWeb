// Moves the four statistics that were hardcoded in frontend/src/components/Hero.jsx
// into the HomepageStat collection, so the counter strip keeps showing them once
// the static array is gone.
//
// The old data held the figure split for the count-up animation
// ({ prefix: '₹', target: 50, suffix: 'Cr+' }); it is stored here as the single
// string an editor reads and types ("₹50Cr+"), and the homepage splits it back
// apart to drive the same animation.
//
// Idempotent: matched on title, so re-running updates rather than duplicates.
// Existing rows keep their status — only newly created stats are published, so a
// stat someone has since drafted is not silently relit.
const HomepageStat = require('../src/models/HomepageStat');
const { upsertOne } = require('./helpers/upsert');
const logger = require('./helpers/logger');

const STATS = [
    { title: 'Branches', value: '35+' },
    { title: 'States', value: '3' },
    { title: 'Happy Customers', value: '10K+' },
    { title: 'Loans Disbursed', value: '₹50Cr+' }
];

module.exports = async (ctx) => {
    let created = 0;
    let updated = 0;

    for (const [index, stat] of STATS.entries()) {
        const existing = await HomepageStat.findOne({ title: stat.title });

        const { doc } = await upsertOne(
            HomepageStat,
            { title: stat.title },
            {
                ...stat,
                displayOrder: index + 1,
                // Only decide the status for a brand new row.
                status: existing ? existing.status : 'Published'
            },
            ctx
        );

        if (existing) updated += 1; else created += 1;
        logger.info(`  ${existing ? 'updated' : 'created'}  ${doc.value} ${doc.title} — ${doc.status}`);
    }

    return `${created} created, ${updated} updated`;
};

// Allow `node scripts/migrateHomepageStats.js` on its own.
if (require.main === module) {
    const { connect, disconnect } = require('./helpers/db');
    const { MigrationContext } = require('./helpers/upsert');

    (async () => {
        const ctx = new MigrationContext('homepage-stats');
        try {
            await connect();
            logger.success('Connected to MongoDB');
            const summary = await module.exports(ctx);
            logger.success(`Homepage statistics: ${summary}`);
        } catch (err) {
            logger.error(err.message);
            const removed = await ctx.rollback();
            logger.warn(`Rolled back ${removed} newly-created record(s).`);
            process.exitCode = 1;
        } finally {
            await disconnect();
        }
    })();
}
