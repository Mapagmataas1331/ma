/** Shared plumbing for the SkyBackdrop scenes (canvas helpers, seeded noise). */

export const TAU = Math.PI * 2

export type Rect = { x: number; y: number; w: number; h: number }

export type SceneEnv = {
  /** Viewport size in CSS px. */
  w: number
  h: number
  /** Backing-store scale (already capped). */
  dpr: number
  /** The page's content column in viewport CSS px, when the host passes one. */
  content: Rect | null
}

export interface SkyScene {
  /** Frame cap; slow scenes look identical at 30fps and cost half. */
  readonly fps: number
  /**
   * (Re)build caches for a size. Must stay cheap when only the height jitters (mobile URL bar).
   * `invalidate` asks the host for a fresh frame once deferred work (e.g. cloud sprites) lands.
   */
  layout(canvas: HTMLCanvasElement, env: SceneEnv, invalidate: () => void): void
  /** Paint a full frame. `t` scene clock (s), `dt` step (s), `shift` parallax (CSS px), `still` = static frame. */
  draw(t: number, dt: number, shift: number, still: boolean): void
  /** Drop the big per-size caches while the scene is not visible. */
  release(): void
}

export type Ctx = CanvasRenderingContext2D

export const rand = (a: number, b: number) => a + Math.random() * (b - a)
export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
export const mix = (a: number, b: number, k: number) => a + (b - a) * k
export const smooth = (e0: number, e1: number, x: number) => {
  const k = clamp01((x - e0) / (e1 - e0))
  return k * k * (3 - 2 * k)
}

/** Offscreen canvas + 2d context with a CSS-px transform (`dpr`) and an optional y origin. */
export function makeLayer(w: number, h: number, dpr = 1, originY = 0): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.ceil(w))
  c.height = Math.max(1, Math.ceil(h))
  const g = c.getContext('2d') as Ctx
  g.setTransform(dpr, 0, 0, dpr, 0, -originY * dpr)
  return [c, g]
}

/** Free a canvas backing store right away instead of waiting for GC. */
export function freeCanvas(c: HTMLCanvasElement | null | undefined) {
  if (!c) return
  c.width = 0
  c.height = 0
}

/** Seeded PRNG (mulberry32). */
export function rng(seed: number) {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Noise2 = (x: number, y: number, period?: number) => number

/** 2D Perlin noise; `period` (lattice cells) makes it tile horizontally. Range ≈ [-0.7, 0.7]. */
export function perlin(seed: number): Noise2 {
  const R = rng(seed)
  const p = new Uint8Array(512)
  const gx = new Float32Array(256)
  const gy = new Float32Array(256)
  for (let i = 0; i < 256; i++) {
    p[i] = i
    const a = R() * TAU
    gx[i] = Math.cos(a)
    gy[i] = Math.sin(a)
  }
  for (let i = 255; i > 0; i--) {
    const j = (R() * (i + 1)) | 0
    const tmp = p[i]
    p[i] = p[j]
    p[j] = tmp
  }
  for (let i = 0; i < 256; i++) p[i + 256] = p[i]
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
  const grad = (ix: number, iy: number, dx: number, dy: number) => {
    const h = p[p[ix] + iy]
    return gx[h] * dx + gy[h] * dy
  }
  return (x, y, period = 0) => {
    let xi = Math.floor(x)
    let yi = Math.floor(y)
    const xf = x - xi
    const yf = y - yi
    let x1 = xi + 1
    if (period) {
      xi = ((xi % period) + period) % period
      x1 = ((x1 % period) + period) % period
    }
    xi &= 255
    x1 &= 255
    yi &= 255
    const y1 = (yi + 1) & 255
    const u = fade(xf)
    const v = fade(yf)
    const a = grad(xi, yi, xf, yf)
    const b = grad(x1, yi, xf - 1, yf)
    const c = grad(xi, y1, xf, yf - 1)
    const d = grad(x1, y1, xf - 1, yf - 1)
    const top = a + (b - a) * u
    return top + (c + (d - c) * u - top) * v
  }
}

/** Fractal sum of `noise`. Range ≈ [-0.6, 0.6]. */
export function fbm(noise: Noise2, x: number, y: number, octaves = 5, period = 0) {
  let sum = 0
  let amp = 0.5
  let freq = 1
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise(x * freq, y * freq, period ? period * freq : 0)
    norm += amp
    amp *= 0.5
    freq *= 2
  }
  return sum / norm
}

/** Repeating dither tile; kills gradient banding. `light` = ±1 level for bright skies. */
export function grainTile(kind: 'dark' | 'light') {
  const [c, g] = makeLayer(128, 128)
  const img = g.createImageData(128, 128)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    if (kind === 'dark') {
      const v = Math.random() * 255
      d[i] = d[i + 1] = d[i + 2] = v
      d[i + 3] = 0.028 * 255
    } else {
      const up = Math.random() < 0.5
      d[i] = up ? 255 : 90
      d[i + 1] = up ? 255 : 110
      d[i + 2] = up ? 255 : 140
      d[i + 3] = Math.random() * (up ? 9 : 5)
    }
  }
  g.putImageData(img, 0, 0)
  return c
}

/** Overlay a grain tile in device pixels; `atop` keeps transparent pixels transparent. */
export function applyGrain(c: HTMLCanvasElement, tile: HTMLCanvasElement, atop = false) {
  const g = c.getContext('2d')
  if (!g) return
  g.save()
  g.setTransform(1, 0, 0, 1, 0, 0)
  g.globalCompositeOperation = atop ? 'source-atop' : 'source-over'
  const pattern = g.createPattern(tile, 'repeat')
  if (pattern) {
    g.fillStyle = pattern
    g.fillRect(0, 0, c.width, c.height)
  }
  g.restore()
}

/** Radial gradient with stops given in absolute radii (clamped into [r0, r1]). */
export function ring(
  g: Ctx,
  cx: number,
  cy: number,
  r0: number,
  r1: number,
  stops: [number, string][],
) {
  const rg = g.createRadialGradient(cx, cy, r0, cx, cy, r1)
  for (const [r, col] of stops) rg.addColorStop(clamp01((r - r0) / (r1 - r0)), col)
  return rg
}
