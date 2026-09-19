-- Migration 013: Advanced Access Features

-- 1. Devices Table
CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mac_address VARCHAR(50) UNIQUE NOT NULL,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL, -- e.g., 'RFID_READER', 'FACE_CAMERA', 'TURNSTILE'
    status VARCHAR(20) DEFAULT 'OFFLINE', -- 'ONLINE', 'OFFLINE', 'MAINTENANCE'
    last_heartbeat TIMESTAMP WITH TIME ZONE,
    firmware_version VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Student Leaves Table
CREATE TABLE IF NOT EXISTS student_leaves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
    valid_to TIMESTAMP WITH TIME ZONE NOT NULL,
    leave_type VARCHAR(50) NOT NULL, -- 'OUTPASS', 'VACATION', 'MEDICAL'
    status VARCHAR(20) DEFAULT 'APPROVED', -- 'PENDING', 'APPROVED', 'REJECTED'
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Alerts / Actionable Intelligence Table
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL, -- 'CURFEW_VIOLATION', 'LEAVE_EXPIRED', 'DEVICE_OFFLINE', 'ACCESS_DENIED'
    message TEXT NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- Optional, can be null for device alerts
    location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_student_leaves_user ON student_leaves(user_id, status);
CREATE INDEX IF NOT EXISTS idx_alerts_unresolved ON alerts(resolved) WHERE resolved = false;
