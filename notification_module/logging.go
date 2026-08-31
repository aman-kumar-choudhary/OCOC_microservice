package main

import (
	"io"
	"log"
	"os"
	"path/filepath"
)

func configureFileLogging() (*os.File, error) {
	logPath := envString("LOG_FILE", "logs/notification-system.log")
	if err := os.MkdirAll(filepath.Dir(logPath), 0755); err != nil {
		return nil, err
	}

	file, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		return nil, err
	}

	log.SetOutput(io.MultiWriter(os.Stdout, file))
	log.SetFlags(log.Ldate | log.Ltime | log.Lmicroseconds | log.Lshortfile)
	log.Printf("file logging enabled path=%s", logPath)
	return file, nil
}
