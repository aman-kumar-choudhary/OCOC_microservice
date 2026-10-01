-- Migration 011: Access Management

CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- campus, facility, area
    parent_id UUID REFERENCES locations(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS access_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    subject_type VARCHAR(50) NOT NULL, -- 'role', 'group', 'user'
    subject_id VARCHAR(255) NOT NULL, -- UUID of user, string of role, etc.
    
    location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
    
    schedule_days INTEGER[] DEFAULT '{1,2,3,4,5,6,7}', -- 1=Mon, 7=Sun
    schedule_start_time TIME,
    schedule_end_time TIME,
    valid_from DATE,
    valid_to DATE,
    
    effect VARCHAR(20) DEFAULT 'ALLOW', -- 'ALLOW', 'DENY'
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS temporary_access_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
    valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
    valid_to TIMESTAMP WITH TIME ZONE NOT NULL,
    granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS access_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
    action VARCHAR(20), -- 'ENTRY', 'EXIT'
    status VARCHAR(20), -- 'GRANTED', 'DENIED'
    reason TEXT,
    event_time TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Anti-passback state (optional, but good for quick lookups)
CREATE TABLE IF NOT EXISTS user_last_locations (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    last_event_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_action VARCHAR(20) -- 'ENTRY', 'EXIT'
);
