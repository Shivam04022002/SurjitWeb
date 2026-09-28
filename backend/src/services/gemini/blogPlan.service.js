// The saved monthly blog plan: what is scheduled, and what became of it.
//
// A plan is the durable form of what the Excel upload produced. Until now the
// validated rows lived only in the browser, so closing the tab lost them; here
// they are documents, and the scheduler reads them on their day.
//
// One plan is active at a time. Saving a new one archives the previous, which
// keeps the page's meaning simple — "the plan" is a single thing — while the
// rows and drafts of earlier plans are left exactly as they were.

const mongoose = require('mongoose');
const GeminiBlogPlan = require('../../models/GeminiBlogPlan');
const GeminiPlanRow = require('../../models/GeminiPlanRow');
const bulkPlan = require('./bulkPlan.service');
const { AppError } = require('../../middleware/errorHandler');
const HTTP_STATUS = require('../../constants/httpStatus');
const zoned = require('../../utils/zonedDate');

// Scheduling is read in the business timezone, the one an administrator means
// when they write a date on a plan. Analytics reads UTC; this deliberately does
// not, because 01 Oct here is the office's 01 Oct.
const TIMEZONE = zoned.TIMEZONE;

// How many times a row is tried before it is left alone for a person to look
// at. Bounded on purpose: a topic Gemini refuses would otherwise be retried
// every run, for ever.
const MAX_ATTEMPTS = 3;

// The rows the scheduler will act on today: waiting rows, and failed rows that
// still have attempts left. Never a row that already has a blog.
const dueFilter = (day) => ({
    scheduledDay: day,
    $or: [
        { status: 'scheduled' },
        { status: 'failed', attempts: { $lt: MAX_ATTEMPTS } }
    ]
});

const activePlan = () => GeminiBlogPlan.findOne({ status: 'active' }).sort({ createdAt: -1 });

// Saves a validated plan, replacing whichever plan was active.
//
// The rows arrive already checked by the plan validator — the same one the
// upload preview uses — so what is stored is what the admin saw. Invalid rows
// are stored too, as `invalid`: the plan persists as uploaded, and a row can be
// corrected later rather than vanishing on refresh.
const savePlan = async ({ name, rows }, { userId }) => {
    if (!Array.isArray(rows) || !rows.length) {
        throw new AppError('A plan needs at least one row.', HTTP_STATUS.BAD_REQUEST);
    }
    if (rows.length > bulkPlan.MAX_ROWS) {
        throw new AppError(`A plan can hold at most ${bulkPlan.MAX_ROWS} rows.`, HTTP_STATUS.BAD_REQUEST);
    }

    // Re-validated here, not trusted from the browser: what gets scheduled is
    // decided by the server, on the server's own reading of the rows.
    const { rows: checked } = await bulkPlan.validateRows(rows.map((r) => ({
        date: r.date,
        topic: r.topic,
        category: r.category,
        generateImage: r.generateImage,
        sourceRow: r.sourceRow ?? null
    })));

    const plan = await GeminiBlogPlan.create({
        name: String(name || 'Monthly blog plan').trim().slice(0, 200),
        createdBy: userId
    });

    const documents = checked.map((r, i) => ({
        plan: plan._id,
        createdBy: userId,
        rowNumber: r.sourceRow ?? null,
        position: i,
        // An invalid row may have no usable date; it is kept for the admin to
        // fix, parked on today so it is never mistaken for something due.
        scheduledDay: r.date || zoned.today(),
        topic: r.topic || '(no topic)',
        category: r.category ? r.category._id : null,
        categoryName: r.category ? r.category.name : null,
        generateImage: r.generateImage !== false,
        status: r.valid ? 'scheduled' : 'invalid',
        validationErrors: r.errors || []
    }));

    await GeminiPlanRow.insertMany(documents);

    // Only once the new plan is safely stored does the previous one step aside.
    await GeminiBlogPlan.updateMany(
        { status: 'active', _id: { $ne: plan._id } },
        { $set: { status: 'archived', archivedAt: new Date() } }
    );

    return getActivePlan();
};

// Rows of a plan, in the order they were uploaded, with the blog each produced.
const rowsOf = (planId) => GeminiPlanRow.find({ plan: planId })
    .sort({ position: 1 })
    .populate('blog', 'title slug status')
    .lean();

const summarise = (rows) => {
    const counts = rows.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
    }, {});
    return {
        total: rows.length,
        invalid: counts.invalid || 0,
        scheduled: counts.scheduled || 0,
        generating: counts.generating || 0,
        generated: counts.generated || 0,
        failed: counts.failed || 0,
        missed: counts.missed || 0
    };
};

const shape = (plan, rows) => ({
    plan: plan && {
        _id: plan._id,
        name: plan.name,
        status: plan.status,
        createdAt: plan.createdAt
    },
    timezone: TIMEZONE,
    today: zoned.today(),
    maxAttempts: MAX_ATTEMPTS,
    summary: summarise(rows),
    rows: rows.map((r) => ({
        _id: r._id,
        rowNumber: r.rowNumber,
        position: r.position,
        scheduledDay: r.scheduledDay,
        topic: r.topic,
        category: r.category,
        categoryName: r.categoryName,
        generateImage: r.generateImage,
        status: r.status,
        errors: r.validationErrors || [],
        blog: r.blog || null,
        generatedAt: r.generatedAt,
        attempts: r.attempts,
        lastError: r.lastError
    }))
});

const getActivePlan = async () => {
    const plan = await activePlan();
    if (!plan) return shape(null, []);
    return shape(plan, await rowsOf(plan._id));
};

// Archives the active plan. Its rows and the drafts they produced are kept; the
// page simply stops showing it as the current plan.
const archiveActivePlan = async () => {
    const plan = await activePlan();
    if (!plan) throw new AppError('There is no active plan.', HTTP_STATUS.NOT_FOUND);
    plan.status = 'archived';
    plan.archivedAt = new Date();
    await plan.save();
    return getActivePlan();
};

// Puts a failed or missed row back in the queue for its day, and clears the
// attempt count so a deliberate retry gets a full set of tries.
const retryRow = async (rowId) => {
    if (!mongoose.isValidObjectId(rowId)) throw new AppError('Row not found', HTTP_STATUS.NOT_FOUND);
    const row = await GeminiPlanRow.findById(rowId);
    if (!row) throw new AppError('Row not found', HTTP_STATUS.NOT_FOUND);
    if (row.status === 'generated') {
        throw new AppError('This row has already produced a draft.', HTTP_STATUS.CONFLICT);
    }
    if (row.status === 'invalid') {
        throw new AppError('Fix this row in the plan before retrying it.', HTTP_STATUS.BAD_REQUEST);
    }
    row.status = 'scheduled';
    row.attempts = 0;
    row.lastError = null;
    await row.save();
    return getActivePlan();
};

// Rows whose day has gone by without a draft. Marked rather than generated: a
// plan uploaded in November should not suddenly write October's blogs.
const markMissed = async (today = zoned.today()) => {
    const { modifiedCount } = await GeminiPlanRow.updateMany(
        {
            scheduledDay: { $lt: today },
            status: { $in: ['scheduled', 'failed', 'generating'] },
            blog: null
        },
        { $set: { status: 'missed' } }
    );
    return modifiedCount || 0;
};

// Claims one row for this run, atomically.
//
// The filter is the claim: only a row still waiting can move to `generating`,
// so if two runs overlap — two workers, a restart mid-run, a manual run beside
// the timer — exactly one of them gets the row and the other is handed null.
const claimRow = (rowId) => GeminiPlanRow.findOneAndUpdate(
    {
        _id: rowId,
        blog: null,
        $or: [{ status: 'scheduled' }, { status: 'failed', attempts: { $lt: MAX_ATTEMPTS } }]
    },
    {
        $set: { status: 'generating', lastAttemptAt: new Date() },
        $inc: { attempts: 1 }
    },
    { new: true }
);

const dueRows = (day = zoned.today()) => GeminiPlanRow.find(dueFilter(day)).sort({ position: 1 }).lean();

module.exports = {
    savePlan,
    getActivePlan,
    archiveActivePlan,
    retryRow,
    markMissed,
    claimRow,
    dueRows,
    summarise,
    MAX_ATTEMPTS,
    TIMEZONE
};
