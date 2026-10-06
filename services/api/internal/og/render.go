// Package og renders the 1200×630 Open Graph cards for the ma.cyou sites: a static take on the
// night sky from packages/ui (navy gradient, nebula glows, stars, a planet limb) with the site's
// wordmark and Inter type on top. Pure Go: image/draw, x/image/vector, x/image/font/opentype.
package og

import (
	"bytes"
	_ "embed"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/png"
	"math"
	"strings"
	"sync"
	"unicode"
	"unicode/utf8"

	"golang.org/x/image/font"
	"golang.org/x/image/font/opentype"
	"golang.org/x/image/font/sfnt"
	"golang.org/x/image/math/fixed"
	"golang.org/x/image/vector"
)

const (
	Width  = 1200
	Height = 630
)

// Site picks the backdrop composition and the host label, mirroring SkyVariant in packages/ui.
type Site string

const (
	SiteHome     Site = "home"
	SiteProjects Site = "projects"
	SiteResume   Site = "resume"
	SiteChat     Site = "chat"
)

// Card is one image. An empty Title on the home site renders the homepage hero (big wordmark).
type Card struct {
	Site     Site
	Title    string
	Subtitle string
}

type rgb struct{ r, g, b float64 }

// Dark theme tokens from packages/ui/src/styles.css (oklch converted to sRGB).
var (
	colFg     = color.RGBA{239, 242, 247, 255} // --fg
	colMuted  = color.RGBA{164, 171, 184, 255} // --fg-muted
	colAccent = color.RGBA{115, 163, 252, 255} // --accent (hue 262)
)

// Defaults per site: host label (short handle as in the header site switcher) and the copy used
// when the query does not pass a title / subtitle. Text matches each app's index.html meta.
type siteInfo struct {
	short    string // "" = the bare ma.cyou wordmark
	title    string
	subtitle string
}

var sites = map[Site]siteInfo{
	SiteHome:     {"", "Timofey - Mapagmataas", "Resume, projects, and a quiet messenger."},
	SiteProjects: {"projects", "Projects", "Things that shipped — notes in the repo as markdown."},
	SiteResume:   {"me", "Résumé", "CV without the corporate fog — web systems, PostgreSQL, Linux."},
	SiteChat:     {"chat", "Chat", "Invite-gated chat. Encryption on. No feed, no ads."},
}

// ValidSite reports whether s names a known site.
func ValidSite(s Site) bool {
	_, ok := sites[s]
	return ok
}

//go:embed fonts/Inter-SemiBold.ttf
var semiBoldTTF []byte

//go:embed fonts/Inter-Regular.ttf
var regularTTF []byte

var (
	fontsOnce         sync.Once
	semiBold, regular *opentype.Font
	fontsErr          error
)

func loadFonts() error {
	fontsOnce.Do(func() {
		if semiBold, fontsErr = opentype.Parse(semiBoldTTF); fontsErr != nil {
			return
		}
		regular, fontsErr = opentype.Parse(regularTTF)
	})
	return fontsErr
}

// RenderPNG draws the card and encodes it as PNG.
func RenderPNG(c Card) ([]byte, error) {
	img, err := Render(c)
	if err != nil {
		return nil, err
	}
	var buf bytes.Buffer
	enc := png.Encoder{CompressionLevel: png.DefaultCompression}
	if err := enc.Encode(&buf, img); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// Render draws the card. Safe for concurrent use: faces are created per call.
func Render(c Card) (*image.RGBA, error) {
	if err := loadFonts(); err != nil {
		return nil, fmt.Errorf("og fonts: %w", err)
	}
	info, ok := sites[c.Site]
	if !ok {
		c.Site, info = SiteHome, sites[SiteHome]
	}
	sc := scenes[c.Site]
	img := paintSky(sc)
	t := &typesetter{dst: img}
	defer t.close()
	if c.Site == SiteHome && c.Title == "" {
		drawHero(t, info, c.Subtitle)
	} else {
		drawTitled(t, info, c, sc)
	}
	return img, nil
}

// ── backdrop ──────────────────────────────────────────────────────────────────────────────────

type blob struct {
	ax, ay, r float64
	c         rgb
	a         float64
}

type planet struct{ cx, cy, R float64 }

type scene struct {
	base   [3]rgb
	lift   float64
	stars  float64 // density multiplier
	blobs  []blob
	neb    float64
	hole   [4]float64 // x, y, rx, ry as fractions; rx == 0 means none
	planet *planet
	glow   float64
	seed   uint32
	// textBottom is where the text block must end so it clears the limb.
	textBottom float64
}

var homeBlobs = []blob{
	{0.86, 0.12, 0.34, rgb{105, 150, 255}, 0.3},
	{0.98, 0.36, 0.24, rgb{150, 100, 235}, 0.26},
	{0.68, -0.04, 0.2, rgb{125, 115, 250}, 0.16},
	{0.03, 0.62, 0.3, rgb{40, 170, 190}, 0.27},
	{-0.04, 0.46, 0.22, rgb{20, 120, 200}, 0.26},
}

// Compositions follow SKY_PRESETS (packages/ui/src/components/sky/presets.ts), tuned up a little
// because a card is mostly seen as a ~500px thumbnail.
var scenes = map[Site]scene{
	SiteHome: {
		base: [3]rgb{{6, 8, 14}, {9, 13, 21}, {13, 19, 33}},
		lift: 0.55, stars: 1, blobs: homeBlobs, neb: 0.8,
		hole: [4]float64{0.5, 0.45, 0.4, 0.36},
		// a low, wide limb along the bottom (bottomLimb)
		planet: &planet{Width * 0.5, Height*0.85 + Width*1.5, Width * 1.5},
		glow:   1, seed: 7, textBottom: 500,
	},
	SiteProjects: {
		base: [3]rgb{{6, 8, 14}, {9, 12, 20}, {12, 17, 30}},
		lift: 0.45, stars: 0.85, neb: 0.75,
		blobs: []blob{
			{0.03, 0.08, 0.28, rgb{105, 150, 255}, 0.26},
			{0.2, -0.06, 0.18, rgb{150, 100, 235}, 0.18},
			{1.0, 0.5, 0.2, rgb{125, 115, 250}, 0.12},
		},
		hole: [4]float64{0.4, 0.55, 0.38, 0.34},
		// a big world rising out of the lower-right corner (cornerLimb)
		planet: cornerLimb(),
		glow:   0.9, seed: 11, textBottom: 560,
	},
	SiteResume: {
		base: [3]rgb{{5, 7, 13}, {8, 11, 19}, {10, 14, 25}},
		lift: 0.4, stars: 0.6, neb: 0.85,
		blobs: []blob{
			{0.04, 0.06, 0.3, rgb{120, 112, 245}, 0.34},
			{-0.03, 0.24, 0.2, rgb{80, 130, 245}, 0.26},
			{0.98, 0.98, 0.26, rgb{70, 110, 230}, 0.16},
		},
		hole: [4]float64{0.42, 0.56, 0.36, 0.34},
		seed: 23, textBottom: 560,
	},
	SiteChat: {
		base: [3]rgb{{6, 8, 14}, {8, 11, 19}, {11, 15, 26}},
		lift: 0.32, stars: 0.55, neb: 0.7,
		blobs: []blob{
			{0.96, 0.9, 0.32, rgb{105, 150, 255}, 0.3},
			{0.76, 1.06, 0.22, rgb{150, 100, 235}, 0.22},
			{1.02, 0.1, 0.2, rgb{40, 170, 190}, 0.14},
		},
		hole: [4]float64{0.4, 0.55, 0.38, 0.34},
		seed: 31, textBottom: 560,
	},
}

func cornerLimb() *planet {
	R := float64(Width) * 1.25
	depth := float64(Height) * 0.42
	s := (R - depth) / math.Sqrt2
	return &planet{Width + s, Height + s, R}
}

// paintSky renders the backdrop into a float buffer, then rounds it to 8 bits.
func paintSky(sc scene) *image.RGBA {
	const W, H = Width, Height
	buf := make([]rgb, W*H)
	D := math.Hypot(W, math.Min(H, W*1.2))
	liftR := math.Hypot(W, H) * 0.55
	lift := rgb{22, 29, 48}
	var spot struct{ x, y, ang, r float64 }
	if p := sc.planet; p != nil {
		dx, dy := W*0.5-p.cx, H*0.45-p.cy
		dl := math.Hypot(dx, dy)
		spot.x, spot.y = p.cx+dx/dl*p.R, p.cy+dy/dl*p.R
		spot.ang = math.Atan2(dy, dx) + math.Pi/2
		spot.r = math.Max(math.Min(W, p.R)*0.4, 260)
	}
	for y := 0; y < H; y++ {
		fy := (float64(y) + 0.5) / H
		var base rgb
		if fy < 0.6 {
			base = mix(sc.base[0], sc.base[1], fy/0.6)
		} else {
			base = mix(sc.base[1], sc.base[2], (fy-0.6)/0.4)
		}
		for x := 0; x < W; x++ {
			px, py := float64(x)+0.5, float64(y)+0.5
			c := base
			// soft lift behind the content
			if sc.lift > 0 {
				k := math.Hypot(px-W*0.5, py-H*0.42) / liftR
				if k < 1 {
					c = over(c, lift, sc.lift*(1-k))
				}
			}
			// nebula: additive blobs, broken up by fbm so they read as clouds, kept off the text
			if len(sc.blobs) > 0 {
				m := sc.neb * (0.45 + 0.75*fbm(px/260, py/260, sc.seed)) * (1 - holeAt(sc.hole, px, py))
				for _, b := range sc.blobs {
					k := math.Hypot(px-b.ax*W, py-b.ay*H) / (b.r * D)
					if k >= 1 {
						continue
					}
					f := 1 - k*k
					a := b.a * f * f * f * m
					c.r += b.c.r * a
					c.g += b.c.g * a
					c.b += b.c.b * a
				}
			}
			buf[y*W+x] = c
		}
	}
	paintStars(buf, sc)
	if p := sc.planet; p != nil {
		paintPlanet(buf, *p, sc.glow, spot.x, spot.y, spot.ang, spot.r)
	}
	img := image.NewRGBA(image.Rect(0, 0, W, H))
	// No dither: at 8 bits the gradients show no visible banding, and a noise-free image keeps the
	// PNG around 170 KB (crawlers such as WhatsApp skip images over ~300 KB).
	for i, c := range buf {
		img.Pix[i*4+0] = clamp8(c.r)
		img.Pix[i*4+1] = clamp8(c.g)
		img.Pix[i*4+2] = clamp8(c.b)
		img.Pix[i*4+3] = 255
	}
	return img
}

// holeAt is the keep-out strength (0..0.92) of the ellipse over the text, as in night.ts.
func holeAt(h [4]float64, px, py float64) float64 {
	if h[2] == 0 {
		return 0
	}
	dx := (px - h[0]*Width) / (h[2] * Width)
	dy := (py - h[1]*Height) / (h[3] * Height)
	k := math.Sqrt(dx*dx + dy*dy)
	switch {
	case k >= 1:
		return 0
	case k < 0.55:
		return 0.92 - (0.92-0.6)*(k/0.55)
	default:
		return 0.6 * (1 - (k-0.55)/0.45)
	}
}

var starTints = []rgb{{255, 255, 255}, {232, 238, 255}, {214, 224, 255}, {196, 212, 255}, {255, 246, 236}}

func paintStars(buf []rgb, sc scene) {
	r := newRNG(sc.seed)
	type layer struct {
		n           int
		size, alpha [2]float64
		halo        float64
	}
	layers := []layer{
		{int(190 * sc.stars), [2]float64{0.45, 0.95}, [2]float64{0.3, 0.65}, 0},
		{int(70 * sc.stars), [2]float64{0.8, 1.5}, [2]float64{0.5, 0.9}, 0},
		{int(9 * sc.stars), [2]float64{1.3, 1.9}, [2]float64{0.8, 1}, 0.12},
	}
	for _, l := range layers {
		for i := 0; i < l.n; i++ {
			x, y := r.float()*Width, r.float()*Height
			size := lerp(l.size[0], l.size[1], r.float())
			a := lerp(l.alpha[0], l.alpha[1], r.float())
			tint := starTints[int(r.float()*float64(len(starTints)))%len(starTints)]
			// thin out over the text and toward / below a limb
			a *= 1 - math.Min(1, holeAt(sc.hole, x, y)/0.6)
			if p := sc.planet; p != nil {
				d := math.Hypot(x-p.cx, y-p.cy) - p.R
				if d < 6 {
					continue
				}
				a *= smooth(math.Min(1, d/140))
			}
			if a < 0.03 {
				continue
			}
			splat(buf, x, y, size*0.55, a, tint)
			if l.halo > 0 {
				splat(buf, x, y, size*3.2, a*l.halo, tint)
			}
		}
	}
}

// splat adds a gaussian dot (sigma in px) to the buffer.
func splat(buf []rgb, cx, cy, sigma, a float64, c rgb) {
	rad := int(math.Ceil(sigma * 3.2))
	x0, y0 := int(cx), int(cy)
	inv := 1 / (2 * sigma * sigma)
	// keep the peak at `a` even for sub-pixel stars, then scale down the tiniest so they stay faint
	norm := math.Min(1, sigma*1.6)
	for y := y0 - rad; y <= y0+rad; y++ {
		if y < 0 || y >= Height {
			continue
		}
		for x := x0 - rad; x <= x0+rad; x++ {
			if x < 0 || x >= Width {
				continue
			}
			dx, dy := float64(x)+0.5-cx, float64(y)+0.5-cy
			k := a * norm * math.Exp(-(dx*dx+dy*dy)*inv)
			if k < 0.002 {
				continue
			}
			p := &buf[y*Width+x]
			*p = screen(*p, c, k)
		}
	}
}

type stop struct {
	d float64
	c rgb
	a float64
}

func ramp(stops []stop, d float64) (rgb, float64) {
	if d <= stops[0].d {
		return stops[0].c, stops[0].a
	}
	for i := 1; i < len(stops); i++ {
		if d <= stops[i].d {
			t := (d - stops[i-1].d) / (stops[i].d - stops[i-1].d)
			return mix(stops[i-1].c, stops[i].c, t), lerp(stops[i-1].a, stops[i].a, t)
		}
	}
	last := stops[len(stops)-1]
	return last.c, last.a
}

// paintPlanet: dark body with a grain-free gradient, a thin bright atmosphere line, the soft
// outer glow, and the flattened highlight where the limb is closest to the content (night.ts).
func paintPlanet(buf []rgb, p planet, glow, sx, sy, sang, sr float64) {
	R := p.R
	body := []stop{{R - 200, rgb{4, 5, 10}, 1}, {R - 50, rgb{6, 8, 15}, 1}, {R - 10, rgb{11, 16, 30}, 1}, {R, rgb{20, 30, 56}, 1}}
	rim := []stop{
		{R - 4, rgb{115, 163, 252}, 0}, {R - 0.8, rgb{150, 190, 255}, 0.4}, {R, rgb{200, 220, 255}, 0.72},
		{R + 1.1, rgb{130, 175, 255}, 0.3}, {R + 7, rgb{115, 163, 252}, 0},
	}
	halo := []stop{
		{R, rgb{95, 140, 245}, 0.2 * glow}, {R + 16, rgb{85, 125, 235}, 0.11 * glow}, {R + 60, rgb{70, 105, 210}, 0.05 * glow},
		{R + 160, rgb{50, 80, 170}, 0.018 * glow}, {R + Height*0.45, rgb{40, 60, 140}, 0},
	}
	cosA, sinA := math.Cos(-sang), math.Sin(-sang)
	for y := 0; y < Height; y++ {
		for x := 0; x < Width; x++ {
			px, py := float64(x)+0.5, float64(y)+0.5
			d := math.Hypot(px-p.cx, py-p.cy)
			if d > R+Height*0.45 {
				continue
			}
			c := buf[y*Width+x]
			// rim brightness fades toward the sides, brightest in the middle of the arc
			side := 1 - math.Min(1, math.Abs(px-sx)/(Width*0.75))
			if d < R {
				col, _ := ramp(body, d)
				// darker toward the sides of the visible body
				col = over(col, rgb{3, 4, 8}, 0.6*(1-side))
				// AA edge against the sky
				c = mix(c, col, math.Min(1, R-d))
			} else {
				hc, ha := ramp(halo, d)
				c = over(c, hc, ha)
			}
			if d > R-4 && d < R+7 {
				rc, ra := ramp(rim, d)
				c = screen(c, rc, ra*(0.2+0.8*side))
			}
			// highlight: an ellipse flattened along the tangent at the bright spot, mostly outside
			lx, ly := px-sx, py-sy
			u := lx*cosA - ly*sinA
			v := (lx*sinA + ly*cosA) / 0.3
			if k := math.Hypot(u, v) / sr; k < 1 {
				var a float64
				var hc rgb
				if k < 0.35 {
					hc, a = mix(rgb{120, 175, 255}, rgb{70, 140, 220}, k/0.35), lerp(0.14, 0.05, k/0.35)
				} else {
					hc, a = mix(rgb{70, 140, 220}, rgb{40, 100, 180}, (k-0.35)/0.65), lerp(0.05, 0, (k-0.35)/0.65)
				}
				if d < R-1 {
					a *= 0.12
				}
				c = over(c, hc, a*glow)
			}
			buf[y*Width+x] = c
		}
	}
}

// ── type ──────────────────────────────────────────────────────────────────────────────────────

type typesetter struct {
	dst   *image.RGBA
	faces []font.Face
}

func (t *typesetter) face(f *opentype.Font, size float64) font.Face {
	face, err := opentype.NewFace(f, &opentype.FaceOptions{Size: size, DPI: 72, Hinting: font.HintingNone})
	if err != nil {
		panic(err) // only fails on invalid options
	}
	t.faces = append(t.faces, face)
	return face
}

func (t *typesetter) close() {
	for _, f := range t.faces {
		_ = f.Close()
	}
}

type span struct {
	text  string
	color color.RGBA
}

// width of s in px with tracking (em fraction, like Tailwind's tracking-tight = -0.025).
func measure(face font.Face, size, tracking float64, s string) float64 {
	var w fixed.Int26_6
	prev := rune(-1)
	n := 0
	for _, r := range s {
		if prev >= 0 {
			w += face.Kern(prev, r)
		}
		adv, _ := face.GlyphAdvance(r)
		w += adv
		prev = r
		n++
	}
	if n > 1 {
		return float64(w)/64 + tracking*size*float64(n-1)
	}
	return float64(w) / 64
}

func (t *typesetter) draw(face font.Face, size, tracking, x, baseline float64, spans ...span) float64 {
	prev := rune(-1)
	for _, sp := range spans {
		src := image.NewUniform(sp.color)
		for _, r := range sp.text {
			if prev >= 0 {
				x += float64(face.Kern(prev, r))/64 + tracking*size
			}
			dot := fixed.Point26_6{X: fixed.Int26_6(math.Round(x * 64)), Y: fixed.Int26_6(math.Round(baseline * 64))}
			dr, mask, mp, adv, ok := face.Glyph(dot, r)
			if ok {
				draw.DrawMask(t.dst, dr, src, image.Point{}, mask, mp, draw.Over)
			}
			x += float64(adv) / 64
			prev = r
		}
	}
	return x
}

// wrap breaks s into at most maxLines lines no wider than width, ending with … when cut.
func wrap(face font.Face, size, tracking, width float64, s string, maxLines int) []string {
	words := strings.Fields(s)
	fits := func(l string) bool { return measure(face, size, tracking, l) <= width }
	var lines []string
	cur := ""
	i := 0
	for i < len(words) && len(lines) < maxLines {
		w := words[i]
		next := w
		if cur != "" {
			next = cur + " " + w
		}
		switch {
		case fits(next):
			cur = next
			i++
		case cur == "":
			// a single word wider than the line: hard-break it
			head := w
			for utf8.RuneCountInString(head) > 1 && !fits(head) {
				_, sz := utf8.DecodeLastRuneInString(head)
				head = head[:len(head)-sz]
			}
			lines = append(lines, head)
			if words[i] = w[len(head):]; words[i] == "" {
				i++
			}
		default:
			lines = append(lines, cur)
			cur = ""
		}
	}
	if cur != "" {
		lines = append(lines, cur)
	}
	if i < len(words) && len(lines) > 0 {
		last := strings.TrimRight(lines[len(lines)-1], " ,.;:—-")
		for last != "" && !fits(last+"…") {
			_, sz := utf8.DecodeLastRuneInString(last)
			last = strings.TrimRight(last[:len(last)-sz], " ,.;:—-")
		}
		lines[len(lines)-1] = last + "…"
	}
	return lines
}

// Clean drops control characters and glyphs the embedded fonts do not have (emoji, CJK …),
// collapses whitespace, and caps the length in runes.
func Clean(s string, max int) string {
	_ = loadFonts()
	var b strings.Builder
	var sb sfnt.Buffer
	n := 0
	space := false
	for _, r := range s {
		if unicode.IsSpace(r) {
			space = b.Len() > 0
			continue
		}
		if unicode.IsControl(r) {
			continue
		}
		if semiBold != nil {
			if gi, err := semiBold.GlyphIndex(&sb, r); err != nil || gi == 0 {
				continue
			}
		}
		if n >= max {
			b.WriteRune('…')
			break
		}
		if space {
			b.WriteByte(' ')
			n++
			space = false
		}
		b.WriteRune(r)
		n++
	}
	return b.String()
}

// brand draws the favicon mark and the host label; returns the right edge.
func (t *typesetter) brand(x, top, markSize float64, short string) float64 {
	drawMark(t.dst, x, top, markSize, colFg)
	size := markSize * 0.62
	face := t.face(semiBold, size)
	baseline := top + markSize/2 + size*0.36
	tx := x + markSize + markSize*0.36
	if short == "" {
		return t.draw(face, size, -0.02, tx, baseline, span{"ma", colFg}, span{".cyou", colMuted})
	}
	return t.draw(face, size, -0.02, tx, baseline, span{short, colAccent}, span{".ma.cyou", colMuted})
}

// drawHero is the homepage: the big two-tone wordmark, the name, and the tagline, centred.
func drawHero(t *typesetter, info siteInfo, subtitle string) {
	if subtitle == "" {
		subtitle = info.subtitle
	}
	const wordSize = 168.0
	word := t.face(semiBold, wordSize)
	ww := measure(word, wordSize, -0.03, "ma.cyou")
	wordBase := 300.0
	t.draw(word, wordSize, -0.03, (Width-ww)/2, wordBase, span{"ma", colFg}, span{".cyou", colMuted})

	const nameSize = 44.0
	name := t.face(semiBold, nameSize)
	nw := measure(name, nameSize, -0.02, info.title)
	t.draw(name, nameSize, -0.02, (Width-nw)/2, wordBase+82, span{info.title, colFg})

	const subSize = 30.0
	sub := t.face(regular, subSize)
	lines := wrap(sub, subSize, 0, 900, subtitle, 2)
	for i, l := range lines {
		lw := measure(sub, subSize, 0, l)
		t.draw(sub, subSize, 0, (Width-lw)/2, wordBase+140+float64(i)*subSize*1.4, span{l, colMuted})
	}
}

// drawTitled is every other card: brand row on top, a large title and a muted subtitle on the left.
func drawTitled(t *typesetter, info siteInfo, c Card, sc scene) {
	const padX, top = 80.0, 70.0
	title, subtitle := c.Title, c.Subtitle
	if title == "" {
		title = info.title
		if subtitle == "" {
			subtitle = info.subtitle
		}
	}
	t.brand(padX, top, 50, info.short)

	maxW := float64(Width) - padX*2
	if sc.planet != nil && c.Site == SiteProjects {
		maxW -= 120 // keep clear of the corner limb
	}
	var (
		tSize  float64
		tFace  font.Face
		tLines []string
	)
	for _, size := range []float64{84, 76, 68, 60, 54} {
		tSize = size
		tFace = t.face(semiBold, size)
		tLines = wrap(tFace, size, -0.025, maxW, title, 3)
		if len(tLines) <= 2 && !strings.HasSuffix(tLines[len(tLines)-1], "…") {
			break
		}
	}
	tLead := tSize * 1.1

	const sSize = 32.0
	sFace := t.face(regular, sSize)
	var sLines []string
	if subtitle != "" {
		sLines = wrap(sFace, sSize, 0, maxW, subtitle, 2)
	}
	sLead := sSize * 1.4

	// block height from the first cap line to the last baseline
	h := tSize*0.73 + tLead*float64(len(tLines)-1)
	if len(sLines) > 0 {
		h += 46 + sSize*0.73 + sLead*float64(len(sLines)-1)
	}
	// centre the block between the brand row and the limb, nudged up a little
	areaTop, areaBottom := top+50+40, sc.textBottom
	y := areaTop + math.Max(0, (areaBottom-areaTop-h)/2-10)

	// accent rule above the title, like a section eyebrow
	fillRect(t.dst, padX, y-34, 56, 4, colAccent)

	base := y + tSize*0.73
	for i, l := range tLines {
		t.draw(tFace, tSize, -0.025, padX-tSize*0.04, base+float64(i)*tLead, span{l, colFg})
	}
	base += tLead * float64(len(tLines)-1)
	if len(sLines) > 0 {
		base += 46 + sSize*0.73
		for i, l := range sLines {
			t.draw(sFace, sSize, 0, padX, base+float64(i)*sLead, span{l, colMuted})
		}
	}
}

func fillRect(dst *image.RGBA, x, y, w, h float64, c color.RGBA) {
	r := vector.NewRasterizer(Width, Height)
	rad := h / 2
	// pill
	r.MoveTo(float32(x+rad), float32(y))
	r.LineTo(float32(x+w-rad), float32(y))
	r.QuadTo(float32(x+w), float32(y), float32(x+w), float32(y+rad))
	r.QuadTo(float32(x+w), float32(y+h), float32(x+w-rad), float32(y+h))
	r.LineTo(float32(x+rad), float32(y+h))
	r.QuadTo(float32(x), float32(y+h), float32(x), float32(y+rad))
	r.QuadTo(float32(x), float32(y), float32(x+rad), float32(y))
	r.ClosePath()
	r.Draw(dst, dst.Bounds(), image.NewUniform(c), image.Point{})
}

// drawMark rasterises apps/*/public/favicon.svg (a 100×100 viewBox) at (x, y) with side `size`.
func drawMark(dst *image.RGBA, x, y, size float64, c color.RGBA) {
	s := size / 100
	r := vector.NewRasterizer(Width, Height)
	p := func(px, py float64) (float32, float32) { return float32(x + px*s), float32(y + py*s) }
	move := func(a, b float64) { r.MoveTo(p(a, b)) }
	line := func(a, b float64) { r.LineTo(p(a, b)) }
	cube := func(a, b, c2, d, e, f float64) {
		x1, y1 := p(a, b)
		x2, y2 := p(c2, d)
		x3, y3 := p(e, f)
		r.CubeTo(x1, y1, x2, y2, x3, y3)
	}
	// M100,50c0,18.3-9.8,34.3-24.5,43v-23.2l21.5-5.9-21.5-5.9V24.2h-.5l-25,23.8-25-23.8h-.5v68.8
	// C9.8,84.3,0,68.3,0,50,0,22.4,22.4,0,50,0s50,22.4,50,50Z
	move(100, 50)
	cube(100, 68.3, 90.2, 84.3, 75.5, 93)
	line(75.5, 69.8)
	line(97, 63.9)
	line(75.5, 58)
	line(75.5, 24.2)
	line(75, 24.2)
	line(50, 48)
	line(25, 24.2)
	line(24.5, 24.2)
	line(24.5, 93)
	cube(9.8, 84.3, 0, 68.3, 0, 50)
	cube(0, 22.4, 22.4, 0, 50, 0)
	cube(77.6, 0, 100, 22.4, 100, 50)
	r.ClosePath()
	// polygon 75.5,58.1 75.5,69.9 53,76 53,52
	move(75.5, 58.1)
	line(75.5, 69.9)
	line(53, 76)
	line(53, 52)
	r.ClosePath()
	r.Draw(dst, dst.Bounds(), image.NewUniform(c), image.Point{})
}

// ── math ──────────────────────────────────────────────────────────────────────────────────────

func lerp(a, b, t float64) float64 { return a + (b-a)*t }
func mix(a, b rgb, t float64) rgb {
	return rgb{lerp(a.r, b.r, t), lerp(a.g, b.g, t), lerp(a.b, b.b, t)}
}
func over(dst, src rgb, a float64) rgb { return mix(dst, src, math.Max(0, math.Min(1, a))) }
func screen(dst, src rgb, a float64) rgb {
	f := func(d, s float64) float64 { return d + (255-d)*(s/255)*a }
	return rgb{f(dst.r, src.r), f(dst.g, src.g), f(dst.b, src.b)}
}
func smooth(t float64) float64 { return t * t * (3 - 2*t) }
func clamp8(v float64) uint8 {
	if v <= 0 {
		return 0
	}
	if v >= 255 {
		return 255
	}
	return uint8(v + 0.5)
}

type rng struct{ s uint32 }

func newRNG(seed uint32) *rng { return &rng{seed*747796405 + 2891336453} }
func (r *rng) float() float64 {
	r.s ^= r.s << 13
	r.s ^= r.s >> 17
	r.s ^= r.s << 5
	return float64(r.s) / (1 << 32)
}

func hash2(x, y int32, seed uint32) float64 {
	h := uint32(x)*374761393 + uint32(y)*668265263 + seed*2246822519
	h = (h ^ (h >> 13)) * 1274126177
	h ^= h >> 16
	return float64(h) / (1 << 32)
}

func vnoise(x, y float64, seed uint32) float64 {
	x0, y0 := math.Floor(x), math.Floor(y)
	fx, fy := smooth(x-x0), smooth(y-y0)
	ix, iy := int32(x0), int32(y0)
	a := hash2(ix, iy, seed)
	b := hash2(ix+1, iy, seed)
	c := hash2(ix, iy+1, seed)
	d := hash2(ix+1, iy+1, seed)
	return lerp(lerp(a, b, fx), lerp(c, d, fx), fy)
}

// fbm: four octaves of value noise in 0..1, the wispy texture over the nebula.
func fbm(x, y float64, seed uint32) float64 {
	var sum, amp, norm = 0.0, 0.5, 0.0
	for i := 0; i < 4; i++ {
		sum += vnoise(x, y, seed+uint32(i)*97) * amp
		norm += amp
		x, y = x*2.03+17.1, y*2.03+9.7
		amp *= 0.5
	}
	return sum / norm
}
