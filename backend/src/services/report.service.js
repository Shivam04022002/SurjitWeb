const Report = require('../models/Report');
const { AppError } = require('../middleware/errorHandler');
const { deleteUploadedFile } = require('./upload.service');
const HTTP_STATUS = require('../constants/httpStatus');

const buildQuery = (filters = {}) => {
    const query = {};

    if (filters.status) query.status = filters.status;
    if (filters.year) query.year = Number(filters.year);

    if (filters.search) {
        const rx = new RegExp(filters.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        query.$or = [{ title: rx }, { financialYear: rx }, { description: rx }];
    }

    return query;
};

// Display order first, then the most recent year, then newest — so a set of
// reports left at the default order still reads newest-first.
const SORT = { displayOrder: 1, year: -1, createdAt: -1 };

const listPublicReports = async () => Report.find({ status: 'Published' }).sort(SORT);

const listReports = async (filters = {}) => {
    const page = Math.max(parseInt(filters.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(filters.limit, 10) || 10, 1), 100);
    const skip = (page - 1) * limit;

    const query = buildQuery(filters);

    const [data, total] = await Promise.all([
        Report.find(query).sort(SORT).skip(skip).limit(limit),
        Report.countDocuments(query)
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
};

const getReportById = async (id) => {
    const report = await Report.findById(id);
    if (!report) throw new AppError('Report not found', HTTP_STATUS.NOT_FOUND);
    return report;
};

// Public download resolves by id but refuses anything unpublished, so a draft
// cannot be fetched by guessing its id.
const getPublishedReportById = async (id) => {
    const report = await Report.findOne({ _id: id, status: 'Published' });
    if (!report) throw new AppError('Report not found', HTTP_STATUS.NOT_FOUND);
    return report;
};

const createReport = async (data, files = {}) => {
    if (!files.pdf) {
        throw new AppError('A PDF file is required', HTTP_STATUS.BAD_REQUEST);
    }

    if (data.displayOrder === undefined || data.displayOrder === null || data.displayOrder === '') {
        data.displayOrder = (await Report.countDocuments()) + 1;
    }

    data.pdf = files.pdf;
    if (files.thumbnail) data.thumbnail = files.thumbnail;

    return Report.create(data);
};

const updateReport = async (id, data, files = {}) => {
    const report = await Report.findById(id);
    if (!report) throw new AppError('Report not found', HTTP_STATUS.NOT_FOUND);

    if (files.pdf) {
        if (report.pdf && report.pdf.fileName) {
            await deleteUploadedFile(report.pdf.fileName);
        }
        data.pdf = files.pdf;
    }

    if (files.thumbnail) {
        if (report.thumbnail && report.thumbnail.fileName) {
            await deleteUploadedFile(report.thumbnail.fileName);
        }
        data.thumbnail = files.thumbnail;
    }

    Object.assign(report, data);
    await report.save();
    return report;
};

const deleteReport = async (id) => {
    const report = await Report.findById(id);
    if (!report) throw new AppError('Report not found', HTTP_STATUS.NOT_FOUND);

    if (report.pdf && report.pdf.fileName) {
        await deleteUploadedFile(report.pdf.fileName);
    }
    if (report.thumbnail && report.thumbnail.fileName) {
        await deleteUploadedFile(report.thumbnail.fileName);
    }

    await Report.findByIdAndDelete(id);
    return { deleted: true };
};

const setReportStatus = async (id, status) => {
    const report = await Report.findById(id);
    if (!report) throw new AppError('Report not found', HTTP_STATUS.NOT_FOUND);
    report.status = status;
    await report.save();
    return report;
};

const reorderReports = async (orderedIds) => {
    const bulkOps = orderedIds.map((id, index) => ({
        updateOne: { filter: { _id: id }, update: { $set: { displayOrder: index + 1 } } }
    }));
    await Report.bulkWrite(bulkOps);
    return Report.find({ _id: { $in: orderedIds } }).sort(SORT);
};

module.exports = {
    listPublicReports,
    listReports,
    getReportById,
    getPublishedReportById,
    createReport,
    updateReport,
    deleteReport,
    setReportStatus,
    reorderReports
};
