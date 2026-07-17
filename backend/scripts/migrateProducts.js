// Migrate Product Categories + Products (with embedded features, eligibility,
// documents, interest rates, FAQs, EMI config).
const { ProductCategory, Product } = require('../src/models');
const { MigrationContext, upsertOne } = require('./helpers/upsert');
const { loadData } = require('./helpers/dataLoader');
const logger = require('./helpers/logger');

const withOrder = (arr, mapFn) =>
    (arr || []).map((item, i) => ({ ...mapFn(item), displayOrder: i + 1 }));

async function migrateProducts(ctx) {
    const { categories, products } = await loadData('products');

    // ── Categories (by slug) ──────────────────────────────────────────────────
    const categoryBySlug = {};
    for (const cat of categories) {
        const { doc } = await upsertOne(ProductCategory, { slug: cat.slug }, {
            name: cat.name,
            slug: cat.slug,
            shortDescription: cat.shortDescription || '',
            displayOrder: cat.displayOrder || 0,
            isActive: true
        }, ctx);
        categoryBySlug[cat.slug] = doc._id;
    }
    logger.success(`${categories.length} Categories imported`);

    // ── Products (by slug) ────────────────────────────────────────────────────
    for (const p of products) {
        const categoryId = categoryBySlug[p.categorySlug];
        if (!categoryId) throw new Error(`Product "${p.slug}" references unknown category "${p.categorySlug}"`);

        await upsertOne(Product, { slug: p.slug }, {
            category: categoryId,
            name: p.name,
            slug: p.slug,
            heroTitle: p.heroTitle || p.name,
            heroDescription: p.heroDescription || '',
            shortDescription: p.shortDescription || '',
            longDescription: p.longDescription || '',
            displayOrder: p.displayOrder || 0,
            isActive: true,
            features: withOrder(p.features, (f) => (typeof f === 'string' ? { title: f, description: '' } : f)),
            eligibility: withOrder(p.eligibility, (e) => ({ title: e.title, description: e.description || '' })),
            documents: withOrder(p.documents, (d) => (typeof d === 'string' ? { title: d, description: '' } : d)),
            interestRates: withOrder(p.interestRates, (r) => ({
                loanAmountFrom: r.loanAmountFrom, loanAmountTo: r.loanAmountTo,
                interestRate: r.interestRate, tenure: r.tenure || ''
            })),
            faqs: withOrder(p.faqs, (q) => ({ question: q.question, answer: q.answer })),
            emiConfig: p.emiConfig || {}
        }, ctx);
    }
    logger.success(`${products.length} Products imported`);

    return `Products (created ${ctx.counts.created}, updated ${ctx.counts.updated})`;
}

if (require.main === module) {
    const { connect, disconnect } = require('./helpers/db');
    (async () => {
        const ctx = new MigrationContext('products');
        logger.step('Products');
        try {
            await connect();
            logger.plain(await migrateProducts(ctx));
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

module.exports = migrateProducts;
