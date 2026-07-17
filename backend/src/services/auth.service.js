const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
const RefreshToken = require('../models/RefreshToken');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/token');
const { AppError } = require('../middleware/errorHandler');
const HTTP_STATUS = require('../constants/httpStatus');
const env = require('../config/env');

const login = async (email, password) => {
    const admin = await Admin.findOne({ email }).select('+password');

    if (!admin) {
        throw new AppError('Invalid email or password', HTTP_STATUS.UNAUTHORIZED);
    }

    if (!admin.isActive) {
        throw new AppError('Account is deactivated', HTTP_STATUS.FORBIDDEN);
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
        throw new AppError('Invalid email or password', HTTP_STATUS.UNAUTHORIZED);
    }

    admin.lastLoginAt = new Date();
    await admin.save();

    const payload = { id: admin._id, email: admin.email, role: admin.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    await RefreshToken.create({
        token: refreshToken,
        admin: admin._id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    return {
        admin: admin.toJSON(),
        accessToken,
        refreshToken
    };
};

const logout = async (token) => {
    await RefreshToken.updateOne({ token }, { revokedAt: new Date() });
};

const getProfile = async (adminId) => {
    const admin = await Admin.findById(adminId).select('-password');
    if (!admin) {
        throw new AppError('Admin not found', HTTP_STATUS.NOT_FOUND);
    }
    return admin;
};

const changePassword = async (adminId, currentPassword, newPassword) => {
    const admin = await Admin.findById(adminId).select('+password');
    if (!admin) {
        throw new AppError('Admin not found', HTTP_STATUS.NOT_FOUND);
    }

    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    if (!isMatch) {
        throw new AppError('Current password is incorrect', HTTP_STATUS.BAD_REQUEST);
    }

    const isSamePassword = await bcrypt.compare(newPassword, admin.password);
    if (isSamePassword) {
        throw new AppError('New password cannot be same as current password', HTTP_STATUS.BAD_REQUEST);
    }

    admin.password = await bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS);
    await admin.save();

    // Revoke all refresh tokens for this admin after password change
    await RefreshToken.updateMany({ admin: adminId, revokedAt: null }, { revokedAt: new Date() });

    return admin;
};

const refreshAccessToken = async (token) => {
    const storedToken = await RefreshToken.findOne({ token, revokedAt: null });
    if (!storedToken || storedToken.expiresAt < new Date()) {
        throw new AppError('Invalid or expired refresh token', HTTP_STATUS.UNAUTHORIZED);
    }

    const decoded = verifyRefreshToken(token);
    const admin = await Admin.findById(decoded.id);

    if (!admin || !admin.isActive) {
        throw new AppError('Admin not found or deactivated', HTTP_STATUS.UNAUTHORIZED);
    }

    const payload = { id: admin._id, email: admin.email, role: admin.role };
    const accessToken = generateAccessToken(payload);

    return { accessToken };
};

module.exports = {
    login,
    logout,
    getProfile,
    changePassword,
    refreshAccessToken
};
