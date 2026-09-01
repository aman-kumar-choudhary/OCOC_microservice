package rfid

import (
	"context"
	"fmt"
	"log"
	"math/rand"
	"os"
	"time"
)

// Reader is the interface for RFID enrollment devices.
// Designed for loose coupling so any reader/protocol can be plugged in.
type Reader interface {
	Connect(ctx context.Context) error
	Disconnect() error
	StartScan(ctx context.Context) error
	StopScan() error
	ReadCard(ctx context.Context) (*ScanResult, error)
	GetStatus() ReaderStatus
}

// ── Simulated Reader ──────────────────────────────────────────────────────────

// SimulatedReader returns fake UIDs — used when RFID_READER_SIMULATE=true.
type SimulatedReader struct {
	status ReaderStatus
}

func NewSimulatedReader() Reader {
	return &SimulatedReader{status: ReaderIdle}
}

func (s *SimulatedReader) Connect(_ context.Context) error {
	s.status = ReaderIdle
	log.Println("[RFID][SIM] Reader connected (simulation mode)")
	return nil
}

func (s *SimulatedReader) Disconnect() error {
	s.status = ReaderIdle
	return nil
}

func (s *SimulatedReader) StartScan(_ context.Context) error {
	s.status = ReaderScanning
	return nil
}

func (s *SimulatedReader) StopScan() error {
	s.status = ReaderIdle
	return nil
}

func (s *SimulatedReader) ReadCard(_ context.Context) (*ScanResult, error) {
	if s.status != ReaderScanning {
		return nil, fmt.Errorf("reader is not scanning")
	}
	s.status = ReaderProcessing
	time.Sleep(500 * time.Millisecond) // simulate scan delay
	uid := randomUID()
	s.status = ReaderIdle
	return &ScanResult{UID: uid, Status: "success"}, nil
}

func (s *SimulatedReader) GetStatus() ReaderStatus {
	return s.status
}

func randomUID() string {
	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	b := make([]byte, 4)
	r.Read(b)
	return fmt.Sprintf("%02X%02X%02X%02X", b[0], b[1], b[2], b[3])
}

// ── WebSocket Reader ──────────────────────────────────────────────────────────

// WebSocketReader connects to a physical RFID reader via WebSocket.
// The reader device should send JSON: {"uid": "<card_uid>"}
type WebSocketReader struct {
	url    string
	status ReaderStatus
	// conn would hold the WebSocket connection — requires github.com/gorilla/websocket
	// For now this is a skeleton that can be completed when hardware is available.
}

func NewWebSocketReader(url string) Reader {
	return &WebSocketReader{url: url, status: ReaderIdle}
}

func (w *WebSocketReader) Connect(ctx context.Context) error {
	log.Printf("[RFID][WS] Connecting to RFID reader at %s", w.url)
	// TODO: establish WebSocket connection to w.url
	// conn, _, err := websocket.DefaultDialer.DialContext(ctx, w.url, nil)
	// if err != nil { return fmt.Errorf("rfid ws connect: %w", err) }
	w.status = ReaderIdle
	return nil
}

func (w *WebSocketReader) Disconnect() error {
	w.status = ReaderIdle
	return nil
}

func (w *WebSocketReader) StartScan(_ context.Context) error {
	w.status = ReaderScanning
	return nil
}

func (w *WebSocketReader) StopScan() error {
	w.status = ReaderIdle
	return nil
}

func (w *WebSocketReader) ReadCard(ctx context.Context) (*ScanResult, error) {
	// TODO: read from WebSocket connection
	// var result ScanResult
	// err := conn.ReadJSON(&result)
	return nil, fmt.Errorf("WebSocket reader not yet connected to hardware")
}

func (w *WebSocketReader) GetStatus() ReaderStatus {
	return w.status
}

// NewReaderFromEnv selects the reader implementation based on env config.
func NewReaderFromEnv() Reader {
	if os.Getenv("RFID_READER_SIMULATE") == "true" {
		log.Println("[RFID] Using simulated reader (RFID_READER_SIMULATE=true)")
		return NewSimulatedReader()
	}
	url := os.Getenv("RFID_READER_URL")
	if url == "" {
		log.Println("[RFID] RFID_READER_URL not set, falling back to simulation")
		return NewSimulatedReader()
	}
	return NewWebSocketReader(url)
}
