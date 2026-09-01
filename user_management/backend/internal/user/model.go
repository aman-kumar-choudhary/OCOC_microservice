package user

import (
	"time"

	"github.com/google/uuid"
)

// UserType enumerates supported user personas.
type UserType string

const (
	UserTypeStudent UserType = "student"
	UserTypeFaculty UserType = "faculty"
	UserTypeWorker  UserType = "worker"
	UserTypeVisitor UserType = "visitor"
)

// UserStatus represents account lifecycle state.
type UserStatus string

const (
	StatusActive      UserStatus = "active"
	StatusSuspended   UserStatus = "suspended"
	StatusDeactivated UserStatus = "deactivated"
)

// User is the core user entity.
type User struct {
	ID              uuid.UUID  `json:"id"`
	KeycloakUserID  string     `json:"keycloak_user_id,omitempty"`
	UserType        UserType   `json:"user_type"`
	Status          UserStatus `json:"status"`
	Email           string     `json:"email"`
	Phone           string     `json:"phone,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
	Profile         *Profile   `json:"profile,omitempty"`
	Roles           []string   `json:"roles,omitempty"`
	ActiveRFID      string     `json:"active_rfid,omitempty"`
}

// Profile holds extended user attributes.
type Profile struct {
	UserID            uuid.UUID  `json:"user_id"`
	FullName          string     `json:"full_name"`
	RollNumber        string     `json:"roll_number,omitempty"`
	EmployeeID        string     `json:"employee_id,omitempty"`
	DepartmentID      *uuid.UUID `json:"department_id,omitempty"`
	HostelID          *uuid.UUID `json:"hostel_id,omitempty"`
	EmergencyContact  string     `json:"emergency_contact,omitempty"`
	GuardianContact   string     `json:"guardian_contact,omitempty"`
	PhotoReference    string     `json:"photo_reference,omitempty"`
	// Visitor fields
	GovIDType         string     `json:"gov_id_type,omitempty"`
	GovIDNumber       string     `json:"gov_id_number,omitempty"`
	VisitPurpose      string     `json:"visit_purpose,omitempty"`
	HostContact       string     `json:"host_contact,omitempty"`
	VisitStart        *time.Time `json:"visit_start,omitempty"`
	VisitDurationDays int        `json:"visit_duration_days,omitempty"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

// CreateUserRequest is the payload for creating a new user.
type CreateUserRequest struct {
	UserType  UserType `json:"user_type"`
	Email     string   `json:"email"`
	Phone     string   `json:"phone"`
	Password  string   `json:"password"` // initial password — sent to Keycloak only
	Profile   ProfileRequest `json:"profile"`
}

// ProfileRequest holds profile data in create/update requests.
type ProfileRequest struct {
	FullName          string     `json:"full_name"`
	RollNumber        string     `json:"roll_number,omitempty"`
	EmployeeID        string     `json:"employee_id,omitempty"`
	DepartmentID      *uuid.UUID `json:"department_id,omitempty"`
	HostelID          *uuid.UUID `json:"hostel_id,omitempty"`
	EmergencyContact  string     `json:"emergency_contact,omitempty"`
	GuardianContact   string     `json:"guardian_contact,omitempty"`
	PhotoReference    string     `json:"photo_reference,omitempty"`
	// Visitor
	GovIDType         string     `json:"gov_id_type,omitempty"`
	GovIDNumber       string     `json:"gov_id_number,omitempty"`
	VisitPurpose      string     `json:"visit_purpose,omitempty"`
	HostContact       string     `json:"host_contact,omitempty"`
	VisitStart        *time.Time `json:"visit_start,omitempty"`
	VisitDurationDays int        `json:"visit_duration_days,omitempty"`
}

// UpdateUserRequest is the payload for updating a user.
type UpdateUserRequest struct {
	Phone   string         `json:"phone,omitempty"`
	Profile *ProfileRequest `json:"profile,omitempty"`
}

// ListFilter holds query parameters for user listing.
type ListFilter struct {
	Search     string
	UserType   string
	Status     string
	Department string
	Role       string
	Page       int
	Limit      int
}

// ListResult is the paginated user list response.
type ListResult struct {
	Users      []User `json:"users"`
	Total      int    `json:"total"`
	Page       int    `json:"page"`
	Limit      int    `json:"limit"`
	TotalPages int    `json:"total_pages"`
}

// Stats holds user statistics for dashboard.
type Stats struct {
	Total        int `json:"total"`
	Active       int `json:"active"`
	Suspended    int `json:"suspended"`
	Deactivated  int `json:"deactivated"`
	Students     int `json:"students"`
	Faculty      int `json:"faculty"`
	Workers      int `json:"workers"`
	Visitors     int `json:"visitors"`
}
