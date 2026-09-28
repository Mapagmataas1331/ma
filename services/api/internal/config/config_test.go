package config

import "testing"

func TestValidateProductionKEK(t *testing.T) {
	cfg := Load()
	cfg.DevInsecureHTTP = false
	cfg.ServerKEK = ""
	cfg.TurnSecret = "real-turn-secret"
	cfg.DatabaseURL = "postgres://macyou:change-me@127.0.0.1:5432/macyou"
	if err := cfg.Validate(); err == nil {
		t.Fatal("empty KEK was accepted")
	}
	cfg.ServerKEK = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
	if err := cfg.Validate(); err != nil {
		t.Fatal(err)
	}
}

func TestValidateLocalAllowsEmptyKEK(t *testing.T) {
	cfg := Load()
	cfg.DevInsecureHTTP = true
	cfg.ServerKEK = ""
	if err := cfg.Validate(); err != nil {
		t.Fatal(err)
	}
}

func TestDefaultsMatchArchitecture(t *testing.T) {
	cfg := Load()
	if cfg.MaxFileBytes != 25<<20 || cfg.UserQuotaBytes != 500<<20 || cfg.GlobalQuotaBytes != 60<<30 || cfg.MinFreeBytes != 15<<30 {
		t.Fatalf("unexpected quotas: %+v", cfg)
	}
}
