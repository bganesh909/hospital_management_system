# Hospital Management System

A full-stack hospital management system: one web application with role-based access for admins, doctors, nurses, receptionists, pharmacists and lab technicians.

- **Backend:** FastAPI (Python 3.12), async SQLAlchemy 2 + asyncpg, Pydantic v2, JWT auth
- **Frontend:** React 18 + TypeScript, Vite, Tailwind CSS v4, TanStack Query, React Hook Form + Zod, Recharts
- **Database:** PostgreSQL 17, plain SQL migrations

## Features

| Area | What it covers |
|---|---|
| **Patients** | Registration, search, full history (appointments, OPD, IPD, lab, prescriptions, billing) |
| **Doctors & departments** | Doctor profiles linked to user accounts, weekly schedules, departments with heads |
| **Appointments** | Slot-based booking from doctor schedules, double-booking protection, check-in / complete / no-show, reschedule, cancel |
| **OPD** | Visits with vitals, diagnosis, prescriptions |
| **IPD** | Wards and beds (bulk bed creation), admissions, daily rounds, bed transfer, discharge |
| **Pharmacy** | Medicine inventory and categories, stock adjustments, low-stock and expiry alerts, dispensing against prescriptions |
| **Laboratory** | Test catalog, lab requests, result entry with normal/abnormal/critical flags, printable reports |
| **Billing** | Invoices (draft, issue, edit, cancel, print), payments, partial refunds, insurance claims, automatic overdue status |
| **Staff & HR** | Staff records, attendance, leave requests with approval, monthly payroll generation |
| **Admin** | User management, hospital settings (name, logo, tax rate, currency), audit log of every change, dashboard, reports with CSV export |
| **Notifications** | In-app (and optional email) notifications for appointments, lab results, low stock, leave and admissions |

### Roles

`admin`, `doctor`, `nurse`, `receptionist`, `pharmacist`, `lab_tech`. Each role sees only its own sidebar items and pages, and the API enforces the same permissions.

## Project structure

```
backend-fastapi/
  app/
    api/v1/        # Route handlers, one file per module
    services/      # Business logic
    repositories/  # Shared data-access helpers
    models/        # SQLAlchemy models
    schemas/       # Pydantic request/response schemas
    middleware/    # Audit-log context and change tracking
    scripts/       # CLI scripts (create_admin)
    core/          # Config, database, security
frontend/
  src/
    features/      # Pages, one folder per module
    services/      # API clients
    hooks/         # React Query hooks
    components/    # Layout and shared UI
database/
  migrations/      # Numbered SQL migrations
  seeds/           # Default data (departments, hospital settings)
  migrate.sh       # Applies pending migrations and seeds
docker-compose.yml # PostgreSQL (+ Redis) for local development
```

## Getting started

### Prerequisites

- Python 3.12
- Node.js 18+
- PostgreSQL 17, either through Docker or a local installation
- `psql` on your PATH (used by the migration script)

### 1. Configure the environment

No credentials are hardcoded. Copy each example file and fill in the values:

```bash
cp .env.example .env                                   # docker-compose (Postgres user/password/port)
cp backend-fastapi/.env.example backend-fastapi/.env   # backend (DATABASE_URL, JWT_SECRET, ...)
cp frontend/.env.example frontend/.env                 # optional: frontend port / API proxy target
```

The backend refuses to start without `DATABASE_URL` and `JWT_SECRET`. Generate a JWT secret with:

```bash
openssl rand -hex 32
```

### 2. Start PostgreSQL

With Docker:

```bash
docker compose up -d
```

The container is published on `POSTGRES_PORT`, which defaults to **5433** so it doesn't clash with a local Postgres on 5432. Make sure `DATABASE_URL` in `backend-fastapi/.env` uses the same port and credentials.

Or use an existing local PostgreSQL: create a user and a database, then point `DATABASE_URL` at them.

### 3. Run the migrations

```bash
./database/migrate.sh --print-target   # check which database it will use
./database/migrate.sh                  # apply all pending migrations and seeds
```

The script reads the connection from `DATABASE_URL_SYNC` / `DATABASE_URL`, taken from environment variables first and then from `backend-fastapi/.env`. It records applied files in a `schema_migrations` table, so re-running it only applies new files. Other options:

```bash
./database/migrate.sh --status         # list applied and pending files
./database/migrate.sh --baseline 013   # existing database: mark 001–013 as applied, then apply the rest
```

### 4. Install and run the backend

```bash
cd backend-fastapi
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

python -m app.scripts.create_admin     # create the first admin (prompts for email and password)
uvicorn app.main:app --reload --port 8000
```

API docs are served at <http://localhost:8000/api/docs>, and a health check at `/api/health`.

To create the admin without prompts:

```bash
ADMIN_EMAIL=admin@yourhospital.com ADMIN_PASSWORD='a-strong-password' python -m app.scripts.create_admin
```

Add `--reset` to reset the password of an existing account.

### 5. Install and run the frontend

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:3000> and log in with the admin account. In development, Vite proxies `/api` to the backend (`API_PROXY_TARGET`, default `http://localhost:8000`), so no CORS setup is needed.

### First steps as admin

1. **Settings:** set the hospital name, address, currency and tax rate.
2. **Departments**, then **IPD → Wards** (add wards and beds), **Pharmacy → Categories** and **Laboratory → Test Catalog**.
3. **Users:** create accounts for doctors and staff, then add their **Doctor** and **Staff** profiles.

## Configuration reference

### Backend (`backend-fastapi/.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | yes | `postgresql+asyncpg://user:password@host:port/db` |
| `DATABASE_URL_SYNC` | no | Plain `postgresql://` URL for the migration script; derived from `DATABASE_URL` if omitted |
| `JWT_SECRET` | yes | At least 32 characters |
| `ACCESS_TOKEN_EXPIRE_MINUTES` / `REFRESH_TOKEN_EXPIRE_DAYS` | no | Token lifetimes (30 minutes / 7 days) |
| `CORS_ORIGINS` | no | JSON list of allowed origins; only needed when the frontend calls the API from another origin |
| `DEBUG` | no | `true` logs every SQL query |
| `DB_POOL_SIZE`, `DB_MAX_OVERFLOW`, `DB_POOL_TIMEOUT`, `DB_POOL_RECYCLE` | no | Connection-pool tuning |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_NAME`, `SMTP_FROM_EMAIL` | no | Email notifications; disabled when `SMTP_HOST` is empty |

### Frontend (`frontend/.env`)

| Variable | Description |
|---|---|
| `FRONTEND_PORT` | Dev server port (default 3000) |
| `API_PROXY_TARGET` | Where the dev proxy sends `/api` (default `http://localhost:8000`) |
| `VITE_API_BASE_URL` | Only when the API is on a different origin; defaults to `/api/v1` |

### Docker (`.env`)

`POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_PORT` (default 5433), `REDIS_PORT`.

## Production build

```bash
cd frontend && npm run build   # outputs frontend/dist
```

Serve `frontend/dist` and the API behind the same host (for example with a reverse proxy routing `/api` to the backend), or set `VITE_API_BASE_URL` and `CORS_ORIGINS` if they're on different origins. Run the backend without `--reload` and with `DEBUG=false`.

## Roadmap

- Patient portal (patient login, self-service booking, reports and bills)
- General inventory for equipment and supplies
- Nursing notes and medication administration records
- Multi-hospital support with a super-admin role
- Automated test suite
