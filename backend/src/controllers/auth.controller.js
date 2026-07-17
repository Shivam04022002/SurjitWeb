const authService = require('../services/auth.service');
const { sendSuccess } = require('../utils/response');
const HTTP_STATUS = require('../constants/httpStatus');
const asyncHandler = require('../utils/asyncHandler');
const { setAuthCookies, clearAuthCookies, getRefreshTokenFromCookie } = require('../utils/authCookies');
const { resetLoginLimiter } = require('../middleware/rateLimiters');

const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const { admin, accessToken, refreshToken } = await authService.login(email, password);
    setAuthCookies(res, accessToken, refreshToken);
    // Successful login: clear this account's failed-attempt counter.
    resetLoginLimiter(req);
    return sendSuccess(res, 'Login successful', { admin }, HTTP_STATUS.OK);
});

const logout = asyncHandler(async (req, res) => {
    const refreshToken = getRefreshTokenFromCookie(req) || req.body?.refreshToken;
    if (refreshToken) {
        await authService.logout(refreshToken);
    }
    clearAuthCookies(res);
    return sendSuccess(res, 'Logout successful', {}, HTTP_STATUS.OK);
});

const getProfile = asyncHandler(async (req, res) => {
    const admin = await authService.getProfile(req.user._id);
    return sendSuccess(res, 'Profile fetched successfully', { admin }, HTTP_STATUS.OK);
});

const changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    await authService.changePassword(req.user._id, currentPassword, newPassword);
    clearAuthCookies(res);
    return sendSuccess(res, 'Password changed successfully. Please log in again.', {}, HTTP_STATUS.OK);
});

const refreshToken = asyncHandler(async (req, res) => {
    const refreshToken = getRefreshTokenFromCookie(req) || req.body?.refreshToken;
    const { accessToken } = await authService.refreshAccessToken(refreshToken);
    setAuthCookies(res, accessToken, refreshToken);
    return sendSuccess(res, 'Token refreshed successfully', {}, HTTP_STATUS.OK);
});

module.exports = {
    login,
    logout,
    getProfile,
    changePassword,
    refreshToken
};
