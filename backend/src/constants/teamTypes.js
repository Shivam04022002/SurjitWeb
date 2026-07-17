const TEAM_TYPES = {
    LEADERSHIP: 'leadership',
    BOARD: 'board'
};

const TEAM_TYPE_VALUES = Object.values(TEAM_TYPES);

const TEAM_TYPE_LABELS = {
    [TEAM_TYPES.LEADERSHIP]: 'Leadership Team',
    [TEAM_TYPES.BOARD]: 'Board of Directors'
};

module.exports = { TEAM_TYPES, TEAM_TYPE_VALUES, TEAM_TYPE_LABELS };
