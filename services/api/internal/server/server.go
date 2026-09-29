package server

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/coder/websocket"
	"github.com/google/uuid"
	"github.com/mapagmataas1331/ma/services/api/internal/auth"
	"github.com/mapagmataas1331/ma/services/api/internal/authz"
	"github.com/mapagmataas1331/ma/services/api/internal/config"
	"github.com/mapagmataas1331/ma/services/api/internal/httpx"
	"github.com/mapagmataas1331/ma/services/api/internal/quota"
	"github.com/mapagmataas1331/ma/services/api/internal/signaling"
	"github.com/mapagmataas1331/ma/services/api/internal/store"
	"github.com/mapagmataas1331/ma/services/api/internal/turn"
	"github.com/pquerna/otp/totp"
	"golang.org/x/crypto/chacha20poly1305"
	"golang.org/x/time/rate"
)

type App struct {
	Cfg    config.Config
	DB     *store.Store
	Hub    *signaling.Hub
	kek    []byte
	mu     sync.Mutex
	chals  map[string]challenge
	pairs  map[string]pairSession
	limits map[string]*rate.Limiter
}

type challenge struct {
	UserID  uuid.UUID
	Device  store.Device
	Expires time.Time
}

type pairSession struct {
	UserID       uuid.UUID
	SourceDevice uuid.UUID
	TargetDevice uuid.UUID
	Code         string
	State        string
	Expires      time.Time
}

func New(cfg config.Config, db *store.Store) *App {
	kek, err := base64.StdEncoding.DecodeString(cfg.ServerKEK)
	if err != nil || len(kek) != chacha20poly1305.KeySize {
		kek = make([]byte, chacha20poly1305.KeySize)
		if _, err = rand.Read(kek); err != nil {
			panic(err)
		}
	}
	return &App{Cfg: cfg, DB: db, Hub: signaling.New(), kek: kek, chals: map[string]challenge{}, pairs: map[string]pairSession{}, limits: map[string]*rate.Limiter{}}
}

func (a *App) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", a.health)
	mux.HandleFunc("GET /version", func(w http.ResponseWriter, r *http.Request) {
		httpx.WriteJSON(w, 200, map[string]string{"version": "0.1.0"})
	})
	mux.HandleFunc("GET /v1/capabilities", a.capabilities)
	mux.HandleFunc("POST /v1/auth/register", a.register)
	mux.HandleFunc("POST /v1/auth/login", a.login)
	mux.HandleFunc("POST /v1/auth/login/2fa", a.login2fa)
	mux.HandleFunc("POST /v1/auth/logout", a.logout)
	mux.HandleFunc("GET /v1/users/me", a.me)
	mux.HandleFunc("PATCH /v1/users/me", a.patchMe)
	mux.HandleFunc("GET /v1/users/{username}", a.profile)
	mux.HandleFunc("GET /v1/account", a.account)
	mux.HandleFunc("POST /v1/invites", a.createInvite)
	mux.HandleFunc("DELETE /v1/invites/{id}", a.revokeInvite)
	mux.HandleFunc("PUT /v1/users/me/identity-keys", a.identity)
	mux.HandleFunc("GET /v1/devices", a.devices)
	mux.HandleFunc("POST /v1/devices/{id}/revoke", a.revokeDevice)
	mux.HandleFunc("POST /v1/devices/{id}/trust", a.trustDevice)
	mux.HandleFunc("POST /v1/devices/fresh", a.startFresh)
	mux.HandleFunc("POST /v1/devices/pairing", a.pairStart)
	mux.HandleFunc("GET /v1/devices/pairing/{id}", a.pairStatus)
	mux.HandleFunc("POST /v1/devices/pairing/{id}/claim", a.pairClaim)
	mux.HandleFunc("POST /v1/devices/pairing/{id}/confirm", a.pairConfirm)
	mux.HandleFunc("POST /v1/devices/pairing/{id}/complete", a.pairComplete)
	mux.HandleFunc("POST /v1/devices/pairing/{id}/cancel", a.pairCancel)
	mux.HandleFunc("GET /v1/contacts", a.contacts)
	mux.HandleFunc("POST /v1/contacts", a.addContact)
	mux.HandleFunc("POST /v1/contacts/{id}/accept", a.acceptContact)
	mux.HandleFunc("POST /v1/contacts/{id}/block", a.blockContact)
	mux.HandleFunc("DELETE /v1/contacts/{id}/block", a.unblockContact)
	mux.HandleFunc("GET /v1/contacts/{id}/keys", a.contactKeys)
	mux.HandleFunc("GET /v1/contacts/{id}/devices", a.contactDevices)
	mux.HandleFunc("GET /v1/conversations", a.conversations)
	mux.HandleFunc("POST /v1/conversations", a.createConversation)
	mux.HandleFunc("GET /v1/conversations/{id}", a.conversation)
	mux.HandleFunc("PATCH /v1/conversations/{id}", a.renameConversation)
	mux.HandleFunc("DELETE /v1/conversations/{id}", a.deleteConversation)
	mux.HandleFunc("POST /v1/conversations/{id}/members", a.addMember)
	mux.HandleFunc("DELETE /v1/conversations/{id}/members/{userId}", a.removeMember)
	mux.HandleFunc("POST /v1/conversations/{id}/leave", a.leaveConversation)
	mux.HandleFunc("POST /v1/conversations/{id}/transfer", a.transferOwnership)
	mux.HandleFunc("POST /v1/mailbox/messages", a.postMessage)
	mux.HandleFunc("GET /v1/mailbox/messages", a.getMessages)
	mux.HandleFunc("POST /v1/mailbox/messages/{id}/ack", a.ackMessage)
	mux.HandleFunc("POST /v1/mailbox/files", a.postFile)
	mux.HandleFunc("GET /v1/mailbox/files", a.getFiles)
	mux.HandleFunc("GET /v1/mailbox/files/{id}", a.downloadFile)
	mux.HandleFunc("POST /v1/mailbox/files/{id}/ack", a.ackFile)
	mux.HandleFunc("POST /v1/mailbox/files/{id}/recipients", a.linkFileRecipient)
	mux.HandleFunc("GET /v1/mailbox/cloud", a.cloudFiles)
	mux.HandleFunc("DELETE /v1/mailbox/cloud/{id}", a.deleteCloudFile)
	mux.HandleFunc("GET /v1/turn/credentials", a.turnCreds)
	mux.HandleFunc("POST /v1/auth/2fa/totp/setup", a.totpSetup)
	mux.HandleFunc("POST /v1/auth/2fa/totp/confirm", a.totpConfirm)
	mux.HandleFunc("GET /v1/push/vapid-public-key", a.vapid)
	mux.HandleFunc("POST /v1/push/subscriptions", a.pushSub)
	mux.HandleFunc("GET /v1/ws", a.ws)
	limits := quota.Limits{MaxFileBytes: a.Cfg.MaxFileBytes, MaxMessageBytes: a.Cfg.MaxMessageBytes, UserQuotaBytes: a.Cfg.UserQuotaBytes, GlobalQuotaBytes: a.Cfg.GlobalQuotaBytes, MinFreeBytes: a.Cfg.MinFreeBytes}
	_ = limits.CheckMessage(0)
	return httpx.Chain(mux, httpx.Recover, httpx.AccessLog, httpx.SecurityHeaders, func(h http.Handler) http.Handler { return httpx.CORS(a.Cfg.CORSOrigins, a.Cfg.DevInsecureHTTP, h) }, func(h http.Handler) http.Handler { return httpx.CSRF(a.Cfg.CORSOrigins, a.Cfg.DevInsecureHTTP, h) }, func(h http.Handler) http.Handler { return httpx.RateLimit(120, h) })
}

func (a *App) health(w http.ResponseWriter, r *http.Request) {
	err := a.DB.Pool.Ping(r.Context())
	ok := err == nil
	status := 200
	if !ok {
		status = http.StatusServiceUnavailable
	}
	httpx.WriteJSON(w, status, map[string]any{"ok": ok, "db": ok})
}

func (a *App) capabilities(w http.ResponseWriter, r *http.Request) {
	httpx.WriteJSON(w, 200, map[string]any{
		"max_file_bytes":      a.Cfg.MaxFileBytes,
		"max_message_bytes":   a.Cfg.MaxMessageBytes,
		"user_quota_bytes":    a.Cfg.UserQuotaBytes,
		"global_quota_bytes":  a.Cfg.GlobalQuotaBytes,
		"min_free_bytes":      a.Cfg.MinFreeBytes,
		"file_ttl_seconds":    int(a.Cfg.FileTTL.Seconds()),
		"message_ttl_seconds": int(a.Cfg.MessageTTL.Seconds()),
		"attachments":         "ciphertext",
		"max_group_members":   store.MaxGroupMembers,
	})
}

type principal struct {
	User      store.User
	Device    *uuid.UUID
	Trust     string
	SessionID uuid.UUID
	Created   time.Time
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
	if err != nil || sess.Revoked != nil || time.Now().After(sess.Expires) || time.Now().After(sess.Created.Add(a.Cfg.SessionAbsolute)) {
		httpx.WriteError(w, 401, "unauthorized", "sign in")
		return principal{}, false
	}
	user, err := a.DB.UserByID(r.Context(), sess.UserID)
	if err != nil || user.Disabled != nil {
		httpx.WriteError(w, 401, "unauthorized", "sign in")
		return principal{}, false
	}
	trust := ""
	if sess.DeviceID != nil {
		dev, err := a.DB.DeviceOwned(r.Context(), user.ID, *sess.DeviceID)
		if err != nil {
			httpx.WriteError(w, 401, "unauthorized", "sign in")
			return principal{}, false
		}
		trust = dev.Trust
	}
	if time.Since(sess.LastSeen) > 5*time.Minute {
		next := time.Now().Add(a.Cfg.SessionIdle)
		absolute := sess.Created.Add(a.Cfg.SessionAbsolute)
		if next.After(absolute) {
			next = absolute
		}
		_ = a.DB.TouchSession(r.Context(), sess.ID, next)
	}
	return principal{User: user, Device: sess.DeviceID, Trust: trust, SessionID: sess.ID, Created: sess.Created}, true
}

func (a *App) requireChat(w http.ResponseWriter, r *http.Request) (principal, bool) {
	p, ok := a.auth(w, r)
	if !ok {
		return p, false
	}
	if err := authz.AllowChat(authz.DeviceAccess{HasDevice: p.Device != nil, Trust: p.Trust}); err != nil {
		httpx.WriteError(w, 403, "device_untrusted", "this device is not trusted")
		return p, false
	}
	return p, true
}

func (a *App) allowKeyed(key string, perMinute int) bool {
	a.mu.Lock()
	defer a.mu.Unlock()
	lim := a.limits[key]
	if lim == nil {
		lim = rate.NewLimiter(rate.Every(time.Minute/time.Duration(perMinute)), perMinute)
		a.limits[key] = lim
	}
	return lim.Allow()
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
	if !a.allowKeyed("register:"+httpx.ClientIP(r), 3) {
		httpx.WriteError(w, 429, "rate_limited", "too many requests")
		return
	}
	username, err := auth.CanonicalUsername(body.Username)
	if err != nil {
		httpx.WriteError(w, 400, "username_invalid", "username must be 3-12 letters, numbers, or underscores")
		return
	}
	display := strings.TrimSpace(body.DisplayName)
	if display == "" {
		display = username
	}
	display, err = auth.CanonicalDisplayName(display)
	if err != nil {
		httpx.WriteError(w, 400, "display_name_invalid", "display name must be 1-32 characters")
		return
	}
	if err := auth.ValidatePassword(body.Password); err != nil {
		httpx.WriteError(w, 400, err.Error(), "choose a longer password")
		return
	}
	if err := a.ensureSpace(r.Context(), 0.10); err != nil {
		httpx.WriteError(w, 507, "server_overloaded", "Server is overloaded now, try again in a bit")
		return
	}
	sum := sha256.Sum256([]byte(body.Invite))
	hash, err := auth.HashPassword(body.Password)
	if err != nil {
		httpx.WriteError(w, 500, "internal", "could not hash password")
		return
	}
	if err := a.DB.RegisterWithInvite(r.Context(), sum[:], username, display, hash); err != nil {
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
	if !a.allowKeyed("login:"+httpx.ClientIP(r)+":"+strings.ToLower(body.Username), 5) {
		httpx.WriteError(w, 429, "rate_limited", "too many requests")
		return
	}
	user, err := a.DB.UserByName(r.Context(), body.Username)
	if err != nil || !auth.VerifyPassword(user.Password, body.Password) || user.Disabled != nil {
		httpx.WriteError(w, 401, "invalid_credentials", "username or password is wrong")
		a.event(r, nil, "login_failed")
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
	if err := auth.ValidateDeviceName(body.Device.Name); err != nil {
		body.Device.Name = "browser"
	}
	ed, err := decodePublicKey(body.Device.Ed)
	if err != nil {
		httpx.WriteError(w, 400, "bad_request", "device key")
		return
	}
	x, err := decodePublicKey(body.Device.X)
	if err != nil {
		httpx.WriteError(w, 400, "bad_request", "device key")
		return
	}
	count, _ := a.DB.TrustedDeviceCount(r.Context(), user.ID)
	dev, err := a.DB.UpsertDevice(r.Context(), user.ID, body.Device.Name, body.Device.Platform, ed, x, count == 0)
	if err != nil {
		httpx.WriteError(w, 500, "internal", "device")
		return
	}
	if dev.Trust == "revoked" {
		httpx.WriteError(w, 403, "device_revoked", "this device was revoked")
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
	a.event(r, &user.ID, "login")
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
	deviceID := ""
	if p.Device != nil {
		deviceID = p.Device.String()
	}
	httpx.WriteJSON(w, 200, map[string]any{"id": p.User.ID, "username": p.User.Username, "display_name": p.User.DisplayName, "email": p.User.Email, "totp_enabled": p.User.TOTP, "device_id": deviceID, "trust_state": p.Trust})
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
	open, _ := a.DB.OpenInvites(r.Context(), p.User.ID)
	codes := []map[string]string{}
	for _, item := range open {
		codes = append(codes, map[string]string{"id": item.ID.String(), "expires_at": item.ExpiresAt.Format(time.RFC3339), "created_at": item.CreatedAt.Format(time.RFC3339)})
	}
	httpx.WriteJSON(w, 200, map[string]any{
		"id": p.User.ID, "username": p.User.Username, "display_name": p.User.DisplayName,
		"invite_credits": info.Credits, "invited": info.Invited, "badges": info.Badges, "invitees": people, "open_invites": codes,
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

func (a *App) revokeInvite(w http.ResponseWriter, r *http.Request) {
	p, ok := a.auth(w, r)
	if !ok {
		return
	}
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		httpx.WriteError(w, 400, "bad_request", "id")
		return
	}
	if err := a.DB.RevokeInvite(r.Context(), p.User.ID, id); err != nil {
		httpx.WriteError(w, 404, "not_found", "invite was already used")
		return
	}
	w.WriteHeader(204)
}

func (a *App) identity(w http.ResponseWriter, r *http.Request) {
	p, ok := a.requireChat(w, r)
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
	ed, err := decodePublicKey(body.Ed)
	if err != nil {
		httpx.WriteError(w, 400, "bad_request", "key")
		return
	}
	x, err := decodePublicKey(body.X)
	if err != nil {
		httpx.WriteError(w, 400, "bad_request", "key")
		return
	}
	if len(p.User.Ed25519) > 0 && !bytesEqual(p.User.Ed25519, ed) {
		a.event(r, &p.User.ID, "identity_changed")
	}
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
		out = append(out, map[string]any{"id": d.ID, "name": d.Name, "platform": d.Platform, "trust_state": d.Trust, "last_seen_at": d.LastSeen, "current": current, "x25519": base64.RawURLEncoding.EncodeToString(d.X)})
	}
	httpx.WriteJSON(w, 200, out)
}

func (a *App) revokeDevice(w http.ResponseWriter, r *http.Request) {
	p, ok := a.auth(w, r)
	if !ok {
		return
	}
	if p.Trust != "trusted" || p.Device == nil {
		httpx.WriteError(w, 403, "device_untrusted", "this device is not trusted")
		return
	}
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		httpx.WriteError(w, 400, "bad_request", "id")
		return
	}
	var body struct {
		ConfirmLast bool `json:"confirm_last"`
	}
	_ = httpx.ReadJSON(r, &body)
	if err := a.DB.RevokeOwnedDevice(r.Context(), p.User.ID, id, body.ConfirmLast); err != nil {
		if errors.Is(err, store.ErrLastTrusted) {
			httpx.WriteError(w, 409, "last_trusted_device", "confirm revoking the only trusted device")
			return
		}
		httpx.WriteError(w, 404, "not_found", "device")
		return
	}
	a.Hub.Close(p.User.ID, id)
	a.event(r, &p.User.ID, "device_revoked")
	a.Hub.Notify(r.Context(), p.User.ID, signaling.Frame{V: 1, T: "device.revoked", ID: uuid.NewString(), P: map[string]any{"id": id.String()}})
	w.WriteHeader(204)
}

func (a *App) startFresh(w http.ResponseWriter, r *http.Request) {
	p, ok := a.auth(w, r)
	if !ok {
		return
	}
	if p.Device == nil {
		httpx.WriteError(w, 403, "device_untrusted", "this device is not trusted")
		return
	}
	if p.Trust == "trusted" {
		w.WriteHeader(204)
		return
	}
	if p.Trust != "pending" {
		httpx.WriteError(w, 403, "device_untrusted", "this device is not trusted")
		return
	}
	if err := a.DB.TrustSelf(r.Context(), p.User.ID, *p.Device); err != nil {
		httpx.WriteError(w, 404, "not_found", "device")
		return
	}
	a.event(r, &p.User.ID, "device_trusted")
	w.WriteHeader(204)
}

func (a *App) trustDevice(w http.ResponseWriter, r *http.Request) {
	p, ok := a.auth(w, r)
	if !ok {
		return
	}
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil || p.Device == nil || p.Trust != "trusted" {
		httpx.WriteError(w, 403, "device_untrusted", "this device is not trusted")
		return
	}
	if err := a.DB.TrustOwnedDevice(r.Context(), p.User.ID, id, *p.Device); err != nil {
		httpx.WriteError(w, 404, "not_found", "device")
		return
	}
	a.event(r, &p.User.ID, "device_trusted")
	a.Hub.Notify(r.Context(), p.User.ID, signaling.Frame{V: 1, T: "device.trusted", ID: uuid.NewString(), P: map[string]any{"id": id.String()}})
	w.WriteHeader(204)
}

func pairingCode() (string, error) {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	buf := make([]byte, 8)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	out := make([]byte, len(buf))
	for i, b := range buf {
		out[i] = alphabet[int(b)%len(alphabet)]
	}
	return string(out), nil
}

func pairFingerprint(id string, source, target uuid.UUID) string {
	sum := sha256.Sum256([]byte(id + "|" + source.String() + "|" + target.String()))
	return hex.EncodeToString(sum[:4])
}

func (a *App) pairStart(w http.ResponseWriter, r *http.Request) {
	p, ok := a.auth(w, r)
	if !ok {
		return
	}
	if p.Device == nil || p.Trust != "trusted" {
		httpx.WriteError(w, 403, "device_untrusted", "a trusted device must start transfer")
		return
	}
	code, err := pairingCode()
	if err != nil {
		httpx.WriteError(w, 500, "internal", "pairing")
		return
	}
	id := uuid.NewString()
	a.mu.Lock()
	a.pairs[id] = pairSession{UserID: p.User.ID, SourceDevice: *p.Device, Code: code, State: "created", Expires: time.Now().Add(10 * time.Minute)}
	a.mu.Unlock()
	httpx.WriteJSON(w, 201, map[string]string{"pairing_id": id, "code": code, "state": "created"})
}

func (a *App) loadPair(id string, user uuid.UUID) (pairSession, bool) {
	a.mu.Lock()
	defer a.mu.Unlock()
	sess, ok := a.pairs[id]
	if !ok || sess.UserID != user || time.Now().After(sess.Expires) || sess.State == "cancelled" || sess.State == "expired" {
		return pairSession{}, false
	}
	return sess, true
}

func (a *App) pairStatus(w http.ResponseWriter, r *http.Request) {
	p, ok := a.auth(w, r)
	if !ok {
		return
	}
	sess, ok := a.loadPair(r.PathValue("id"), p.User.ID)
	if !ok || p.Device == nil || (*p.Device != sess.SourceDevice && *p.Device != sess.TargetDevice) {
		httpx.WriteError(w, 404, "not_found", "pairing expired")
		return
	}
	out := map[string]string{"state": sess.State, "source_device_id": sess.SourceDevice.String()}
	if sess.TargetDevice != uuid.Nil {
		out["target_device_id"] = sess.TargetDevice.String()
		out["fingerprint"] = pairFingerprint(r.PathValue("id"), sess.SourceDevice, sess.TargetDevice)
		var x []byte
		_ = a.DB.Pool.QueryRow(r.Context(), `SELECT device_pk_x25519 FROM devices WHERE id=$1 AND user_id=$2`, sess.TargetDevice, p.User.ID).Scan(&x)
		if len(x) == 32 {
			out["target_x25519"] = base64.RawURLEncoding.EncodeToString(x)
		}
	}
	httpx.WriteJSON(w, 200, out)
}

func (a *App) pairClaim(w http.ResponseWriter, r *http.Request) {
	p, ok := a.auth(w, r)
	if !ok {
		return
	}
	var body struct {
		Code string `json:"code"`
	}
	if err := httpx.ReadJSON(r, &body); err != nil {
		httpx.WriteError(w, 400, "bad_request", "invalid json")
		return
	}
	id := r.PathValue("id")
	a.mu.Lock()
	sess, exists := a.pairs[id]
	if !exists || sess.UserID != p.User.ID || time.Now().After(sess.Expires) || sess.State != "created" || p.Device == nil || p.Trust != "pending" || *p.Device == sess.SourceDevice || subtle.ConstantTimeCompare([]byte(sess.Code), []byte(body.Code)) != 1 {
		a.mu.Unlock()
		httpx.WriteError(w, 404, "not_found", "pairing expired")
		return
	}
	sess.State = "claimed"
	sess.TargetDevice = *p.Device
	a.pairs[id] = sess
	a.mu.Unlock()
	httpx.WriteJSON(w, 200, map[string]string{
		"status": "claimed", "state": "claimed", "device_id": sess.SourceDevice.String(),
		"fingerprint": pairFingerprint(id, sess.SourceDevice, sess.TargetDevice),
	})
}

func (a *App) pairConfirm(w http.ResponseWriter, r *http.Request) {
	p, ok := a.auth(w, r)
	if !ok {
		return
	}
	id := r.PathValue("id")
	a.mu.Lock()
	sess, exists := a.pairs[id]
	if !exists || sess.UserID != p.User.ID || time.Now().After(sess.Expires) || sess.State != "claimed" || p.Device == nil || p.Trust != "trusted" || *p.Device != sess.SourceDevice {
		a.mu.Unlock()
		httpx.WriteError(w, 404, "not_found", "pairing expired")
		return
	}
	sess.State = "confirmed"
	a.pairs[id] = sess
	a.mu.Unlock()
	w.WriteHeader(204)
}

func (a *App) pairComplete(w http.ResponseWriter, r *http.Request) {
	p, ok := a.auth(w, r)
	if !ok {
		return
	}
	id := r.PathValue("id")
	a.mu.Lock()
	sess, exists := a.pairs[id]
	if !exists || sess.UserID != p.User.ID || time.Now().After(sess.Expires) || (sess.State != "confirmed" && sess.State != "transferring") || p.Device == nil || p.Trust != "trusted" || *p.Device != sess.SourceDevice || sess.TargetDevice == uuid.Nil {
		a.mu.Unlock()
		httpx.WriteError(w, 404, "not_found", "pairing expired")
		return
	}
	sess.State = "trusted"
	delete(a.pairs, id)
	a.mu.Unlock()
	if err := a.DB.TrustOwnedDevice(r.Context(), p.User.ID, sess.TargetDevice, sess.SourceDevice); err != nil {
		httpx.WriteError(w, 404, "not_found", "device")
		return
	}
	a.event(r, &p.User.ID, "device_trusted")
	w.WriteHeader(204)
}

func (a *App) pairCancel(w http.ResponseWriter, r *http.Request) {
	p, ok := a.auth(w, r)
	if !ok {
		return
	}
	id := r.PathValue("id")
	a.mu.Lock()
	sess, exists := a.pairs[id]
	if exists && sess.UserID == p.User.ID && p.Device != nil && (*p.Device == sess.SourceDevice || *p.Device == sess.TargetDevice) {
		sess.State = "cancelled"
		a.pairs[id] = sess
	}
	a.mu.Unlock()
	w.WriteHeader(204)
}

func (a *App) contacts(w http.ResponseWriter, r *http.Request) {
	p, ok := a.requireChat(w, r)
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
	p, ok := a.requireChat(w, r)
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
	a.touch(r.Context(), p.User.ID, "contacts.updated")
	a.touch(r.Context(), other.ID, "contacts.updated")
	httpx.WriteJSON(w, 201, map[string]string{"status": "accepted"})
}

func (a *App) acceptContact(w http.ResponseWriter, r *http.Request) {
	p, ok := a.requireChat(w, r)
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

func (a *App) blockContact(w http.ResponseWriter, r *http.Request) {
	p, ok := a.requireChat(w, r)
	if !ok {
		return
	}
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil || id == p.User.ID {
		httpx.WriteError(w, 400, "bad_request", "id")
		return
	}
	if err := a.DB.SetBlocked(r.Context(), p.User.ID, id, true); err != nil {
		httpx.WriteError(w, 500, "internal", "block")
		return
	}
	w.WriteHeader(204)
}

func (a *App) unblockContact(w http.ResponseWriter, r *http.Request) {
	p, ok := a.requireChat(w, r)
	if !ok {
		return
	}
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		httpx.WriteError(w, 400, "bad_request", "id")
		return
	}
	if err := a.DB.SetBlocked(r.Context(), p.User.ID, id, false); err != nil {
		httpx.WriteError(w, 500, "internal", "block")
		return
	}
	w.WriteHeader(204)
}

func (a *App) contactKeys(w http.ResponseWriter, r *http.Request) {
	p, ok := a.requireChat(w, r)
	if !ok {
		return
	}
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		httpx.WriteError(w, 400, "bad_request", "id")
		return
	}
	allowed, err := a.DB.CanReadIdentity(r.Context(), p.User.ID, id)
	if err != nil || !allowed {
		httpx.WriteError(w, 404, "not_found", "keys")
		return
	}
	user, err := a.DB.UserByID(r.Context(), id)
	if err != nil || len(user.X25519) != 32 {
		httpx.WriteError(w, 404, "not_found", "keys")
		return
	}
	httpx.WriteJSON(w, 200, map[string]string{
		"ed25519": base64.RawURLEncoding.EncodeToString(user.Ed25519),
		"x25519":  base64.RawURLEncoding.EncodeToString(user.X25519),
	})
}

func (a *App) conversations(w http.ResponseWriter, r *http.Request) {
	p, ok := a.requireChat(w, r)
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
		members, _ := a.DB.Members(r.Context(), c.ID, p.User.ID)
		out = append(out, conversationJSON(c, members))
	}
	httpx.WriteJSON(w, 200, out)
}

func (a *App) createConversation(w http.ResponseWriter, r *http.Request) {
	p, ok := a.requireChat(w, r)
	if !ok {
		return
	}
	var body struct {
		Kind    string      `json:"kind"`
		User    uuid.UUID   `json:"user_id"`
		Title   string      `json:"title"`
		Members []uuid.UUID `json:"member_ids"`
	}
	if err := httpx.ReadJSON(r, &body); err != nil {
		httpx.WriteError(w, 400, "bad_request", "invalid json")
		return
	}
	if body.Kind == "group" {
		if err := auth.ValidateGroupName(body.Title); err != nil {
			httpx.WriteError(w, 400, "group_name_invalid", "group name must be 1-64 characters")
			return
		}
		conv, err := a.DB.CreateGroup(r.Context(), p.User.ID, strings.TrimSpace(body.Title), body.Members)
		if err != nil {
			writeGroupError(w, err, "group")
			return
		}
		for _, member := range body.Members {
			a.touch(r.Context(), member, "conversations.updated")
		}
		// Return the member list right away so the creator can address the group without a second fetch.
		members, _ := a.DB.Members(r.Context(), conv.ID, p.User.ID)
		httpx.WriteJSON(w, 201, conversationJSON(conv, members))
		return
	}
	conv, err := a.DB.DirectConversation(r.Context(), p.User.ID, body.User)
	if err != nil {
		httpx.WriteError(w, 500, "internal", "conversation")
		return
	}
	a.touch(r.Context(), body.User, "conversations.updated")
	httpx.WriteJSON(w, 201, conversationJSON(conv, nil))
}

func (a *App) postMessage(w http.ResponseWriter, r *http.Request) {
	p, ok := a.requireChat(w, r)
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
	if err := a.ensureSpace(r.Context(), 0.20); err != nil {
		httpx.WriteError(w, 507, "server_overloaded", "Server is overloaded now, wait a bit or send it when the user is online")
		return
	}
	access, err := a.DB.AuthorizeDelivery(r.Context(), body.Conversation, p.User.ID, body.Recipient)
	if err != nil || authz.AllowDelivery(authz.DeliveryInput{Found: access.Found, SenderMember: access.SenderMember, RecipientMember: access.RecipientMember, DirectPeerMatches: access.DirectPeerMatches, Blocked: access.Blocked}) != nil {
		httpx.WriteError(w, 403, "forbidden", "conversation")
		return
	}
	raw, err := base64.RawURLEncoding.DecodeString(body.Envelope)
	if err != nil || (quota.Limits{MaxMessageBytes: a.Cfg.MaxMessageBytes}).CheckMessage(int64(len(raw))) != nil {
		httpx.WriteError(w, 400, "too_large", "message is too large")
		return
	}
	if err := a.DB.PutMessage(r.Context(), body.Conversation, p.User.ID, body.Recipient, body.Message, raw, time.Now().Add(a.Cfg.MessageTTL)); err != nil {
		httpx.WriteError(w, 500, "internal", "mailbox")
		return
	}
	a.Hub.Notify(r.Context(), body.Recipient, signaling.Frame{V: 1, T: "mailbox.new", ID: uuid.NewString(), P: map[string]any{"n": 1}})
	if !a.Hub.Online(body.Recipient) {
		a.pushMailbox(r.Context(), body.Recipient, 1)
	}
	httpx.WriteJSON(w, 201, map[string]string{"status": "stored"})
}

func (a *App) getMessages(w http.ResponseWriter, r *http.Request) {
	p, ok := a.requireChat(w, r)
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
	p, ok := a.requireChat(w, r)
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
	p, ok := a.requireChat(w, r)
	if !ok {
		return
	}
	if err := a.ensureSpace(r.Context(), 0.20); err != nil {
		httpx.WriteError(w, 507, "server_overloaded", "Server is overloaded now, wait a bit or send it when the user is online")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, a.Cfg.MaxFileBytes+1<<20)
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		httpx.WriteError(w, 413, "too_large", "file is above the offline limit")
		return
	}
	file, hdr, err := r.FormFile("file")
	if err != nil {
		httpx.WriteError(w, 400, "bad_request", "file")
		return
	}
	defer file.Close()
	sizeHint := hdr.Size
	if sizeHint < 0 {
		sizeHint = 0
	}
	if sizeHint > a.Cfg.MaxFileBytes {
		httpx.WriteError(w, 413, "too_large", "file is above the cloud limit")
		return
	}
	fileID, err := uuid.Parse(r.FormValue("file_id"))
	if err != nil {
		fileID = uuid.New()
	}
	conv, _ := uuid.Parse(r.FormValue("conversation_id"))
	recipients, okRec := a.cloudRecipients(w, r, p, conv)
	if !okRec {
		return
	}
	// Quota belongs to the sender and counts this blob once, not once per recipient.
	userUsed, _ := a.DB.UserUsage(r.Context(), p.User.ID)
	globalUsed, _ := a.DB.GlobalUsage(r.Context())
	free, _ := a.disk()
	lim := quota.Limits{MaxFileBytes: a.Cfg.MaxFileBytes, UserQuotaBytes: a.Cfg.UserQuotaBytes, GlobalQuotaBytes: a.Cfg.GlobalQuotaBytes, MinFreeBytes: a.Cfg.MinFreeBytes}
	if err := lim.CheckFile(sizeHint, userUsed, globalUsed, free); err != nil {
		if errors.Is(err, quota.ErrTooLarge) {
			httpx.WriteError(w, 413, "too_large", "file is above the cloud limit")
			return
		}
		if errors.Is(err, quota.ErrUser) {
			a.writeCloudQuota(w, r, p.User.ID)
			return
		}
		httpx.WriteError(w, 507, "server_overloaded", "Server is overloaded now, wait a bit or send it when the user is online")
		return
	}
	env, err := base64.RawURLEncoding.DecodeString(r.FormValue("envelope"))
	if err != nil || !strings.Contains(string(env), `"alg":"secretstream"`) {
		httpx.WriteError(w, 400, "plaintext_rejected", "files must be encrypted")
		return
	}
	dir := filepath.Join(a.Cfg.MailboxDir, time.Now().Format("2006"), time.Now().Format("01"))
	_ = os.MkdirAll(dir, 0o750)
	// A fresh name so a retry cannot truncate the blob already linked to recipients.
	path := filepath.Join(dir, fileID.String()+"-"+uuid.NewString())
	out, err := os.Create(path)
	if err != nil {
		httpx.WriteError(w, 500, "internal", "disk")
		return
	}
	h := sha256.New()
	n, err := io.Copy(io.MultiWriter(out, h), io.LimitReader(file, a.Cfg.MaxFileBytes+1))
	_ = out.Close()
	if n > a.Cfg.MaxFileBytes {
		_ = os.Remove(path)
		httpx.WriteError(w, 413, "too_large", "file is above the cloud limit")
		return
	}
	if err != nil {
		_ = os.Remove(path)
		httpx.WriteError(w, 500, "internal", "disk")
		return
	}
	stored, err := a.DB.PutBlob(r.Context(), conv, p.User.ID, fileID, env, n, h.Sum(nil), path, time.Now().Add(a.Cfg.FileTTL), recipients, a.Cfg.UserQuotaBytes, a.Cfg.GlobalQuotaBytes)
	if err != nil || !stored {
		_ = os.Remove(path)
		if errors.Is(err, store.ErrUserQuota) {
			a.writeCloudQuota(w, r, p.User.ID)
			return
		}
		if err != nil {
			httpx.WriteError(w, 507, "server_overloaded", "Server is overloaded now, wait a bit or send it when the user is online")
			return
		}
		for _, rec := range recipients {
			a.Hub.Notify(r.Context(), rec, signaling.Frame{V: 1, T: "mailbox.new", ID: uuid.NewString(), P: map[string]any{"n": 1}})
		}
		httpx.WriteJSON(w, 200, map[string]string{"status": "duplicate"})
		return
	}
	for _, rec := range recipients {
		a.Hub.Notify(r.Context(), rec, signaling.Frame{V: 1, T: "mailbox.new", ID: uuid.NewString(), P: map[string]any{"n": 1}})
		if !a.Hub.Online(rec) {
			a.pushMailbox(r.Context(), rec, 1)
		}
	}
	httpx.WriteJSON(w, 201, map[string]string{"status": "stored", "sha256": hex.EncodeToString(h.Sum(nil))})
}

func (a *App) cloudRecipients(w http.ResponseWriter, r *http.Request, p principal, conv uuid.UUID) ([]uuid.UUID, bool) {
	raw := []string{}
	if r.MultipartForm != nil {
		raw = r.MultipartForm.Value["recipient_user_id"]
	}
	if len(raw) == 0 && r.FormValue("recipient_user_id") != "" {
		raw = []string{r.FormValue("recipient_user_id")}
	}
	seen := map[uuid.UUID]struct{}{}
	var recipients []uuid.UUID
	for _, value := range raw {
		id, err := uuid.Parse(value)
		if err != nil || id == uuid.Nil {
			httpx.WriteError(w, 400, "bad_request", "recipient")
			return nil, false
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		access, err := a.DB.AuthorizeDelivery(r.Context(), conv, p.User.ID, id)
		if err != nil || authz.AllowDelivery(authz.DeliveryInput{Found: access.Found, SenderMember: access.SenderMember, RecipientMember: access.RecipientMember, DirectPeerMatches: access.DirectPeerMatches, Blocked: access.Blocked}) != nil {
			httpx.WriteError(w, 403, "forbidden", "conversation")
			return nil, false
		}
		recipients = append(recipients, id)
	}
	if len(recipients) == 0 {
		httpx.WriteError(w, 400, "bad_request", "recipient")
		return nil, false
	}
	return recipients, true
}

func (a *App) cloudFiles(w http.ResponseWriter, r *http.Request) {
	p, ok := a.requireChat(w, r)
	if !ok {
		return
	}
	used, files, err := a.cloudSnapshot(r.Context(), p.User.ID)
	if err != nil {
		httpx.WriteError(w, 500, "internal", "cloud")
		return
	}
	httpx.WriteJSON(w, 200, map[string]any{"used": used, "limit": a.Cfg.UserQuotaBytes, "files": files})
}

func (a *App) deleteCloudFile(w http.ResponseWriter, r *http.Request) {
	p, ok := a.requireChat(w, r)
	if !ok {
		return
	}
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		httpx.WriteError(w, 400, "bad_request", "id")
		return
	}
	path, recipients, err := a.DB.DeleteCloudFile(r.Context(), p.User.ID, id)
	if err != nil {
		httpx.WriteError(w, 404, "not_found", "file")
		return
	}
	if path != "" {
		_ = os.Remove(path)
	}
	for _, rec := range recipients {
		a.Hub.Notify(r.Context(), rec, signaling.Frame{V: 1, T: "chat.file.missing", ID: uuid.NewString(), P: map[string]any{"file_id": id.String()}})
	}
	w.WriteHeader(204)
}

func (a *App) writeCloudQuota(w http.ResponseWriter, r *http.Request, user uuid.UUID) {
	used, files, _ := a.cloudSnapshot(r.Context(), user)
	httpx.WriteJSON(w, 413, map[string]any{
		"code":    "quota_user",
		"message": "cloud storage is full",
		"details": map[string]any{"used": used, "limit": a.Cfg.UserQuotaBytes, "files": files},
	})
}

func (a *App) cloudSnapshot(ctx context.Context, user uuid.UUID) (int64, []map[string]any, error) {
	used, err := a.DB.UserUsage(ctx, user)
	if err != nil {
		return 0, nil, err
	}
	list, err := a.DB.CloudFiles(ctx, user)
	if err != nil {
		return 0, nil, err
	}
	files := make([]map[string]any, 0, len(list))
	for _, f := range list {
		name, _ := fileMeta(f.Envelope)
		files = append(files, map[string]any{
			"file_id":         f.FileID.String(),
			"conversation_id": f.Conversation.String(),
			"name":            name,
			"size":            f.Size,
			"recipients":      f.Recipients,
			"waiting":         f.Waiting,
			"expires_at":      f.Expires,
		})
	}
	return used, files, nil
}

func (a *App) getFiles(w http.ResponseWriter, r *http.Request) {
	p, ok := a.requireChat(w, r)
	if !ok {
		return
	}
	list, err := a.DB.InboxFiles(r.Context(), p.User.ID)
	if err != nil {
		httpx.WriteError(w, 500, "internal", "mailbox")
		return
	}
	out := []map[string]any{}
	for _, f := range list {
		name, mime := fileMeta(f.Envelope)
		out = append(out, map[string]any{"id": f.ID.String(), "conversation_id": f.Conversation.String(), "name": name, "mime": mime, "size": f.Size})
	}
	httpx.WriteJSON(w, 200, out)
}

func (a *App) downloadFile(w http.ResponseWriter, r *http.Request) {
	p, ok := a.requireChat(w, r)
	if !ok {
		return
	}
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		httpx.WriteError(w, 400, "bad_request", "id")
		return
	}
	f, err := a.DB.OpenFile(r.Context(), p.User.ID, id)
	if err != nil {
		httpx.WriteError(w, 404, "not_found", "This file is no longer on the server")
		return
	}
	body, err := os.Open(f.Path)
	if err != nil {
		httpx.WriteError(w, 404, "not_found", "This file is no longer on the server")
		return
	}
	defer body.Close()
	name, _ := fileMeta(f.Envelope)
	// The body is ciphertext; never let the browser sniff or render it, and quote the name safely.
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": name}))
	if info, err := body.Stat(); err == nil {
		w.Header().Set("Content-Length", strconv.FormatInt(info.Size(), 10))
	}
	w.WriteHeader(200)
	_, _ = io.Copy(w, body)
}

func (a *App) linkFileRecipient(w http.ResponseWriter, r *http.Request) {
	p, ok := a.requireChat(w, r)
	if !ok {
		return
	}
	fileID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		httpx.WriteError(w, 400, "bad_request", "id")
		return
	}
	var body struct {
		Recipient uuid.UUID `json:"recipient_user_id"`
	}
	if err := httpx.ReadJSON(r, &body); err != nil || body.Recipient == uuid.Nil {
		httpx.WriteError(w, 400, "bad_request", "recipient")
		return
	}
	err = a.DB.LinkRecipient(r.Context(), p.User.ID, fileID, body.Recipient)
	if errors.Is(err, store.ErrNotFound) {
		httpx.WriteError(w, 404, "not_found", "file")
		return
	}
	if errors.Is(err, store.ErrForbidden) {
		httpx.WriteError(w, 403, "forbidden", "conversation")
		return
	}
	if err != nil {
		httpx.WriteError(w, 500, "internal", "file")
		return
	}
	a.Hub.Notify(r.Context(), body.Recipient, signaling.Frame{V: 1, T: "mailbox.new", ID: uuid.NewString(), P: map[string]any{"n": 1}})
	w.WriteHeader(204)
}

func (a *App) ackFile(w http.ResponseWriter, r *http.Request) {
	p, ok := a.requireChat(w, r)
	if !ok {
		return
	}
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		httpx.WriteError(w, 400, "bad_request", "id")
		return
	}
	path, err := a.DB.AckFile(r.Context(), p.User.ID, id)
	if err == nil && path != "" {
		_ = os.Remove(path)
	}
	w.WriteHeader(204)
}

func (a *App) touch(ctx context.Context, user uuid.UUID, kind string) {
	a.Hub.Notify(ctx, user, signaling.Frame{V: 1, T: kind, ID: uuid.NewString(), P: map[string]any{}})
}

func fileMeta(envelope []byte) (string, string) {
	var meta struct {
		Name string `json:"name"`
		Mime string `json:"mime"`
	}
	_ = json.Unmarshal(envelope, &meta)
	name := strings.TrimSpace(meta.Name)
	if name == "" || strings.ContainsAny(name, `/\`) {
		name = "file"
	}
	mime := meta.Mime
	switch {
	case strings.HasPrefix(mime, "image/"), strings.HasPrefix(mime, "video/"), strings.HasPrefix(mime, "audio/"):
	case mime == "application/pdf":
	default:
		mime = "application/octet-stream"
	}
	return name, mime
}

func (a *App) turnCreds(w http.ResponseWriter, r *http.Request) {
	p, ok := a.requireChat(w, r)
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
		ON CONFLICT (endpoint) DO UPDATE SET p256dh=EXCLUDED.p256dh, auth=EXCLUDED.auth, device_id=EXCLUDED.device_id
		WHERE push_subscriptions.user_id=EXCLUDED.user_id`, p.User.ID, p.Device, body.Endpoint, body.P256dh, body.Auth)
	if err != nil {
		httpx.WriteError(w, 500, "internal", "push")
		return
	}
	w.WriteHeader(204)
}

func (a *App) ws(w http.ResponseWriter, r *http.Request) {
	origin := r.Header.Get("Origin")
	if (origin == "" && !a.Cfg.DevInsecureHTTP) || (origin != "" && !httpx.OriginAllowed(origin, a.Cfg.CORSOrigins, a.Cfg.DevInsecureHTTP)) {
		httpx.WriteError(w, 403, "csrf", "origin")
		return
	}
	p, ok := a.auth(w, r)
	if !ok {
		return
	}
	if p.Device == nil || (p.Trust != "trusted" && p.Trust != "pending") {
		httpx.WriteError(w, 403, "device_untrusted", "this device is not trusted")
		return
	}
	patterns := []string{"*"}
	if !a.Cfg.DevInsecureHTTP {
		patterns = originHosts(a.Cfg.CORSOrigins)
	}
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{OriginPatterns: patterns})
	if err != nil {
		return
	}
	dev := uuid.Nil
	if p.Device != nil {
		dev = *p.Device
	}
	c := &signaling.Conn{User: p.User.ID, Device: dev, WS: conn}
	conn.SetReadLimit(64 << 10)
	a.Hub.Add(c)
	defer func() {
		a.Hub.Remove(p.User.ID, dev)
		if !a.Hub.Online(p.User.ID) {
			a.publishPresence(context.Background(), p.User.ID, false)
		}
		_ = conn.Close(websocket.StatusNormalClosure, "bye")
	}()
	if p.Trust == "trusted" {
		peers, _ := a.DB.PresencePeerIDs(r.Context(), p.User.ID)
		online := []string{}
		for _, id := range peers {
			if a.Hub.Online(id) {
				online = append(online, id.String())
			}
		}
		snap, _ := json.Marshal(signaling.Frame{V: 1, T: "presence.snapshot", ID: uuid.NewString(), P: map[string]any{"users": online}})
		_ = conn.Write(r.Context(), websocket.MessageText, snap)
		a.publishPresence(r.Context(), p.User.ID, true)
	}
	for {
		_, data, err := conn.Read(r.Context())
		if err != nil {
			return
		}
		var frame signaling.Frame
		if err := jsonUnmarshal(data, &frame); err != nil {
			continue
		}
		if p.Trust != "trusted" && !strings.HasPrefix(frame.T, "rtc.") && !strings.HasPrefix(frame.T, "pair.") {
			_ = conn.Write(r.Context(), websocket.MessageText, []byte(`{"v":1,"t":"error","id":"`+frame.ID+`","p":{"code":"device_untrusted"}}`))
			continue
		}
		if err := a.authorizeSignal(r.Context(), p, frame); err != nil {
			code := "forbidden"
			if errors.Is(err, authz.ErrPlaintext) {
				code = "plaintext_rejected"
			}
			_ = conn.Write(r.Context(), websocket.MessageText, []byte(`{"v":1,"t":"error","id":"`+frame.ID+`","p":{"code":"`+code+`"}}`))
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
			dropped, err := a.DB.Cleanup(ctx)
			if err == nil {
				a.releaseMailbox(ctx, dropped)
			}
		}
	}
}

func (a *App) disk() (free, total uint64) {
	_ = os.MkdirAll(a.Cfg.MailboxDir, 0o750)
	return diskUsage(a.Cfg.MailboxDir)
}

func (a *App) ensureSpace(ctx context.Context, min float64) error {
	free, total := a.disk()
	if quota.EnoughFree(free, total, min) {
		return nil
	}
	dropped, err := a.DB.DropMailbox(ctx, 12*time.Hour)
	if err == nil {
		a.releaseMailbox(ctx, dropped)
	}
	free, total = a.disk()
	if quota.EnoughFree(free, total, min) {
		return nil
	}
	return errors.New("overloaded")
}

func (a *App) releaseMailbox(ctx context.Context, dropped []store.DroppedMail) {
	for _, row := range dropped {
		for _, path := range row.Paths {
			_ = os.Remove(path)
		}
		messages := make([]string, 0, len(row.Messages))
		for _, id := range row.Messages {
			messages = append(messages, id.String())
		}
		files := make([]string, 0, len(row.Files))
		for _, id := range row.Files {
			files = append(files, id.String())
		}
		if len(messages) == 0 && len(files) == 0 {
			continue
		}
		a.Hub.Notify(ctx, row.Sender, signaling.Frame{V: 1, T: "chat.expired", ID: uuid.NewString(), P: map[string]any{"message_ids": messages, "file_ids": files}})
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

func jsonUnmarshal(b []byte, v any) error {
	return jsonDecode(b, v)
}

func jsonDecode(b []byte, v any) error {
	return decodeJSON(b, v)
}
