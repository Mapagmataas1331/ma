package main

import (
	"context"
	"database/sql"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/stdlib"
	"github.com/mapagmataas1331/ma/services/api/internal/config"
	"github.com/mapagmataas1331/ma/services/api/internal/schema"
	"github.com/mapagmataas1331/ma/services/api/internal/server"
	"github.com/mapagmataas1331/ma/services/api/internal/store"
	"github.com/pressly/goose/v3"
	"golang.org/x/crypto/acme/autocert"
)

func main() {
	cfg := config.Load()
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	db, err := store.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("db", "err", err)
		os.Exit(1)
	}
	defer db.Pool.Close()
	sqlDB := stdlib.OpenDBFromPool(db.Pool)
	if err := migrate(sqlDB); err != nil {
		slog.Error("migrate", "err", err)
		os.Exit(1)
	}
	app := server.New(cfg, db)
	go app.CleanupLoop(ctx)
	handler := app.Handler()
	srv := &http.Server{Addr: cfg.ListenAddr, Handler: handler, ReadHeaderTimeout: 10 * time.Second}
	go func() {
		<-ctx.Done()
		sh, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = srv.Shutdown(sh)
	}()
	if cfg.DevInsecureHTTP || cfg.BehindProxy {
		slog.Info("listening", "addr", cfg.ListenAddr, "behind_proxy", cfg.BehindProxy)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("listen", "err", err)
			os.Exit(1)
		}
		return
	}
	m := &autocert.Manager{
		Prompt:     autocert.AcceptTOS,
		HostPolicy: autocert.HostWhitelist(cfg.ACMEHosts...),
		Cache:      autocert.DirCache(cfg.ACMECacheDir),
		Email:      cfg.ACMEEmail,
	}
	go func() {
		_ = http.ListenAndServe(":80", m.HTTPHandler(nil))
	}()
	srv.Addr = ":443"
	srv.TLSConfig = m.TLSConfig()
	if err := srv.ListenAndServeTLS("", ""); err != nil && err != http.ErrServerClosed {
		slog.Error("tls", "err", err)
		os.Exit(1)
	}
}

func migrate(db *sql.DB) error {
	goose.SetBaseFS(schema.FS())
	if err := goose.SetDialect("postgres"); err != nil {
		return err
	}
	return goose.Up(db, "migrations")
}
