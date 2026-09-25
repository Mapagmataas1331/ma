package server

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/coder/websocket"
	"github.com/google/uuid"
	"github.com/mapagmataas1331/ma/services/api/internal/auth"
	"github.com/mapagmataas1331/ma/services/api/internal/config"
	"github.com/mapagmataas1331/ma/services/api/internal/httpx"
	"github.com/mapagmataas1331/ma/services/api/internal/quota"
	"github.com/mapagmataas1331/ma/services/api/internal/signaling"
	"github.com/mapagmataas1331/ma/services/api/internal/store"
	"github.com/mapagmataas1331/ma/services/api/internal/turn"
	"github.com/pquerna/otp/totp"
	"golang.org/x/crypto/chacha20poly1305"
)

type App struct {
	Cfg   config.Config
	DB    *store.Store
	Hub   *signaling.Hub
	kek   []byte
	mu    sync.Mutex
	chals map[string]challenge
	pairs map[string]pairSession
}

type challenge struct {
	UserID  uuid.UUID
	Device  store.Device
	Expires time.Time
}

type pairSession struct {
	UserID    uuid.UUID
	DeviceID  uuid.UUID
	Code      string
	Expires   time.Time
}

func New(cfg config.Config, db *store.Store) *App {
	kek, _ := base64.StdEncoding.DecodeString(cfg.ServerKEK)
	if len(kek) != chacha20poly1305.KeySize {
		kek = make([]byte, chacha20poly1305.KeySize)
	}
	return &App{Cfg: cfg, DB: db, Hub: signaling.New(), kek: kek, chals: map[string]challenge{}, pairs: map[string]pairSession{}}
}

func (a *App) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", a.health)
	mux.HandleFunc("GET /version", func(w http.ResponseWriter, r *http.Request) {
		httpx.WriteJSON(w, 200, map[string]string{"version": "0.1.0"})
	})
	mux.HandleFunc("POST /v1/auth/register", a.register)
	mux.HandleFunc("POST /v1/auth/login", a.login)
	mux.HandleFunc("POST /v1/auth/login/2fa", a.login2fa)
	mux.HandleFunc("POST /v1/auth/logout", a.logout)
	mux.HandleFunc("GET /v1/users/me", a.me)
	mux.HandleFunc("GET /v1/users/{username}", a.profile)
	mux.HandleFunc("GET /v1/account", a.account)
	mux.HandleFunc("POST /v1/invites", a.createInvite)
	mux.HandleFunc("PUT /v1/users/me/identity-keys", a.identity)
	mux.HandleFunc("GET /v1/devices", a.devices)
	mux.HandleFunc("POST /v1/devices/{id}/revoke", a.revokeDevice)
	mux.HandleFunc("POST /v1/devices/{id}/trust", a.trustDevice)
	mux.HandleFunc("POST /v1/devices/pairing", a.pairStart)
	mux.HandleFunc("POST /v1/devices/pairing/{id}/claim", a.pairClaim)
	mux.HandleFunc("GET /v1/contacts", a.contacts)
	mux.HandleFunc("POST /v1/contacts", a.addContact)
	mux.HandleFunc("POST /v1/contacts/{id}/accept", a.acceptContact)
	mux.HandleFunc("GET /v1/contacts/{id}/keys", a.contactKeys)
	mux.HandleFunc("GET /v1/conversations", a.conversations)
	mux.HandleFunc("POST /v1/conversations", a.createConversation)
	mux.HandleFunc("POST /v1/mailbox/messages", a.postMessage)
	mux.HandleFunc("GET /v1/mailbox/messages", a.getMessages)
	mux.HandleFunc("POST /v1/mailbox/messages/{id}/ack", a.ackMessage)
	mux.HandleFunc("POST /v1/mailbox/files", a.postFile)
	mux.HandleFunc("GET /v1/turn/credentials", a.turnCreds)
	mux.HandleFunc("POST /v1/auth/2fa/totp/setup", a.totpSetup)
	mux.HandleFunc("POST /v1/auth/2fa/totp/confirm", a.totpConfirm)
	mux.HandleFunc("GET /v1/push/vapid-public-key", a.vapid)
	mux.HandleFunc("POST /v1/push/subscriptions", a.pushSub)
	mux.HandleFunc("GET /v1/ws", a.ws)
	limits := quota.Limits{MaxFileBytes: a.Cfg.MaxFileBytes, MaxMessageBytes: a.Cfg.MaxMessageBytes, UserQuotaBytes: a.Cfg.UserQuotaBytes, GlobalQuotaBytes: a.Cfg.GlobalQuotaBytes, MinFreeBytes: a.Cfg.MinFreeBytes}
	_ = limits
	return httpx.Chain(mux, httpx.Recover, httpx.AccessLog, httpx.SecurityHeaders, func(h http.Handler) http.Handler { return httpx.CORS(a.Cfg.CORSOrigins, h) }, func(h http.Handler) http.Handler { return httpx.CSRF(a.Cfg.CORSOrigins, h) }, func(h http.Handler) http.Handler { return httpx.RateLimit(120, h) })
}

func (a *App) health(w http.ResponseWriter, r *http.Request) {
	err := a.DB.Pool.Ping(r.Context())
	ok := err == nil
	httpx.WriteJSON(w, 200, map[string]any{"ok": ok, "db": ok})
}

type principal struct {
	User   store.User
	Device *uuid.UUID
}

func (a *App) auth(w http.ResponseWriter, r *http.Request) (principal, bool) {
	token := httpx.SessionCookie(r, a.Cfg.DevInsecureHTTP)
	if token == "" {
		httpx.WriteError(w, 401, "unauthorized", "sign in")
		return principal{}, false
	}
	hash, err := httpx.HashToken(token)
	if err != nil {
		httpx.WriteError(w, 401, "unauthorized", "sign in")
		return principal{}, false
	}
	sess, err := a.DB.SessionByHash(r.Context(), hash)
	if err != nil || sess.Revoked != nil || time.Now().After(sess.Expires) {
		httpx.WriteError(w, 401, "unauthorized", "sign in")
		return principal{}, false
	}
	user, err := a.DB.UserByID(r.Context(), sess.UserID)
	if err != nil || user.Disabled != nil {
		httpx.WriteError(w, 401, "unauthorized", "sign in")
		return principal{}, false
	}
	return principal{User: user, Device: sess.DeviceID}, true
}

func (a *App) register(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Invite      string `json:"invite_code"`
		Username    string `json:"username"`
		Password    string `json:"password"`
		DisplayName string `json:"display_name"`
	}
	if err := httpx.ReadJSON(r, &body); err != nil {
		httpx.WriteError(w, 400, "bad_request", "invalid json")
		return
	}
	if err := auth.ValidatePassword(body.Password); err != nil {
		httpx.WriteError(w, 400, err.Error(), "choose a longer password")
		return
	}
	sum := sha256.Sum256([]byte(body.Invite))
	hash, err := auth.HashPassword(body.Password)
	if err != nil {
		httpx.WriteError(w, 500, "internal", "could not hash password")
		return
	}
	display := body.DisplayName
	if display == "" {
		display = body.Username
	}
	if err := a.DB.RegisterWithInvite(r.Context(), sum[:], body.Username, display, hash); err != nil {
		if err.Error() == "invite_invalid" {
			httpx.WriteError(w, 400, "invite_invalid", "invite is not valid")
			return
		}
		httpx.WriteError(w, 409, "username_taken", "username is taken")
		return
	}
	httpx.WriteJSON(w, 201, map[string]string{"status": "ok"})
}

func (a *App) login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
		Device   struct {
			Name     string `json:"name"`
			Platform string `json:"platform"`
			Ed       string `json:"pk_ed25519"`
			X        string `json:"pk_x25519"`
		} `json:"device"`
	}
	if err := httpx.ReadJSON(r, &body); err != nil {
		httpx.WriteError(w, 400, "bad_request", "invalid json")
		return
	}
	user, err := a.DB.UserByName(r.Context(), body.Username)
	if err != nil || !auth.VerifyPassword(user.Password, body.Password) || user.Disabled != nil {
		httpx.WriteError(w, 401, "invalid_credentials", "username or password is wrong")
		return
	}
	if body.Device.Ed == "" || body.Device.X == "" {
		if user.TOTP {
			id := uuid.NewString()
			a.mu.Lock()
			a.chals[id] = challenge{UserID: user.ID, Expires: time.Now().Add(5 * time.Minute)}
			a.mu.Unlock()
			httpx.WriteJSON(w, 200, map[string]string{"status": "2fa_required", "challenge_id": id})
			return
		}
		a.issue(w, r, user, store.Device{})
		return
	}
	ed, _ := base64.RawURLEncoding.DecodeString(body.Device.Ed)
	x, _ := base64.RawURLEncoding.DecodeString(body.Device.X)
	count, _ := a.DB.TrustedDeviceCount(r.Context(), user.ID)
	dev, err := a.DB.UpsertDevice(r.Context(), user.ID, body.Device.Name, body.Device.Platform, ed, x, count == 0)
	if err != nil {
		httpx.WriteError(w, 500, "internal", "device")
		return
	}
	if user.TOTP {
		id := uuid.NewString()
		a.mu.Lock()
		a.chals[id] = challenge{UserID: user.ID, Device: dev, Expires: time.Now().Add(5 * time.Minute)}
		a.mu.Unlock()
		httpx.WriteJSON(w, 200, map[string]string{"status": "2fa_required", "challenge_id": id})
		return
	}
	a.issue(w, r, user, dev)
}

func (a *App) login2fa(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Challenge string `json:"challenge_id"`
		Code      string `json:"code"`
	}
	if err := httpx.ReadJSON(r, &body); err != nil {
		httpx.WriteError(w, 400, "bad_request", "invalid json")
		return
	}
	a.mu.Lock()
	ch, ok := a.chals[body.Challenge]
	delete(a.chals, body.Challenge)
	a.mu.Unlock()
	if !ok || time.Now().After(ch.Expires) {
		httpx.WriteError(w, 401, "challenge_expired", "try again")
		return
	}
	user, err := a.DB.UserByID(r.Context(), ch.UserID)
	if err != nil {
		httpx.WriteError(w, 401, "unauthorized", "sign in")
		return
	}
	secret, err := a.loadTOTP(r.Context(), user.ID)
	if err != nil || !totp.Validate(body.Code, secret) {
		httpx.WriteError(w, 401, "invalid_code", "code is wrong")
		return
	}
	a.issue(w, r, user, ch.Device)
}

func (a *App) issue(w http.ResponseWriter, r *http.Request, user store.User, dev store.Device) {
	token, hash, err := httpx.RandomToken()
	if err != nil {
		httpx.WriteError(w, 500, "internal", "session")
		return
	}
	exp := time.Now().Add(a.Cfg.SessionIdle)
	var deviceID *uuid.UUID
	if dev.ID != uuid.Nil {
		deviceID = &dev.ID
	}
	if err := a.DB.CreateSession(r.Context(), hash, user.ID, deviceID, exp, httpx.ClientIP(r), r.UserAgent()); err != nil {
		httpx.WriteError(w, 500, "internal", "session")
		return
	}
	httpx.SetSessionCookie(w, token, a.Cfg.DevInsecureHTTP, int(a.Cfg.SessionIdle.Seconds()))
	httpx.WriteJSON(w, 200, map[string]any{
		"status": "ok",
		"user":   map[string]any{"id": user.ID, "username": user.Username, "display_name": user.DisplayName, "totp_enabled": user.TOTP},
		"device": map[string]any{"id": dev.ID, "trust_state": dev.Trust},
	})
}

func (a *App) logout(w http.ResponseWriter, r *http.Request) {
	token := httpx.SessionCookie(r, a.Cfg.DevInsecureHTTP)
	if hash, err := httpx.HashToken(token); err == nil {
		_ = a.DB.RevokeSessionHash(r.Context(), hash)
	}
	httpx.SetSessionCookie(w, "", a.Cfg.DevInsecureHTTP, -1)
	w.WriteHeader(204)
}

func (a *App) me(w http.ResponseWriter, r *http.Request) {
	p, ok := a.auth(w, r)
	if !ok {
		return
	}
	httpx.WriteJSON(w, 200, map[string]any{"id": p.User.ID, "username": p.User.Username, "display_name": p.User.DisplayName, "email": p.User.Email, "totp_enabled": p.User.TOTP})
}

func (a *App) profile(w http.ResponseWriter, r *http.Request) {
	if _, ok := a.auth(w, r); !ok {
		return
	}
	item, err := a.DB.ProfileByName(r.Context(), r.PathValue("username"))
	if err != nil {
		httpx.WriteError(w, 404, "not_found", "user not found")
		return
	}
	if item.Badges == nil {
		item.Badges = []string{}
	}
	httpx.WriteJSON(w, 200, map[string]any{
		"username": item.Username, "display_name": item.DisplayName,
		"created_at": item.CreatedAt.Format(time.RFC3339), "invited": item.Invited, "badges": item.Badges,
	})
}

func (a *App) account(w http.ResponseWriter, r *http.Request) {
	p, ok := a.auth(w, r)
	if !ok {
		return
	}
	info, err := a.DB.AccountInvites(r.Context(), p.User.ID)
	if err != nil {
		httpx.WriteError(w, 500, "internal", "account")
		return
	}
	if info.Badges == nil {
		info.Badges = []string{}
	}
	people := make([]map[string]string, 0, len(info.People))
	for _, person := range info.People {
		people = append(people, map[string]string{"username": person.Username, "display_name": person.DisplayName, "created_at": person.CreatedAt.Format(time.RFC3339)})
	}
	httpx.WriteJSON(w, 200, map[string]any{
		"id": p.User.ID, "username": p.User.Username, "display_name": p.User.DisplayName,
		"invite_credits": info.Credits, "invited": info.Invited, "badges": info.Badges, "invitees": people,
	})
}

func (a *App) createInvite(w http.ResponseWriter, r *http.Request) {
	p, ok := a.auth(w, r)
	if !ok {
		return
	}
	raw := make([]byte, 18)
	if _, err := rand.Read(raw); err != nil {
		httpx.WriteError(w, 500, "internal", "invite")
		return
	}
	code := base64.RawURLEncoding.EncodeToString(raw)
	sum := sha256.Sum256([]byte(code))
	expires := time.Now().Add(7 * 24 * time.Hour)
	if err := a.DB.CreateUserInvite(r.Context(), p.User.ID, sum[:], expires); err != nil {
		if err.Error() == "no_invites" {
			httpx.WriteError(w, 403, "no_invites", "no invites left")
			return
		}
		httpx.WriteError(w, 500, "internal", "invite")
		return
	}
	httpx.WriteJSON(w, 201, map[string]any{"code": code, "expires_at": expires.Format(time.RFC3339)})
}

func (a *App) identity(w http.ResponseWriter, r *http.Request) {
	p, ok := a.auth(w, r)
	if !ok {
		return
	}
	var body struct {
		Ed string `json:"ed25519"`
		X  string `json:"x25519"`
	}
	if err := httpx.ReadJSON(r, &body); err != nil {
		httpx.WriteError(w, 400, "bad_request", "invalid json")
		return
	}
	ed, _ := base64.RawURLEncoding.DecodeString(body.Ed)
	x, _ := base64.RawURLEncoding.DecodeString(body.X)
	if err := a.DB.SetIdentity(r.Context(), p.User.ID, ed, x); err != nil {
		httpx.WriteError(w, 500, "internal", "keys")
		return
	}
	w.WriteHeader(204)
}

func (a *App) devices(w http.ResponseWriter, r *http.Request) {
	p, ok := a.auth(w, r)
	if !ok {
		return
	}
	list, err := a.DB.Devices(r.Context(), p.User.ID)
	if err != nil {
		httpx.WriteError(w, 500, "internal", "devices")
		return
	}
	out := []map[string]any{}
	for _, d := range list {
		current := p.Device != nil && *p.Device == d.ID
		out = append(out, map[string]any{"id": d.ID, "name": d.Name, "platform": d.Platform, "trust_state": d.Trust, "last_seen_at": d.LastSeen, "current": current})
	}
	httpx.WriteJSON(w, 200, out)
}

func (a *App) revokeDevice(w http.ResponseWriter, r *http.Request) {
	p, ok := a.auth(w, r)
	if !ok {
		return
	}
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		httpx.WriteError(w, 400, "bad_request", "id")
		return
	}
	_ = a.DB.RevokeDevice(r.Context(), id)
	a.Hub.Notify(r.Context(), p.User.ID, signaling.Frame{V: 1, T: "device.revoked", ID: uuid.NewString(), P: map[string]any{"id": id.String()}})
	w.WriteHeader(204)
}

func (a *App) trustDevice(w http.ResponseWriter, r *http.Request) {
	p, ok := a.auth(w, r)
	if !ok {
		return
	}
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil || p.Device == nil {
		httpx.WriteError(w, 400, "bad_request", "id")
		return
	}
	_ = a.DB.TrustDevice(r.Context(), id, *p.Device)
	w.WriteHeader(204)
}

func (a *App) pairStart(w http.ResponseWriter, r *http.Request) {
	p, ok := a.auth(w, r)
	if !ok {
		return
	}
	code := randomCode()
	id := uuid.NewString()
	dev := uuid.Nil
	if p.Device != nil {
		dev = *p.Device
	}
	a.mu.Lock()
	a.pairs[id] = pairSession{UserID: p.User.ID, DeviceID: dev, Code: code, Expires: time.Now().Add(2 * time.Minute)}
	a.mu.Unlock()
	httpx.WriteJSON(w, 201, map[string]string{"pairing_id": id, "code": code})
}

func (a *App) pairClaim(w http.ResponseWriter, r *http.Request) {
	p, ok := a.auth(w, r)
	if !ok {
		return
	}
	id := r.PathValue("id")
	a.mu.Lock()
	sess, exists := a.pairs[id]
	a.mu.Unlock()
	if !exists || sess.UserID != p.User.ID || time.Now().After(sess.Expires) {
		httpx.WriteError(w, 404, "not_found", "pairing expired")
		return
	}
	httpx.WriteJSON(w, 200, map[string]string{"status": "claimed"})
}

func (a *App) contacts(w http.ResponseWriter, r *http.Request) {
	p, ok := a.auth(w, r)
	if !ok {
		return
	}
	list, err := a.DB.Contacts(r.Context(), p.User.ID)
	if err != nil {
		httpx.WriteError(w, 500, "internal", "contacts")
		return
	}
	out := []map[string]any{}
	for _, c := range list {
		out = append(out, map[string]any{"id": c.ID, "username": c.Username, "display_name": c.DisplayName, "state": c.State})
	}
	httpx.WriteJSON(w, 200, out)
}

func (a *App) addContact(w http.ResponseWriter, r *http.Request) {
	p, ok := a.auth(w, r)
	if !ok {
		return
	}
	var body struct {
		Username string `json:"username"`
	}
	if err := httpx.ReadJSON(r, &body); err != nil {
		httpx.WriteError(w, 400, "bad_request", "invalid json")
		return
	}
	other, err := a.DB.UserByName(r.Context(), body.Username)
	if err != nil {
		httpx.WriteError(w, 404, "not_found", "user")
		return
	}
	_ = a.DB.AddContact(r.Context(), p.User.ID, other.ID)
	_ = a.DB.AddContact(r.Context(), other.ID, p.User.ID)
	_, _ = a.DB.Pool.Exec(r.Context(), `UPDATE contacts SET state='accepted' WHERE (owner_id=$1 AND contact_id=$2) OR (owner_id=$2 AND contact_id=$1)`, p.User.ID, other.ID)
	httpx.WriteJSON(w, 201, map[string]string{"status": "accepted"})
}

func (a *App) acceptContact(w http.ResponseWriter, r *http.Request) {
	p, ok := a.auth(w, r)
	if !ok {
		return
	}
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		httpx.WriteError(w, 400, "bad_request", "id")
		return
	}
	_ = a.DB.AcceptContact(r.Context(), p.User.ID, id)
	w.WriteHeader(204)
}

func (a *App) contactKeys(w http.ResponseWriter, r *http.Request) {
	_, ok := a.auth(w, r)
	if !ok {
		return
	}
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		httpx.WriteError(w, 400, "bad_request", "id")
		return
	}
	user, err := a.DB.UserByID(r.Context(), id)
	if err != nil || len(user.X25519) == 0 {
		httpx.WriteError(w, 404, "not_found", "keys")
		return
	}
	httpx.WriteJSON(w, 200, map[string]string{
		"ed25519": base64.RawURLEncoding.EncodeToString(user.Ed25519),
		"x25519":  base64.RawURLEncoding.EncodeToString(user.X25519),
	})
}

func (a *App) conversations(w http.ResponseWriter, r *http.Request) {
	p, ok := a.auth(w, r)
	if !ok {
		return
	}
	list, err := a.DB.Conversations(r.Context(), p.User.ID)
	if err != nil {
		httpx.WriteError(w, 500, "internal", "conversations")
		return
	}
	out := []map[string]any{}
	for _, c := range list {
		out = append(out, map[string]any{"id": c.ID, "peer_id": c.PeerID, "peer_name": c.Peer, "peer_username": c.Username})
	}
	httpx.WriteJSON(w, 200, out)
}

func (a *App) createConversation(w http.ResponseWriter, r *http.Request) {
	p, ok := a.auth(w, r)
	if !ok {
		return
	}
	var body struct {
		Kind string    `json:"kind"`
		User uuid.UUID `json:"user_id"`
	}
	if err := httpx.ReadJSON(r, &body); err != nil {
		httpx.WriteError(w, 400, "bad_request", "invalid json")
		return
	}
	conv, err := a.DB.DirectConversation(r.Context(), p.User.ID, body.User)
	if err != nil {
		httpx.WriteError(w, 500, "internal", "conversation")
		return
	}
	httpx.WriteJSON(w, 201, map[string]any{"id": conv.ID, "peer_id": conv.PeerID, "peer_name": conv.Peer})
}

func (a *App) postMessage(w http.ResponseWriter, r *http.Request) {
	p, ok := a.auth(w, r)
	if !ok {
		return
	}
	var body struct {
		Conversation uuid.UUID `json:"conversation_id"`
		Recipient    uuid.UUID `json:"recipient_user_id"`
		Message      uuid.UUID `json:"message_id"`
		Envelope     string    `json:"envelope"`
	}
	if err := httpx.ReadJSON(r, &body); err != nil {
		httpx.WriteError(w, 400, "bad_request", "invalid json")
		return
	}
	raw, err := base64.RawURLEncoding.DecodeString(body.Envelope)
	if err != nil || int64(len(raw)) > a.Cfg.MaxMessageBytes {
		httpx.WriteError(w, 400, "too_large", "message is too large")
		return
	}
	if err := a.DB.PutMessage(r.Context(), body.Conversation, p.User.ID, body.Recipient, body.Message, raw, time.Now().Add(a.Cfg.MessageTTL)); err != nil {
		httpx.WriteError(w, 500, "internal", "mailbox")
		return
	}
	a.Hub.Notify(r.Context(), body.Recipient, signaling.Frame{V: 1, T: "mailbox.new", ID: uuid.NewString(), P: map[string]any{"n": 1}})
	httpx.WriteJSON(w, 201, map[string]string{"status": "stored"})
}

func (a *App) getMessages(w http.ResponseWriter, r *http.Request) {
	p, ok := a.auth(w, r)
	if !ok {
		return
	}
	list, err := a.DB.Inbox(r.Context(), p.User.ID)
	if err != nil {
		httpx.WriteError(w, 500, "internal", "mailbox")
		return
	}
	out := []map[string]string{}
	for _, m := range list {
		out = append(out, map[string]string{"id": m.ID.String(), "envelope": base64.StdEncoding.EncodeToString(m.Envelope)})
	}
	httpx.WriteJSON(w, 200, out)
}

func (a *App) ackMessage(w http.ResponseWriter, r *http.Request) {
	p, ok := a.auth(w, r)
	if !ok {
		return
	}
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		httpx.WriteError(w, 400, "bad_request", "id")
		return
	}
	_ = a.DB.AckMessage(r.Context(), p.User.ID, id)
	w.WriteHeader(204)
}

func (a *App) postFile(w http.ResponseWriter, r *http.Request) {
	p, ok := a.auth(w, r)
	if !ok {
		return
	}
	if err := r.ParseMultipartForm(a.Cfg.MaxFileBytes + 1024); err != nil {
		httpx.WriteError(w, 400, "bad_request", "upload")
		return
	}
	file, hdr, err := r.FormFile("file")
	if err != nil {
		httpx.WriteError(w, 400, "bad_request", "file")
		return
	}
	defer file.Close()
	if hdr.Size > a.Cfg.MaxFileBytes {
		httpx.WriteError(w, 413, "too_large", "file is above the offline limit")
		return
	}
	userUsed, _ := a.DB.UserUsage(r.Context(), p.User.ID)
	globalUsed, _ := a.DB.GlobalUsage(r.Context())
	free := diskFree(a.Cfg.MailboxDir)
	lim := quota.Limits{MaxFileBytes: a.Cfg.MaxFileBytes, UserQuotaBytes: a.Cfg.UserQuotaBytes, GlobalQuotaBytes: a.Cfg.GlobalQuotaBytes, MinFreeBytes: a.Cfg.MinFreeBytes}
	if err := lim.CheckFile(hdr.Size, userUsed, globalUsed, free); err != nil {
		httpx.WriteError(w, 507, "quota_exceeded", err.Error())
		return
	}
	fileID, err := uuid.Parse(r.FormValue("file_id"))
	if err != nil {
		fileID = uuid.New()
	}
	conv, _ := uuid.Parse(r.FormValue("conversation_id"))
	rec, _ := uuid.Parse(r.FormValue("recipient_user_id"))
	env, _ := base64.RawURLEncoding.DecodeString(r.FormValue("envelope"))
	dir := filepath.Join(a.Cfg.MailboxDir, time.Now().Format("2006"), time.Now().Format("01"))
	_ = os.MkdirAll(dir, 0o750)
	path := filepath.Join(dir, fileID.String())
	out, err := os.Create(path)
	if err != nil {
		httpx.WriteError(w, 500, "internal", "disk")
		return
	}
	h := sha256.New()
	n, err := io.Copy(io.MultiWriter(out, h), file)
	_ = out.Close()
	if err != nil {
		httpx.WriteError(w, 500, "internal", "disk")
		return
	}
	if err := a.DB.PutFile(r.Context(), conv, p.User.ID, rec, fileID, env, n, h.Sum(nil), path, time.Now().Add(a.Cfg.FileTTL)); err != nil {
		httpx.WriteError(w, 500, "internal", "mailbox")
		return
	}
	a.Hub.Notify(r.Context(), rec, signaling.Frame{V: 1, T: "mailbox.new", ID: uuid.NewString(), P: map[string]any{"n": 1}})
	httpx.WriteJSON(w, 201, map[string]string{"status": "stored", "sha256": hex.EncodeToString(h.Sum(nil))})
}

func (a *App) turnCreds(w http.ResponseWriter, r *http.Request) {
	p, ok := a.auth(w, r)
	if !ok {
		return
	}
	user, cred, _ := turn.Credentials(a.Cfg.TurnSecret, p.User.ID.String(), a.Cfg.TurnURLs, 12*time.Hour)
	httpx.WriteJSON(w, 200, map[string]any{"urls": turn.URLsOrDefault(a.Cfg.TurnURLs), "username": user, "credential": cred})
}

func (a *App) totpSetup(w http.ResponseWriter, r *http.Request) {
	p, ok := a.auth(w, r)
	if !ok {
		return
	}
	key, err := totp.Generate(totp.GenerateOpts{Issuer: "ma.cyou", AccountName: p.User.Username})
	if err != nil {
		httpx.WriteError(w, 500, "internal", "totp")
		return
	}
	nonce, ct, err := a.seal([]byte(key.Secret()))
	if err != nil {
		httpx.WriteError(w, 500, "internal", "totp")
		return
	}
	_, err = a.DB.Pool.Exec(r.Context(), `INSERT INTO totp_credentials (user_id, secret_ciphertext, nonce) VALUES ($1,$2,$3)
		ON CONFLICT (user_id) DO UPDATE SET secret_ciphertext=EXCLUDED.secret_ciphertext, nonce=EXCLUDED.nonce, confirmed_at=NULL`, p.User.ID, ct, nonce)
	if err != nil {
		httpx.WriteError(w, 500, "internal", "totp")
		return
	}
	httpx.WriteJSON(w, 200, map[string]string{"otpauth_url": key.URL(), "secret": key.Secret()})
}

func (a *App) totpConfirm(w http.ResponseWriter, r *http.Request) {
	p, ok := a.auth(w, r)
	if !ok {
		return
	}
	var body struct {
		Code string `json:"code"`
	}
	_ = httpx.ReadJSON(r, &body)
	secret, err := a.loadTOTP(r.Context(), p.User.ID)
	if err != nil || !totp.Validate(body.Code, secret) {
		httpx.WriteError(w, 400, "invalid_code", "code is wrong")
		return
	}
	_, _ = a.DB.Pool.Exec(r.Context(), `UPDATE totp_credentials SET confirmed_at=now() WHERE user_id=$1`, p.User.ID)
	codes := []string{}
	for i := 0; i < 10; i++ {
		raw := randomCode() + randomCode()
		sum := sha256.Sum256([]byte(raw))
		_, _ = a.DB.Pool.Exec(r.Context(), `INSERT INTO recovery_codes (user_id, code_hash) VALUES ($1,$2)`, p.User.ID, sum[:])
		codes = append(codes, raw)
	}
	httpx.WriteJSON(w, 200, map[string]any{"recovery_codes": codes})
}

func (a *App) vapid(w http.ResponseWriter, r *http.Request) {
	httpx.WriteJSON(w, 200, map[string]string{"public_key": a.Cfg.VAPIDPublic})
}

func (a *App) pushSub(w http.ResponseWriter, r *http.Request) {
	p, ok := a.auth(w, r)
	if !ok {
		return
	}
	var body struct {
		Endpoint string `json:"endpoint"`
		P256dh   string `json:"p256dh"`
		Auth     string `json:"auth"`
	}
	if err := httpx.ReadJSON(r, &body); err != nil {
		httpx.WriteError(w, 400, "bad_request", "invalid json")
		return
	}
	_, err := a.DB.Pool.Exec(r.Context(), `INSERT INTO push_subscriptions (user_id, device_id, endpoint, p256dh, auth) VALUES ($1,$2,$3,$4,$5)
		ON CONFLICT (endpoint) DO UPDATE SET p256dh=EXCLUDED.p256dh, auth=EXCLUDED.auth`, p.User.ID, p.Device, body.Endpoint, body.P256dh, body.Auth)
	if err != nil {
		httpx.WriteError(w, 500, "internal", "push")
		return
	}
	w.WriteHeader(204)
}

func (a *App) ws(w http.ResponseWriter, r *http.Request) {
	origin := r.Header.Get("Origin")
	if origin != "" && !httpx.OriginAllowed(origin, a.Cfg.CORSOrigins) {
		httpx.WriteError(w, 403, "csrf", "origin")
		return
	}
	p, ok := a.auth(w, r)
	if !ok {
		return
	}
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{OriginPatterns: []string{"*"}})
	if err != nil {
		return
	}
	dev := uuid.Nil
	if p.Device != nil {
		dev = *p.Device
	}
	c := &signaling.Conn{User: p.User.ID, Device: dev, WS: conn}
	a.Hub.Add(c)
	defer func() {
		a.Hub.Remove(p.User.ID, dev)
		if !a.Hub.Online(p.User.ID) {
			a.Hub.Broadcast(context.Background(), signaling.Frame{V: 1, T: "presence.update", ID: uuid.NewString(), P: map[string]any{"user": p.User.ID.String(), "online": false}}, uuid.Nil)
		}
		_ = conn.Close(websocket.StatusNormalClosure, "bye")
	}()
	others := []string{}
	for _, id := range a.Hub.UserIDs() {
		if id != p.User.ID.String() {
			others = append(others, id)
		}
	}
	snap, _ := json.Marshal(signaling.Frame{V: 1, T: "presence.snapshot", ID: uuid.NewString(), P: map[string]any{"users": others}})
	_ = conn.Write(r.Context(), websocket.MessageText, snap)
	a.Hub.Broadcast(r.Context(), signaling.Frame{V: 1, T: "presence.update", ID: uuid.NewString(), P: map[string]any{"user": p.User.ID.String(), "online": true}}, p.User.ID)
	for {
		_, data, err := conn.Read(r.Context())
		if err != nil {
			return
		}
		var frame signaling.Frame
		if err := jsonUnmarshal(data, &frame); err != nil {
			continue
		}
		if err := a.Hub.Relay(r.Context(), p.User.ID, dev, frame); err != nil && signaling.IsOffline(err) {
			_ = conn.Write(r.Context(), websocket.MessageText, []byte(`{"v":1,"t":"error","id":"`+frame.ID+`","p":{"code":"offline"}}`))
		}
	}
}

func (a *App) seal(plain []byte) (nonce, ct []byte, err error) {
	ae, err := chacha20poly1305.NewX(a.kek)
	if err != nil {
		return nil, nil, err
	}
	nonce = make([]byte, ae.NonceSize())
	if _, err = rand.Read(nonce); err != nil {
		return nil, nil, err
	}
	return nonce, ae.Seal(nil, nonce, plain, nil), nil
}

func (a *App) loadTOTP(ctx context.Context, user uuid.UUID) (string, error) {
	var ct, nonce []byte
	if err := a.DB.Pool.QueryRow(ctx, `SELECT secret_ciphertext, nonce FROM totp_credentials WHERE user_id=$1`, user).Scan(&ct, &nonce); err != nil {
		return "", err
	}
	ae, err := chacha20poly1305.NewX(a.kek)
	if err != nil {
		return "", err
	}
	plain, err := ae.Open(nil, nonce, ct, nil)
	if err != nil {
		return "", err
	}
	return string(plain), nil
}

func (a *App) CleanupLoop(ctx context.Context) {
	t := time.NewTicker(10 * time.Minute)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			_ = a.DB.Cleanup(ctx)
		}
	}
}

func randomCode() string {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	out := make([]byte, 8)
	for i := range out {
		out[i] = alphabet[int(b[i])%len(alphabet)]
	}
	return string(out)
}

func diskFree(path string) uint64 {
	_ = path
	return 1 << 40
}

func jsonUnmarshal(b []byte, v any) error {
	return jsonDecode(b, v)
}

func jsonDecode(b []byte, v any) error {
	return decodeJSON(b, v)
}
