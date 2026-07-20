// Migrate the blogs the site used to serve from a static file into the CMS.
// Featured images are uploaded to S3 idempotently (deterministic key +
// HeadObject reuse) and every blog is upserted by slug, so re-running this
// updates in place rather than duplicating.
const path = require('path');
const fs = require('fs');
const { Blog, BlogCategory } = require('../src/models');
const { MigrationContext, upsertOne } = require('./helpers/upsert');
const { loadData } = require('./helpers/dataLoader');
const { resolveAsset } = require('./helpers/assets');
const { uploadImage } = require('./helpers/s3');
const logger = require('./helpers/logger');

// The shared resolveAsset looks in assets/website, where the other migrations'
// images live. Blog images sit one level up in assets/, so that root is tried
// first and the shared helper is left alone for everything else.
const BLOG_ASSETS_DIR = path.resolve(__dirname, '../../frontend/src/assets');

const resolveBlogAsset = (fileName) => {
    if (!fileName) return null;
    const direct = path.join(BLOG_ASSETS_DIR, fileName);
    if (fs.existsSync(direct)) return direct;
    return resolveAsset(fileName);
};

const slugify = (s) => String(s).toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// The static content is markdown-lite: **bold** lines acting as subheadings,
// "- " bullets, and blank-line-separated paragraphs. The CMS stores HTML, so
// it is converted once here rather than asking the editor to redo it.
const toHtml = (text) => {
    const blocks = String(text).split(/\n\s*\n/);
    const out = [];

    for (const raw of blocks) {
        const block = raw.trim();
        if (!block) continue;

        const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);

        // A block that is only "**Heading**" becomes a real heading.
        if (lines.length === 1 && /^\*\*(.+)\*\*:?$/.test(lines[0])) {
            out.push(`<h3>${inline(lines[0].replace(/^\*\*|\*\*:?$/g, ''))}</h3>`);
            continue;
        }

        // A "**Heading**" followed by bullets: heading, then the list.
        const bullets = lines.filter((l) => l.startsWith('- '));
        if (bullets.length) {
            const lead = lines.filter((l) => !l.startsWith('- '));
            for (const l of lead) {
                out.push(/^\*\*(.+)\*\*:?$/.test(l)
                    ? `<h3>${inline(l.replace(/^\*\*|\*\*:?$/g, ''))}</h3>`
                    : `<p>${inline(l)}</p>`);
            }
            out.push(`<ul>${bullets.map((b) => `<li>${inline(b.slice(2))}</li>`).join('')}</ul>`);
            continue;
        }

        out.push(`<p>${lines.map(inline).join('<br>')}</p>`);
    }

    return out.join('\n');
};

const inline = (s) => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

const readingTimeOf = (html) => {
    const words = html.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
};

async function migrateBlogs(ctx) {
    const { blogs } = await loadData('blogs');

    // Categories first, so blogs can reference them.
    const categoryIds = {};
    const names = [...new Set(blogs.map((b) => b.category).filter(Boolean))];

    for (const [index, name] of names.entries()) {
        const slug = slugify(name);
        // upsertOne returns { doc, created } — the document is on .doc.
        const { doc } = await upsertOne(
            BlogCategory,
            { slug },
            { name, slug, description: '', displayOrder: index + 1, isActive: true },
            ctx
        );
        categoryIds[name] = doc._id;
    }

    for (const [index, blog] of blogs.entries()) {
        let featuredImage = { url: '', fileName: '', size: 0 };

        const localPath = resolveBlogAsset(blog.image);
        if (!localPath) {
            logger.warn(`missing blog image: ${blog.image}`);
        } else {
            const res = await uploadImage(localPath, 'blog', blog.image);
            if (!res) {
                logger.warn(`upload skipped (S3 not configured): ${blog.image}`);
            } else {
                res.reused ? (ctx.counts.reused += 1) : (ctx.counts.uploaded += 1);
                featuredImage = { url: res.url, fileName: res.fileName, size: res.size || 0 };
            }
        }

        const content = toHtml(blog.content);
        // "09 September, 2024" parses directly; fall back to now if it ever
        // does not, so a bad date never blocks the migration.
        const published = new Date(blog.date);
        const publishedAt = Number.isNaN(published.getTime()) ? new Date() : published;

        await upsertOne(
            Blog,
            { slug: blog.slug },
            {
                title: blog.title,
                slug: blog.slug,
                summary: blog.summary,
                content,
                featuredImage,
                category: categoryIds[blog.category] || null,
                author: blog.author || 'Surjit Finance',
                tags: [],
                readingTime: readingTimeOf(content),
                status: 'published',
                publishedAt,
                seo: {
                    metaTitle: blog.title,
                    metaDescription: blog.summary,
                    metaKeywords: '',
                    ogImage: featuredImage
                }
            },
            ctx
        );

        logger.info(`blog ${index + 1}/${blogs.length}: ${blog.slug}`);
    }

    return { categories: names.length, blogs: blogs.length };
}

module.exports = migrateBlogs;

// Runnable on its own: `node scripts/migrateBlogs.js`
if (require.main === module) {
    const { connect, disconnect } = require('./helpers/db');
    (async () => {
        const ctx = new MigrationContext();
        try {
            await connect();
            const result = await migrateBlogs(ctx);
            logger.info(`done — categories: ${result.categories}, blogs: ${result.blogs}`);
            logger.info(JSON.stringify(ctx.counts));
        } catch (err) {
            logger.error(`migration failed: ${err.message}`);
            process.exitCode = 1;
        } finally {
            await disconnect();
        }
    })();
}
