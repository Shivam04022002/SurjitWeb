const requiredAlways = [
    'MONGODB_URI',
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'CORS_ORIGIN'
];

const env = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT || '5000', 10),

    MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/surjitfinance_cms',

    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'default_access_secret',
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'default_refresh_secret',
    JWT_ACCESS_EXPIRATION: process.env.JWT_ACCESS_EXPIRATION || '15m',
    JWT_REFRESH_EXPIRATION: process.env.JWT_REFRESH_EXPIRATION || '7d',

    CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',

    AWS_REGION: process.env.AWS_REGION || 'ap-south-1',
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || '',
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || '',
    AWS_S3_BUCKET_NAME: process.env.AWS_S3_BUCKET_NAME || '',
    AWS_S3_BASE_URL: process.env.AWS_S3_BASE_URL || '',

    BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),

    // General API rate limit (per IP)
    API_RATE_LIMIT_WINDOW_MS: parseInt(process.env.API_RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 min
    API_RATE_LIMIT_MAX: parseInt(process.env.API_RATE_LIMIT_MAX || '1000', 10),

    // Public review submission. Deliberately far tighter than the general API
    // limiter: this is an unauthenticated write that also accepts a file.
    REVIEW_RATE_LIMIT_WINDOW_MS: parseInt(process.env.REVIEW_RATE_LIMIT_WINDOW_MS || '3600000', 10), // 1 hour
    REVIEW_RATE_LIMIT_MAX: parseInt(process.env.REVIEW_RATE_LIMIT_MAX || '5', 10),

    // Login rate limit (per IP + email, failed attempts only)
    AUTH_RATE_LIMIT_WINDOW_MS: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 min
    AUTH_RATE_LIMIT_MAX: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '10', 10),

    SUPER_ADMIN_EMAIL: process.env.SUPER_ADMIN_EMAIL || 'admin@surjitfinance.com',
    SUPER_ADMIN_PASSWORD: process.env.SUPER_ADMIN_PASSWORD || 'Admin@123'
};

const validateEnv = () => {
    const missing = requiredAlways.filter((key) => !env[key] || env[key].trim() === '');
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    if (env.NODE_ENV === 'production') {
        const weakSecrets = [];
        if (env.JWT_ACCESS_SECRET === 'default_access_secret') weakSecrets.push('JWT_ACCESS_SECRET');
        if (env.JWT_REFRESH_SECRET === 'default_refresh_secret') weakSecrets.push('JWT_REFRESH_SECRET');
        if (weakSecrets.length > 0) {
            throw new Error(`Production requires strong JWT secrets. Update: ${weakSecrets.join(', ')}`);
        }
    }
};

validateEnv();

module.exports = env;
