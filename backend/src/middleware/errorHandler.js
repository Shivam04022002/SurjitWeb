const HTTP_STATUS = require('../constants/httpStatus');
const logger = require('../utils/logger');
const { sendError } = require('../utils/response');

class AppError extends Error {
    constructor(message, statusCode, errors = []) {
        super(message);
        this.statusCode = statusCode;
        this.errors = errors;
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

const errorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
    err.message = err.message || 'Internal Server Error';

    logger.error(err.message, {
        stack: err.stack,
        statusCode: err.statusCode,
        path: req.originalUrl,
        method: req.method
    });

    if (process.env.NODE_ENV === 'development') {
        return sendError(res, err.message, err.errors || [], err.statusCode);
    }

    return sendError(res, err.message, err.errors || [], err.statusCode);
};

const notFound = (req, res, next) => {
    next(new AppError(`Route not found: ${req.originalUrl}`, HTTP_STATUS.NOT_FOUND));
};

module.exports = { errorHandler, notFound, AppError };
