const Director = require('../../models/Director');
const { AppError } = require('../../middleware/errorHandler');
const HTTP_STATUS = require('../../constants/httpStatus');

const getAllDirectors = async () => {
    return Director.find().sort({ displayOrder: 1, createdAt: 1 });
};

const createDirector = async (data) => {
    return Director.create(data);
};

const updateDirector = async (id, data) => {
    const director = await Director.findByIdAndUpdate(id, data, {
        new: true,
        runValidators: true
    });
    if (!director) {
        throw new AppError('Director not found', HTTP_STATUS.NOT_FOUND);
    }
    return director;
};

const deleteDirector = async (id) => {
    const director = await Director.findByIdAndDelete(id);
    if (!director) {
        throw new AppError('Director not found', HTTP_STATUS.NOT_FOUND);
    }
    return director;
};

const toggleDirectorStatus = async (id) => {
    const director = await Director.findById(id);
    if (!director) {
        throw new AppError('Director not found', HTTP_STATUS.NOT_FOUND);
    }
    director.isActive = !director.isActive;
    await director.save();
    return director;
};

const reorderDirectors = async (orderedIds) => {
    const bulkOps = orderedIds.map((id, index) => ({
        updateOne: {
            filter: { _id: id },
            update: { $set: { displayOrder: index + 1 } }
        }
    }));
    await Director.bulkWrite(bulkOps);
    return Director.find().sort({ displayOrder: 1 });
};

module.exports = {
    getAllDirectors,
    createDirector,
    updateDirector,
    deleteDirector,
    toggleDirectorStatus,
    reorderDirectors
};
