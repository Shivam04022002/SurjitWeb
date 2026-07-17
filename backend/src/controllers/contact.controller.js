const Contact = require('../models/Contact');
const { sendSuccess } = require('../utils/response');
const HTTP_STATUS = require('../constants/httpStatus');
const asyncHandler = require('../utils/asyncHandler');

const submitContact = asyncHandler(async (req, res) => {
    const contact = await Contact.create(req.body);
    return sendSuccess(res, 'Thank you for contacting us! We will get back to you soon.', contact, HTTP_STATUS.CREATED);
});

const getAllContacts = asyncHandler(async (req, res) => {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    return sendSuccess(res, 'Contacts fetched successfully', { contacts }, HTTP_STATUS.OK);
});

module.exports = {
    submitContact,
    getAllContacts
};
