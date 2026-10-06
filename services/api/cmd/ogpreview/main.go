// Command ogpreview writes Open Graph cards to disk for eyeballing the design without the API:
//
//	go run ./cmd/ogpreview -out /tmp/og
package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/mapagmataas1331/ma/services/api/internal/og"
)

func main() {
	out := flag.String("out", "og-preview", "output directory")
	flag.Parse()
	if err := os.MkdirAll(*out, 0o755); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	cards := map[string]og.Card{
		"home":          {Site: og.SiteHome},
		"projects":      {Site: og.SiteProjects},
		"resume":        {Site: og.SiteResume},
		"chat":          {Site: og.SiteChat},
		"home-title":    {Site: og.SiteHome, Title: "Hello from ma.cyou", Subtitle: "A custom title and subtitle."},
		"projects-long": {Site: og.SiteProjects, Title: "Redis Grafana dashboards: metrics, alerts and the boring parts that keep it online", Subtitle: "A long subtitle that keeps going to check that wrapping and the ellipsis behave nicely on two lines at most, really."},
		"resume-ru":     {Site: og.SiteResume, Title: "Резюме — веб-системы, PostgreSQL, Linux", Subtitle: "Без корпоративного тумана."},
	}
	for name, c := range cards {
		start := time.Now()
		b, err := og.RenderPNG(c)
		if err != nil {
			fmt.Fprintln(os.Stderr, name, err)
			os.Exit(1)
		}
		path := filepath.Join(*out, name+".png")
		if err := os.WriteFile(path, b, 0o644); err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		fmt.Printf("%-14s %6.1f KB %4d ms\n", name, float64(len(b))/1024, time.Since(start).Milliseconds())
	}
}
