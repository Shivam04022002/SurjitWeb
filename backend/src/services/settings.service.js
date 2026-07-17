const GlobalSettings = require('../models/GlobalSettings');

const getSettings = async () => {
    let settings = await GlobalSettings.findOne();
    if (!settings) {
        settings = await GlobalSettings.create({});
    }
    return settings;
};

const updateSettings = async (data) => {
    let settings = await GlobalSettings.findOne();
    if (!settings) {
        settings = await GlobalSettings.create(data);
        return settings;
    }
    Object.assign(settings, data);
    await settings.save();
    return settings;
};

module.exports = { getSettings, updateSettings };
