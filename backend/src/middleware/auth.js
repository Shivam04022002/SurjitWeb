const { verifyAccessToken } = require('../utils/token');
const Admin = require('../models/Admin');
const { sendError } = require('../utils/response');
const HTTP_STATUS = require('../constants/httpStatus');
const asyncHandler = require('../utils/asyncHandler');

const extractToken = (req) => {
    if (req.cookies?.accessToken) {
        return req.cookies.accessToken;
    }

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.split(' ')[1];
    }

    return null;
};

const auth = asyncHandler(async (req, res, next) => {
    const token = extractToken(req);

    if (!token) {
        return sendError(res, 'Access token is required', [], HTTP_STATUS.UNAUTHORIZED);
    }

    try {
        const decoded = verifyAccessToken(token);
        const admin = await Admin.findById(decoded.id).select('-password');

        if (!admin) {
            return sendError(res, 'Admin not found', [], HTTP_STATUS.UNAUTHORIZED);
        }

        if (!admin.isActive) {
            return sendError(res, 'Account is deactivated', [], HTTP_STATUS.FORBIDDEN);
        }

        req.user = admin;
        next();
    } catch (error) {
        return sendError(res, 'Invalid or expired token', [], HTTP_STATUS.UNAUTHORIZED);
    }
});

module.exports = auth;
