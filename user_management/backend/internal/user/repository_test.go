package user_test

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/ococ/user-management/internal/user"
	_ "github.com/lib/pq"
)

// setupTestDB connects to the local ococ_users database.
func setupTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("postgres", "postgres://ococ:root@localhost:5432/ococ_users?sslmode=disable")
	if err != nil {
		t.Fatalf("Failed to open DB: %v", err)
	}
	if err := db.Ping(); err != nil {
		t.Skipf("DB not available, skipping tests: %v", err)
	}
	return db
}

func TestUserRepositoryIntegration(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	repo := user.NewPostgresRepository(db)
	ctx := context.Background()

	// Wrap in a transaction and rollback at the end so tests don't leave garbage.
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatalf("Failed to begin tx: %v", err)
	}
	defer tx.Rollback()

	// 1. Create a user
	u := &user.User{
		ID:        uuid.New(),
		UserType:  user.UserTypeStudent,
		Status:    user.StatusActive,
		Email:     "test_student@example.com",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	err = repo.Create(ctx, tx, u)
	if err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	// 2. Create profile
	deps, err := repo.ListDepartments(ctx)
	if err != nil || len(deps) == 0 {
		t.Fatalf("Failed to fetch departments or no departments found")
	}
	depID := deps[0].ID

	p := &user.Profile{
		UserID:       u.ID,
		FullName:     "Test Student",
		RollNumber:   "CS12345",
		DepartmentID: &depID,
		Course:       "MCA",
		Semester:     "2",
		UpdatedAt:    time.Now(),
	}
	err = repo.CreateProfile(ctx, tx, p)
	if err != nil {
		t.Fatalf("Failed to create profile: %v", err)
	}

	// Commit before fetching because GetByID doesn't use the transaction
	err = tx.Commit()
	if err != nil {
		t.Fatalf("Failed to commit tx: %v", err)
	}

	// Clean up after test
	defer func() {
		delTx, _ := db.BeginTx(ctx, nil)
		repo.Delete(ctx, delTx, u.ID)
		delTx.Commit()
	}()

	// 3. Test GetByID
	fetched, err := repo.GetByID(ctx, u.ID)
	if err != nil {
		t.Fatalf("Failed to get user: %v", err)
	}
	if fetched == nil {
		t.Fatalf("User not found")
	}
	if fetched.Profile == nil {
		t.Fatalf("Profile is nil in GetByID")
	}
	if fetched.Profile.FullName != "Test Student" {
		t.Errorf("Expected full name 'Test Student', got %s", fetched.Profile.FullName)
	}
	if fetched.Profile.Course != "MCA" {
		t.Errorf("Expected course 'MCA', got %s", fetched.Profile.Course)
	}
	if fetched.HasFaceAuth != false {
		t.Errorf("Expected HasFaceAuth false, got %v", fetched.HasFaceAuth)
	}

	// 4. Test List

	listRes, err := repo.List(ctx, user.ListFilter{Search: "test_student@example.com"})
	if err != nil {
		t.Fatalf("Failed to list users: %v", err)
	}
	if len(listRes.Users) == 0 {
		t.Fatalf("User not found in List")
	}

	listedUser := listRes.Users[0]
	if listedUser.Profile == nil {
		t.Fatalf("Profile is nil in List response! (This was the core bug)")
	}
	if listedUser.Profile.FullName != "Test Student" {
		t.Errorf("Expected full name 'Test Student', got '%s'", listedUser.Profile.FullName)
	}
	if listedUser.Profile.Department != deps[0].Name {
		t.Errorf("Expected department '%s', got '%s'", deps[0].Name, listedUser.Profile.Department)
	}

	// 5. Create a user without a profile and ensure they still show up in List (LEFT JOIN check)
	u2 := &user.User{
		ID:        uuid.New(),
		UserType:  user.UserTypeVisitor,
		Status:    user.StatusActive,
		Email:     "noprofile@example.com",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	tx2, _ := db.BeginTx(ctx, nil)
	err = repo.Create(ctx, tx2, u2)
	tx2.Commit()
	defer func() {
		delTx, _ := db.BeginTx(ctx, nil)
		repo.Delete(ctx, delTx, u2.ID)
		delTx.Commit()
	}()

	listRes2, err := repo.List(ctx, user.ListFilter{Search: "noprofile@example.com"})
	if err != nil {
		t.Fatalf("Failed to list u2: %v", err)
	}
	if len(listRes2.Users) == 0 {
		t.Fatalf("User without profile not found in List (LEFT JOIN broken?)")
	}
	if listRes2.Users[0].Profile != nil {
		t.Errorf("Expected nil profile for u2, got %v", listRes2.Users[0].Profile)
	}
}
