package server

import (
	"context"
	"encoding/json"
	"io"
	"net/http"

	webpush "github.com/SherClockHolmes/webpush-go"
	"github.com/google/uuid"
)

func (a *App) pushMailbox(ctx context.Context, user uuid.UUID, count int) {
	if a.Cfg.VAPIDPublic == "" || a.Cfg.VAPIDPrivate == "" {
		return
	}
	rows, err := a.DB.Pool.Query(ctx, `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id=$1`, user)
	if err != nil {
		return
	}
	defer rows.Close()
	payload, _ := json.Marshal(map[string]any{"t": "mailbox", "n": count})
	for rows.Next() {
		var endpoint, p256dh, auth string
		if err := rows.Scan(&endpoint, &p256dh, &auth); err != nil {
			continue
		}
		resp, err := webpush.SendNotification(payload, &webpush.Subscription{Endpoint: endpoint, Keys: webpush.Keys{P256dh: p256dh, Auth: auth}}, &webpush.Options{
			Subscriber:      a.Cfg.VAPIDSubject,
			VAPIDPublicKey:  a.Cfg.VAPIDPublic,
			VAPIDPrivateKey: a.Cfg.VAPIDPrivate,
			TTL:             86400,
			Urgency:         webpush.UrgencyHigh,
			Topic:           "ma-mail",
		})
		if err != nil {
			continue
		}
		_, _ = io.Copy(io.Discard, resp.Body)
		_ = resp.Body.Close()
		if resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusGone {
			_, _ = a.DB.Pool.Exec(ctx, `DELETE FROM push_subscriptions WHERE endpoint=$1`, endpoint)
		}
	}
}
