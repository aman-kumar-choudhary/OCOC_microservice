-- Migration 014: Hostel Management Module

-- 1. Hostel Gates
CREATE TABLE IF NOT EXISTS hostel_gates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hostel_id UUID REFERENCES hostels(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    gate_type VARCHAR(50) DEFAULT 'MAIN', -- 'MAIN', 'SIDE', etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- 2. Gate Rules
CREATE TABLE IF NOT EXISTS gate_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hostel_id UUID REFERENCES hostels(id) ON DELETE CASCADE,
    gate_id UUID REFERENCES hostel_gates(id) ON DELETE CASCADE, -- Optional, if specific to a gate
    opening_time TIME,
    closing_time TIME,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. RFID Readers
CREATE TABLE IF NOT EXISTS rfid_readers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reader_id VARCHAR(100) UNIQUE NOT NULL,
    gate_id UUID REFERENCES hostel_gates(id) ON DELETE CASCADE,
    direction VARCHAR(20) NOT NULL, -- 'IN', 'OUT'
    status VARCHAR(20) DEFAULT 'ONLINE', -- 'ONLINE', 'OFFLINE', 'ERROR'
    last_heartbeat TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Hostel Permissions
CREATE TABLE IF NOT EXISTS hostel_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    permission_type VARCHAR(50) NOT NULL, -- 'HOSTEL_EXIT', 'CAMPUS_EXIT', 'OVERNIGHT', 'EMERGENCY'
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'ACTIVE', -- 'ACTIVE', 'EXPIRED', 'REVOKED', 'USED'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Hostel Movement (Immutable Event Log)
CREATE TABLE IF NOT EXISTS hostel_movement (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    rfid_card_id UUID REFERENCES rfid_cards(id) ON DELETE SET NULL,
    gate_id UUID REFERENCES hostel_gates(id) ON DELETE SET NULL,
    reader_id UUID REFERENCES rfid_readers(id) ON DELETE SET NULL,
    event_type VARCHAR(20) NOT NULL, -- 'IN', 'OUT'
    status VARCHAR(20) NOT NULL, -- 'ALLOWED', 'DENIED'
    reason VARCHAR(100), -- E.g. 'NO_PERMISSION', 'LATE', 'GATE_CLOSED'
    permission_id UUID REFERENCES hostel_permissions(id) ON DELETE SET NULL,
    event_time TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Student Hostel Status (Materialized Current State)
CREATE TABLE IF NOT EXISTS student_hostel_status (
    student_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    current_status VARCHAR(50) NOT NULL, -- 'INSIDE', 'OUTSIDE', 'ON_LEAVE', 'UNAUTHORIZED', 'LATE_RETURN'
    last_movement_id UUID REFERENCES hostel_movement(id) ON DELETE SET NULL,
    last_event_time TIMESTAMP WITH TIME ZONE,
    active_permission_id UUID REFERENCES hostel_permissions(id) ON DELETE SET NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Hostel Attendance Rules
CREATE TABLE IF NOT EXISTS hostel_attendance_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hostel_id UUID REFERENCES hostels(id) ON DELETE CASCADE,
    cutoff_time TIME NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Hostel Attendance
CREATE TABLE IF NOT EXISTS hostel_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    hostel_id UUID REFERENCES hostels(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status VARCHAR(50) NOT NULL, -- 'PRESENT', 'ABSENT', 'APPROVED_LEAVE', 'OUTSIDE_WITH_PERMISSION', 'UNAUTHORIZED_OUTSIDE'
    marked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (student_id, date)
);

-- 9. Hostel Alerts
CREATE TABLE IF NOT EXISTS hostel_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL, -- 'UNAUTHORIZED_EXIT_ATTEMPT', 'LATE_RETURN', 'READER_OFFLINE'
    description TEXT,
    severity VARCHAR(20) DEFAULT 'WARNING',
    is_resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);
