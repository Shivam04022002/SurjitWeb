const CareerSettings = require('../../models/CareerSettings');

const getSettings = async () => {
    let settings = await CareerSettings.findOne();
    if (!settings) {
        settings = await CareerSettings.create({});
    }
    return settings;
};

const updateSettings = async (data) => {
    let settings = await CareerSettings.findOne();
    if (!settings) {
        settings = await CareerSettings.create(data);
        return settings;
    }
    Object.assign(settings, data);
    await settings.save();
    return settings;
};

module.exports = { getSettings, updateSettings };
