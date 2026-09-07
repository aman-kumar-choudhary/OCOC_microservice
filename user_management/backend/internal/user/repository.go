package user

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	_ "github.com/lib/pq"
)

// Repository defines user storage operations.
type Repository interface {
	Create(ctx context.Context, tx *sql.Tx, u *User) error
	CreateProfile(ctx context.Context, tx *sql.Tx, p *Profile) error
	GetByID(ctx context.Context, id uuid.UUID) (*User, error)
	GetByEmail(ctx context.Context, email string) (*User, error)
	GetKeycloakIDByEmail(ctx context.Context, email string) (string, bool, error)
	Update(ctx context.Context, tx *sql.Tx, u *User) error
	UpdateProfile(ctx context.Context, tx *sql.Tx, p *Profile) error
	UpdateStatus(ctx context.Context, tx *sql.Tx, id uuid.UUID, status UserStatus) error
	UpdateKeycloakID(ctx context.Context, tx *sql.Tx, id uuid.UUID, kcID string) error
	List(ctx context.Context, f ListFilter) (*ListResult, error)

	ListDepartments(ctx context.Context) ([]Department, error)
	ListHostels(ctx context.Context) ([]Hostel, error)
	Stats(ctx context.Context) (*Stats, error)
	Delete(ctx context.Context, tx *sql.Tx, id uuid.UUID) error
	ExistsByEmail(ctx context.Context, email string) (bool, error)
	ExistsByPhone(ctx context.Context, phone string) (bool, error)
	GetActiveRFIDUID(ctx context.Context, userID uuid.UUID) (string, error)
}

// PostgresRepository implements Repository using PostgreSQL.
type PostgresRepository struct {
	db *sql.DB
}

// NewPostgresRepository creates a new PostgreSQL-backed user repository.
func NewPostgresRepository(db *sql.DB) Repository {
	return &PostgresRepository{db: db}
}

func (r *PostgresRepository) Create(ctx context.Context, tx *sql.Tx, u *User) error {
	q := `INSERT INTO users (id, keycloak_user_id, user_type, status, email, phone, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`
	exec := sqlExec(tx, r.db)
	_, err := exec(ctx, q, u.ID, nullStr(u.KeycloakUserID), string(u.UserType), string(u.Status),
		u.Email, nullStr(u.Phone), u.CreatedAt, u.UpdatedAt)
	if err != nil {
		if strings.Contains(err.Error(), "users_email_key") || strings.Contains(err.Error(), "duplicate key") {
			return fmt.Errorf("email already registered")
		}
		return fmt.Errorf("create user: %w", err)
	}
	return nil
}

func (r *PostgresRepository) CreateProfile(ctx context.Context, tx *sql.Tx, p *Profile) error {
	exec := sqlExec(tx, r.db)

	var utype string
	var err error
	if tx != nil {
		err = tx.QueryRowContext(ctx, `SELECT user_type FROM users WHERE id=$1`, p.UserID).Scan(&utype)
	} else {
		err = r.db.QueryRowContext(ctx, `SELECT user_type FROM users WHERE id=$1`, p.UserID).Scan(&utype)
	}
	if err != nil {
		return fmt.Errorf("failed to lookup user type for profile creation: %w", err)
	}

	var q string
	switch utype {
	case "student":
		q = `INSERT INTO student_profiles (
				user_id, full_name, roll_number, department_id, 
				course, semester, hostel_id, emergency_contact,
				guardian_contact, photo_reference, updated_at
			) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
			ON CONFLICT (user_id) DO UPDATE SET
				full_name=EXCLUDED.full_name, roll_number=EXCLUDED.roll_number,
				department_id=EXCLUDED.department_id, 
				course=EXCLUDED.course, semester=EXCLUDED.semester,
				hostel_id=EXCLUDED.hostel_id,
				emergency_contact=EXCLUDED.emergency_contact, guardian_contact=EXCLUDED.guardian_contact,
				photo_reference=EXCLUDED.photo_reference, updated_at=EXCLUDED.updated_at`
		_, err = exec(ctx, q, p.UserID, p.FullName, nullStr(p.RollNumber), nullUUID(p.DepartmentID), nullStr(p.Course), nullStr(p.Semester), nullUUID(p.HostelID), nullStr(p.EmergencyContact), nullStr(p.GuardianContact), nullStr(p.PhotoReference), p.UpdatedAt)

	case "faculty":
		q = `INSERT INTO faculty_profiles (
				user_id, full_name, employee_id, department_id, 
				designation, emergency_contact, photo_reference, updated_at
			) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
			ON CONFLICT (user_id) DO UPDATE SET
				full_name=EXCLUDED.full_name, employee_id=EXCLUDED.employee_id,
				department_id=EXCLUDED.department_id, 
				designation=EXCLUDED.designation,
				emergency_contact=EXCLUDED.emergency_contact, photo_reference=EXCLUDED.photo_reference,
				updated_at=EXCLUDED.updated_at`
		_, err = exec(ctx, q, p.UserID, p.FullName, nullStr(p.EmployeeID), nullUUID(p.DepartmentID), nullStr(p.Designation), nullStr(p.EmergencyContact), nullStr(p.PhotoReference), p.UpdatedAt)

	case "worker":
		q = `INSERT INTO worker_profiles (
				user_id, full_name, employee_id, department_id, 
				designation, emergency_contact, photo_reference, updated_at
			) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
			ON CONFLICT (user_id) DO UPDATE SET
				full_name=EXCLUDED.full_name, employee_id=EXCLUDED.employee_id,
				department_id=EXCLUDED.department_id, 
				designation=EXCLUDED.designation, emergency_contact=EXCLUDED.emergency_contact,
				photo_reference=EXCLUDED.photo_reference, updated_at=EXCLUDED.updated_at`
		_, err = exec(ctx, q, p.UserID, p.FullName, nullStr(p.EmployeeID), nullUUID(p.DepartmentID), nullStr(p.Designation), nullStr(p.EmergencyContact), nullStr(p.PhotoReference), p.UpdatedAt)

	case "visitor":
		q = `INSERT INTO visitor_profiles (
				user_id, full_name, gov_id_type, gov_id_number, visit_purpose,
				host_contact, visit_start, visit_duration_days, photo_reference, updated_at
			) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
			ON CONFLICT (user_id) DO UPDATE SET
				full_name=EXCLUDED.full_name, gov_id_type=EXCLUDED.gov_id_type,
				gov_id_number=EXCLUDED.gov_id_number, visit_purpose=EXCLUDED.visit_purpose,
				host_contact=EXCLUDED.host_contact, visit_start=EXCLUDED.visit_start,
				visit_duration_days=EXCLUDED.visit_duration_days, photo_reference=EXCLUDED.photo_reference,
				updated_at=EXCLUDED.updated_at`
		_, err = exec(ctx, q, p.UserID, p.FullName, nullStr(p.GovIDType), nullStr(p.GovIDNumber), nullStr(p.VisitPurpose), nullStr(p.HostContact), nullTime(p.VisitStart), nullInt(p.VisitDurationDays), p.UpdatedAt)
		
	default:
		return fmt.Errorf("unknown user type: %s", utype)
	}

	if err != nil {
		return fmt.Errorf("create %s profile: %w", utype, err)
	}
	return nil
}

func (r *PostgresRepository) GetByID(ctx context.Context, id uuid.UUID) (*User, error) {
	u := &User{}
	var kcID, phone sql.NullString
	var status, utype string

	err := r.db.QueryRowContext(ctx,
		`SELECT id, keycloak_user_id, user_type, status, email, phone, created_at, updated_at,
		 EXISTS(SELECT 1 FROM freco_people fp JOIN freco_face_embeddings fe ON fe.person_id = fp.id WHERE fp.external_id = users.id) AS has_face_auth
		 FROM users WHERE id=$1`, id).
		Scan(&u.ID, &kcID, &utype, &status, &u.Email, &phone, &u.CreatedAt, &u.UpdatedAt, &u.HasFaceAuth)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get user: %w", err)
	}
	u.KeycloakUserID = kcID.String
	u.Phone = phone.String
	u.UserType = UserType(utype)
	u.Status = UserStatus(status)

	if p, err := r.loadProfile(ctx, id); err == nil {
		u.Profile = p
	}
	if uid, err := r.GetActiveRFIDUID(ctx, id); err == nil {
		u.ActiveRFID = uid
	}
	return u, nil
}

func (r *PostgresRepository) GetByEmail(ctx context.Context, email string) (*User, error) {
	var id uuid.UUID
	err := r.db.QueryRowContext(ctx, `SELECT id FROM users WHERE email=$1`, email).Scan(&id)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, id)
}

func (r *PostgresRepository) GetKeycloakIDByEmail(ctx context.Context, email string) (string, bool, error) {
	var kcID sql.NullString
	err := r.db.QueryRowContext(ctx, `SELECT keycloak_user_id FROM users WHERE email=$1`, email).Scan(&kcID)
	if err == sql.ErrNoRows {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return kcID.String, true, nil
}

func (r *PostgresRepository) Update(ctx context.Context, tx *sql.Tx, u *User) error {
	exec := sqlExec(tx, r.db)
	_, err := exec(ctx, `UPDATE users SET phone=$2, updated_at=$3 WHERE id=$1`, u.ID, nullStr(u.Phone), u.UpdatedAt)
	return err
}

func (r *PostgresRepository) UpdateProfile(ctx context.Context, tx *sql.Tx, p *Profile) error {
	return r.CreateProfile(ctx, tx, p)
}

func (r *PostgresRepository) UpdateStatus(ctx context.Context, tx *sql.Tx, id uuid.UUID, status UserStatus) error {
	exec := sqlExec(tx, r.db)
	now := time.Now()
	if _, err := exec(ctx, `UPDATE users SET status=$2, updated_at=$3 WHERE id=$1`, id, string(status), now); err != nil {
		return err
	}
	isActive := status == StatusActive
	_, err := exec(ctx, `UPDATE freco_people SET active=$2, updated_at=$3 WHERE external_id=$1`, id, isActive, now)
	return err
}

func (r *PostgresRepository) UpdateKeycloakID(ctx context.Context, tx *sql.Tx, id uuid.UUID, kcID string) error {
	exec := sqlExec(tx, r.db)
	_, err := exec(ctx, `UPDATE users SET keycloak_user_id=$2, updated_at=$3 WHERE id=$1`, id, kcID, time.Now())
	return err
}

func (r *PostgresRepository) List(ctx context.Context, f ListFilter) (*ListResult, error) {
	if f.Page < 1 {
		f.Page = 1
	}
	if f.Limit < 1 || f.Limit > 200 {
		f.Limit = 20
	}
	offset := (f.Page - 1) * f.Limit

	where, args := buildListWhere(f)
	base := `FROM users u 
		LEFT JOIN student_profiles sp ON sp.user_id = u.id AND u.user_type = 'student'
		LEFT JOIN faculty_profiles fp ON fp.user_id = u.id AND u.user_type = 'faculty'
		LEFT JOIN worker_profiles wp ON wp.user_id = u.id AND u.user_type = 'worker'
		LEFT JOIN visitor_profiles vp ON vp.user_id = u.id AND u.user_type = 'visitor'
		LEFT JOIN departments d ON d.id = COALESCE(sp.department_id, fp.department_id, wp.department_id) ` + where

	var total int
	if err := r.db.QueryRowContext(ctx, "SELECT COUNT(*) "+base, args...).Scan(&total); err != nil {
		return nil, fmt.Errorf("count users: %w", err)
	}

	args = append(args, f.Limit, offset)
	q := fmt.Sprintf(`SELECT u.id, u.keycloak_user_id, u.user_type, u.status, u.email, u.phone, u.created_at, u.updated_at,
		COALESCE(sp.full_name, fp.full_name, wp.full_name, vp.full_name) as full_name, 
		sp.roll_number, 
		COALESCE(fp.employee_id, wp.employee_id) as employee_id, 
		COALESCE(sp.department_id, fp.department_id, wp.department_id) as department_id, 
		sp.hostel_id,
		d.name as department, 
		d.school as school, 
		sp.course, 
		sp.semester, 
		COALESCE(fp.designation, wp.designation) as designation, 
		CASE WHEN sp.hostel_id IS NOT NULL THEN TRUE ELSE FALSE END as hostel_flag,
		COALESCE(sp.emergency_contact, fp.emergency_contact, wp.emergency_contact) as emergency_contact, 
		sp.guardian_contact, 
		COALESCE(sp.photo_reference, fp.photo_reference, wp.photo_reference, vp.photo_reference) as photo_reference,
		vp.gov_id_type, vp.gov_id_number, vp.visit_purpose, vp.host_contact,
		vp.visit_start, vp.visit_duration_days, 
		COALESCE(sp.updated_at, fp.updated_at, wp.updated_at, vp.updated_at) as p_updated_at,
		(SELECT rc.uid FROM rfid_cards rc JOIN user_rfid_cards urc ON urc.rfid_card_id=rc.id WHERE urc.user_id=u.id AND urc.is_primary=true AND urc.unassigned_at IS NULL AND rc.status='active' LIMIT 1) AS active_rfid,
		EXISTS(SELECT 1 FROM freco_people fp JOIN freco_face_embeddings fe ON fe.person_id = fp.id WHERE fp.external_id = u.id) AS has_face_auth
		%s ORDER BY u.created_at DESC LIMIT $%d OFFSET $%d`, base, len(args)-1, len(args))

	rows, err := r.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, fmt.Errorf("list users: %w", err)
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var u User
		var p Profile
		var kcID, phone sql.NullString
		var utype, status string
		var fullName, roll, emp, emerg, guard, photo sql.NullString
		var deptID, hostelID sql.NullString
		var dept, school, course, semester, designation sql.NullString
		var hostelFlag sql.NullBool
		var govType, govNum, purpose, host sql.NullString
		var visitStart sql.NullTime
		var visitDuration sql.NullInt32
		var pUpdatedAt sql.NullTime
		var activeRFID sql.NullString

		if err := rows.Scan(
			&u.ID, &kcID, &utype, &status, &u.Email, &phone, &u.CreatedAt, &u.UpdatedAt,
			&fullName, &roll, &emp, &deptID, &hostelID,
			&dept, &school, &course, &semester, &designation, &hostelFlag,
			&emerg, &guard, &photo,
			&govType, &govNum, &purpose, &host,
			&visitStart, &visitDuration, &pUpdatedAt,
			&activeRFID, &u.HasFaceAuth,
		); err != nil {
			continue
		}
		u.KeycloakUserID = kcID.String
		u.Phone = phone.String
		u.UserType = UserType(utype)
		u.Status = UserStatus(status)
		u.ActiveRFID = activeRFID.String

		if fullName.Valid {
			p.UserID = u.ID
			p.FullName = fullName.String
			p.RollNumber = roll.String
			p.EmployeeID = emp.String
			p.Department = dept.String
			p.School = school.String
			p.Course = course.String
			p.Semester = semester.String
			p.Designation = designation.String
			p.HostelFlag = hostelFlag.Bool
			p.EmergencyContact = emerg.String
			p.GuardianContact = guard.String
			p.PhotoReference = photo.String
			p.GovIDType = govType.String
			p.GovIDNumber = govNum.String
			p.VisitPurpose = purpose.String
			p.HostContact = host.String
			if deptID.Valid {
				id, _ := uuid.Parse(deptID.String)
				p.DepartmentID = &id
			}
			if hostelID.Valid {
				id, _ := uuid.Parse(hostelID.String)
				p.HostelID = &id
			}
			if visitStart.Valid {
				t := visitStart.Time
				p.VisitStart = &t
			}
			if visitDuration.Valid {
				p.VisitDurationDays = int(visitDuration.Int32)
			}
			if pUpdatedAt.Valid {
				p.UpdatedAt = pUpdatedAt.Time
			}
			u.Profile = &p
		}

		users = append(users, u)
	}
	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("list users iteration: %w", err)
	}

	totalPages := (total + f.Limit - 1) / f.Limit
	return &ListResult{Users: users, Total: total, Page: f.Page, Limit: f.Limit, TotalPages: totalPages}, nil
}

func (r *PostgresRepository) Stats(ctx context.Context) (*Stats, error) {
	var s Stats
	err := r.db.QueryRowContext(ctx, `SELECT
		COUNT(*),
		COUNT(*) FILTER (WHERE status='active'),
		COUNT(*) FILTER (WHERE status='suspended'),
		COUNT(*) FILTER (WHERE status='deactivated'),
		COUNT(*) FILTER (WHERE user_type='student'),
		COUNT(*) FILTER (WHERE user_type='faculty'),
		COUNT(*) FILTER (WHERE user_type='worker'),
		COUNT(*) FILTER (WHERE user_type='visitor')
		FROM users`).Scan(&s.Total, &s.Active, &s.Suspended, &s.Deactivated,
		&s.Students, &s.Faculty, &s.Workers, &s.Visitors)
	return &s, err
}

func (r *PostgresRepository) Delete(ctx context.Context, tx *sql.Tx, id uuid.UUID) error {
	exec := sqlExec(tx, r.db)
	_, err := exec(ctx, `DELETE FROM users WHERE id=$1`, id)
	return err
}

func (r *PostgresRepository) ExistsByEmail(ctx context.Context, email string) (bool, error) {
	var exists bool
	err := r.db.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE email=$1)`, email).Scan(&exists)
	return exists, err
}

func (r *PostgresRepository) ExistsByPhone(ctx context.Context, phone string) (bool, error) {
	if phone == "" {
		return false, nil
	}
	var exists bool
	err := r.db.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE phone=$1)`, phone).Scan(&exists)
	return exists, err
}

func (r *PostgresRepository) GetActiveRFIDUID(ctx context.Context, userID uuid.UUID) (string, error) {
	var uid string
	err := r.db.QueryRowContext(ctx, `
		SELECT rc.uid FROM rfid_cards rc
		JOIN user_rfid_cards urc ON urc.rfid_card_id=rc.id
		WHERE urc.user_id=$1 AND urc.is_primary=true AND urc.unassigned_at IS NULL AND rc.status='active'
		LIMIT 1`, userID).Scan(&uid)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return uid, err
}

func (r *PostgresRepository) loadProfile(ctx context.Context, userID uuid.UUID) (*Profile, error) {
	p := &Profile{UserID: userID}
	var roll, emp, emerg, guard, photo sql.NullString
	var deptID, hostelID sql.NullString
	var dept, school, course, semester, designation sql.NullString
	var hostelFlag sql.NullBool
	var govType, govNum, purpose, host sql.NullString
	var visitStart sql.NullTime
	var visitDuration sql.NullInt32

	err := r.db.QueryRowContext(ctx, `
		SELECT 
			COALESCE(sp.full_name, fp.full_name, wp.full_name, vp.full_name) as full_name,
			sp.roll_number,
			COALESCE(fp.employee_id, wp.employee_id) as employee_id,
			COALESCE(sp.department_id, fp.department_id, wp.department_id) as department_id,
			sp.hostel_id,
			d.name as department,
			d.school as school,
			sp.course,
			sp.semester,
			COALESCE(fp.designation, wp.designation) as designation,
			CASE WHEN sp.hostel_id IS NOT NULL THEN TRUE ELSE FALSE END as hostel_flag,
			COALESCE(sp.emergency_contact, fp.emergency_contact, wp.emergency_contact) as emergency_contact,
			sp.guardian_contact,
			COALESCE(sp.photo_reference, fp.photo_reference, wp.photo_reference, vp.photo_reference) as photo_reference,
			vp.gov_id_type,
			vp.gov_id_number,
			vp.visit_purpose,
			vp.host_contact,
			vp.visit_start,
			vp.visit_duration_days,
			COALESCE(sp.updated_at, fp.updated_at, wp.updated_at, vp.updated_at) as updated_at
		FROM users u
		LEFT JOIN student_profiles sp ON sp.user_id = u.id AND u.user_type = 'student'
		LEFT JOIN faculty_profiles fp ON fp.user_id = u.id AND u.user_type = 'faculty'
		LEFT JOIN worker_profiles wp ON wp.user_id = u.id AND u.user_type = 'worker'
		LEFT JOIN visitor_profiles vp ON vp.user_id = u.id AND u.user_type = 'visitor'
		LEFT JOIN departments d ON d.id = COALESCE(sp.department_id, fp.department_id, wp.department_id)
		WHERE u.id=$1`, userID).
		Scan(&p.FullName, &roll, &emp, &deptID, &hostelID,
			&dept, &school, &course, &semester, &designation, &hostelFlag,
			&emerg, &guard, &photo,
			&govType, &govNum, &purpose, &host,
			&visitStart, &visitDuration, &p.UpdatedAt)
	if err != nil {
		return nil, err
	}
	p.RollNumber = roll.String
	p.EmployeeID = emp.String
	p.Department = dept.String
	p.School = school.String
	p.Course = course.String
	p.Semester = semester.String
	p.Designation = designation.String
	p.HostelFlag = hostelFlag.Bool
	p.EmergencyContact = emerg.String
	p.GuardianContact = guard.String
	p.PhotoReference = photo.String
	p.GovIDType = govType.String
	p.GovIDNumber = govNum.String
	p.VisitPurpose = purpose.String
	p.HostContact = host.String
	if deptID.Valid {
		id, _ := uuid.Parse(deptID.String)
		p.DepartmentID = &id
	}
	if hostelID.Valid {
		id, _ := uuid.Parse(hostelID.String)
		p.HostelID = &id
	}
	if visitStart.Valid {
		t := visitStart.Time
		p.VisitStart = &t
	}
	if visitDuration.Valid {
		p.VisitDurationDays = int(visitDuration.Int32)
	}
	return p, nil
}

// ── helpers ───────────────────────────────────────────────────────────────────

type execFn func(ctx context.Context, query string, args ...interface{}) (sql.Result, error)

func sqlExec(tx *sql.Tx, db *sql.DB) execFn {
	if tx != nil {
		return tx.ExecContext
	}
	return db.ExecContext
}

func buildListWhere(f ListFilter) (string, []interface{}) {
	var conds []string
	var args []interface{}
	n := 1

	if f.Search != "" {
		conds = append(conds, fmt.Sprintf(
			`(u.email ILIKE $%d OR COALESCE(sp.full_name, fp.full_name, wp.full_name, vp.full_name) ILIKE $%d OR sp.roll_number ILIKE $%d OR COALESCE(fp.employee_id, wp.employee_id) ILIKE $%d OR u.phone ILIKE $%d OR u.id::text ILIKE $%d)`,
			n, n, n, n, n, n))
		args = append(args, "%"+f.Search+"%")
		n++
	}
	if f.UserType != "" {
		conds = append(conds, fmt.Sprintf(`u.user_type=$%d`, n))
		args = append(args, f.UserType)
		n++
	}
	if f.Status != "" {
		conds = append(conds, fmt.Sprintf(`u.status=$%d`, n))
		args = append(args, f.Status)
		n++
	}
	if f.Department != "" {
		conds = append(conds, fmt.Sprintf(`COALESCE(sp.department_id, fp.department_id, wp.department_id)=$%d`, n))
		args = append(args, f.Department)
		n++
	}
	if f.Course != "" {
		conds = append(conds, fmt.Sprintf(`sp.course ILIKE $%d`, n))
		args = append(args, "%"+f.Course+"%")
		n++
	}
	if f.Semester != "" {
		conds = append(conds, fmt.Sprintf(`sp.semester=$%d`, n))
		args = append(args, f.Semester)
		n++
	}
	if f.HostelID != "" {
		conds = append(conds, fmt.Sprintf(`sp.hostel_id=$%d`, n))
		args = append(args, f.HostelID)
		n++
	}
	if len(conds) == 0 {
		return "", args
	}
	return "WHERE " + strings.Join(conds, " AND "), args
}

func nullStr(s string) sql.NullString { return sql.NullString{String: s, Valid: s != ""} }

func nullUUID(id *uuid.UUID) sql.NullString {
	if id == nil {
		return sql.NullString{}
	}
	return sql.NullString{String: id.String(), Valid: true}
}

func nullTime(t *time.Time) sql.NullTime {
	if t == nil {
		return sql.NullTime{}
	}
	return sql.NullTime{Time: *t, Valid: true}
}

func nullInt(n int) sql.NullInt32 { return sql.NullInt32{Int32: int32(n), Valid: n > 0} }

func (r *PostgresRepository) ListDepartments(ctx context.Context) ([]Department, error) {
	rows, err := r.db.QueryContext(ctx, "SELECT id, name, code, school FROM departments ORDER BY name ASC")
	if err != nil {
		return nil, fmt.Errorf("list departments: %w", err)
	}
	defer rows.Close()

	var deps []Department
	for rows.Next() {
		var d Department
		var school sql.NullString
		if err := rows.Scan(&d.ID, &d.Name, &d.Code, &school); err != nil {
			continue
		}
		d.School = school.String
		deps = append(deps, d)
	}
	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("list departments iteration: %w", err)
	}
	return deps, nil
}

func (r *PostgresRepository) ListHostels(ctx context.Context) ([]Hostel, error) {
	rows, err := r.db.QueryContext(ctx, "SELECT id, name, code FROM hostels ORDER BY name ASC")
	if err != nil {
		return nil, fmt.Errorf("list hostels: %w", err)
	}
	defer rows.Close()

	var hostels []Hostel
	for rows.Next() {
		var h Hostel
		if err := rows.Scan(&h.ID, &h.Name, &h.Code); err != nil {
			continue
		}
		hostels = append(hostels, h)
	}
	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("list hostels iteration: %w", err)
	}
	return hostels, nil
}
