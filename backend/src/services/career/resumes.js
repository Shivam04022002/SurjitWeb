const files = require('../storage/privateFiles');

// Job applicants' CVs: where each is stored, and what staff may see of it.
//
// A CV is stored at the address recorded on its own application
// (`resumeUrl`) and is trusted only inside resumes/ of this application's
// storage. It reaches staff only through
// GET /api/v1/careers/applications/:id/resume, which checks the Job
// Applications permission; the stored address itself is never sent to a
// browser.

const FOLDER = 'resumes';

const nameOf = (application) => files.sanitizeFilename(application.resumeOriginalName)
    || files.storedNameOf(application.resumeFileName || application.resumeUrl);

// What the CMS shows about an application's CV, without its address.
//
//   available     present in storage
//   missing       recorded, but the file is no longer in storage
//   unrecognised  recorded at an address outside this app's CV storage
//   unchecked     recorded; storage could not be asked in time
//   recorded      recorded (storage not asked: `check: false`)
//   not_provided  no CV was uploaded
const resumeViewOf = async (application, { check = false } = {}) => {
    const stored = application.resumeUrl;
    if (!stored) return { status: 'not_provided', fileName: '', fileType: '' };
    const fileName = nameOf(application);
    const ext = files.extensionOf(fileName || stored);
    const view = { fileName, fileType: ext ? ext.toUpperCase() : '' };
    const location = files.locate(stored, FOLDER);
    if (!location) return { ...view, status: 'unrecognised' };
    if (!check) return { ...view, status: 'recorded' };
    return { ...view, status: await files.checkAvailability(location) };
};

// Opens the CV of this application for streaming, or null when it has none
// in our storage.
const openResume = async (application) => {
    const location = files.locate(application.resumeUrl, FOLDER);
    if (!location) return null;
    return files.openLocated(location, nameOf(application));
};

module.exports = { FOLDER, resumeViewOf, openResume };
