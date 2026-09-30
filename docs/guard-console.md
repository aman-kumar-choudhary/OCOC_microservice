# Guard Console

## Overview

The Guard Console is the primary operational interface for campus security guards. It provides real-time gate monitoring, camera-based face verification, RFID two-step verification, and leave-aware gate decision support. The console is designed for continuous operation at campus entry/exit points.

**Frontend Location**: `user_management/frontend/src/views/GuardDashboard.jsx`

**Default Route**: `/guard`

**Authorized Roles**: `SUPER_ADMIN`, `GUARD`, `SECURITY_GUARD`, `SECURITY_ADMIN`

---

## Dashboard Layout

The Guard Console uses a three-section layout optimized for split-screen gate operations:

```
┌─────────────────────────────────────────────────────────────────┐
│ Guard Console                                          LIVE FEED│
├──────────────────┬──────────────────────────────────────────────┤
│                  │                                              │
│  FRECO Camera    │          Digital Register (Live)             │
│  Face Stream     │          • Time • Name • Action             │
│                  │          • Location • Status                 │
│──────────────────│                                              │
│  2-SV Verify     │          Entry/Exit event log               │
│  Queue           │          (WebSocket real-time)               │
│──────────────────│                                              │
│  Actionable      │                                              │
│  Alerts          │                                              │
├──────────────────┴──────────────────────────────────────────────┤
│                                                                 │
│  Gate Movement and Leave Monitor                                │
│  • Student details • Current status • Permission               │
│  • Approved by • Last in/out movement                          │
│  Search / Filter by status / Filter by movement                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Default Widgets

As specified in the OCOC Dashboard Module:

| Widget | Description |
|--------|-------------|
| **Live Gate Activity Feed** | Real-time WebSocket stream of entry/exit events with user name, action, location, and status |
| **Pending Face Recognition Reviews** | 2-Step Verification (2-SV) queue — RFID scans waiting for face match confirmation |
| **Current Campus Entry Count** | Count of currently active entry records |
| **Gate Access Alerts** | Actionable security alerts: unauthorized access, curfew violations, system alerts |
| **Active Security Incidents** | Hostel curfew alerts, unresolved access violations |

---

## FRECO Face Stream Integration

The guard console integrates with the FRECO face recognition service via the `useLiveFaceInference` hook:

```
Browser Camera → WebSocket /api/v1/face/stream → FRECO Service
                                                    │
                                        ┌───────────┴───────────┐
                                        │ Face Detection (SCRFD)│
                                        │ Liveness (MiniFASNet) │
                                        │ Pose Estimation       │
                                        └───────────┬───────────┘
                                                    │
                                        Face detected response
                                                    │
                                                    ▼
                                        Guard Console UI
                                        • Face count
                                        • Bounding box
                                        • Liveness status
                                        • Confidence score
```

### Camera Operations

- **Start camera**: Activates browser camera and begins streaming frames to FRECO WebSocket
- **Single recognition mode**: Detects one face per frame with liveness verification
- **Auto-reconnect**: WebSocket reconnects after 5-second delay on disconnection

---

## Two-Step Verification (2-SV)

The 2-SV workflow combines RFID scan with face verification for enhanced security:

```
Step 1: Student taps RFID card at gate reader
        │
        ▼
Step 2: ACCESS_EVENT with status=PENDING arrives via WebSocket
        │
        ▼
Step 3: Guard console displays pending verification:
        • Student name
        • RFID UID
        • Location name
        │
        ▼
Step 4: Guard verifies face match using camera
        │
        ├── Face matched → Guard clicks "Face matched"
        │   └── POST /access/verify-face { matched: true, face_confidence }
        │
        └── Face not matched → Guard clicks "Reject"
            └── POST /access/verify-face { matched: false, reason }
```

---

## Leave-Aware Gate Decisions

The guard console displays approved leave details for each student in the "Gate Movement and Leave Monitor" section. When a student approaches the gate, the guard can immediately see their leave status:

### Student Information Displayed

| Field | Source | Description |
|-------|--------|-------------|
| Student name | `student_name` | Full name of the student |
| Student ID / Roll | `student_roll` or `student_id` | Unique student identifier |
| Hostel | `hostel_name` | Assigned hostel |
| Phone | `student_phone` | Contact number |
| Current status | `current_status` | INSIDE, OUTSIDE, ON_LEAVE, UNAUTHORIZED, LATE_RETURN |
| Permission type | `permission_type` | Day Pass, Multi-Day, Emergency, Medical |
| Valid period | `permission_start_time` – `permission_end_time` | Approved leave date range |
| Permission reason | `permission_reason` | Reason for leave (from student application) |
| Approved by | `granted_by_name` | Name of the approving authority |
| Last movement | `last_movement_type` | ENTRY or EXIT |
| Last gate | `last_gate_name` | Gate where last movement was recorded |
| Last event time | `last_event_time` | Timestamp of last gate event |

### Camera-Based Movement Verification

When the FRECO camera identifies a student, the guard console cross-references the identification against the approved leave database:

```
Camera identifies student (face match)
        │
        ▼
Cross-reference against hostelLeaves data
        │
        ├── Student has ACTIVE leave covering today
        │   └── ✅ "LEAVE ACTIVE — Gate exit permitted"
        │       (green badge with leave type and validity)
        │
        ├── Student has NO active leave
        │   └── ⚠️ "NO ACTIVE LEAVE — Manual verification required"
        │       (amber badge — guard must decide)
        │
        └── Student's leave has EXPIRED but not returned
            └── ❌ "LEAVE EXPIRED — Overdue return"
                (red badge with expired leave details)
```

### Search and Filter

The gate monitor supports:
- **Text search**: Filter by student name, ID, phone number
- **Status filter**: INSIDE, OUTSIDE, ON_LEAVE, UNAUTHORIZED, LATE_RETURN
- **Movement filter**: ENTRY, EXIT, or both

---

## WebSocket Events

The guard console receives real-time events via WebSocket at `/api/v1/ws/stream`:

| Event Type | Description | Action |
|-----------|-------------|--------|
| `ACCESS_EVENT` | Gate entry/exit event | Append to digital register; if status=PENDING, add to 2-SV queue |
| `SYSTEM_ALERT` | System-generated security alert | Display in alerts panel |
| `HOSTEL_CURFEW_ALERT` | Curfew violation detected | Display in alerts panel |
| `HOSTEL_ALERT` | General hostel alert | Display in alerts panel |
| `HOSTEL_STATUS_UPDATED` | Student status changed | Refresh leave monitor data |

---

## API Dependencies

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/access/events` | GET | Fetch initial event history (15 records) |
| `/api/v1/access/guard/hostel-leaves` | GET | Fetch student leave and movement data |
| `/api/v1/access/verify-face` | POST | Complete 2-SV face verification |
| `/api/v1/ws/stream` | WebSocket | Real-time event streaming |

### Auto-Refresh

- Leave monitor data auto-refreshes every **15 seconds**
- WebSocket provides real-time updates between refresh intervals
- WebSocket auto-reconnects after 5 seconds on disconnect

---

## Environment Requirements

The guard console requires:
- Browser with camera access (HTTPS recommended for production)
- Network connectivity to User Management API (port 8080)
- Network connectivity to FRECO service (port 8000) for face stream
- WebSocket support for real-time event streaming

---

## Operational Notes

- The guard console is designed for **continuous operation** — it should remain open during gate duty shifts
- The FRECO face stream does **not** automatically grant or deny access — it provides identification and leave validation as a **decision support tool** for the guard
- Guards can manually override "no leave found" status and still allow exit, which is recorded in the audit trail
- The digital register provides a complete, searchable log of all gate events during the shift
