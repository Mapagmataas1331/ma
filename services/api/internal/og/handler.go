package og

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// Version is part of every ETag. Bump it when the design changes; pages can also add &v=N to the
// og:image URL so caches that ignore revalidation pick up the new card.
const Version = "1"

const (
	MaxTitle    = 100 // runes
	MaxSubtitle = 180
	cacheSize   = 64
)

// Handler serves GET /v1/og?site=home|projects|resume|chat&title=…&subtitle=… as a 1200×630 PNG.
// Rendered cards are kept in a small in-memory cache and rendering is serialised, so a burst of
// crawler hits costs one render per distinct card.
type Handler struct {
	mu    sync.Mutex
	cache map[string][]byte
	order []string
	sem   chan struct{}
}

func NewHandler() *Handler {
	return &Handler{cache: map[string][]byte{}, sem: make(chan struct{}, 2)}
}

// ParseCard reads site / title / subtitle (desc is accepted as an alias) from a query string.
// ok is false for an unknown site.
func ParseCard(q url.Values) (Card, bool) {
	site := Site(q.Get("site"))
	if site == "" {
		site = SiteHome
	}
	if !ValidSite(site) {
		return Card{}, false
	}
	sub := q.Get("subtitle")
	if sub == "" {
		sub = q.Get("desc")
	}
	return Card{Site: site, Title: Clean(q.Get("title"), MaxTitle), Subtitle: Clean(sub, MaxSubtitle)}, true
}

func (c Card) key() string {
	return string(c.Site) + "\x00" + c.Title + "\x00" + c.Subtitle
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	card, ok := ParseCard(r.URL.Query())
	if !ok {
		http.Error(w, "unknown site", http.StatusBadRequest)
		return
	}
	key := card.key()
	sum := sha256.Sum256([]byte(Version + "\x00" + key))
	etag := `"og` + Version + "-" + hex.EncodeToString(sum[:10]) + `"`

	hdr := w.Header()
	hdr.Set("Content-Type", "image/png")
	// The image is a pure function of the URL: a day in browsers, a week at shared caches, and a
	// long stale window so a slow re-render never blocks a preview.
	hdr.Set("Cache-Control", "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800")
	hdr.Set("ETag", etag)
	// social crawlers and other origins embed this as a plain <img>
	hdr.Set("Cross-Origin-Resource-Policy", "cross-origin")
	if match := r.Header.Get("If-None-Match"); match == "*" || strings.Contains(match, etag) {
		w.WriteHeader(http.StatusNotModified)
		return
	}

	png, err := h.render(card, key)
	if err != nil {
		slog.Error("og render", "err", err)
		hdr.Del("Cache-Control")
		hdr.Del("ETag")
		http.Error(w, "render failed", http.StatusInternalServerError)
		return
	}
	http.ServeContent(w, r, "og.png", time.Time{}, bytes.NewReader(png))
}

func (h *Handler) render(card Card, key string) ([]byte, error) {
	if b := h.get(key); b != nil {
		return b, nil
	}
	h.sem <- struct{}{}
	defer func() { <-h.sem }()
	if b := h.get(key); b != nil { // rendered while we waited
		return b, nil
	}
	b, err := RenderPNG(card)
	if err != nil {
		return nil, err
	}
	h.put(key, b)
	return b, nil
}

// put stores a card, dropping the oldest once the cache is full.
func (h *Handler) put(key string, b []byte) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if _, ok := h.cache[key]; !ok {
		if len(h.order) >= cacheSize {
			delete(h.cache, h.order[0])
			h.order = h.order[1:]
		}
		h.order = append(h.order, key)
	}
	h.cache[key] = b
}

func (h *Handler) get(key string) []byte {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.cache[key]
}
