-- ============================================================
-- BTC Dashboard — Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- Snapshot table: one row per 5-minute collection cycle
CREATE TABLE IF NOT EXISTS snapshots (
    id        BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data      JSONB NOT NULL
);

-- Index for fast latest/history queries
CREATE INDEX IF NOT EXISTS idx_snapshots_timestamp
    ON snapshots (timestamp DESC);

-- ============================================================
-- Auto-delete rows older than 30 days
-- Option A: pg_cron (enable in Supabase Dashboard > Extensions)
-- ============================================================
-- SELECT cron.schedule(
--     'delete-old-snapshots',       -- job name
--     '0 3 * * *',                  -- daily at 03:00 UTC
--     $$DELETE FROM snapshots WHERE timestamp < NOW() - INTERVAL '30 days'$$
-- );

-- ============================================================
-- Option B: Supabase Edge Function (no pg_cron required)
-- Create a scheduled Edge Function that runs:
--   supabase.from('snapshots')
--     .delete()
--     .lt('timestamp', new Date(Date.now() - 30*24*3600*1000).toISOString())
-- ============================================================

-- ============================================================
-- Permanent hourly archive (NO deletion ever)
-- 1 record per hour = 24/day = ~120KB/day (after JSONB compression)
-- 500MB free tier → approx 7-8 years of hourly history
-- ============================================================
CREATE TABLE IF NOT EXISTS snapshots_hourly (
    id        BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data      JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_snapshots_hourly_timestamp
    ON snapshots_hourly (timestamp DESC);

-- Row Level Security (optional — enable if you want table-level auth)
-- ALTER TABLE snapshots ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "service_role_only" ON snapshots
--     USING (auth.role() = 'service_role');
