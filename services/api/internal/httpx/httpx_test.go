package httpx

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestOriginAllowedAllowlist(t *testing.T) {
	origins := []string{
		"https://ma.cyou",
		"https://me.ma.cyou",
		"https://projects.ma.cyou",
		"https://chat.ma.cyou",
	}
	for _, o := range origins {
		if !OriginAllowed(o, origins, false) {
			t.Fatalf("expected allow %s", o)
		}
	}
	if OriginAllowed("https://evil.example", origins, false) {
		t.Fatal("evil origin allowed in production")
	}
	if OriginAllowed("https://ma.cyou.evil.com", origins, false) {
		t.Fatal("suffix origin allowed")
	}
}

func TestOriginAllowedDevVitePorts(t *testing.T) {
	if !OriginAllowed("http://127.0.0.1:5173", nil, true) {
		t.Fatal("dev vite origin should be allowed")
	}
	if OriginAllowed("http://127.0.0.1:3000", nil, true) {
		t.Fatal("non-vite port should be denied")
	}
	if OriginAllowed("http://evil:5173", nil, false) {
		t.Fatal("dev ports must not apply outside DEV_INSECURE_HTTP")
	}
}

func TestCORSCredentialedAllowlist(t *testing.T) {
	origins := []string{"https://ma.cyou", "https://chat.ma.cyou"}
	h := CORS(origins, false, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/v1/auth/session", nil)
	req.Header.Set("Origin", "https://ma.cyou")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "https://ma.cyou" {
		t.Fatalf("ACAO=%q", got)
	}
	if rec.Header().Get("Access-Control-Allow-Credentials") != "true" {
		t.Fatal("missing credentials")
	}
	if rec.Header().Get("Vary") != "Origin" {
		t.Fatal("missing Vary: Origin")
	}

	pre := httptest.NewRequest(http.MethodOptions, "/v1/auth/session", nil)
	pre.Header.Set("Origin", "https://chat.ma.cyou")
	pre.Header.Set("Access-Control-Request-Method", "POST")
	prerec := httptest.NewRecorder()
	h.ServeHTTP(prerec, pre)
	if prerec.Code != http.StatusNoContent {
		t.Fatalf("preflight status %d", prerec.Code)
	}
	if prerec.Header().Get("Access-Control-Allow-Origin") != "https://chat.ma.cyou" {
		t.Fatal("preflight ACAO")
	}

	bad := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	bad.Header.Set("Origin", "https://evil.example")
	badrec := httptest.NewRecorder()
	h.ServeHTTP(badrec, bad)
	if badrec.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatal("disallowed origin got ACAO")
	}
}

func TestSecurityHeaders(t *testing.T) {
	h := SecurityHeaders(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	checks := map[string]string{
		"X-Content-Type-Options":  "nosniff",
		"Referrer-Policy":         "no-referrer",
		"X-Frame-Options":         "DENY",
		"Permissions-Policy":      "accelerometer=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), microphone=(), payment=(), usb=()",
		"Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
	}
	for k, want := range checks {
		if got := rec.Header().Get(k); got != want {
			t.Fatalf("%s=%q want %q", k, got, want)
		}
	}
	if rec.Header().Get("Strict-Transport-Security") != "" {
		t.Fatal("HSTS must not be set on plain HTTP without X-Forwarded-Proto")
	}

	httpsReq := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	httpsReq.Header.Set("X-Forwarded-Proto", "https")
	httpsRec := httptest.NewRecorder()
	h.ServeHTTP(httpsRec, httpsReq)
	if got := httpsRec.Header().Get("Strict-Transport-Security"); got != "max-age=31536000; includeSubDomains; preload" {
		t.Fatalf("HSTS=%q", got)
	}
}