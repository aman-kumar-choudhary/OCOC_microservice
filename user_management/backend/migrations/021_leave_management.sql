CREATE TABLE IF NOT EXISTS leave_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    workflow JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES users(id),
    leave_type_id UUID NOT NULL REFERENCES leave_types(id),
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    destination TEXT NOT NULL DEFAULT '',
    reason TEXT NOT NULL DEFAULT '',
    custom_reason TEXT,
    contact_info JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SUBMITTED','PENDING_APPROVAL','APPROVED','REJECTED','WITHDRAWN','EXPIRED','COMPLETED')),
    current_stage INTEGER NOT NULL DEFAULT 0,
    workflow_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
    submitted_at TIMESTAMPTZ,
    returned_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (end_at > start_at)
);
CREATE INDEX IF NOT EXISTS idx_leave_requests_student ON leave_requests(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leave_requests_queue ON leave_requests(status, current_stage, start_at);
CREATE INDEX IF NOT EXISTS idx_leave_requests_period ON leave_requests(student_id, start_at, end_at);

CREATE TABLE IF NOT EXISTS leave_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES leave_requests(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES users(id),
    filename TEXT NOT NULL,
    content_type TEXT NOT NULL,
    content BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS leave_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES leave_requests(id) ON DELETE CASCADE,
    stage_index INTEGER NOT NULL,
    permission TEXT NOT NULL,
    actor_id UUID REFERENCES users(id),
    decision TEXT NOT NULL CHECK (decision IN ('APPROVED','REJECTED')),
    comment TEXT NOT NULL DEFAULT '',
    decided_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(request_id, stage_index)
);
CREATE TABLE IF NOT EXISTS leave_delegations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delegator_id UUID NOT NULL REFERENCES users(id),
    delegate_id UUID NOT NULL REFERENCES users(id),
    permission TEXT NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','REVOKED','EXPIRED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK(ends_at > starts_at), CHECK(delegator_id <> delegate_id)
);
CREATE TABLE IF NOT EXISTS leave_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES users(id),
    leave_type_id UUID NOT NULL REFERENCES leave_types(id),
    academic_period TEXT NOT NULL,
    allowed_days NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK(allowed_days >= 0),
    consumed_days NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK(consumed_days >= 0),
    allow_negative BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(student_id, leave_type_id, academic_period)
);
CREATE TABLE IF NOT EXISTS leave_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    request_id UUID REFERENCES leave_requests(id),
    student_id UUID REFERENCES users(id),
    actor_id UUID REFERENCES users(id),
    actor_permission TEXT,
    action TEXT NOT NULL,
    previous_state TEXT,
    new_state TEXT,
    comments TEXT NOT NULL DEFAULT '',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_leave_audit_request ON leave_audit_logs(request_id, created_at DESC);
CREATE TABLE IF NOT EXISTS leave_rfid_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL UNIQUE REFERENCES leave_requests(id),
    student_id UUID NOT NULL REFERENCES users(id),
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','REVOKED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS leave_notifications (
    id BIGSERIAL PRIMARY KEY,
    request_id UUID REFERENCES leave_requests(id),
    recipient_id UUID REFERENCES users(id),
    permission TEXT,
    event TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    delivered_at TIMESTAMPTZ
);

INSERT INTO leave_types(code,name,description,workflow) VALUES
('DAY_PASS','Day Pass','Same-day departure and return','["leave.approve.warden"]'),
('MULTI_DAY','Multi-Day Leave','Leave for one or more nights','["leave.approve.warden","leave.approve.chancellor"]'),
('EMERGENCY','Emergency Leave','Urgent departure','["leave.approve.warden"]'),
('MEDICAL','Medical Leave','Medical leave requiring endorsement','["leave.approve.medical","leave.approve.warden"]'),
('CUSTOM','Custom Leave','Configurable leave type','["leave.approve.warden"]')
ON CONFLICT(code) DO NOTHING;

INSERT INTO roles(name,description,user_type) VALUES
('CHANCELLOR','Leave approval role',NULL),
('MEDICAL_OFFICER','Medical leave endorsement role',NULL),
('STUDENT','Student leave applicant role','student')
ON CONFLICT(name) DO NOTHING;
INSERT INTO permissions(name,description) VALUES
('leave.request.submit','Submit and manage own leave requests'),
('leave.approve.warden','Approve leave at warden stage'),
('leave.approve.chancellor','Approve leave at chancellor stage'),
('leave.approve.medical','Endorse medical leave'),
('leave.delegate','Delegate eligible approval authority'),
('leave.workflow.manage','Configure leave types and workflows'),
('leave.balance.manage','Configure student leave balances'),
('leave.audit.view','View immutable leave audit events')
ON CONFLICT(name) DO NOTHING;
INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r CROSS JOIN permissions p
WHERE (r.name='STUDENT' AND p.name='leave.request.submit')
   OR (r.name='WARDEN' AND p.name IN ('leave.approve.warden','leave.delegate'))
   OR (r.name='CHANCELLOR' AND p.name IN ('leave.approve.chancellor','leave.delegate'))
   OR (r.name='MEDICAL_OFFICER' AND p.name IN ('leave.approve.medical','leave.delegate'))
   OR (r.name='SUPER_ADMIN' AND p.name IN ('leave.workflow.manage','leave.balance.manage','leave.audit.view'))
   OR (r.name='ADMIN' AND p.name IN ('leave.balance.manage','leave.audit.view'))
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION prevent_leave_audit_mutation() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'leave audit logs are immutable'; END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS leave_audit_immutable ON leave_audit_logs;
CREATE TRIGGER leave_audit_immutable BEFORE UPDATE OR DELETE ON leave_audit_logs FOR EACH ROW EXECUTE FUNCTION prevent_leave_audit_mutation();
