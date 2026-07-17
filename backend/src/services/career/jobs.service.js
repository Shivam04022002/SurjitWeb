const JobOpening = require('../../models/JobOpening');
const { AppError } = require('../../middleware/errorHandler');
const HTTP_STATUS = require('../../constants/httpStatus');

const getAllJobs = async (filters = {}) => {
    const query = {};
    if (filters.department) query.department = new RegExp(filters.department, 'i');
    if (filters.employmentType) query.employmentType = filters.employmentType;
    if (filters.isPublished !== undefined) query.isPublished = filters.isPublished;
    if (filters.isActive !== undefined) query.isActive = filters.isActive;

    return JobOpening.find(query).sort({ displayOrder: 1, createdAt: -1 });
};

const getJobById = async (id) => {
    const job = await JobOpening.findById(id);
    if (!job) {
        throw new AppError('Job opening not found', HTTP_STATUS.NOT_FOUND);
    }
    return job;
};

const createJob = async (data) => {
    const jobCount = await JobOpening.countDocuments();
    if (data.displayOrder === undefined || data.displayOrder === null) {
        data.displayOrder = jobCount + 1;
    }
    return JobOpening.create(data);
};

const updateJob = async (id, data) => {
    const job = await JobOpening.findByIdAndUpdate(id, data, {
        new: true,
        runValidators: true
    });
    if (!job) {
        throw new AppError('Job opening not found', HTTP_STATUS.NOT_FOUND);
    }
    return job;
};

const deleteJob = async (id) => {
    const job = await JobOpening.findByIdAndUpdate(
        id,
        { deletedAt: new Date() },
        { new: true }
    );
    if (!job) {
        throw new AppError('Job opening not found', HTTP_STATUS.NOT_FOUND);
    }
    return job;
};

const toggleJobStatus = async (id) => {
    const job = await JobOpening.findById(id);
    if (!job) {
        throw new AppError('Job opening not found', HTTP_STATUS.NOT_FOUND);
    }
    job.isActive = !job.isActive;
    await job.save();
    return job;
};

const toggleJobPublish = async (id) => {
    const job = await JobOpening.findById(id);
    if (!job) {
        throw new AppError('Job opening not found', HTTP_STATUS.NOT_FOUND);
    }
    job.isPublished = !job.isPublished;
    await job.save();
    return job;
};

const reorderJobs = async (orderedIds) => {
    const bulkOps = orderedIds.map((id, index) => ({
        updateOne: {
            filter: { _id: id },
            update: { $set: { displayOrder: index + 1 } }
        }
    }));
    await JobOpening.bulkWrite(bulkOps);
    return JobOpening.find().sort({ displayOrder: 1 });
};

const duplicateJob = async (id) => {
    const original = await JobOpening.findById(id);
    if (!original) {
        throw new AppError('Job opening not found', HTTP_STATUS.NOT_FOUND);
    }

    const jobCount = await JobOpening.countDocuments();
    const duplicateData = original.toObject();
    delete duplicateData._id;
    delete duplicateData.createdAt;
    delete duplicateData.updatedAt;
    delete duplicateData.__v;
    duplicateData.jobTitle = `${original.jobTitle} (Copy)`;
    duplicateData.isPublished = false;
    duplicateData.displayOrder = jobCount + 1;
    duplicateData.deletedAt = null;

    return JobOpening.create(duplicateData);
};

module.exports = {
    getAllJobs,
    getJobById,
    createJob,
    updateJob,
    deleteJob,
    toggleJobStatus,
    toggleJobPublish,
    reorderJobs,
    duplicateJob
};
