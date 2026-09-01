package database

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"strconv"
	"time"

	_ "github.com/lib/pq"
)

// DB wraps *sql.DB and provides transaction helpers.
type DB struct {
	*sql.DB
}

// OpenFromEnv opens a PostgreSQL connection using DATABASE_URL from the environment.
func OpenFromEnv() (*DB, error) {
	dsn := envString("DATABASE_URL", "")
	if dsn == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, fmt.Errorf("open postgres: %w", err)
	}

	db.SetMaxOpenConns(envInt("DATABASE_MAX_OPEN_CONNS", 25))
	db.SetMaxIdleConns(envInt("DATABASE_MAX_IDLE_CONNS", 10))
	db.SetConnMaxLifetime(time.Duration(envInt("DATABASE_CONN_MAX_LIFETIME_SECONDS", 300)) * time.Second)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return nil, fmt.Errorf("ping postgres: %w", err)
	}
	return &DB{db}, nil
}

// RunMigration executes a SQL migration file.
func RunMigration(db *DB, path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("read migration %s: %w", path, err)
	}
	if _, err := db.Exec(string(data)); err != nil {
		return fmt.Errorf("apply migration %s: %w", path, err)
	}
	return nil
}

// WithTx executes fn inside a serializable transaction.
// If fn returns an error the transaction is rolled back; otherwise committed.
func (db *DB) WithTx(ctx context.Context, fn func(*sql.Tx) error) error {
	tx, err := db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	if err := fn(tx); err != nil {
		_ = tx.Rollback()
		return err
	}
	return tx.Commit()
}

// Ping checks database health.
func (db *DB) Ping(ctx context.Context) error {
	return db.PingContext(ctx)
}

func envString(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func envInt(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}
