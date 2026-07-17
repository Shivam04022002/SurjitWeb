// Database connection helper for migration scripts.
// Loads env from backend/.env and connects mongoose using MONGODB_URI.
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');

const connect = async () => {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error('MONGODB_URI is not set (checked backend/.env and process.env).');
    }
    await mongoose.connect(uri);
    return mongoose.connection;
};

const disconnect = async () => {
    await mongoose.connection.close();
};

module.exports = { connect, disconnect, mongoose };
