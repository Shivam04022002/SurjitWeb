# Surjit Finance CMS Backend

## Phase 1 Foundation

This backend powers the Surjit Finance CMS Admin Panel and continues to serve the existing public website forms.

## Tech Stack

- Node.js
- Express.js
- MongoDB / Mongoose
- JWT Authentication (delivered via httpOnly cookies)
- Bcrypt
- AWS SDK v3 (S3)
- Helmet, Morgan, Express Rate Limit
- Multer / Multer-S3
- Cookie Parser

## Quick Start

```bash
cd backend
npm install
cp .env.example .env
# Update .env with your MongoDB URI and secrets
npm run dev
```

## Default Super Admin

On first startup, a Super Admin is seeded automatically:

- Email: `admin@surjitfinance.com`
- Password: `Admin@123`

Configure these via `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` environment variables.

## Authentication

JWT access and refresh tokens are delivered as httpOnly cookies to protect against XSS. The auth middleware also accepts an `Authorization: Bearer <token>` header for API testing.

## API Versioning

- Admin/CMS endpoints: `/api/v1/...`
- Public website endpoints: `/api/...`

## Available Scripts

```bash
npm run dev     # Start with nodemon
npm start       # Start with node
```

## Folder Structure

See `PHASE_1_DELIVERABLES.md` in the project root for the complete backend folder structure.
