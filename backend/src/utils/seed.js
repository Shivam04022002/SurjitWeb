const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
const env = require('../config/env');
const { ROLES } = require('../constants/roles');
const logger = require('./logger');

const seedSuperAdmin = async () => {
    try {
        const exists = await Admin.findOne({ email: env.SUPER_ADMIN_EMAIL });
        if (exists) {
            return;
        }

        const hashedPassword = await bcrypt.hash(env.SUPER_ADMIN_PASSWORD, env.BCRYPT_SALT_ROUNDS);

        await Admin.create({
            name: 'Super Admin',
            email: env.SUPER_ADMIN_EMAIL,
            password: hashedPassword,
            role: ROLES.SUPER_ADMIN,
            isActive: true
        });

        logger.info('Super admin seeded successfully');
    } catch (error) {
        logger.error('Failed to seed super admin:', error);
        throw error;
    }
};

module.exports = { seedSuperAdmin };
