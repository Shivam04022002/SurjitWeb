const crypto = require('crypto');
const env = require('../config/env');

// Authenticated encryption for secrets stored in the database (third-party
// API keys). AES-256-GCM: a tampered or wrong-key ciphertext fails to decrypt
// instead of producing garbage.
//
// The key is derived with HKDF from SETTINGS_ENCRYPTION_KEY, or from
// JWT_ACCESS_SECRET when that is not set. A distinct `info` label means the
// derived key is never the JWT secret itself, and a leak of one ciphertext
// says nothing about the token-signing key.

const ALGORITHM = 'aes-256-gcm';
const INFO = 'surjit-cms/integration-secrets/v1';

const deriveKey = () => {
    const material = env.SETTINGS_ENCRYPTION_KEY || env.JWT_ACCESS_SECRET;
    if (!material) throw new Error('No encryption key material is configured');
    return Buffer.from(crypto.hkdfSync('sha256', material, Buffer.alloc(0), INFO, 32));
};

const encrypt = (plaintext) => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, deriveKey(), iv);
    const data = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
    return {
        iv: iv.toString('base64'),
        tag: cipher.getAuthTag().toString('base64'),
        data: data.toString('base64')
    };
};

// Returns null rather than throwing when the value cannot be decrypted — most
// often because the encryption key material changed — so callers can report
// "re-enter the key" instead of failing with a crypto error.
const decrypt = (box) => {
    if (!box || !box.iv || !box.tag || !box.data) return null;
    try {
        const decipher = crypto.createDecipheriv(ALGORITHM, deriveKey(), Buffer.from(box.iv, 'base64'));
        decipher.setAuthTag(Buffer.from(box.tag, 'base64'));
        return Buffer.concat([
            decipher.update(Buffer.from(box.data, 'base64')),
            decipher.final()
        ]).toString('utf8');
    } catch {
        return null;
    }
};

module.exports = { encrypt, decrypt };
