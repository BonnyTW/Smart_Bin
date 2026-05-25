-- schema.sql
CREATE TABLE IF NOT EXISTS bins (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT,
    max_depth_cm INT NOT NULL,
    threshold_pct INT DEFAULT 80,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS readings (
    id UUID PRIMARY KEY,
    bin_id UUID REFERENCES bins(id) ON DELETE CASCADE,
    fill_pct FLOAT NOT NULL,
    temperature FLOAT,
    humidity FLOAT,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY,
    bin_id UUID REFERENCES bins(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    resolved BOOL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'viewer',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_readings_bin_id_recorded_at ON readings(bin_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_bin_id_resolved ON alerts(bin_id, resolved);
