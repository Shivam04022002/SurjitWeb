# Surjit Finance CMS Admin Panel

## Phase 1 Foundation

This is the admin panel for the Surjit Finance CMS.

## Tech Stack

- React 19
- Vite 7
- Material UI 6
- React Router 7
- React Hook Form
- Yup + @hookform/resolvers
- Axios

## Quick Start

```bash
cd admin
npm install
cp .env.example .env
# Update .env if your backend runs on a different URL/port
npm run dev
```

The dev server runs on port 5174 and proxies `/api` requests to the backend at `http://localhost:5000`.

## Authentication

The admin panel uses httpOnly cookies for JWT storage. No tokens are stored in `localStorage`. Axios is configured with `withCredentials: true` so cookies are sent automatically.

## Default Login

Use the Super Admin credentials created by the backend seed:

- Email: `admin@surjitfinance.com`
- Password: `Admin@123`

## Available Scripts

```bash
npm run dev       # Start dev server
npm run build     # Build for production
npm run preview   # Preview production build
npm run lint      # Run ESLint
```

## Folder Structure

See `PHASE_1_DELIVERABLES.md` in the project root for the complete admin panel folder structure.
