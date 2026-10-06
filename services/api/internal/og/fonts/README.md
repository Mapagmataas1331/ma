Inter 4.001 (https://rsms.me/inter, SIL Open Font License 1.1, see OFL.txt), instanced from the
variable font for the Open Graph card renderer:

- `Inter-SemiBold.ttf`: wght 600, opsz 32 (titles, wordmark)
- `Inter-Regular.ttf`: wght 400, opsz 24 (subtitles)

Both are subset to Latin, Latin-1, Latin Extended-A, basic Cyrillic, and common punctuation, keep
GPOS kerning, and have the site's `cv11` (single-storey a) and `ss01` (open digits) alternates baked
into the cmap so the card matches `font-feature-settings` in packages/ui/src/styles.css.
Rebuild with fontTools `varLib.instancer` + `subset` if more glyphs are needed.
