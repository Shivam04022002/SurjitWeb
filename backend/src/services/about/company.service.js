const CompanyInfo = require('../../models/CompanyInfo');

const getCompanyInfo = async () => {
    let company = await CompanyInfo.findOne();
    if (!company) {
        company = await CompanyInfo.create({});
    }
    return company;
};

const updateCompanyInfo = async (data) => {
    let company = await CompanyInfo.findOne();
    if (!company) {
        company = await CompanyInfo.create(data);
        return company;
    }

    Object.assign(company, data);
    await company.save();
    return company;
};

module.exports = { getCompanyInfo, updateCompanyInfo };
