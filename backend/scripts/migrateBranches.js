// Moves the six branches that were hardcoded in frontend/src/pages/Contact.jsx
// into the Branch collection, so the website keeps showing them once the static
// array is gone.
//
// The old data held one address string per branch; it is split here into the
// street line plus city, state and pincode. Joining them back as
// "address, city, state pincode" reproduces each original string exactly.
//
// Idempotent: matched on branchName, so re-running updates rather than
// duplicates. Existing rows keep their status — only newly created branches are
// published, so a branch someone has since drafted is not silently relit.
const Branch = require('../src/models/Branch');
const { upsertOne } = require('./helpers/upsert');
const logger = require('./helpers/logger');

const BRANCHES = [
    {
        branchName: 'Registered Office',
        address: '248-C, Vijay Nagar, Krishna Nagar, Alambagh',
        city: 'Lucknow', state: 'Uttar Pradesh', pincode: '226012'
    },
    {
        branchName: 'Kanpur Branch',
        address: '34-Chanakyapuri, Shyam Nagar, Near Jagriti Palace',
        city: 'Kanpur', state: 'Uttar Pradesh', pincode: '208015'
    },
    {
        branchName: 'Agra Branch',
        address: '6/1, Ist floor, Nai Ki Mandi Police Chowki, Subhash Park Crossing, Mahatma Gandhi Rd',
        city: 'Agra', state: 'Uttar Pradesh', pincode: '282010'
    },
    {
        branchName: 'Varanasi Branch',
        address: 'FF-04, Ist floor Urvashi Complex, Gandhi Nagar, opposite Sigra Petrol Pump',
        city: 'Varanasi', state: 'Uttar Pradesh', pincode: '221001'
    },
    {
        branchName: 'Indore Branch',
        address: 'IInd floor, Building No. 4, Chandra Lok Colony, Khajrana Main Road',
        city: 'Indore', state: 'Madhya Pradesh', pincode: '452016'
    },
    {
        branchName: 'Jaipur Branch',
        address: '7 Gopalpura Bypass Road, Vasundhara Colony, Gopal Pura Mode',
        city: 'Jaipur', state: 'Rajasthan', pincode: '302018'
    }
];

module.exports = async (ctx) => {
    let created = 0;
    let updated = 0;

    for (const [index, branch] of BRANCHES.entries()) {
        const existing = await Branch.findOne({ branchName: branch.branchName });

        const { doc } = await upsertOne(
            Branch,
            { branchName: branch.branchName },
            {
                ...branch,
                displayOrder: index + 1,
                // Only decide the status for a brand new row.
                status: existing ? existing.status : 'Published'
            },
            ctx
        );

        if (existing) updated += 1; else created += 1;
        logger.info(`  ${existing ? 'updated' : 'created'}  ${doc.branchName} (${doc.city}) — ${doc.status}`);
    }

    return `${created} created, ${updated} updated`;
};

// Allow `node scripts/migrateBranches.js` on its own.
if (require.main === module) {
    const { connect, disconnect } = require('./helpers/db');
    const { MigrationContext } = require('./helpers/upsert');

    (async () => {
        const ctx = new MigrationContext('branches');
        try {
            await connect();
            logger.success('Connected to MongoDB');
            const summary = await module.exports(ctx);
            logger.success(`Branches: ${summary}`);
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
