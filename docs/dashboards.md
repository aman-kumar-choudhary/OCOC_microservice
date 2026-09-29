# Module 11: Dashboards

> Comprehensive functional, role-based, and architectural specification for the One Card One Campus (OCOC) Dashboard Module.

---

## 1. Module Overview

The **Dashboard Module** provides role-based visual summaries of operational and analytical information across the One Card One Campus (OCOC) platform. Dashboards present real-time and historical data through configurable widgets, enabling campus administrators, wardens, security personnel, academic staff, and students to quickly monitor activities relevant to their daily responsibilities.

### Key Governance Principles

1. **Role-Based Visibility (RBAC)**: Dashboard visibility is strictly governed by the user's effective permission set. Users can only view widgets, metrics, and actions for which their role holds active authorization.
2. **Predefined Widget Library**: Standard, security-tested widgets for identity, gate movement, leave verification, device status, and audit logs.
3. **Custom Dashboard Builder**: Administrators with the `dashboard.custom.manage` permission can create, customize, and share additional dashboards using the predefined widget library.
4. **Real-Time Data Feeds**: High-priority widgets (e.g., gate activity, face recognition streams, security alerts) are powered by WebSockets (`/api/v1/ws/stream`) and short-polling fallback.

---

## 2. Default Dashboard Templates

The OCOC platform provides predefined default dashboard templates tailored to specific operational roles:

### 2.1 Super Administrator Dashboard
- **Target Role**: `SUPER_ADMIN`
- **Default Route**: `/dashboard`
- **Operational Scope**: Campus-wide unrestricted oversight across all subsystems, hardware devices, and user categories.
- **Default Widgets**:
  - **Campus Occupancy Map**: Live geographic and zone-level visualization of student, staff, and visitor population density.
  - **Online / Offline Device Summary**: Operational status of all campus IoT controllers, RFID turnstiles, and biometric capture terminals.
  - **Pending Approval Queue**: High-level aggregation of pending requests awaiting action across all campus departments.
  - **Notification Delivery Statistics**: Throughput, delivery rates, and failure metrics for SMTP email and WhatsApp Cloud API dispatches.
  - **Permission Audit Log Summary**: Immutable log stream of recent role changes, permission grants, and administrative overrides.
  - **System Health Indicators**: Real-time heartbeat, CPU/memory usage, database connection pool health, and microservice status.
  - **Recent Security Alerts**: High-severity incident notifications, including perimeter breaches, unauthorized card scans, and tailgating alerts.

### 2.2 Administrator Dashboard
- **Target Role**: `ADMIN`
- **Default Route**: `/access` (Access Management Command Center)
- **Operational Scope**: Access policy configuration, device provisioning, leave approvals within administrative scope, and zone security.
- **Default Widgets**:
  - **Zone-wise Campus Occupancy**: Real-time headcount and capacity tracking partitioned by academic blocks, administrative zones, and common areas.
  - **Pending Leave Approvals**: Actionable approval queue for student and staff leave requests requiring administrative authorization.
  - **Device Health Status**: Heartbeat, firmware versions, and sync status of access readers and gate controllers.
  - **Today's Attendance Rate**: Campus aggregate check-in statistics compared against scheduled timetables.
  - **Active Security Alerts**: Access denial spikes, door-held-open alarms, and anomalous after-hours movement.
  - **Recent Administrative Activities**: Audit trail of recent rule edits, temporary credential issuances, and user onboarding steps.

### 2.3 Faculty / Warden Dashboard
- **Target Role**: `WARDEN`, `FACULTY`
- **Default Route**: `/hostel` (for Wardens) / `/dashboard` (for Faculty)
- **Operational Scope**: Student welfare, residential governance, class attendance, and movement compliance.
- **Default Widgets**:
  - **Pending Leave Approvals**: Multi-stage leave approval interface allowing wardens to review parent consent, leave destinations, and balance caps before granting gate exit passes.
  - **Today's Class Attendance**: Live lecture attendance percentages derived from RFID classroom taps and biometric logs.
  - **Hostel In/Out Status**: Real-time census of students physically inside the hostel versus those checked out or on campus.
  - **Student Absence Alerts**: Automated notifications flagged when students miss compulsory roll-calls, curfew windows, or scheduled lectures.
  - **Attendance Exception Requests**: Manual rectification requests submitted by students for medical or sanctioned off-campus events.
  - **Recent Student Activities**: Detailed chronological timeline of gate taps, mess hall entries, and hostel door access for assigned wards.

### 2.4 Security Guard Dashboard (Guard Console)
- **Target Role**: `GUARD`, `SECURITY_GUARD`
- **Default Route**: `/guard`
- **Operational Scope**: Frontline gate entry/exit control, visual verification, RFID card processing, and leave enforcement.
- **Default Widgets**:
  - **Live Gate Activity Feed**: Sub-second digital register displaying every RFID card tap, timestamp, person name, photo, and access outcome (GRANTED / DENIED).
  - **Pending Face Recognition Reviews (2-SV)**: Split-screen interface for 2-Step Verification pairing an RFID tap with live camera recognition.
  - **Current Campus Entry Count**: Live counter showing campus net occupancy, total entries today, and total exits today.
  - **Gate Access Alerts**: Immediate audio-visual warnings for blacklisted cards, expired passes, or unapproved exit attempts.
  - **Active Security Incidents**: Rapid-escalation queue for manual guard incident reporting and perimeter alerts.
  - **FRECO Camera Stream & Student Detail Panel**: Real-time ONNX face detection stream cross-referencing recognized faces against approved leave schedules to display a prominent pass/deny recommendation with student contact and hostel information.

### 2.5 Student Dashboard
- **Target Role**: `STUDENT`
- **Default Route**: `/dashboard` (Personal Workspace)
- **Operational Scope**: Personal academic life, residential permissions, identity credential status, and campus facilities.
- **Default Widgets**:
  - **Attendance Percentage Summary**: Semester and subject-wise attendance tracking against the 75% minimum compliance threshold.
  - **Active Leave / Day Pass Status**: Real-time status badge of submitted leave requests (DRAFT, PENDING_APPROVAL, APPROVED, REJECTED) with quick-access button to apply for campus leave.
  - **Library Loans and Due Dates**: Current list of borrowed books, return due dates, and pending renewal requests.
  - **Recent RFID Access History**: Personal log of turnstile taps, mess entries, and hostel curfew check-ins.
  - **Important Campus Notifications**: Administrative circulars, hostel announcements, and leave decision alerts.
  - **Upcoming Academic Activities**: Exam schedules, practical lab timings, and campus event registrations.

### 2.6 Librarian Dashboard
- **Target Role**: `LIBRARIAN`
- **Default Route**: `/dashboard`
- **Operational Scope**: Library asset circulation, catalog tracking, inventory audits, and overdue penalty enforcement.
- **Default Widgets**:
  - **Books Issued Today**: Daily transaction volume breakdown by department and user type (student, research scholar, faculty).
  - **Overdue Books List**: Priority roster of delinquent loans with automated notice dispatch triggers.
  - **Upcoming Book Returns**: Projected return schedule for the upcoming 7-day window.
  - **Low Availability Titles**: Catalog alerts for high-demand titles whose reserve buffer has dropped below threshold.
  - **Reservation Queue Summary**: List of pending holds placed by students and faculty with notification dispatch capabilities.
  - **Fine Collection Statistics**: Daily, weekly, and semester-to-date fine collections with online payment reconciliation.

### 2.7 Event Organizer Dashboard
- **Target Role**: `EVENT_ORGANIZER`
- **Default Route**: `/dashboard`
- **Operational Scope**: Temporary event credentialing, attendee verification, venue safety, and visitor management.
- **Default Widgets**:
  - **Active Event Attendance**: Real-time scan rate and total attendee check-in count for registered seminars, sports events, and convocations.
  - **Temporary RFID Cards Issued**: Inventory of guest badges provisioned for the event with holder identities.
  - **RFID Cards Returned**: Live audit of returned temporary badges upon attendee departure.
  - **Venue Capacity Utilization**: Percentage meter measuring current room headcount against certified fire safety capacity.
  - **Visitor Entry and Exit Statistics**: Demographic breakdown of external visitors, vendors, and invitees.
  - **Outstanding Card Returns**: Flagged list of unreturned temporary cards requiring security recovery.

---

## 3. Dashboard Templates Summary

| Dashboard Template | Target Roles | Primary Route | Default Widgets |
|--------------------|--------------|---------------|-----------------|
| **Super Administrator** | `SUPER_ADMIN` | `/dashboard` | Campus Occupancy Map, Device Online/Offline Summary, Pending Approvals, Notification Statistics, Permission Audit Summary, System Health Indicators, Security Alerts |
| **Administrator** | `ADMIN` | `/access` | Zone Occupancy, Leave Approvals, Device Health, Attendance Summary, Active Security Alerts, Administrative Activities |
| **Faculty / Warden** | `WARDEN`, `FACULTY` | `/hostel` | Leave Approvals, Class Attendance, Hostel In/Out Status, Student Absence Alerts, Attendance Exceptions, Recent Student Activities |
| **Security Guard** | `GUARD`, `SECURITY_GUARD` | `/guard` | Live Gate Feed, Pending Face Recognition Reviews (2-SV), Campus Entry Count, Gate Access Alerts, FRECO Face & Leave Cross-Reference |
| **Student** | `STUDENT` | `/dashboard` | Attendance Percentage, Active Leave / Day Pass Status, Library Loans and Due Dates, Recent RFID Access History, Notifications, Upcoming Academic Activities |
| **Librarian** | `LIBRARIAN` | `/dashboard` | Books Issued Today, Overdue Books, Upcoming Book Returns, Low Availability Titles, Reservation Queue Summary, Fine Collection Statistics |
| **Event Organizer** | `EVENT_ORGANIZER` | `/dashboard` | Active Event Attendance, Temporary RFID Cards Issued, RFID Cards Returned, Venue Capacity Utilization, Visitor Statistics, Outstanding Card Returns |

---

## 4. Custom Dashboard Builder

Users holding the `dashboard.custom.manage` permission (Super Administrators and delegated administrators) can build personalized dashboards by assembling widgets from the platform's standardized widget catalog.

### Core Capabilities

1. **Multiple Dashboard Management**: Create, clone, rename, and organize distinct operational dashboards (e.g., "Night Shift Security Monitor", "Hostel Weekend Census", "Exam Hall Live Gate Tracker").
2. **Widget Catalog**: Interactive picker allowing users to browse widgets categorized by subsystem:
   - *Identity & Access*: Live Card Taps, 2-SV Queue, Card Issuance Trend
   - *Biometrics*: FRECO Camera Feed, Face Auth Failure Rate, Liveness Score Distribution
   - *Residential & Leave*: Approved Leave Roster, Curfew Violations, Out-of-Campus Headcount
   - *Infrastructure*: Device Heartbeat Grid, Gateway Latency, Relay State Monitor
   - *Audit & Compliance*: Super Admin Log Stream, Override History, Outbox Status
3. **Flexible Grid Layout**: Grid-based responsive canvas supporting dragging, resizing (1x1, 2x1, 2x2, 4x2 grid units), and dynamic ordering.
4. **Layout Persistence**: Custom dashboard configurations are serialized to JSON and persisted via the User Management backend.
5. **Role-Aware Sharing**: Dashboards can be shared with individual users or role groups. When a shared dashboard is rendered, the RBAC engine filters widget visibility so recipients only view widgets and data points permitted by their personal role claims.

---

## 5. Technical Architecture & Routing Integration

### 5.1 Route Enforcement in Frontend (`App.jsx` & `roleDashboard.js`)

```
User Authenticates (Keycloak JWT)
               │
               ▼
      RootRedirect (`/`)
               │
               ▼
       Role Evaluation
 ┌─────────────┼──────────────┬─────────────┬─────────────┐
 │             │              │             │             │
SUPER_ADMIN  ADMIN          WARDEN        GUARD        STUDENT / OTHERS
 │             │              │             │             │
 ▼             ▼              ▼             ▼             ▼
/dashboard   /access        /hostel       /guard       /dashboard
(Full Suite) (Access Mgmt)  (Hostel Ops)  (Console)    (Personal Workspace)
```

### 5.2 Microservice Data Providers

| Widget Category | Source Microservice | Primary API / Protocol |
|-----------------|---------------------|------------------------|
| User & Role Analytics | User Management | `GET /api/v1/users`, `GET /api/v1/roles` |
| Gate Events & Access Control | User Management (Access) | `GET /api/v1/access/events`, `WebSocket /api/v1/ws/stream` |
| Leave Register & Approvals | User Management (Leave) | `GET /api/v1/leave/requests`, `POST /api/v1/leave/requests/{id}/approve` |
| Live Face Verification | FRECO Service | `WebSocket /api/v1/face/stream`, `POST /api/v1/face/recognize` |
| Notification Throughput | Notification Module | `GET /metrics`, PostgreSQL Outbox `leave_notifications` |
| Device Registry & Health | User Management (Devices) | `GET /api/v1/devices`, `GET /api/v1/devices/health` |
