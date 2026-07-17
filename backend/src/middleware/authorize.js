const { sendError } = require('../utils/response');
const HTTP_STATUS = require('../constants/httpStatus');

const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return sendError(res, 'Unauthorized', [], HTTP_STATUS.UNAUTHORIZED);
        }

        if (!allowedRoles.includes(req.user.role)) {
            return sendError(res, 'You do not have permission to access this resource', [], HTTP_STATUS.FORBIDDEN);
        }

        next();
    };
};

module.exports = authorize;
