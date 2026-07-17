const env = require('../config/env');

const isProduction = env.NODE_ENV === 'production';

// Admin (cms.surjitfinance.com) and API (cms-api.surjitfinance.com) are on different
// subdomains, so credentialed cross-origin XHR requires SameSite=None + Secure in production.
const defaultCookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'None' : 'Lax',
    path: '/'
};

const setAuthCookies = (res, accessToken, refreshToken) => {
    const accessTokenMaxAge = 15 * 60 * 1000; // 15 minutes
    const refreshTokenMaxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

    res.cookie('accessToken', accessToken, {
        ...defaultCookieOptions,
        maxAge: accessTokenMaxAge
    });

    res.cookie('refreshToken', refreshToken, {
        ...defaultCookieOptions,
        maxAge: refreshTokenMaxAge
    });
};

const clearAuthCookies = (res) => {
    res.clearCookie('accessToken', { ...defaultCookieOptions });
    res.clearCookie('refreshToken', { ...defaultCookieOptions });
};

const getRefreshTokenFromCookie = (req) => {
    return req.cookies?.refreshToken;
};

module.exports = {
    setAuthCookies,
    clearAuthCookies,
    getRefreshTokenFromCookie,
    defaultCookieOptions
};
