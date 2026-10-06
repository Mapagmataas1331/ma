import {
  TAU,
  applyGrain,
  freeCanvas,
  grainTile,
  makeLayer,
  rand,
  ring,
  rng,
  type Ctx,
  type SkyScene,
} from './kit'

/**
 * Night sky toolkit: navy base · faint nebula glows · drifting, twinkling stars · an optional
 * planet limb with a breathing atmosphere · optional shooting stars. Each page composes these
 * through a `NightConfig` (see presets.ts).
 */

export type Blob = {
  /** Anchor, as fractions of the viewport (may sit slightly off-screen). */
  ax: number
  ay: number
  /** Radius × viewport diagonal. */
  r: number
  c: [number, number, number]
  a: number
  /** Orbit amplitude (fraction) and period (s). */
  amp: number
  T: number
  p: number
}

export type Planet = { cx: number; cy: number; R: number }

export type NightConfig = {
  /** Frame cap; 0 = static. */
  fps: number
  /** Base gradient: top, 60%, bottom. */
  base: [string, string, string]
  /** Strength of the soft lift behind the content (0..1). */
  lift: number
  /** Star field multipliers relative to the homepage sky. */
  stars: { density: number; alpha: number; twinkle: number; speed: number }
  blobs: Blob[]
  nebGain: number
  /** Keep-out ellipse over the content (fractions; ry defaults to the homepage proportion). */
  hole: { x: number; y: number; rx: number; ry?: number } | null
  planet: ((w: number, h: number) => Planet) | null
  glow: number
  meteors: boolean
}

type Star = {
  x: number
  y: number
  r: number
  a: number
  w: number
  p: number
  d: number
  c: string
}
type StarLayer = { density: number; size: [number, number]; alpha: [number, number]; speed: number }
type Meteor = {
  x: number
  y: number
  vx: number
  vy: number
  speed: number
  len: number
  t0: number
  dur: number
}

const TINTS = [
  'rgb(255,255,255)',
  'rgb(232,238,255)',
  'rgb(214,224,255)',
  'rgb(196,212,255)',
  'rgb(255,246,236)',
]
const DIR = [-Math.cos(0.22), -Math.sin(0.22)] as const // drift left, slightly up
const LAYERS: StarLayer[] = [
  { density: 1.1e-4, size: [0.4, 0.85], alpha: [0.28, 0.6], speed: 1.6 },
  { density: 0.42e-4, size: [0.7, 1.5], alpha: [0.45, 0.85], speed: 3.6 },
]
const NEB_SCALE = 1 / 8
const BREATH = 25

/** Where a limb crosses the viewport edges (for the rim fade and the bright spot). */
function limbSpan(P: Planet, W: number, H: number) {
  const pts: [number, number][] = []
  const addX = (y: number) => {
    const d = P.R * P.R - (P.cy - y) ** 2
    if (d < 0) return
    for (const x of [P.cx - Math.sqrt(d), P.cx + Math.sqrt(d)])
      if (x >= -1 && x <= W + 1) pts.push([x, y])
  }
  const addY = (x: number) => {
    const d = P.R * P.R - (P.cx - x) ** 2
    if (d < 0) return
    for (const y of [P.cy - Math.sqrt(d), P.cy + Math.sqrt(d)])
      if (y >= -1 && y <= H + 1) pts.push([x, y])
  }
  addX(H)
  addX(0)
  addY(0)
  addY(W)
  if (pts.length < 2)
    return { from: [0, H] as [number, number], to: [W, H] as [number, number], top: H }
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const from = pts[0]
  const to = pts[pts.length - 1]
  const crown = P.cx >= 0 && P.cx <= W ? [P.cy - P.R] : []
  const top = Math.max(0, Math.min(...crown, ...pts.map((p) => p[1])))
  return { from, to, top }
}

function makeNoiseMask(w: number, h: number) {
  const [c, g] = makeLayer(w, h)
  const img = g.createImageData(c.width, c.height)
  const R = rng(4242) // seeded: a relayout keeps the same wisps
  const oct = (
    [
      [3, 0.55],
      [6, 0.28],
      [12, 0.17],
    ] as const
  ).map(([n, amp]) => {
    const grid = new Float32Array((n + 2) * (n + 2))
    for (let i = 0; i < grid.length; i++) grid[i] = R()
    return { n, amp, grid }
  })
  const sm = (x: number) => x * x * (3 - 2 * x)
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      let v = 0
      for (const o of oct) {
        const fx = (x / c.width) * o.n
        const fy = (y / c.height) * o.n
        const ix = fx | 0
        const iy = fy | 0
        const tx = sm(fx - ix)
        const ty = sm(fy - iy)
        const S = o.n + 2
        const a = o.grid[iy * S + ix]
        const b = o.grid[iy * S + ix + 1]
        const cc = o.grid[(iy + 1) * S + ix]
        const d = o.grid[(iy + 1) * S + ix + 1]
        v += o.amp * ((a + (b - a) * tx) * (1 - ty) + (cc + (d - cc) * tx) * ty)
      }
      const i = (y * c.width + x) * 4
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255
      img.data[i + 3] = (0.25 + 0.75 * Math.min(1, Math.max(0, (v - 0.22) / 0.6))) * 255
    }
  }
  g.putImageData(img, 0, 0)
  return c
}

export function createNightScene(cfg: NightConfig): SkyScene {
  let canvas: HTMLCanvasElement | null = null
  let ctx: Ctx | null = null
  let W = 0
  let H = 0
  let DPR = 1
  let base: HTMLCanvasElement | null = null
  let planet: HTMLCanvasElement | null = null // planet body + rim line
  let glow: HTMLCanvasElement | null = null // limb glow
  let planetY = 0
  let glowY = 0
  let neb: HTMLCanvasElement | null = null
  let nctx: Ctx | null = null
  let mask: HTMLCanvasElement | null = null
  let nebMask: HTMLCanvasElement | null = null
  let stars: Star[][] = []
  let starsW = 0
  let acc = 1
  let meteor: Meteor | null = null
  let nextMeteor = rand(6, 14)
  let P: Planet | null = null
  const S = cfg.stars
  const layers = LAYERS.map((L) => ({
    ...L,
    density: L.density * S.density,
    speed: L.speed * S.speed,
  }))

  const makeStar = (L: StarLayer): Star => ({
    x: Math.random() * W,
    y: Math.random() * H,
    r: rand(L.size[0], L.size[1]),
    a: rand(L.alpha[0], L.alpha[1]) * S.alpha,
    w: rand(0.25, 0.9),
    p: Math.random() * TAU,
    d: rand(0.15, 0.45) * S.twinkle,
    c: TINTS[(Math.random() * TINTS.length) | 0],
  })

  function renderNebula(t: number) {
    if (!neb || !nctx || !mask || !nebMask) return
    const w = neb.width
    const h = neb.height
    const D = Math.hypot(w, Math.min(h, w * 1.2)) // portrait: keep the clouds as corner glows
    nctx.globalCompositeOperation = 'source-over'
    nctx.clearRect(0, 0, w, h)
    nctx.globalCompositeOperation = 'lighter'
    for (const b of cfg.blobs) {
      const ph = (t / b.T) * TAU + b.p
      const x = (b.ax + b.amp * Math.sin(ph)) * w
      const y = (b.ay + b.amp * 0.8 * Math.sin(ph * 2 + 1.3)) * h
      const r = b.r * D * (1 + 0.08 * Math.sin(ph + 0.7))
      const a = b.a * cfg.nebGain * (0.85 + 0.15 * Math.sin(ph + 2.4))
      const g = nctx.createRadialGradient(x, y, 0, x, y, r)
      for (let i = 0; i <= 12; i++) {
        const k = i / 12
        const f = (1 - k * k) ** 3
        g.addColorStop(k, `rgba(${b.c[0]},${b.c[1]},${b.c[2]},${(a * f).toFixed(4)})`)
      }
      nctx.fillStyle = g
      nctx.fillRect(0, 0, w, h)
    }
    // wispy texture drifting on a slow 60s circle (loops seamlessly)
    const ph = (t / 60) * TAU
    const mw = mask.width
    const mh = mask.height
    nctx.globalCompositeOperation = 'destination-in'
    nctx.drawImage(
      mask,
      -(mw - w) / 2 + Math.cos(ph) * (mw - w) * 0.3,
      -(mh - h) / 2 + Math.sin(ph) * (mh - h) * 0.3,
    )
    nctx.drawImage(nebMask, 0, 0)
    nctx.globalCompositeOperation = 'source-over'
  }

  function syncStars() {
    const area = W * H
    if (starsW !== W || stars.length !== layers.length) {
      stars = layers.map((L) =>
        Array.from({ length: Math.round(area * L.density) }, () => makeStar(L)),
      )
      starsW = W
      return
    }
    // height-only change (mobile URL bar): keep every star where it is; top up / trim only on big changes
    layers.forEach((L, i) => {
      const want = Math.round(area * L.density)
      const list = stars[i]
      if (want > list.length * 1.1) while (list.length < want) list.push(makeStar(L))
      else if (want < list.length * 0.9) list.length = want
    })
  }

  function release() {
    for (const c of [base, planet, glow, neb, mask, nebMask]) freeCanvas(c)
    base = planet = glow = neb = mask = nebMask = null
    nctx = null
  }

  function buildPlanet(cw: number, Pl: Planet) {
    const span = limbSpan(Pl, W, H)
    const top = span.top
    // bright spot: the point of the limb closest to the middle of the screen
    const dx = W * 0.5 - Pl.cx
    const dy = H * 0.45 - Pl.cy
    const dl = Math.hypot(dx, dy) || 1
    const spot = {
      x: Pl.cx + (dx / dl) * Pl.R,
      y: Pl.cy + (dy / dl) * Pl.R,
      ang: Math.atan2(dy, dx) + Math.PI / 2,
    }

    planetY = Math.max(0, top - 24)
    let g: Ctx
    ;[planet, g] = makeLayer(cw, (H - planetY) * DPR + 2, DPR, planetY)
    g.fillStyle = ring(g, Pl.cx, Pl.cy, Pl.R - 200, Pl.R, [
      [Pl.R - 200, 'rgb(4,5,10)'],
      [Pl.R - 50, 'rgb(6,8,15)'],
      [Pl.R - 10, 'rgb(11,16,30)'],
      [Pl.R, 'rgb(20,30,56)'],
    ])
    g.beginPath()
    g.arc(Pl.cx, Pl.cy, Pl.R, 0, TAU)
    g.fill()
    const side = g.createLinearGradient(span.from[0], span.from[1], span.to[0], span.to[1])
    side.addColorStop(0, 'rgba(3,4,8,0.6)')
    side.addColorStop(0.5, 'rgba(3,4,8,0)')
    side.addColorStop(1, 'rgba(3,4,8,0.6)')
    g.save()
    g.beginPath()
    g.arc(Pl.cx, Pl.cy, Pl.R, 0, TAU)
    g.clip()
    g.fillStyle = side
    g.fillRect(0, planetY, W, H - planetY)
    g.restore()
    applyGrain(planet, grainTile('dark'), true)
    {
      // thin atmosphere line, brightest in the middle of the visible arc
      const [rc, rg] = makeLayer(cw, (H - planetY) * DPR + 2, DPR, planetY)
      rg.fillStyle = ring(rg, Pl.cx, Pl.cy, Pl.R - 4, Pl.R + 7, [
        [Pl.R - 4, 'rgba(115,163,252,0)'],
        [Pl.R - 0.8, 'rgba(150,190,255,0.40)'],
        [Pl.R, 'rgba(200,220,255,0.72)'],
        [Pl.R + 1.1, 'rgba(130,175,255,0.30)'],
        [Pl.R + 7, 'rgba(115,163,252,0)'],
      ])
      rg.fillRect(0, planetY, W, H - planetY)
      rg.globalCompositeOperation = 'destination-in'
      const fade = rg.createLinearGradient(span.from[0], span.from[1], span.to[0], span.to[1])
      fade.addColorStop(0, 'rgba(0,0,0,0.2)')
      fade.addColorStop(0.5, 'rgba(0,0,0,1)')
      fade.addColorStop(1, 'rgba(0,0,0,0.2)')
      rg.fillStyle = fade
      rg.fillRect(0, planetY, W, H - planetY)
      g.save()
      g.setTransform(1, 0, 0, 1, 0, 0)
      g.globalAlpha = 0.95
      g.drawImage(rc, 0, 0)
      g.restore()
      freeCanvas(rc)
    }

    // soft limb glow (breathes)
    glowY = Math.max(0, top - H * 0.45)
    ;[glow, g] = makeLayer(cw, (H - glowY) * DPR + 2, DPR, glowY)
    const k = cfg.glow
    g.fillStyle = ring(g, Pl.cx, Pl.cy, Pl.R, Pl.R + H * 0.45, [
      [Pl.R, `rgba(95,140,245,${0.2 * k})`],
      [Pl.R + 16, `rgba(85,125,235,${0.11 * k})`],
      [Pl.R + 60, `rgba(70,105,210,${0.05 * k})`],
      [Pl.R + 160, `rgba(50,80,170,${0.018 * k})`],
      [Pl.R + H * 0.45, 'rgba(40,60,140,0)'],
    ])
    g.fillRect(0, glowY, W, H - glowY)
    g.save()
    g.translate(spot.x, spot.y)
    g.rotate(spot.ang)
    g.scale(1, 0.3)
    const hs = g.createRadialGradient(0, 0, 0, 0, 0, Math.max(Math.min(W, Pl.R) * 0.4, 260))
    hs.addColorStop(0, `rgba(120,175,255,${0.14 * k})`)
    hs.addColorStop(0.35, `rgba(70,140,220,${0.05 * k})`)
    hs.addColorStop(1, 'rgba(40,100,180,0)')
    g.fillStyle = hs
    g.fillRect(-W * 2, -H * 4, W * 4, H * 8)
    g.restore()
    g.globalCompositeOperation = 'destination-out'
    g.fillStyle = 'rgba(0,0,0,0.88)'
    g.beginPath()
    g.arc(Pl.cx, Pl.cy, Pl.R - 1, 0, TAU)
    g.fill()
  }

  return {
    fps: cfg.fps,

    layout(target, env) {
      if (canvas !== target) {
        canvas = target
        ctx = target.getContext('2d')
      }
      if (!ctx) return
      W = env.w
      H = env.h
      DPR = env.dpr
      const cw = canvas.width
      const ch = canvas.height
      release()
      P = cfg.planet ? cfg.planet(W, H) : null

      // ── base gradient + gentle lift behind the content ──
      let g: Ctx
      ;[base, g] = makeLayer(cw, ch, DPR)
      const sky = g.createLinearGradient(0, 0, 0, H)
      sky.addColorStop(0, cfg.base[0])
      sky.addColorStop(0.6, cfg.base[1])
      sky.addColorStop(1, cfg.base[2])
      g.fillStyle = sky
      g.fillRect(0, 0, W, H)
      if (cfg.lift > 0) {
        const lift = g.createRadialGradient(
          W * 0.5,
          H * 0.42,
          0,
          W * 0.5,
          H * 0.42,
          Math.hypot(W, H) * 0.55,
        )
        lift.addColorStop(0, `rgba(22,29,48,${cfg.lift})`)
        lift.addColorStop(1, 'rgba(22,29,48,0)')
        g.fillStyle = lift
        g.fillRect(0, 0, W, H)
      }

      // ── nebula buffer (1/8 res) + its static keep-out mask ──
      if (cfg.blobs.length) {
        ;[neb, nctx] = makeLayer(
          Math.max(2, Math.round(W * NEB_SCALE)),
          Math.max(2, Math.round(H * NEB_SCALE)),
        )
        mask = makeNoiseMask(Math.round(neb.width * 1.25), Math.round(neb.height * 1.25))
        const s = NEB_SCALE
        const [mc, mg] = makeLayer(neb.width, neb.height)
        nebMask = mc
        mg.fillStyle = '#fff'
        mg.fillRect(0, 0, mc.width, mc.height)
        mg.globalCompositeOperation = 'destination-out'
        if (cfg.hole) {
          const rx = mc.width * cfg.hole.rx
          const ry = cfg.hole.ry ? mc.height * cfg.hole.ry : Math.min(mc.height * 0.36, rx * 1.4)
          mg.save()
          mg.translate(mc.width * cfg.hole.x, mc.height * cfg.hole.y)
          mg.scale(1, ry / rx)
          const hole = mg.createRadialGradient(0, 0, 0, 0, 0, rx)
          hole.addColorStop(0, 'rgba(0,0,0,0.92)')
          hole.addColorStop(0.55, 'rgba(0,0,0,0.6)')
          hole.addColorStop(1, 'rgba(0,0,0,0)')
          mg.fillStyle = hole
          mg.fillRect(-rx * 2, (-rx * 2 * rx) / ry, rx * 4, (rx * 4 * rx) / ry)
          mg.restore()
        }
        if (P) {
          // fade the nebula out toward the limb so the glow and the clouds never stack
          mg.fillStyle = ring(mg, P.cx * s, P.cy * s, 0, (P.R + H * 0.32) * s, [
            [0, 'rgba(0,0,0,1)'],
            [(P.R + H * 0.04) * s, 'rgba(0,0,0,1)'],
            [(P.R + H * 0.16) * s, 'rgba(0,0,0,0.6)'],
            [(P.R + H * 0.32) * s, 'rgba(0,0,0,0)'],
          ])
          mg.fillRect(0, 0, mc.width, mc.height)
        }
      }

      if (P) buildPlanet(cw, P)
      applyGrain(base, grainTile('dark'), true)
      syncStars()
      acc = 1
    },

    draw(t, dt, shift, still) {
      if (!ctx || !canvas || !base) return
      acc += dt
      if (neb && (acc >= 0.05 || dt === 0)) {
        renderNebula(t)
        acc = 0
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
      ctx.drawImage(base, 0, 0)
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      if (neb) {
        ctx.globalCompositeOperation = 'screen'
        ctx.drawImage(neb, 0, 0, canvas.width, canvas.height)
        ctx.globalCompositeOperation = 'source-over'
      }

      // stars: drift + twinkle, thinning out toward a limb; parallax nudges them up on scroll
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
      const fadeSpan = H * 0.32
      const span = H + 8
      layers.forEach((L, li) => {
        const mx = DIR[0] * L.speed * dt
        const my = DIR[1] * L.speed * dt
        const off = (((-shift * (li === 0 ? 0.06 : 0.1)) % span) + span) % span // far layer moves less
        if (!ctx) return
        for (const s of stars[li] ?? []) {
          s.x += mx
          s.y += my
          if (s.x < -4) s.x += W + 8
          else if (s.x > W + 4) s.x -= W + 8
          if (s.y < -4) s.y += H + 8
          if (s.y > H + 4) continue // below a viewport that just got shorter: drifts back in on its own
          let y = s.y + off
          if (y > H + 4) y -= span
          let f = 1
          if (P) {
            const above = Math.hypot(s.x - P.cx, y - P.cy) - P.R
            if (above < 10) continue
            f = Math.min(1, (above - 10) / fadeSpan)
          }
          const a = s.a * f * f * (1 - s.d * (0.5 + 0.5 * Math.sin(t * s.w + s.p)))
          if (a < 0.01) continue
          ctx.fillStyle = s.c
          if (s.r > 1.2) {
            ctx.globalAlpha = a * 0.1
            ctx.beginPath()
            ctx.arc(s.x, y, s.r * 3, 0, TAU)
            ctx.fill()
          }
          ctx.globalAlpha = a
          ctx.beginPath()
          ctx.arc(s.x, y, s.r, 0, TAU)
          ctx.fill()
        }
      })

      // shooting star, confined to the top band (never in a static frame)
      if (still || !cfg.meteors) meteor = null
      else {
        if (!meteor && t >= nextMeteor) {
          const ang = rand(0.2, 0.32)
          meteor = {
            x: rand(W * 0.45, W * 0.96),
            y: rand(H * 0.03, H * 0.11),
            vx: -Math.cos(ang),
            vy: Math.sin(ang),
            speed: Math.min(320, W * 0.25) * rand(0.9, 1.05),
            len: Math.min(rand(80, 120), W * 0.22),
            t0: t,
            dur: rand(1, 1.2),
          }
          nextMeteor = t + rand(50, 80)
        }
        if (meteor) {
          const m = meteor
          const p = (t - m.t0) / m.dur
          if (p >= 1 || p < 0) meteor = null
          else {
            const travel = m.speed * (t - m.t0)
            const hx = m.x + m.vx * travel
            const hy = m.y + m.vy * travel
            const tl = m.len * Math.min(1, p * 2.2)
            const tx = hx - m.vx * tl
            const ty = hy - m.vy * tl
            const env = Math.sin(Math.PI * p) ** 1.3 * 0.5
            const lg = ctx.createLinearGradient(hx, hy, tx, ty)
            lg.addColorStop(0, `rgba(235,240,255,${env})`)
            lg.addColorStop(0.25, `rgba(190,208,255,${env * 0.45})`)
            lg.addColorStop(1, 'rgba(160,185,255,0)')
            ctx.globalAlpha = 1
            ctx.strokeStyle = lg
            ctx.lineWidth = 1
            ctx.lineCap = 'round'
            ctx.beginPath()
            ctx.moveTo(hx, hy)
            ctx.lineTo(tx, ty)
            ctx.stroke()
            ctx.globalAlpha = env * 0.5
            ctx.fillStyle = 'rgb(225,232,255)'
            ctx.beginPath()
            ctx.arc(hx, hy, 1.5, 0, TAU)
            ctx.fill()
          }
        }
      }

      // planet + limb on top
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.globalAlpha = 1
      if (planet && glow) {
        const breath = 0.5 + 0.5 * Math.sin((t / BREATH) * TAU - Math.PI / 2)
        ctx.drawImage(planet, 0, Math.round(planetY * DPR))
        ctx.globalAlpha = 0.8 + 0.2 * breath
        ctx.drawImage(glow, 0, Math.round(glowY * DPR))
        ctx.globalAlpha = 1
      }
    },

    release,
  }
}
