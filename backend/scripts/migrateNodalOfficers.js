// Moves the two nodal officers — previously hardcoded in NodalOfficer.jsx, then
// briefly carried as a Legal Page — into the dedicated NodalOfficer collection.
//
// It also removes the obsolete `nodal-officer` LegalPage document if present, so
// the Legal Pages module is left managing only Privacy, Refund and Terms. That
// cleanup is idempotent (a no-op once the row is gone).
//
// Officers are matched on companyName, so re-running updates rather than
// duplicates. Existing rows keep their status; only newly created officers are
// published, so re-running never republishes one an editor has since drafted.
const NodalOfficer = require('../src/models/NodalOfficer');
const LegalPage = require('../src/models/LegalPage');
const { upsertOne } = require('./helpers/upsert');
const logger = require('./helpers/logger');

// Addresses keep their original line breaks; the website renders each line on
// its own row, exactly as the hardcoded <address> did.
const OFFICERS = [
    {
        companyName: 'Surjit Finance',
        officerName: 'Mr. Jeetendra Pandey',
        designation: 'The Nodal Officer, Surjit Hire Purchase Pvt. Ltd.',
        address: '248-C, Vijay Nagar,\nKrishna Nagar,\nLucknow-226012',
        email: 'cs.ho@surjitfinance.com',
        phone: '+91-7042476577'
    },
    {
        companyName: 'Arthmate',
        officerName: 'Mr. Hitesh Bhansali',
        designation: 'The Nodal Officer, Mamta Projects Pvt. Ltd',
        address: 'Room No. 1528, 15th Floor,\nBengal Intelligent Eco EM-3,\nSector-V, Salt Lake City\nKolkata-700091',
        email: 'statutory.compliance@arthmate.com',
        phone: '+91-8336901719'
    }
];

module.exports = async (ctx) => {
    let created = 0;
    let updated = 0;

    for (const [index, officer] of OFFICERS.entries()) {
        const existing = await NodalOfficer.findOne({ companyName: officer.companyName });

        const { doc } = await upsertOne(
            NodalOfficer,
            { companyName: officer.companyName },
            {
                ...officer,
                displayOrder: index + 1,
                // Only decide the status for a brand new row.
                status: existing ? existing.status : 'Published'
            },
            ctx
        );

        if (existing) updated += 1; else created += 1;
        logger.info(`  ${existing ? 'updated' : 'created'}  ${doc.officerName} (${doc.companyName}) — ${doc.status}`);
    }

    // Retire the legacy nodal-officer Legal Page; Nodal Officers now has its own
    // module. Safe to run repeatedly — a no-op once removed.
    const removed = await LegalPage.deleteOne({ slug: 'nodal-officer' });
    if (removed.deletedCount) logger.info('  removed legacy legal page: nodal-officer');

    return `${created} created, ${updated} updated${removed.deletedCount ? ', legacy legal page removed' : ''}`;
};

// Allow `node scripts/migrateNodalOfficers.js` on its own.
if (require.main === module) {
    const { connect, disconnect } = require('./helpers/db');
    const { MigrationContext } = require('./helpers/upsert');

    (async () => {
        const ctx = new MigrationContext('nodal-officers');
        try {
            await connect();
            logger.success('Connected to MongoDB');
            const summary = await module.exports(ctx);
            logger.success(`Nodal officers: ${summary}`);
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
