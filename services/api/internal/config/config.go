package config

import (
	"encoding/base64"
	"errors"
	"os"
	"strconv"
	"strings"
	"time"

	"golang.org/x/crypto/chacha20poly1305"
)

type Config struct {
	ListenAddr       string
	DevInsecureHTTP  bool
	BehindProxy      bool
	ACMEHosts        []string
	ACMEEmail        string
	ACMECacheDir     string
	DatabaseURL      string
	CORSOrigins      []string
	ServerKEK        string
	TurnSecret       string
	TurnURLs         []string
	VAPIDPublic      string
	VAPIDPrivate     string
	VAPIDSubject     string
	MailboxDir       string
	MaxFileBytes     int64
	MaxMessageBytes  int64
	UserQuotaBytes   int64
	GlobalQuotaBytes int64
	MinFreeBytes     int64
	FileTTL          time.Duration
	MessageTTL       time.Duration
	SessionIdle      time.Duration
	SessionAbsolute  time.Duration
	LogLevel         string
}

func Load() Config {
	return Config{
		ListenAddr:       env("LISTEN_ADDR", ":8080"),
		DevInsecureHTTP:  env("DEV_INSECURE_HTTP", "true") == "true",
		BehindProxy:      env("BEHIND_PROXY", "false") == "true",
		ACMEHosts:        split(env("ACME_HOSTS", "api.ma.cyou")),
		ACMEEmail:        env("ACME_EMAIL", ""),
		ACMECacheDir:     env("ACME_CACHE_DIR", "acme"),
		DatabaseURL:      env("DATABASE_URL", "postgres://macyou:macyou@localhost:5432/macyou?sslmode=disable"),
		CORSOrigins:      split(env("CORS_ORIGINS", "http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176,https://ma.cyou,https://me.ma.cyou,https://projects.ma.cyou,https://chat.ma.cyou")),
		ServerKEK:        env("SERVER_KEK", ""),
		TurnSecret:       env("TURN_SECRET", "dev-turn-secret"),
		TurnURLs:         split(env("TURN_URLS", "stun:turn.ma.cyou:3478,turn:turn.ma.cyou:3478?transport=udp")),
		VAPIDPublic:      env("VAPID_PUBLIC_KEY", ""),
		VAPIDPrivate:     env("VAPID_PRIVATE_KEY", ""),
		VAPIDSubject:     env("VAPID_SUBJECT", "mailto:me@ma.cyou"),
		MailboxDir:       env("MAILBOX_DIR", "mailbox"),
		MaxFileBytes:     envInt("MAILBOX_MAX_FILE_BYTES", 25<<20),
		MaxMessageBytes:  envInt("MAILBOX_MAX_MESSAGE_BYTES", 65536),
		UserQuotaBytes:   envInt("MAILBOX_USER_QUOTA_BYTES", 500<<20),
		GlobalQuotaBytes: envInt("MAILBOX_GLOBAL_QUOTA_BYTES", 60<<30),
		MinFreeBytes:     envInt("MAILBOX_MIN_FREE_BYTES", 15<<30),
		FileTTL:          7 * 24 * time.Hour,
		MessageTTL:       30 * 24 * time.Hour,
		SessionIdle:      30 * 24 * time.Hour,
		SessionAbsolute:  180 * 24 * time.Hour,
		LogLevel:         env("LOG_LEVEL", "info"),
	}
}

func (c Config) Validate() error {
	if c.DevInsecureHTTP {
		return nil
	}
	kek, err := base64.StdEncoding.DecodeString(c.ServerKEK)
	if err != nil || len(kek) != chacha20poly1305.KeySize {
		return errors.New("SERVER_KEK must be 32 bytes of standard base64")
	}
	if c.TurnSecret == "" || c.TurnSecret == "dev-turn-secret" {
		return errors.New("TURN_SECRET is required")
	}
	if len(c.CORSOrigins) == 0 {
		return errors.New("CORS_ORIGINS is required")
	}
	if c.DatabaseURL == "" || strings.Contains(c.DatabaseURL, "macyou:macyou@localhost") {
		return errors.New("DATABASE_URL is not set for production")
	}
	if (c.VAPIDPublic == "") != (c.VAPIDPrivate == "") {
		return errors.New("VAPID keys must both be set or both be empty")
	}
	return nil
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envInt(key string, fallback int64) int64 {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.ParseInt(v, 10, 64)
	if err != nil {
		return fallback
	}
	return n
}

func split(v string) []string {
	parts := strings.Split(v, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}
