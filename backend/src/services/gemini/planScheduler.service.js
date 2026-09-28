// Generating the blogs a plan has scheduled for today.
//
// This is the automatic half of Gemini Blogs, and it deliberately goes through
// the same services the admin's own buttons do: the same prompt and model
// settings, the same image flow, the same draft save. A scheduled blog and a
// hand-made one differ only in who pressed the button.
//
// Three things make a run safe to repeat, which matters because the timer fires
// again, PM2 restarts, and a deployment can land mid-run:
//
//   · a row is claimed atomically, so overlapping runs cannot both take it;
//   · the draft is saved under a key derived from the row's own id, so even a
//     save that succeeded and then lost its answer cannot make a second blog;
//   · a row that has a blog is never due again, whatever its status says.

const geminiBlog = require('./geminiBlog.service');
const plans = require('./blogPlan.service');
const GeminiPlanRow = require('../../models/GeminiPlanRow');
const { storeImageBuffer, deleteUploadedFile } = require('../upload.service');
const logger = require('../../utils/logger');
const zoned = require('../../utils/zonedDate');

// One row at a time. Generation is a slow call to someone else's API, and the
// Gemini service already limits how much one admin may have in flight; going
// through the day's rows in order keeps well inside that and makes the log
// readable.
const generateRow = async (row) => {
    const userId = String(row.createdBy);

    // The plan's category is an id, which is what the generator wants: naming a
    // category forces it, and leaving it out lets Gemini choose from the active
    // ones, exactly as the single-blog form does.
    const { blog: draft, imagePrompt } = await geminiBlog.generateBlog({
        topic: row.topic,
        createDate: row.scheduledDay,
        category: row.category ? String(row.category) : undefined,
        rowKey: `plan:${row._id}`
    }, userId);

    const files = {};
    let stored = null;

    if (row.generateImage) {
        try {
            const image = await geminiBlog.generateImage({
                title: draft.title,
                summary: draft.summary,
                topic: row.topic,
                content: draft.content,
                category: draft.category?.name || row.categoryName,
                tags: draft.tags,
                imagePrompt,
                rowKey: `plan:${row._id}`
            }, userId);

            stored = await storeImageBuffer(Buffer.from(image.data, 'base64'), { mimeType: image.mimeType });
            files.featuredImage = {
                ...stored,
                ...(image.provider ? { provider: image.provider } : {}),
                ...(image.provider === 'gemini' ? { model: image.model, generatedFor: 'article' } : {}),
                ...(image.branded !== undefined ? { branded: image.branded } : {}),
                ...(image.credit ? { credit: image.credit } : {})
            };
        } catch (err) {
            // The image is the optional half. A blog without one is still a
            // draft worth having, and the admin can add an image in Review —
            // which is what the manual flow does when an image fails too.
            logger.warn('Scheduled blog: featured image failed; saving the draft without one', {
                row: String(row._id), reason: err.message
            });
        }
    }

    try {
        // The key is the row, so this row can only ever own one draft. A repeat
        // gets that same draft back rather than making another.
        const { blog, duplicate } = await geminiBlog.saveDraft(
            {
                ...draft,
                // The draft carries its category as {_id, name}; the blog model
                // wants the id alone.
                category: draft.category?._id || null,
                createDate: row.scheduledDay
            },
            files,
            { userId, idempotencyKey: `plan-row:${row._id}` }
        );
        return { blog, duplicate };
    } catch (err) {
        // The draft did not save, so nothing points at the image any more.
        if (stored?.fileName) await deleteUploadedFile(stored.fileName).catch(() => {});
        throw err;
    }
};

// Runs every row due on a given day.
//
// One row failing must not cost the rest of the day: each is caught on its own,
// recorded, and the run carries on. A row is only marked generated once a draft
// actually exists, and its id is stored — so nothing can later mistake a failed
// row for a finished one.
const runDueRows = async ({ day = zoned.today(), reason = 'scheduled' } = {}) => {
    const missed = await plans.markMissed(day);
    const due = await plans.dueRows(day);

    const result = { day, timezone: plans.TIMEZONE, reason, due: due.length, generated: 0, failed: 0, skipped: 0, missed };

    if (!due.length) return result;

    logger.info('Scheduled blog generation starting', { day, due: due.length, reason });

    for (const candidate of due) {
        // The claim is the concurrency guard: whoever wins moves the row to
        // `generating`, and everyone else is handed null and moves on.
        const row = await plans.claimRow(candidate._id);
        if (!row) {
            result.skipped += 1;
            continue;
        }

        try {
            const { blog, duplicate } = await generateRow(row);
            row.status = 'generated';
            row.blog = blog._id;
            row.generatedAt = new Date();
            row.lastError = null;
            await row.save();
            result.generated += 1;
            logger.info('Scheduled blog generated', {
                row: String(row._id), blog: String(blog._id), day, reusedExistingDraft: duplicate
            });
        } catch (err) {
            row.status = 'failed';
            row.lastError = String(err.message || 'Generation failed').slice(0, 500);
            await row.save();
            result.failed += 1;
            logger.error('Scheduled blog generation failed', {
                row: String(row._id), day, attempts: row.attempts, reason: row.lastError
            });
        }
    }

    logger.info('Scheduled blog generation finished', result);
    return result;
};

// A row that was generated by hand before its day came round must not be
// generated again. The admin's own save does not know about the plan, so this
// reconciles the two: any scheduled row whose topic already has a draft from
// this plan's owner is marked as generated against it.
const adoptManualDraft = async (rowId, blogId) => {
    const row = await GeminiPlanRow.findOneAndUpdate(
        { _id: rowId, blog: null, status: { $in: ['scheduled', 'failed', 'missed', 'generating'] } },
        { $set: { status: 'generated', blog: blogId, generatedAt: new Date(), lastError: null } },
        { new: true }
    );
    return row;
};

module.exports = { runDueRows, generateRow, adoptManualDraft };
