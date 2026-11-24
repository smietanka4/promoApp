-- =============================================================================
-- PromoApp - PostgreSQL Database Schema
-- PWA for scanning Polish receipts and tracking promotional savings
-- =============================================================================

-- 1. Users (authenticated via Google OAuth 2.0)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    google_id VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. User sessions (standard table required by connect-pg-simple)
CREATE TABLE IF NOT EXISTS "session" (
    "sid" VARCHAR NOT NULL COLLATE "default" PRIMARY KEY,
    "sess" JSON NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL
);

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

-- 3. Scanned and verified receipts
CREATE TABLE IF NOT EXISTS receipts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    store_name VARCHAR(255) NOT NULL,
    receipt_date DATE NOT NULL,
    total_paid NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (total_paid >= 0),
    total_saved NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (total_saved >= 0),
    raw_ai_response JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index optimizing monthly dashboard queries per user
CREATE INDEX IF NOT EXISTS idx_receipts_user_date
    ON receipts (user_id, receipt_date DESC);

-- 4. Receipt line items (products, categories, paid amounts, and discounts)
CREATE TABLE IF NOT EXISTS receipt_items (
    id SERIAL PRIMARY KEY,
    receipt_id INTEGER NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(64) NOT NULL CHECK (
        category IN (
            'Napoje',
            'Nabiał',
            'Pieczywo',
            'Mięso i ryby',
            'Warzywa i owoce',
            'Słodycze i przekąski',
            'Chemia i kosmetyki',
            'Inne'
        )
    ),
    -- NUMERIC(10, 3) supports both discrete units (e.g. 2) and weighted items (e.g. 0.456 kg)
    quantity NUMERIC(10, 3) NOT NULL DEFAULT 1.000 CHECK (quantity > 0),
    paid_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (paid_amount >= 0),
    discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0)
);

-- Indexes optimizing joins and category-level spending/savings aggregations
CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt_id
    ON receipt_items (receipt_id);

CREATE INDEX IF NOT EXISTS idx_receipt_items_category
    ON receipt_items (category);
