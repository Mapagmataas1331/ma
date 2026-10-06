package og

import (
	"bytes"
	"image/png"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"golang.org/x/image/font/opentype"
)

func TestRenderSizeAllSites(t *testing.T) {
	for _, site := range []Site{SiteHome, SiteProjects, SiteResume, SiteChat} {
		b, err := RenderPNG(Card{Site: site, Title: "Hello", Subtitle: "World"})
		if err != nil {
			t.Fatalf("%s: %v", site, err)
		}
		cfg, err := png.DecodeConfig(bytes.NewReader(b))
		if err != nil {
			t.Fatalf("%s: decode: %v", site, err)
		}
		if cfg.Width != Width || cfg.Height != Height {
			t.Fatalf("%s: got %dx%d, want %dx%d", site, cfg.Width, cfg.Height, Width, Height)
		}
		// WhatsApp and some other crawlers drop previews over ~300 KB
		if len(b) > 300<<10 {
			t.Fatalf("%s: %d bytes, want under 300 KB", site, len(b))
		}
	}
}

func get(t *testing.T, h http.Handler, method, target string, hdr map[string]string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, target, nil)
	for k, v := range hdr {
		req.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestHandlerServesPNG(t *testing.T) {
	h := NewHandler()
	rec := get(t, h, http.MethodGet, "/v1/og?site=projects&title=Redis+%2B+Grafana&subtitle=Dashboards", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	if ct := rec.Header().Get("Content-Type"); ct != "image/png" {
		t.Fatalf("content-type %q", ct)
	}
	if cc := rec.Header().Get("Cache-Control"); !strings.Contains(cc, "public") || !strings.Contains(cc, "max-age=") {
		t.Fatalf("cache-control %q", cc)
	}
	if rec.Header().Get("ETag") == "" {
		t.Fatal("missing ETag")
	}
	cfg, err := png.DecodeConfig(rec.Body)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Width != 1200 || cfg.Height != 630 {
		t.Fatalf("got %dx%d", cfg.Width, cfg.Height)
	}
}

func TestHandlerDefaultsAndETag(t *testing.T) {
	h := NewHandler()
	first := get(t, h, http.MethodGet, "/og.png", nil)
	if first.Code != http.StatusOK {
		t.Fatalf("status %d", first.Code)
	}
	etag := first.Header().Get("ETag")
	again := get(t, h, http.MethodGet, "/og.png?site=home", map[string]string{"If-None-Match": etag})
	if again.Code != http.StatusNotModified {
		t.Fatalf("want 304 for a matching ETag (site=home is the default), got %d", again.Code)
	}
	other := get(t, h, http.MethodGet, "/og.png?site=chat", nil)
	if other.Header().Get("ETag") == etag {
		t.Fatal("different cards must not share an ETag")
	}
	head := get(t, h, http.MethodHead, "/og.png", nil)
	if head.Code != http.StatusOK || head.Header().Get("Content-Type") != "image/png" {
		t.Fatalf("HEAD: %d %q", head.Code, head.Header().Get("Content-Type"))
	}
}

func TestHandlerRejectsUnknownSite(t *testing.T) {
	rec := get(t, NewHandler(), http.MethodGet, "/v1/og?site=evil", nil)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status %d", rec.Code)
	}
}

func TestHandlerCacheIsBounded(t *testing.T) {
	h := NewHandler()
	for i := 0; i < cacheSize+5; i++ {
		h.put(strings.Repeat("x", i+1), []byte{1})
	}
	if len(h.cache) != cacheSize || len(h.order) != cacheSize {
		t.Fatalf("cache %d / order %d, want %d", len(h.cache), len(h.order), cacheSize)
	}
}

func TestClean(t *testing.T) {
	cases := map[string]string{
		"  Hello\n\tworld  ":   "Hello world",
		"Ship it 🚀 now":        "Ship it now",
		"Привет, мир":          "Привет, мир",
		"a\x00b\x07c":          "abc",
		strings.Repeat("y", 8): "yyyy…",
	}
	for in, want := range cases {
		max := 50
		if strings.HasPrefix(in, "yyyy") {
			max = 4
		}
		if got := Clean(in, max); got != want {
			t.Errorf("Clean(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestWrapTruncates(t *testing.T) {
	if err := loadFonts(); err != nil {
		t.Fatal(err)
	}
	face, err := opentype.NewFace(semiBold, &opentype.FaceOptions{Size: 40, DPI: 72})
	if err != nil {
		t.Fatal(err)
	}
	defer face.Close()
	lines := wrap(face, 40, 0, 300, strings.Repeat("word ", 40), 2)
	if len(lines) != 2 || !strings.HasSuffix(lines[1], "…") {
		t.Fatalf("got %q", lines)
	}
	for _, l := range lines {
		if w := measure(face, 40, 0, l); w > 300 {
			t.Fatalf("line %q is %.0fpx wide", l, w)
		}
	}
	if got := wrap(face, 40, 0, 300, "short", 2); len(got) != 1 || got[0] != "short" {
		t.Fatalf("got %q", got)
	}
	// one unbreakable word is hard-wrapped instead of overflowing
	long := wrap(face, 40, 0, 200, strings.Repeat("m", 40), 3)
	if len(long) != 3 {
		t.Fatalf("got %q", long)
	}
}
