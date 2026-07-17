const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('path');

const env = require('./src/config/env');
const routes = require('./src/routes');
const { errorHandler, notFound } = require('./src/middleware/errorHandler');
const { apiLimiter } = require('./src/middleware/rateLimiters');
const logger = require('./src/utils/logger');

const app = express();

// Trust proxy (needed for rate limiter behind Nginx)
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS
app.use(cors({
    origin: (origin, callback) => {
        const allowedOrigins = env.CORS_ORIGIN ? env.CORS_ORIGIN.split(',') : ['http://localhost:5173'];
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

// General API rate limiting (per IP). Login has its own, stricter limiter
// applied at the route level (src/routes/auth.routes.js) so that a shared
// public IP cannot lock every admin out of signing in.
app.use(apiLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// HTTP request logging
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));

// Static uploads for local fallback
app.use('/uploads', express.static(path.join(__dirname, 'src', 'uploads')));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'Surjit Finance API is running', data: {} });
});

// API routes
app.use('/api', routes);

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

module.exports = app;
