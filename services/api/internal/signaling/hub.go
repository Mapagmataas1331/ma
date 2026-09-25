package signaling

import (
	"context"
	"encoding/json"
	"sync"

	"github.com/coder/websocket"
	"github.com/google/uuid"
)

type Frame struct {
	V    int            `json:"v"`
	T    string         `json:"t"`
	ID   string         `json:"id"`
	To   *Target        `json:"to,omitempty"`
	From *Target        `json:"from,omitempty"`
	P    map[string]any `json:"p"`
}

type Target struct {
	User   string `json:"user"`
	Device string `json:"device,omitempty"`
}

type Conn struct {
	User   uuid.UUID
	Device uuid.UUID
	WS     *websocket.Conn
}

type Hub struct {
	mu    sync.Mutex
	conns map[uuid.UUID]map[uuid.UUID]*Conn
}

func New() *Hub {
	return &Hub{conns: map[uuid.UUID]map[uuid.UUID]*Conn{}}
}

func (h *Hub) Add(c *Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.conns[c.User] == nil {
		h.conns[c.User] = map[uuid.UUID]*Conn{}
	}
	h.conns[c.User][c.Device] = c
}

func (h *Hub) Remove(user, device uuid.UUID) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if m, ok := h.conns[user]; ok {
		delete(m, device)
		if len(m) == 0 {
			delete(h.conns, user)
		}
	}
}

func (h *Hub) Online(user uuid.UUID) bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	return len(h.conns[user]) > 0
}

func (h *Hub) Relay(ctx context.Context, fromUser, fromDevice uuid.UUID, frame Frame) error {
	if frame.To == nil {
		return nil
	}
	uid, err := uuid.Parse(frame.To.User)
	if err != nil {
		return err
	}
	frame.From = &Target{User: fromUser.String(), Device: fromDevice.String()}
	raw, err := json.Marshal(frame)
	if err != nil {
		return err
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	targets := h.conns[uid]
	for id, c := range targets {
		if frame.To.Device != "" && id.String() != frame.To.Device {
			continue
		}
		_ = c.WS.Write(ctx, websocket.MessageText, raw)
	}
	if len(targets) == 0 {
		return errOffline
	}
	return nil
}

var errOffline = errString("offline")

type errString string

func (e errString) Error() string { return string(e) }

func IsOffline(err error) bool { return err == errOffline }

func (h *Hub) UserIDs() []string {
	h.mu.Lock()
	defer h.mu.Unlock()
	out := make([]string, 0, len(h.conns))
	for id := range h.conns {
		out = append(out, id.String())
	}
	return out
}

func (h *Hub) Broadcast(ctx context.Context, frame Frame, skip uuid.UUID) {
	raw, err := json.Marshal(frame)
	if err != nil {
		return
	}
	h.mu.Lock()
	list := make([]*Conn, 0)
	for uid, devices := range h.conns {
		if uid == skip {
			continue
		}
		for _, c := range devices {
			list = append(list, c)
		}
	}
	h.mu.Unlock()
	for _, c := range list {
		_ = c.WS.Write(ctx, websocket.MessageText, raw)
	}
}

func (h *Hub) Notify(ctx context.Context, user uuid.UUID, frame Frame) {
	raw, _ := json.Marshal(frame)
	h.mu.Lock()
	defer h.mu.Unlock()
	for _, c := range h.conns[user] {
		_ = c.WS.Write(ctx, websocket.MessageText, raw)
	}
}
