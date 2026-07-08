# CropIn — Model Validation Tool

Angular (frontend) + FastAPI (backend) rewrite of the original Streamlit tool. The old app is preserved, untouched, in [legacy-streamlit/](legacy-streamlit/) for reference.

## Stack

- **Frontend:** Angular (latest, standalone components, signals), plain SCSS — no UI framework
- **Backend:** FastAPI (Python), SQLite (WAL mode) — ports the exact business logic from the original `app.py`
- **Auth:** Department + name login (no password), same as the current Streamlit flow

## First-time setup

Requires Node.js (npm) and Python 3 on PATH.

```bash
npm run install:all
```

This installs root + frontend npm dependencies, and creates a Python venv at `backend/.venv` with the backend's dependencies installed.

## Running locally

```bash
npm start
```

Runs both servers concurrently:
- Backend (FastAPI/uvicorn): http://localhost:8000
- Frontend (Angular dev server): http://localhost:4200 — opens automatically

Stop both with:

```bash
npm run stop
```

## Project layout

```
backend/    FastAPI app — routers, SQLite schema, business logic ported from app.py
frontend/   Angular app — one page component per screen (login, overview, qa-review, ds-review, publish, activity, manage-users)
legacy-streamlit/   Original Streamlit app, untouched, kept for reference
```

## Default accounts (Manage Users page only)

The department/name login on the main screen requires no password. The `users` table (used only by the PM-only "Manage Users" page for record-keeping) seeds the same defaults as the legacy app:

| Username | Role |
|----------|------|
| harsha | PM |
| qa1, qa2 | QA |
| ds1 | DS |
