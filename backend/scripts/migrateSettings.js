// Migrate Global Settings (singleton).
const { GlobalSettings } = require('../src/models');
const { MigrationContext, upsertSingleton } = require('./helpers/upsert');
const { loadData } = require('./helpers/dataLoader');
const logger = require('./helpers/logger');

async function migrateSettings(ctx) {
    const { settings } = await loadData('settings');

    await upsertSingleton(GlobalSettings, {
        companyName: settings.companyName,
        tagline: settings.tagline,
        companyDescription: settings.companyDescription,
        phone: settings.phone || '',
        tollFreeNumber: settings.tollFreeNumber || '',
        email: settings.email || '',
        supportEmail: settings.supportEmail || '',
        officeAddress: settings.officeAddress || '',
        city: settings.city || '',
        state: settings.state || '',
        country: settings.country || 'India',
        pinCode: settings.pinCode || '',
        facebook: settings.facebook || '',
        instagram: settings.instagram || '',
        linkedin: settings.linkedin || '',
        youtube: settings.youtube || '',
        twitter: settings.twitter || '',
        footerDescription: settings.footerDescription || '',
        copyright: settings.copyright || '',
        footerNote: settings.footerNote || '',
        businessHours: settings.businessHours || {}
    }, ctx);
    logger.success('Global Settings saved');

    return `Settings (created ${ctx.counts.created}, updated ${ctx.counts.updated})`;
}

if (require.main === module) {
    const { connect, disconnect } = require('./helpers/db');
    (async () => {
        const ctx = new MigrationContext('settings');
        logger.step('Settings');
        try {
            await connect();
            logger.plain(await migrateSettings(ctx));
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

module.exports = migrateSettings;
