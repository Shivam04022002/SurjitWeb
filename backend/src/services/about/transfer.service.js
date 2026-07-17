// Moves a member between the Directors and LeadershipMember collections.
// The two collections stay separate; a transfer copies the document into the
// destination, then removes the original, so the admin sees one record move
// rather than a duplicate appearing.
const Director = require('../../models/Director');
const LeadershipMember = require('../../models/LeadershipMember');
const { AppError } = require('../../middleware/errorHandler');
const HTTP_STATUS = require('../../constants/httpStatus');
const { TEAM_TYPES, TEAM_TYPE_VALUES } = require('../../constants/teamTypes');

const TEAMS = {
    [TEAM_TYPES.BOARD]: { model: Director, label: 'Director' },
    [TEAM_TYPES.LEADERSHIP]: { model: LeadershipMember, label: 'Leadership member' }
};

// Fields carried across. linkedinUrl is only defined on Director, so it is
// copied only when the destination schema actually has the path — a board
// member moved to leadership would otherwise fail validation.
const TRANSFERABLE_FIELDS = [
    'name',
    'designation',
    'description',
    'photo',
    'linkedinUrl',
    'displayOrder',
    'isActive'
];

// `photo` is a nested object rather than a single path, so pathType is used
// instead of schema.path() — the latter returns undefined for nested objects
// and would silently drop the member's image.
const targetHasField = (targetModel, field) => {
    const pathType = targetModel.schema.pathType(field);
    return pathType === 'real' || pathType === 'nested';
};

const buildPayload = (source, targetModel) => {
    const payload = {};
    for (const field of TRANSFERABLE_FIELDS) {
        if (!targetHasField(targetModel, field) || source[field] === undefined) continue;
        payload[field] = source[field];
    }
    return payload;
};

const nextDisplayOrder = async (model) => {
    const last = await model.findOne().sort({ displayOrder: -1 }).select('displayOrder');
    return last ? last.displayOrder + 1 : 1;
};

// Keeps the member's own displayOrder unless the destination already uses it,
// in which case the member is appended to the end.
const resolveDisplayOrder = async (model, desiredOrder) => {
    if (desiredOrder === undefined || desiredOrder === null) {
        return nextDisplayOrder(model);
    }
    const taken = await model.exists({ displayOrder: desiredOrder });
    return taken ? nextDisplayOrder(model) : desiredOrder;
};

const transferMember = async (id, sourceTeam, targetTeam) => {
    if (!TEAM_TYPE_VALUES.includes(targetTeam)) {
        throw new AppError(
            `targetTeam must be one of: ${TEAM_TYPE_VALUES.join(', ')}`,
            HTTP_STATUS.BAD_REQUEST
        );
    }

    const source = TEAMS[sourceTeam];
    const target = TEAMS[targetTeam];

    if (sourceTeam === targetTeam) {
        throw new AppError('Member is already in the requested team', HTTP_STATUS.BAD_REQUEST);
    }

    const original = await source.model.findById(id);
    if (!original) {
        throw new AppError(`${source.label} not found`, HTTP_STATUS.NOT_FOUND);
    }

    const payload = buildPayload(original, target.model);
    payload.displayOrder = await resolveDisplayOrder(target.model, original.displayOrder);

    // Reuse the original _id so the member keeps a stable identity across the
    // move, and carry the original timestamps rather than restamping.
    payload._id = original._id;
    payload.createdAt = original.createdAt;
    payload.updatedAt = original.updatedAt;

    const created = new target.model(payload);
    await created.save({ timestamps: false });

    // Destination is written first so a failure here leaves the original
    // untouched. Once it exists, remove the source; if that fails, drop the
    // copy so a transfer can never leave the member listed on both pages.
    try {
        await source.model.findByIdAndDelete(original._id);
    } catch (err) {
        await target.model.findByIdAndDelete(created._id);
        throw new AppError(
            'Transfer failed while removing the original record; no changes were made',
            HTTP_STATUS.INTERNAL_SERVER_ERROR
        );
    }

    return created;
};

module.exports = {
    transferMember,
    TEAMS
};
