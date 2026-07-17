# Surjit Finance CMS - Phase 1 Deliverables

## Project Overview

Phase 1 establishes the production foundation for the Surjit Finance CMS:

- New MongoDB-based backend with JWT authentication, role-based authorization, and centralized error handling.
- New Admin Panel built with React + Vite + Material UI.
- Existing public website APIs (contact, loan application, career application) are preserved and migrated to MongoDB/Mongoose.
- Existing website UI is untouched.

---

## Folder Structure

### Backend

```
backend/
├── app.js
├── server.js
├── package.json
├── .env
├── .env.example
├── .gitignore
└── src/
    ├── config/
    │   ├── db.js
    │   ├── env.js
    │   └── s3.js
    ├── constants/
    │   ├── httpStatus.js
    │   └── roles.js
    ├── controllers/
    │   ├── auth.controller.js
    │   ├── career.controller.js
    │   ├── contact.controller.js
    │   └── loanApplication.controller.js
    ├── middleware/
    │   ├── auth.js
    │   ├── authorize.js
    │   ├── errorHandler.js
    │   ├── upload.js
    │   └── validate.js
    ├── models/
    │   ├── Admin.js
    │   ├── Contact.js
    │   ├── JobApplication.js
    │   ├── LoanApplication.js
    │   └── RefreshToken.js
    ├── routes/
    │   ├── auth.routes.js
    │   ├── career.routes.js
    │   ├── contact.routes.js
    │   ├── index.js
    │   └── loanApplication.routes.js
    ├── services/
    │   ├── admin.service.js
    │   └── auth.service.js
    ├── uploads/
    │   ├── .gitkeep
    │   └── documents/
    │       └── .gitkeep
    ├── utils/
    │   ├── asyncHandler.js
    │   ├── authCookies.js
    │   ├── logger.js
    │   ├── response.js
    │   ├── seed.js
    │   └── token.js
    └── validators/
        ├── auth.validator.js
        ├── career.validator.js
        ├── contact.validator.js
        ├── index.js
        └── loanApplication.validator.js
```

### Admin Panel

```
admin/
├── .env
├── .env.example
├── .gitignore
├── eslint.config.js
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── components/
    │   └── Loading.jsx
    ├── contexts/
    │   └── AuthContext.jsx
    ├── hooks/
    │   └── useAuth.js
    ├── layouts/
    │   ├── DashboardLayout.jsx
    │   ├── Header.jsx
    │   └── Sidebar.jsx
    ├── pages/
    │   ├── DashboardPage.jsx
    │   ├── LoginPage.jsx
    │   └── ProfilePage.jsx
    ├── routes/
    │   └── AppRoutes.jsx
    ├── services/
    │   ├── api.js
    │   └── auth.service.js
    ├── utils/
    │   ├── constants.js
    │   └── validation.js
    ├── assets/
    │   └── .gitkeep
    ├── App.jsx (optional, currently unused)
    ├── index.css
    └── main.jsx
```

---

## Environment Variables

### Backend (`backend/.env`)

```ini
NODE_ENV=development
PORT=5000

MONGODB_URI=mongodb://127.0.0.1:27017/surjitfinance_cms

JWT_ACCESS_SECRET=your_jwt_access_secret_key_change_in_production
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_change_in_production
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

CORS_ORIGIN=http://localhost:5173,http://localhost:5174,https://surjitfinance.com

AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_S3_BUCKET_NAME=surjit-finance-cms-uploads
AWS_S3_BASE_URL=https://surjit-finance-cms-uploads.s3.ap-south-1.amazonaws.com

BCRYPT_SALT_ROUNDS=12

SUPER_ADMIN_EMAIL=admin@surjitfinance.com
SUPER_ADMIN_PASSWORD=Admin@123
```

### Admin Panel (`admin/.env`)

```ini
VITE_API_BASE_URL=http://localhost:5000/api
```

---

## Installation Steps

### Prerequisites

- Node.js (v18+ recommended)
- MongoDB (local or Atlas)
- AWS S3 bucket and credentials (optional for local development; falls back to local disk storage)

### Backend

```bash
# From the project root
cd backend
npm install
# Copy example env and configure
cp .env.example .env
# Start the server
npm run dev
```

### Admin Panel

```bash
# From the project root
cd admin
npm install
# Copy example env and configure
cp .env.example .env
# Start the dev server
npm run dev
```

### Existing Website (unchanged)

```bash
# From the project root
cd frontend
npm install
npm run dev
```

---

## Commands to Run Locally

### Backend

```bash
npm run dev      # Start with nodemon (auto-reload)
npm start        # Start with node (production style)
```

### Admin Panel

```bash
npm run dev      # Start Vite dev server on port 5174
npm run build    # Build for production
npm run preview  # Preview production build
```

### Existing Website

```bash
npm run dev      # Start Vite dev server on port 5173
npm run build    # Build for production
```

---

## API Documentation

### Base URL

- Local: `http://localhost:5000/api`
- Public website endpoints remain at `/api/*` for backward compatibility.
- Admin/CMS endpoints are versioned at `/api/v1/*`.

### Authentication

Tokens are delivered as **httpOnly cookies** by default to protect against XSS attacks. The browser automatically sends cookies with each request, so the admin panel does not store tokens in `localStorage`.

Protected endpoints read the access token from either:

- The `accessToken` httpOnly cookie (preferred for the admin panel)
- The `Authorization: Bearer <access_token>` header (useful for API testing)

Cookie settings:

- `httpOnly: true`
- `secure: true` in production, `false` in development
- `sameSite: 'Lax'`
- `maxAge` matches JWT expiration

### Response Format

**Success:**

```json
{
  "success": true,
  "message": "...",
  "data": {}
}
```

**Error:**

```json
{
  "success": false,
  "message": "...",
  "errors": []
}
```

---

### Auth Endpoints

#### POST /api/v1/auth/login

Login to the admin panel.

**Request:**

```json
{
  "email": "admin@surjitfinance.com",
  "password": "Admin@123"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "admin": { ... }
  }
}
```

Sets `accessToken` and `refreshToken` as httpOnly cookies.

#### POST /api/v1/auth/logout

Logout the current admin.

**Headers:** `Authorization: Bearer <access_token>`

**Response:**

```json
{
  "success": true,
  "message": "Logout successful",
  "data": {}
}
```

#### GET /api/v1/auth/profile

Get the current admin profile.

**Headers:** `Authorization: Bearer <access_token>`

**Response:**

```json
{
  "success": true,
  "message": "Profile fetched successfully",
  "data": {
    "admin": { ... }
  }
}
```

#### POST /api/v1/auth/change-password

Change the current admin password.

**Headers:** `Authorization: Bearer <access_token>`

**Request:**

```json
{
  "currentPassword": "old_password",
  "newPassword": "NewPassword@123"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Password changed successfully",
  "data": {}
}
```

#### POST /api/v1/auth/refresh-token

Refresh an access token.

The backend reads the `refreshToken` from the httpOnly cookie by default. A request body is optional for API testing.

**Response:**

```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {}
}
```

Sets a new `accessToken` httpOnly cookie.

---

### Public Website Endpoints (Preserved)

These endpoints keep the same contract as the previous backend so the existing website continues to work.

#### POST /api/contact

Submit a contact form.

**Request:**

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "9876543210",
  "subject": "Loan Inquiry",
  "message": "I am interested in a business loan."
}
```

#### POST /api/loan-application

Submit a loan application with document uploads.

**Form fields:**

- `fullName`, `email`, `phone`, `dob`, `gender`, `pan`, `aadhaar`, `address`, `city`, `state`, `pincode`
- `loanType` (business, vehicle, lap), `loanAmount`, `loanPurpose`, `tenure`
- `employmentType` (self-employed, business-owner, salaried), `businessName`, `businessType`, `monthlyIncome`, `workExperience`
- Files: `aadhaarDoc`, `panDoc`, `bankStatementDoc`, `businessProofDoc`

#### GET /api/loan-application/status/:applicationNumber

Check loan application status.

#### POST /api/career/apply

Submit a job application with resume upload.

**Form fields:**

- `jobTitle`, `name`, `email`, `phone`, `experience`, `location`
- File: `resume`

---

## Default Super Admin Credentials

- **Email:** `admin@surjitfinance.com`
- **Password:** `Admin@123`

> Change these in production via the `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` environment variables before the first deployment.

---

## Roles

- `super_admin` - Full access
- `editor` - Can create and edit content
- `content_manager` - Can manage content modules

---

## Remaining TODO for Phase 2

Phase 2 will build the first CMS content modules on top of this foundation.

### Backend

- [ ] Admin Management APIs (CRUD for admins, role assignment)
- [ ] About Us Module
  - [ ] Company Information model and APIs
  - [ ] Board of Directors CRUD
  - [ ] Leadership Team CRUD
- [ ] Soft delete helper utilities (if not already covered by model hooks)
- [ ] Add API pagination helper and standardize list responses
- [ ] AWS S3 integration testing and production file upload verification
- [ ] Add API request/response logging improvements

### Admin Panel

- [ ] Admin Management Pages (list, create, edit, delete admins)
- [ ] About Us Module Pages
  - [ ] Company Information editor
  - [ ] Board of Directors CRUD
  - [ ] Leadership Team CRUD
- [ ] Reusable data table component
- [ ] Reusable form wrapper with Yup validation
- [ ] Snackbar/Toast notification system
- [ ] Confirm dialog component

### Website Integration (Phase 3+)

- [ ] Replace hardcoded content with API calls
- [ ] Setup API service layer in the existing React website
- [ ] Implement loading/error states for CMS-driven content

---

## Notes

- MongoDB must be running before starting the backend.
- The backend seeds a default Super Admin on startup if one does not exist.
- The admin panel dev server is configured to proxy `/api` requests to the backend.
- The existing website dev server runs on port 5173 and the admin panel on port 5174.
- Local file uploads are stored in `backend/src/uploads/` when S3 credentials are not configured.
- No CloudFront is used; S3 object URLs are stored directly in MongoDB.
- JWT tokens are delivered as httpOnly cookies to mitigate XSS risks.
- Backend validates required environment variables on startup and rejects default JWT secrets in production.
