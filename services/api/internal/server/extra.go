package server

import (
	"context"
	"encoding/base64"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/mapagmataas1331/ma/services/api/internal/auth"
	"github.com/mapagmataas1331/ma/services/api/internal/authz"
	"github.com/mapagmataas1331/ma/services/api/internal/httpx"
	"github.com/mapagmataas1331/ma/services/api/internal/signaling"
	"github.com/mapagmataas1331/ma/services/api/internal/store"
)

func (a *App) event(r *http.Request, user *uuid.UUID, kind string) {
	a.DB.Event(r.Context(), user, kind, httpx.ClientIP(r), r.UserAgent())
}

func decodePublicKey(value string) ([]byte, error) {
	raw, err := base64.RawURLEncoding.DecodeString(value)
	if err != nil || len(raw) != 32 {
		return nil, errors.New("key")
	}
	return raw, nil
}

func bytesEqual(a, b []byte) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func publicKeyB64(raw []byte) string {
	if len(raw) != 32 {
		return ""
	}
	return base64.RawURLEncoding.EncodeToString(raw)
}

func conversationJSON(c store.Conversation, members []store.Member) map[string]any {
	people := []map[string]string{}
	for _, member := range members {
		row := map[string]string{"id": member.ID.String(), "username": member.Username, "display_name": member.DisplayName, "role": member.Role}
		if key := publicKeyB64(member.X25519); key != "" {
			row["x25519"] = key
		}
		people = append(people, row)
	}
	out := map[string]any{
		"id": c.ID, "kind": c.Kind, "title": c.Title, "membership_version": c.Version,
		"peer_id": c.PeerID, "peer_name": c.Peer, "peer_username": c.Username, "members": people,
	}
	if key := publicKeyB64(c.PeerX); key != "" {
		out["peer_x25519"] = key
	}
	return out
}

func (a *App) contactDevices(w http.ResponseWriter, r *http.Request) {
	p, ok := a.auth(w, r)
	if !ok {
		return
	}
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		httpx.WriteError(w, 400, "bad_request", "id")
		return
	}
	if id != p.User.ID {
		if err := authz.AllowChat(authz.DeviceAccess{HasDevice: p.Device != nil, Trust: p.Trust}); err != nil {
			httpx.WriteError(w, 403, "device_untrusted", "this device is not trusted")
			return
		}
		allowed, err := a.DB.CanReadIdentity(r.Context(), p.User.ID, id)
		if err != nil {
			httpx.WriteError(w, 500, "internal", "devices")
			return
		}
		if !allowed {
			httpx.WriteError(w, 403, "forbidden", "devices")
			return
		}
	}
	list, err := a.DB.PublicDevices(r.Context(), id)
	if err != nil {
		httpx.WriteError(w, 500, "internal", "devices")
		return
	}
	out := []map[string]string{}
	for _, device := range list {
		out = append(out, map[string]string{"id": device.ID.String(), "trust_state": device.Trust, "x25519": base64.RawURLEncoding.EncodeToString(device.X)})
	}
	httpx.WriteJSON(w, 200, out)
}

func (a *App) patchMe(w http.ResponseWriter, r *http.Request) {
	p, ok := a.auth(w, r)
	if !ok {
		return
	}
	var body struct {
		DisplayName *string `json:"display_name"`
		Username    *string `json:"username"`
	}
	if err := httpx.ReadJSON(r, &body); err != nil {
		httpx.WriteError(w, 400, "bad_request", "invalid json")
		return
	}
	if body.DisplayName == nil && body.Username == nil {
		httpx.WriteError(w, 400, "bad_request", "nothing to update")
		return
	}
	display := p.User.DisplayName
	if body.DisplayName != nil {
		next, err := auth.CanonicalDisplayName(*body.DisplayName)
		if err != nil {
			httpx.WriteError(w, 400, "display_name_invalid", "display name must be 1-32 characters")
			return
		}
		display = next
	}
	username := p.User.Username
	changedUsername := false
	if body.Username != nil {
		next, err := auth.CanonicalUsername(*body.Username)
		if err != nil {
			httpx.WriteError(w, 400, "username_invalid", "username must be 3-12 letters, numbers, or underscores")
			return
		}
		if next != p.User.Username {
			var last *time.Time
			_ = a.DB.Pool.QueryRow(r.Context(), `SELECT username_changed_at FROM users WHERE id=$1`, p.User.ID).Scan(&last)
			if last != nil && time.Since(*last) < 30*24*time.Hour {
				nextAt := last.Add(30 * 24 * time.Hour)
				httpx.WriteJSON(w, 429, map[string]any{
					"code":    "username_cooldown",
					"message": "username can be changed once every 30 days",
					"details": map[string]any{"next_at": nextAt.UTC().Format(time.RFC3339)},
				})
				return
			}
			username = next
			changedUsername = true
		}
	}
	if changedUsername {
		tag, err := a.DB.Pool.Exec(r.Context(), `UPDATE users SET display_name=$2, username=$3, username_changed_at=now() WHERE id=$1`, p.User.ID, display, username)
		if err != nil {
			if strings.Contains(strings.ToLower(err.Error()), "unique") || strings.Contains(err.Error(), "users_username") {
				httpx.WriteError(w, 409, "username_taken", "username is taken")
				return
			}
			httpx.WriteError(w, 500, "internal", "profile")
			return
		}
		if tag.RowsAffected() != 1 {
			httpx.WriteError(w, 500, "internal", "profile")
			return
		}
	} else if _, err := a.DB.Pool.Exec(r.Context(), `UPDATE users SET display_name=$2 WHERE id=$1`, p.User.ID, display); err != nil {
		httpx.WriteError(w, 500, "internal", "profile")
		return
	}
	httpx.WriteJSON(w, 200, map[string]any{"username": username, "display_name": display})
}

func (a *App) publishPresence(ctx context.Context, user uuid.UUID, online bool) {
	peers, err := a.DB.PresencePeerIDs(ctx, user)
	if err != nil {
		return
	}
	a.Hub.NotifyMany(ctx, peers, signaling.Frame{V: 1, T: "presence.update", ID: uuid.NewString(), P: map[string]any{"user": user.String(), "online": online, "devices": a.Hub.DeviceIDs(user)}})
}

func (a *App) authorizeSignal(ctx context.Context, p principal, frame signaling.Frame) error {
	if _, ok := frame.P["data"]; ok {
		return authz.ErrPlaintext
	}
	in := authz.SignalInput{FrameType: frame.T, HasTarget: frame.To != nil}
	if frame.To == nil {
		return authz.AllowSignal(in)
	}
	target, err := uuid.Parse(frame.To.User)
	if err != nil {
		return authz.ErrForbidden
	}
	in.SameAccount = target == p.User.ID
	if frame.To.Device != "" {
		deviceID, err := uuid.Parse(frame.To.Device)
		if err != nil {
			return authz.ErrForbidden
		}
		if _, err = a.DB.DeviceOwned(ctx, target, deviceID); err == nil {
			in.TargetDeviceOK = true
		}
	} else if in.SameAccount && len(frame.T) >= 5 && frame.T[:5] != "pair." {
		in.TargetDeviceOK = true
	}
	if !in.SameAccount {
		related, blocked, err := a.DB.SignalRelated(ctx, p.User.ID, target)
		if err != nil {
			return err
		}
		in.Related = related
		in.Blocked = blocked
	}
	return authz.AllowSignal(in)
}

func originHosts(origins []string) []string {
	out := []string{}
	for _, origin := range origins {
		parsed, err := url.Parse(origin)
		if err == nil && parsed.Host != "" {
			out = append(out, parsed.Host)
		}
	}
	if len(out) == 0 {
		return []string{"api.ma.cyou"}
	}
	return out
}

func (a *App) conversation(w http.ResponseWriter, r *http.Request) {
	p, ok := a.requireChat(w, r)
	if !ok {
		return
	}
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		httpx.WriteError(w, 400, "bad_request", "id")
		return
	}
	members, err := a.DB.Members(r.Context(), id, p.User.ID)
	if err != nil || len(members) == 0 {
		httpx.WriteError(w, 404, "not_found", "conversation")
		return
	}
	httpx.WriteJSON(w, 200, map[string]any{"id": id, "members": membersJSON(members), "membership_version": len(members)})
}

func membersJSON(members []store.Member) []map[string]string {
	out := make([]map[string]string, 0, len(members))
	for _, member := range members {
		out = append(out, map[string]string{"id": member.ID.String(), "username": member.Username, "display_name": member.DisplayName, "role": member.Role})
	}
	return out
}

// writeGroupError maps store errors from group operations to stable API codes.
func writeGroupError(w http.ResponseWriter, err error, what string) {
	switch {
	case errors.Is(err, store.ErrGroupFull):
		httpx.WriteError(w, 409, "group_full", "group already has the maximum number of members")
	case errors.Is(err, store.ErrNotContact):
		httpx.WriteError(w, 403, "not_contact", "only accepted contacts can be added")
	case errors.Is(err, store.ErrOwnerMustTransfer):
		httpx.WriteError(w, 409, "owner_must_transfer", "transfer ownership or delete the group before leaving")
	case errors.Is(err, store.ErrNotFound):
		httpx.WriteError(w, 404, "not_found", what)
	case errors.Is(err, store.ErrForbidden):
		httpx.WriteError(w, 403, "forbidden", what)
	default:
		httpx.WriteError(w, 500, "internal", what)
	}
}

// touchMembers tells every listed user (and any extra ids) that a conversation changed so their lists refresh.
func (a *App) touchMembers(ctx context.Context, conversation uuid.UUID, extra ...uuid.UUID) {
	seen := map[uuid.UUID]struct{}{}
	ids, _ := a.DB.MemberIDs(ctx, conversation)
	for _, id := range append(ids, extra...) {
		if _, ok := seen[id]; ok || id == uuid.Nil {
			continue
		}
		seen[id] = struct{}{}
		a.touch(ctx, id, "conversations.updated")
	}
}

func (a *App) renameConversation(w http.ResponseWriter, r *http.Request) {
	p, ok := a.requireChat(w, r)
	if !ok {
		return
	}
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		httpx.WriteError(w, 400, "bad_request", "id")
		return
	}
	var body struct {
		Title string `json:"title"`
	}
	if err = httpx.ReadJSON(r, &body); err != nil || auth.ValidateGroupName(body.Title) != nil {
		httpx.WriteError(w, 400, "group_name_invalid", "group name must be 1-64 characters")
		return
	}
	if err = a.DB.RenameConversation(r.Context(), id, p.User.ID, body.Title); err != nil {
		writeGroupError(w, err, "group")
		return
	}
	a.touchMembers(r.Context(), id)
	w.WriteHeader(204)
}

func (a *App) deleteConversation(w http.ResponseWriter, r *http.Request) {
	p, ok := a.requireChat(w, r)
	if !ok {
		return
	}
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		httpx.WriteError(w, 400, "bad_request", "id")
		return
	}
	// Collect members before they are marked as left, so everyone learns the group is gone.
	members, _ := a.DB.MemberIDs(r.Context(), id)
	if err = a.DB.DeleteConversation(r.Context(), id, p.User.ID); err != nil {
		writeGroupError(w, err, "group")
		return
	}
	a.touchMembers(r.Context(), id, members...)
	w.WriteHeader(204)
}

func (a *App) addMember(w http.ResponseWriter, r *http.Request) {
	p, ok := a.requireChat(w, r)
	if !ok {
		return
	}
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		httpx.WriteError(w, 400, "bad_request", "id")
		return
	}
	var body struct {
		User uuid.UUID `json:"user_id"`
	}
	if err = httpx.ReadJSON(r, &body); err != nil || body.User == uuid.Nil {
		httpx.WriteError(w, 400, "bad_request", "invalid json")
		return
	}
	if err = a.DB.AddMember(r.Context(), id, p.User.ID, body.User); err != nil {
		writeGroupError(w, err, "member")
		return
	}
	a.touchMembers(r.Context(), id)
	w.WriteHeader(204)
}

func (a *App) removeMember(w http.ResponseWriter, r *http.Request) {
	p, ok := a.requireChat(w, r)
	if !ok {
		return
	}
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		httpx.WriteError(w, 400, "bad_request", "id")
		return
	}
	userID, err := uuid.Parse(r.PathValue("userId"))
	if err != nil {
		httpx.WriteError(w, 400, "bad_request", "user")
		return
	}
	if err = a.DB.RemoveMember(r.Context(), id, p.User.ID, userID); err != nil {
		writeGroupError(w, err, "member")
		return
	}
	a.touchMembers(r.Context(), id, userID)
	w.WriteHeader(204)
}

func (a *App) leaveConversation(w http.ResponseWriter, r *http.Request) {
	p, ok := a.requireChat(w, r)
	if !ok {
		return
	}
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		httpx.WriteError(w, 400, "bad_request", "id")
		return
	}
	if err = a.DB.LeaveConversation(r.Context(), id, p.User.ID); err != nil {
		writeGroupError(w, err, "leave")
		return
	}
	a.touchMembers(r.Context(), id, p.User.ID)
	w.WriteHeader(204)
}

func (a *App) transferOwnership(w http.ResponseWriter, r *http.Request) {
	p, ok := a.requireChat(w, r)
	if !ok {
		return
	}
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		httpx.WriteError(w, 400, "bad_request", "id")
		return
	}
	var body struct {
		User uuid.UUID `json:"user_id"`
	}
	if err = httpx.ReadJSON(r, &body); err != nil || body.User == uuid.Nil {
		httpx.WriteError(w, 400, "bad_request", "invalid json")
		return
	}
	if err = a.DB.TransferOwnership(r.Context(), id, p.User.ID, body.User); err != nil {
		writeGroupError(w, err, "owner")
		return
	}
	a.touchMembers(r.Context(), id)
	w.WriteHeader(204)
}
