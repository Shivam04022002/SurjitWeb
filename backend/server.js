require('dotenv').config();
const app = require('./app');
const connectDB = require('./src/config/db');
const logger = require('./src/utils/logger');
const { seedSuperAdmin } = require('./src/utils/seed');
const { ensureSystemRoles } = require('./src/services/role.service');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        await connectDB();
        await seedSuperAdmin();
        // Creates the roles the CMS ships with if they are missing and repairs
        // Super Admin's reach. It never deletes, renames or overwrites a role
        // an administrator has adjusted, so it is safe on every boot.
        await ensureSystemRoles();

        app.listen(PORT, () => {
            logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();
