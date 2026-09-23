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
    ANALYTICS_RATE_LIMIT_WINDOW_MS: parseInt(process.env.ANALYTICS_RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 min
    ANALYTICS_RATE_LIMIT_MAX: parseInt(process.env.ANALYTICS_RATE_LIMIT_MAX || '300', 10),
    // Calendar days in the analytics dashboard are this zone's days.
    ANALYTICS_TIMEZONE: process.env.ANALYTICS_TIMEZONE || 'Asia/Kolkata',
    LOAN_RATE_LIMIT_WINDOW_MS: parseInt(process.env.LOAN_RATE_LIMIT_WINDOW_MS || '3600000', 10), // 1 hour
    LOAN_RATE_LIMIT_MAX: parseInt(process.env.LOAN_RATE_LIMIT_MAX || '10', 10),
    LOAN_STATUS_RATE_LIMIT_WINDOW_MS: parseInt(process.env.LOAN_STATUS_RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 min
    LOAN_STATUS_RATE_LIMIT_MAX: parseInt(process.env.LOAN_STATUS_RATE_LIMIT_MAX || '30', 10),
    REVIEW_RATE_LIMIT_WINDOW_MS: parseInt(process.env.REVIEW_RATE_LIMIT_WINDOW_MS || '3600000', 10), // 1 hour
    REVIEW_RATE_LIMIT_MAX: parseInt(process.env.REVIEW_RATE_LIMIT_MAX || '5', 10),

    // Login rate limit (per IP + email, failed attempts only)
    AUTH_RATE_LIMIT_WINDOW_MS: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 min
    AUTH_RATE_LIMIT_MAX: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '10', 10),

    // Gemini blog generation. The API key is normally entered in the CMS (API
    // page) and stored encrypted; GEMINI_API_KEY, when set, takes precedence
    // and the CMS then shows it as managed by the server environment.
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
    GEMINI_TEXT_MODEL: process.env.GEMINI_TEXT_MODEL || 'gemini-3.6-flash',
    // Featured images (paid: needs Gemini API billing). Nano Banana 2.
    GEMINI_IMAGE_MODEL: process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image',
    // Kept under nginx's default 60s proxy timeout so a slow model surfaces as
    // a clear error rather than a gateway timeout.
    GEMINI_TIMEOUT_MS: parseInt(process.env.GEMINI_TIMEOUT_MS || '55000', 10),
    // Base delay for retrying a transient Gemini failure (500/503): about this
    // long before the first retry and twice that before the second. Retries
    // share the GEMINI_TIMEOUT_MS budget.
    GEMINI_RETRY_BASE_MS: parseInt(process.env.GEMINI_RETRY_BASE_MS || '1000', 10),
    // Free text models to fall back to, in order, when the API-page model is
    // out of quota (429) or overloaded (500/503 after retries). Comma
    // separated. Empty means no fallback. Never includes image/media models.
    // A list saved on the API page takes precedence; this applies only while
    // none is saved there.
    GEMINI_FALLBACK_TEXT_MODELS: process.env.GEMINI_FALLBACK_TEXT_MODELS || '',
    // How long a model is skipped after a quota error when Google gives no
    // retry delay, and after an overload that retries could not fix.
    GEMINI_QUOTA_COOLDOWN_MS: parseInt(process.env.GEMINI_QUOTA_COOLDOWN_MS || '60000', 10),
    GEMINI_OVERLOAD_COOLDOWN_MS: parseInt(process.env.GEMINI_OVERLOAD_COOLDOWN_MS || '30000', 10),

    // Free featured images from Pexels (https://www.pexels.com/api/). The key
    // is normally saved on the API page (stored encrypted); this is used only
    // while none is saved there. With neither, admins upload images themselves.
    PEXELS_API_KEY: process.env.PEXELS_API_KEY || '',
    GEMINI_RATE_LIMIT_WINDOW_MS: parseInt(process.env.GEMINI_RATE_LIMIT_WINDOW_MS || '3600000', 10), // 1 hour
    GEMINI_RATE_LIMIT_MAX: parseInt(process.env.GEMINI_RATE_LIMIT_MAX || '40', 10),
    // Website analytics location: a local MaxMind GeoLite2 City database.
    // Unset (or a missing file) simply means visits are recorded without a
    // location. No visitor IP is ever stored or sent anywhere.
    GEOIP_CITY_DB_PATH: process.env.GEOIP_CITY_DB_PATH || '',

    // Encrypts integration secrets at rest. Falls back to a key derived from
    // JWT_ACCESS_SECRET, so rotating that secret without setting this one
    // means stored integration keys must be re-entered.
    SETTINGS_ENCRYPTION_KEY: process.env.SETTINGS_ENCRYPTION_KEY || '',

    SUPER_ADMIN_EMAIL:process.env.SUPER_ADMIN_EMAIL || 'admin@surjitfinance.com',
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
