const LeadershipMember = require('../../models/LeadershipMember');
const { AppError } = require('../../middleware/errorHandler');
const HTTP_STATUS = require('../../constants/httpStatus');

const getAllLeadershipMembers = async () => {
    return LeadershipMember.find().sort({ displayOrder: 1, createdAt: 1 });
};

const createLeadershipMember = async (data) => {
    return LeadershipMember.create(data);
};

const updateLeadershipMember = async (id, data) => {
    const member = await LeadershipMember.findByIdAndUpdate(id, data, {
        new: true,
        runValidators: true
    });
    if (!member) {
        throw new AppError('Leadership member not found', HTTP_STATUS.NOT_FOUND);
    }
    return member;
};

const deleteLeadershipMember = async (id) => {
    const member = await LeadershipMember.findByIdAndDelete(id);
    if (!member) {
        throw new AppError('Leadership member not found', HTTP_STATUS.NOT_FOUND);
    }
    return member;
};

const toggleLeadershipStatus = async (id) => {
    const member = await LeadershipMember.findById(id);
    if (!member) {
        throw new AppError('Leadership member not found', HTTP_STATUS.NOT_FOUND);
    }
    member.isActive = !member.isActive;
    await member.save();
    return member;
};

const reorderLeadershipMembers = async (orderedIds) => {
    const bulkOps = orderedIds.map((id, index) => ({
        updateOne: {
            filter: { _id: id },
            update: { $set: { displayOrder: index + 1 } }
        }
    }));
    await LeadershipMember.bulkWrite(bulkOps);
    return LeadershipMember.find().sort({ displayOrder: 1 });
};

module.exports = {
    getAllLeadershipMembers,
    createLeadershipMember,
    updateLeadershipMember,
    deleteLeadershipMember,
    toggleLeadershipStatus,
    reorderLeadershipMembers
};
