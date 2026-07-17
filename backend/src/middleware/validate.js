const { validationResult } = require('express-validator');
const { sendError } = require('../utils/response');
const HTTP_STATUS = require('../constants/httpStatus');

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const formattedErrors = errors.array().map((err) => ({
            field: err.path,
            message: err.msg
        }));
        return sendError(res, 'Validation failed', formattedErrors, HTTP_STATUS.BAD_REQUEST);
    }
    next();
};

module.exports = validate;
