const mongoose = require('mongoose');

const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'internship', 'contract'];

const jobOpeningSchema = new mongoose.Schema({
    jobTitle: {
        type: String,
        required: [true, 'Job title is required'],
        trim: true,
        maxlength: [200, 'Job title must not exceed 200 characters']
    },
    department: {
        type: String,
        required: [true, 'Department is required'],
        trim: true,
        maxlength: [200, 'Department must not exceed 200 characters']
    },
    location: {
        type: String,
        required: [true, 'Location is required'],
        trim: true,
        maxlength: [200, 'Location must not exceed 200 characters']
    },
    employmentType: {
        type: String,
        required: [true, 'Employment type is required'],
        enum: {
            values: EMPLOYMENT_TYPES,
            message: 'Employment type must be one of: full_time, part_time, internship, contract'
        }
    },
    experienceRequired: {
        type: String,
        trim: true,
        default: '',
        maxlength: [200, 'Experience required must not exceed 200 characters']
    },
    numberOfVacancies: {
        type: Number,
        default: 1,
        min: [1, 'Number of vacancies must be at least 1']
    },
    salary: {
        type: String,
        trim: true,
        default: '',
        maxlength: [200, 'Salary must not exceed 200 characters']
    },
    shortDescription: {
        type: String,
        trim: true,
        default: '',
        maxlength: [500, 'Short description must not exceed 500 characters']
    },
    fullDescription: {
        type: String,
        trim: true,
        default: ''
    },
    skillsRequired: [{ type: String, trim: true }],
    responsibilities: [{ type: String, trim: true }],
    qualifications: [{ type: String, trim: true }],
    displayOrder: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    applicationDeadline: { type: Date, default: null },
    seoMetaTitle: { type: String, trim: true, default: '', maxlength: [160, 'Meta title must not exceed 160 characters'] },
    seoMetaDescription: { type: String, trim: true, default: '', maxlength: [320, 'Meta description must not exceed 320 characters'] },
    seoMetaKeywords: { type: String, trim: true, default: '' },
    deletedAt: { type: Date, default: null }
}, {
    timestamps: true
});

jobOpeningSchema.pre(/^find/, function (next) {
    if (this.getFilter().deletedAt === undefined) {
        this.where({ deletedAt: null });
    }
    next();
});

jobOpeningSchema.index({ isPublished: 1 });
jobOpeningSchema.index({ isActive: 1 });
jobOpeningSchema.index({ department: 1 });
jobOpeningSchema.index({ employmentType: 1 });
jobOpeningSchema.index({ displayOrder: 1 });
jobOpeningSchema.index({ applicationDeadline: 1 });
jobOpeningSchema.index({ deletedAt: 1 });
jobOpeningSchema.index({ createdAt: -1 });

module.exports = mongoose.model('JobOpening', jobOpeningSchema);
