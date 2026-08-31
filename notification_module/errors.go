package main

import "fmt"

type ErrorKind string

const (
	ErrorValidation    ErrorKind = "validation error"
	ErrorTemplate      ErrorKind = "template error"
	ErrorProvider      ErrorKind = "provider error"
	ErrorRateLimit     ErrorKind = "rate limit error"
	ErrorDuplicate     ErrorKind = "duplicate notification"
	ErrorAuthorization ErrorKind = "authorization error"
	ErrorNotFound      ErrorKind = "not found"
	ErrorInternal      ErrorKind = "internal error"
)

type AppError struct {
	Kind    ErrorKind `json:"kind"`
	Message string    `json:"message"`
}

func (e *AppError) Error() string {
	if e == nil {
		return ""
	}
	return fmt.Sprintf("%s: %s", e.Kind, e.Message)
}

func appError(kind ErrorKind, format string, args ...interface{}) *AppError {
	return &AppError{Kind: kind, Message: fmt.Sprintf(format, args...)}
}
