# Vendor & Site Expense Management

Three apps: `backend` (NestJS + PostgreSQL + Prisma), `web` (Next.js), `mobile` (Expo + React Native).

## Quick start

1. **Database** — Set `backend/.env` from `backend/.env.example`.  
   - **Docker (easiest):** install [Docker Desktop](https://www.docker.com/products/docker-desktop/), then from repo root run `docker compose up -d`, then `psql "postgresql://postgres:postgres@localhost:5432/vendor_expense" -v ON_ERROR_STOP=1 -f backend/prisma/install.sql`.  
   - **Existing Postgres:** create database and user, put the URL in `DATABASE_URL`, then run `install.sql` the same way.
2. **Backend** — `cd backend && npm install && psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/install.sql && npx prisma generate && npm run prisma:seed && npm run start:dev`  
   - `install.sql` drops and recreates app tables (use a dedicated database). Then Prisma Client via `generate` only — no migration folder.
3. **Web** — `cd web && npm install`, copy `web/.env.local` from `.env.example`, then `npm run dev`  
   API calls use **`/api-proxy`** (Next.js → `127.0.0.1:4000`). Run API + web together from repo root: `npm install && npm run dev`
4. **Mobile** — `cd mobile && npm install && EXPO_PUBLIC_API_URL=http://<your-lan-ip>:4000 npx expo start` (use machine IP, not `localhost`, on a physical device)

Seed users: `admin@example.com` / `Admin12345!`, `accounts@example.com` / `Account12345!`.

### Google (Gmail) sign-in

1. In [Google Cloud Console](https://console.cloud.google.com/), create an OAuth **Web client** (or use an existing project).
2. **Authorized redirect URI:** `http://localhost:4000/auth/google/callback` (production: `https://YOUR_API_HOST/auth/google/callback`).
3. Set in `backend/.env`: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, and `FRONTEND_URL` (e.g. `http://localhost:3000`).
4. **Admin / users:** If their Google **email** already exists in `users`, their **role** is unchanged and `google_id` is linked on first Google login. New Google accounts get **MEMBER** with **no password** (Google-only). Password login returns *"This account uses Google sign-in"* when `password_hash` is null.
5. **Database:** `users.password_hash` is optional; `users.google_id` stores Google `sub` (unique). Canonical SQL: `backend/prisma/install.sql` (keep in sync with `prisma/schema.prisma`).
6. **Mobile:** `POST /auth/google/token` with `{ "idToken": "<Google ID token>" }` returns `{ user, accessToken }` (uses token `sub` + email like the web flow).

## End-to-end feature

Create a **requirement** (expense line), attach **payments**, upload **invoice** (PDF/image + optional GST JSON):

- API: `POST /requirements`, `POST /requirements/:id/payments`, `POST /requirements/:id/invoice` (multipart)
- Web: `/expenses/new`

## Production hardening (next steps)

- Swap SHA demo patterns: keep **bcrypt** for passwords; use **refresh tokens** + **httpOnly cookies** for the web app.
- Store invoices in **S3-compatible** object storage with signed URLs; virus scan inbound files.
- Add **audit log** table for compliance; **rate limit** auth and imports.
- **Read replicas** + connection pooling (PgBouncer) for scale; cache dashboard aggregates in Redis.
