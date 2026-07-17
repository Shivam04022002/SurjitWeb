const JobApplication = require('../../models/JobApplication');
const Notification = require('../../models/Notification');
const { AppError } = require('../../middleware/errorHandler');
const HTTP_STATUS = require('../../constants/httpStatus');

const APPLICATION_STATUSES = ['new', 'reviewed', 'shortlisted', 'interview_scheduled', 'selected', 'rejected'];

const getAllApplications = async (filters = {}) => {
    const query = {};
    if (filters.status) query.status = filters.status;
    if (filters.appliedPosition) query.appliedPosition = filters.appliedPosition;
    if (filters.search) {
        const searchRegex = new RegExp(filters.search, 'i');
        query.$or = [
            { applicantName: searchRegex },
            { email: searchRegex },
            { appliedPositionTitle: searchRegex }
        ];
    }
    return JobApplication.find(query)
        .populate('appliedPosition', 'jobTitle department')
        .sort({ createdAt: -1 });
};

const getApplicationById = async (id) => {
    const application = await JobApplication.findById(id)
        .populate('appliedPosition', 'jobTitle department location employmentType');
    if (!application) {
        throw new AppError('Application not found', HTTP_STATUS.NOT_FOUND);
    }
    return application;
};

const createApplication = async (data) => {
    const application = await JobApplication.create(data);

    await Notification.create({
        type: 'new_job_application',
        title: 'New Job Application',
        message: `${application.applicantName} applied for ${application.appliedPositionTitle || 'a position'}`,
        referenceId: application._id,
        referenceModel: 'JobApplication'
    });

    return application;
};

const updateApplicationStatus = async (id, status) => {
    if (!APPLICATION_STATUSES.includes(status)) {
        throw new AppError(`Invalid status. Must be one of: ${APPLICATION_STATUSES.join(', ')}`, HTTP_STATUS.BAD_REQUEST);
    }

    const application = await JobApplication.findByIdAndUpdate(
        id,
        { status },
        { new: true, runValidators: true }
    ).populate('appliedPosition', 'jobTitle department');

    if (!application) {
        throw new AppError('Application not found', HTTP_STATUS.NOT_FOUND);
    }
    return application;
};

const deleteApplication = async (id) => {
    const application = await JobApplication.findByIdAndUpdate(
        id,
        { deletedAt: new Date() },
        { new: true }
    );
    if (!application) {
        throw new AppError('Application not found', HTTP_STATUS.NOT_FOUND);
    }
    return application;
};

const exportApplications = async (filters = {}) => {
    const query = {};
    if (filters.status) query.status = filters.status;
    if (filters.appliedPosition) query.appliedPosition = filters.appliedPosition;

    return JobApplication.find(query)
        .populate('appliedPosition', 'jobTitle department')
        .sort({ createdAt: -1 })
        .lean();
};

module.exports = {
    getAllApplications,
    getApplicationById,
    createApplication,
    updateApplicationStatus,
    deleteApplication,
    exportApplications
};
