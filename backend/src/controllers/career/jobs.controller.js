const jobsService = require('../../services/career/jobs.service');
const { sendSuccess } = require('../../utils/response');
const HTTP_STATUS = require('../../constants/httpStatus');
const asyncHandler = require('../../utils/asyncHandler');

const getAllJobs = asyncHandler(async (req, res) => {
    const { department, employmentType, isPublished, isActive } = req.query;
    const filters = {};
    if (department) filters.department = department;
    if (employmentType) filters.employmentType = employmentType;
    if (isPublished !== undefined) filters.isPublished = isPublished === 'true';
    if (isActive !== undefined) filters.isActive = isActive === 'true';

    const jobs = await jobsService.getAllJobs(filters);
    return sendSuccess(res, 'Job openings fetched successfully', { jobs });
});

const getJobById = asyncHandler(async (req, res) => {
    const job = await jobsService.getJobById(req.params.id);
    return sendSuccess(res, 'Job opening fetched successfully', { job });
});

const createJob = asyncHandler(async (req, res) => {
    const data = { ...req.body };
    if (data.skillsRequired && typeof data.skillsRequired === 'string') {
        try { data.skillsRequired = JSON.parse(data.skillsRequired); } catch (_) { data.skillsRequired = [data.skillsRequired]; }
    }
    if (data.responsibilities && typeof data.responsibilities === 'string') {
        try { data.responsibilities = JSON.parse(data.responsibilities); } catch (_) { data.responsibilities = [data.responsibilities]; }
    }
    if (data.qualifications && typeof data.qualifications === 'string') {
        try { data.qualifications = JSON.parse(data.qualifications); } catch (_) { data.qualifications = [data.qualifications]; }
    }
    const job = await jobsService.createJob(data);
    return sendSuccess(res, 'Job opening created successfully', { job }, HTTP_STATUS.CREATED);
});

const updateJob = asyncHandler(async (req, res) => {
    const data = { ...req.body };
    if (data.skillsRequired && typeof data.skillsRequired === 'string') {
        try { data.skillsRequired = JSON.parse(data.skillsRequired); } catch (_) { data.skillsRequired = [data.skillsRequired]; }
    }
    if (data.responsibilities && typeof data.responsibilities === 'string') {
        try { data.responsibilities = JSON.parse(data.responsibilities); } catch (_) { data.responsibilities = [data.responsibilities]; }
    }
    if (data.qualifications && typeof data.qualifications === 'string') {
        try { data.qualifications = JSON.parse(data.qualifications); } catch (_) { data.qualifications = [data.qualifications]; }
    }
    const job = await jobsService.updateJob(req.params.id, data);
    return sendSuccess(res, 'Job opening updated successfully', { job });
});

const deleteJob = asyncHandler(async (req, res) => {
    await jobsService.deleteJob(req.params.id);
    return sendSuccess(res, 'Job opening deleted successfully', {});
});

const toggleJobStatus = asyncHandler(async (req, res) => {
    const job = await jobsService.toggleJobStatus(req.params.id);
    return sendSuccess(res, `Job ${job.isActive ? 'activated' : 'deactivated'} successfully`, { job });
});

const toggleJobPublish = asyncHandler(async (req, res) => {
    const job = await jobsService.toggleJobPublish(req.params.id);
    return sendSuccess(res, `Job ${job.isPublished ? 'published' : 'unpublished'} successfully`, { job });
});

const reorderJobs = asyncHandler(async (req, res) => {
    const { ids } = req.body;
    const jobs = await jobsService.reorderJobs(ids);
    return sendSuccess(res, 'Jobs reordered successfully', { jobs });
});

const duplicateJob = asyncHandler(async (req, res) => {
    const job = await jobsService.duplicateJob(req.params.id);
    return sendSuccess(res, 'Job opening duplicated successfully', { job }, HTTP_STATUS.CREATED);
});

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
