-- Vendor & Site Expense — full PostgreSQL schema (matches prisma/schema.prisma)
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/install.sql
--
-- Safe to re-run: drops app tables/types first, then recreates. Uses public schema only.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DROP TABLE IF EXISTS "invoices" CASCADE;
DROP TABLE IF EXISTS "payments" CASCADE;
DROP TABLE IF EXISTS "requirement_update_logs" CASCADE;
DROP TABLE IF EXISTS "requirements" CASCADE;
DROP TABLE IF EXISTS "vendors" CASCADE;
DROP TABLE IF EXISTS "sites" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;
DROP TYPE IF EXISTS "RequirementStatus";
DROP TYPE IF EXISTS "UserRole";

CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'ACCOUNT_HEAD', 'MEMBER');
CREATE TYPE "RequirementStatus" AS ENUM ('PENDING', 'COMPLETED');

CREATE TABLE "users" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email"         TEXT NOT NULL UNIQUE,
  "password_hash" TEXT,
  "google_id"     TEXT,
  "name"          TEXT NOT NULL,
  "role"          "UserRole" NOT NULL DEFAULT 'MEMBER',
  "is_blocked"    BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "users_google_id_key" ON "users" ("google_id");

CREATE TABLE "vendors" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"       TEXT NOT NULL,
  "gst_number" TEXT,
  "phone"      TEXT,
  "alternate_phone" TEXT,
  "email"      TEXT,
  "address"    TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "vendors_name_idx" ON "vendors" ("name");

CREATE TABLE "sites" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"       TEXT NOT NULL,
  "code"       TEXT UNIQUE,
  "address"    TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "requirements" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "item_name"     TEXT NOT NULL,
  "brand"         TEXT,
  "quantity"      DECIMAL(18, 4) NOT NULL DEFAULT 1,
  "total_amount"  DECIMAL(18, 2) NOT NULL,
  "status"        "RequirementStatus" NOT NULL DEFAULT 'PENDING',
  "bill_received" BOOLEAN NOT NULL DEFAULT FALSE,
  "entry_date"    DATE NOT NULL,
  "notes"         TEXT,
  "is_flagged"    BOOLEAN NOT NULL DEFAULT FALSE,
  "flag_reason"   TEXT,
  "flagged_at"    TIMESTAMP(3),
  "flagged_by_id" UUID,
  "vendor_id"     UUID NOT NULL,
  "site_id"       UUID NOT NULL,
  "created_by_id" UUID NOT NULL,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "requirements_vendor_id_fkey"
    FOREIGN KEY ("vendor_id") REFERENCES "vendors" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "requirements_site_id_fkey"
    FOREIGN KEY ("site_id") REFERENCES "sites" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "requirements_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "requirements_flagged_by_id_fkey"
    FOREIGN KEY ("flagged_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "requirements_vendor_id_idx" ON "requirements" ("vendor_id");
CREATE INDEX "requirements_site_id_idx" ON "requirements" ("site_id");
CREATE INDEX "requirements_entry_date_idx" ON "requirements" ("entry_date");
CREATE INDEX "requirements_created_by_id_idx" ON "requirements" ("created_by_id");
CREATE INDEX "requirements_is_flagged_idx" ON "requirements" ("is_flagged");

CREATE TABLE "payments" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "amount"         DECIMAL(18, 2) NOT NULL,
  "paid_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "method"         TEXT,
  "note"           TEXT,
  "requirement_id" UUID NOT NULL,
  "recorded_by_id" UUID NOT NULL,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "payments_requirement_id_fkey"
    FOREIGN KEY ("requirement_id") REFERENCES "requirements" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "payments_recorded_by_id_fkey"
    FOREIGN KEY ("recorded_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "payments_requirement_id_idx" ON "payments" ("requirement_id");
CREATE INDEX "payments_paid_at_idx" ON "payments" ("paid_at");

CREATE TABLE "requirement_update_logs" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "requirement_id" UUID NOT NULL,
  "changed_by_id"  UUID NOT NULL,
  "previous_data"  JSONB NOT NULL,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "requirement_update_logs_requirement_id_fkey"
    FOREIGN KEY ("requirement_id") REFERENCES "requirements" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "requirement_update_logs_changed_by_id_fkey"
    FOREIGN KEY ("changed_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "requirement_update_logs_requirement_id_created_at_idx"
  ON "requirement_update_logs" ("requirement_id", "created_at");

CREATE TABLE "invoices" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "file_url"       TEXT NOT NULL,
  "file_key"       TEXT NOT NULL,
  "mime_type"      TEXT NOT NULL,
  "original_name"  TEXT NOT NULL,
  "gst_details"    JSONB,
  "requirement_id" UUID NOT NULL UNIQUE,
  "uploaded_by_id" UUID NOT NULL,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "invoices_requirement_id_fkey"
    FOREIGN KEY ("requirement_id") REFERENCES "requirements" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "invoices_uploaded_by_id_fkey"
    FOREIGN KEY ("uploaded_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
