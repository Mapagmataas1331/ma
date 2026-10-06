import {
  TAU,
  applyGrain,
  clamp01,
  fbm,
  freeCanvas,
  grainTile,
  makeLayer,
  mix,
  perlin,
  rng,
  smooth,
  type Ctx,
  type SkyScene,
} from './kit'

/**
 * Daytime sky toolkit: warm light from the sun (bloom, faint breathing god-rays, floating
 * specks), a soft sea of cloud tops that catches the sun's warmth, and high thin wisps.
 * Each page composes these through a `DayConfig` (see presets.ts).
 */

type Puff = { x: number; y: number; rx: number; ry: number; z: number }
type BandOpts = { seed: number; rMax: number; lineY: number; haze: number; zBase: number }
type Band = { sprite: HTMLCanvasElement; y: number; w: number; h: number; v: number; x: number }
type Ray = {
  a: number
  wd: number
  len: number
  alpha: number
  per: number
  ph: number
  sway: number
}
type BandDef = {
  y0: number
  line: number
  rMax: number
  haze: number
  z: number
  v: number
  seed: number
}
type Mote = {
  x: number
  y: number
  vx: number
  vy: number
  s: number
  o: number
  per: number
  ph: number
}
type WispState = {
  sprite: HTMLCanvasElement
  x: number
  y: number
  w: number
  h: number
  alpha: number
  v: number
  key: string
}

/** A high, thin cirrus streak. x/y/w/h are fractions of the viewport; w/h are capped by maxW/maxH (CSS px). */
export type Wisp = {
  x: number
  y: number
  w: number
  h: number
  maxW: number
  maxH: number
  alpha: number
  seed: number
  v: number
}

export type DayConfig = {
  /** Frame cap; 0 = static. */
  fps: number
  /** Sun position (fractions of the viewport; usually just off-screen). */
  sun: [number, number]
  /** Sky colours painted outward from the sun. */
  sky: [number, string][]
  /** Gradient reach × viewport diagonal. */
  reach: number
  bloom: number
  bloomR: number
  /** Luminous haze resting on the horizon / cloud sea (0 = none, 1 = homepage). */
  horizon: number
  rays: { count: number; alpha: number } | null
  /** Max floating specks of light. */
  motes: number
  /** Sea of cloud tops; `top` is a fraction of the height or 'content' (just under the content column). */
  sea: { side: 'full' | 'left'; top: number | 'content' } | null
  wisps: Wisp[]
  /** Soft brightening behind the content: a round glow or a full-height reading column. */
  veil: { kind: 'radial' | 'column'; alpha: number } | null
}

const S = 0.5 // cloud sprite resolution relative to CSS px (they're soft; upscaling is invisible)
const RS = 0.25 // god-ray layer resolution
const HAZE_RGB: [number, number, number] = [240, 244, 250]

/** One horizontally tiling band of cumulus tops: a foreshortened cauliflower merged into a lit height field. */
/** Generator so the work can be time-sliced across frames (yields once per row). */
function* makeBand(
  Tw: number,
  bh: number,
  { seed, rMax, lineY, haze, zBase }: BandOpts,
): Generator<void, HTMLCanvasElement, void> {
  const R = rng(seed)
  const edgeN = perlin(seed * 5 + 3)
  const bumpN = perlin(seed * 11 + 1)
  const w = Math.round(Tw * S)
  const h = Math.max(8, Math.round(bh * S))
  const ly = lineY * S
  const rm = rMax * S

  const puffs: Puff[] = []
  const nM = Math.max(3, Math.round(w / (rm * 1.7)))
  for (let i = 0; i < nM; i++) {
    const r = rm * (0.45 + Math.pow(R(), 0.7) * 0.55)
    puffs.push({
      x: ((i + R() * 0.9) / nM) * w,
      y: ly + (R() - 0.3) * rm * 0.5,
      rx: r * 1.45,
      ry: r * 0.62,
      z: zBase * S + R() * r * 0.2,
    })
  }
  const sprout = (parents: Puff[], per: number, k0: number, k1: number) => {
    const out: Puff[] = []
    for (const p of parents) {
      for (let j = 0; j < per; j++) {
        if (R() < 0.25) continue
        const k = k0 + (k1 - k0) * R()
        const a = -Math.PI / 2 + (R() - 0.5) * 2.2
        out.push({
          x: p.x + Math.cos(a) * p.rx * 0.6,
          y: p.y + Math.sin(a) * p.ry * 0.62,
          rx: p.rx * k,
          ry: p.ry * k * 1.15,
          z: p.z + p.ry * 0.25,
        })
      }
    }
    return out
  }
  const mid = sprout(puffs, 2, 0.38, 0.55)
  const small = sprout(mid, 2, 0.4, 0.6)
  puffs.push(...mid, ...small)

  const cells = Math.max(4, Math.round(w / (rm * 0.9))) // integer noise period → seamless tile
  const sc = cells / w
  const N = w * h
  const Hm = new Float32Array(N)
  const C = new Float32Array(N)
  const K = rm * 0.13
  const hf = zBase * S
  for (let y = 0; y < h; y++) {
    yield
    for (let x = 0; x < w; x++) {
      const en = fbm(edgeN, x * sc * 2, y * sc * 2, 4, cells * 2)
      let m = -1e9
      let sum = 0
      let cov = 0
      for (const p of puffs) {
        let dx = x - p.x
        if (dx > w / 2) dx -= w
        else if (dx < -w / 2) dx += w
        if (Math.abs(dx) > p.rx * 1.3) continue
        dx /= p.rx
        let dy = (y - p.y) / p.ry
        if (dy > 0) dy *= 0.55 // extrude downward: rounded tops, no lower lips
        const d = Math.sqrt(dx * dx + dy * dy) + en * 0.25
        if (d >= 1) continue
        const c = smooth(1, 0.5, d)
        if (c > cov) cov = c
        const hgt = (p.z + p.ry * 1.1 * Math.sqrt(1 - d * d)) * (0.4 + 0.6 * c)
        if (hgt > m) {
          sum *= Math.exp((m - hgt) / K)
          m = hgt
        }
        sum += Math.exp((hgt - m) / K)
      }
      // solid body below the billow line
      const fill = smooth(ly - rm * 0.1, ly + rm * 0.6, y + en * rm * 0.5)
      const i = y * w + x
      if (cov > 0 || fill > 0) {
        const hb = cov > 0 ? m + K * Math.log(sum) : hf
        Hm[i] = fill > cov ? mix(hb, hf, fill - cov) : hb
        C[i] = Math.max(cov, fill)
      } else Hm[i] = hf * 0.5
    }
  }
  // periodic box blur of the height field → smooth, painterly normals
  const rad = Math.max(1, Math.round(rm * 0.06))
  const tmp = new Float32Array(N)
  const Hb = new Float32Array(N)
  for (let y = 0; y < h; y++) {
    yield
    for (let x = 0; x < w; x++) {
      let a = 0
      for (let k = -rad; k <= rad; k++) a += Hm[y * w + ((x + k + w) % w)]
      tmp[y * w + x] = a / (2 * rad + 1)
    }
  }
  for (let y = 0; y < h; y++) {
    yield
    for (let x = 0; x < w; x++) {
      let a = 0
      let n = 0
      for (let k = -rad; k <= rad; k++) {
        const yy = y + k
        if (yy >= 0 && yy < h) {
          a += tmp[yy * w + x]
          n++
        }
      }
      Hb[y * w + x] = a / n
    }
  }
  const lm = Math.hypot(0.2, -0.85, 0.6)
  const L = [0.2 / lm, -0.85 / lm, 0.6 / lm]
  const [c, g] = makeLayer(w, h)
  const img = g.createImageData(w, h)
  const px = img.data
  const amb = [158, 184, 224]
  for (let y = 0; y < h; y++) {
    yield
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const cov = C[i]
      if (cov <= 0.003) continue
      const xl = y * w + ((x - 1 + w) % w)
      const xr = y * w + ((x + 1) % w)
      const yu = y > 0 ? i - w : i
      const yd = y < h - 1 ? i + w : i
      let nx = -(Hb[xr] - Hb[xl]) * 0.5
      let ny = -(Hb[yd] - Hb[yu]) * 0.5
      let nz = 0.8
      if (ny > 0) ny = 0 // no shadowed lower lips
      nx *= 0.5 // light from above: sides only faintly shaded
      nx += fbm(bumpN, x * sc * 4, y * sc * 4, 2, cells * 4) * 0.25
      const nm = Math.hypot(nx, ny, nz)
      nx /= nm
      ny /= nm
      nz /= nm
      let l = clamp01((nx * L[0] + ny * L[1] + nz * L[2] + 0.45) / 1.45)
      const depth = clamp01((y - ly) / (h - ly + 1)) // lower in the band → in the shade of the tops
      l *= 1 - Math.pow(depth, 0.8) * 0.5
      l = mix(l, 1, (1 - smooth(0, 0.8, cov)) * 0.5)
      l = Math.pow(l, 0.8)
      const o = i * 4
      px[o] = mix(mix(amb[0], 255, l), HAZE_RGB[0], haze)
      px[o + 1] = mix(mix(amb[1], 255, l), HAZE_RGB[1], haze)
      px[o + 2] = mix(mix(amb[2], 255, l), HAZE_RGB[2], haze)
      px[o + 3] = cov * 255
    }
  }
  g.putImageData(img, 0, 0)
  return c
}

function makeWisp(wCss: number, hCss: number, seed: number) {
  const n = perlin(seed)
  const [c, g] = makeLayer(Math.round(wCss * S), Math.round(hCss * S))
  const w = c.width
  const h = c.height
  const img = g.createImageData(w, h)
  const px = img.data
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w
      const v = y / h
      const shear = (v - 0.5) * 0.25 + Math.sin(u * 3.1) * 0.08 // slight arc
      const env =
        Math.pow(Math.max(0, 1 - Math.pow((u - 0.5) / 0.5, 2)), 1.5) *
        Math.exp(-Math.pow((v - 0.5 - shear * 0.6) / 0.26, 2))
      const f = fbm(n, u * 2.2, v * 5 + u * 1.5, 5)
      const o = (y * w + x) * 4
      px[o] = px[o + 1] = px[o + 2] = 255
      px[o + 3] = smooth(-0.05, 0.45, f + 0.12) * env * 120
    }
  }
  g.putImageData(img, 0, 0)
  return c
}

function makeMoteSprite() {
  const [c, g] = makeLayer(32, 32)
  const r = g.createRadialGradient(16, 16, 0, 16, 16, 16)
  r.addColorStop(0, 'rgba(255,255,252,1)')
  r.addColorStop(0.18, 'rgba(255,252,240,0.9)')
  r.addColorStop(0.42, 'rgba(255,250,238,0.3)')
  r.addColorStop(1, 'rgba(255,250,238,0)')
  g.fillStyle = r
  g.fillRect(0, 0, 32, 32)
  return c
}

export function createDayScene(cfg: DayConfig): SkyScene {
  let canvas: HTMLCanvasElement | null = null
  let ctx: Ctx | null = null
  let W = 0
  let H = 0
  let DPR = 1
  let SX = 0
  let SY = 0
  let DIAG = 1
  let seaTop = 0
  let sky: HTMLCanvasElement | null = null
  let rayC: HTMLCanvasElement | null = null
  let rayG: Ctx | null = null
  let seaC: HTMLCanvasElement | null = null
  let seaG: Ctx | null = null
  let seaY0 = 0
  let seaMask: CanvasGradient | null = null
  let warmC: HTMLCanvasElement | null = null
  let warmY0 = 0
  let rays: Ray[] = []
  let motes: Mote[] = []
  let bands: Band[] = []
  let bandSprites: HTMLCanvasElement[] = []
  let bandKey = ''
  let defs: BandDef[] = []
  let job: {
    key: string
    gens: Generator<void, HTMLCanvasElement, void>[]
    out: HTMLCanvasElement[]
    timer: number
  } | null = null
  let seaAlpha = 0 // the sea fades in the first time its sprites arrive
  let invalidate = () => {}
  let hazeGrad: CanvasGradient[] = []
  let hazeY: [number, number][] = []
  let wisps: WispState[] = []
  const moteSprite = cfg.motes ? makeMoteSprite() : null

  // specks live in the sunlit part of the sky, inside the ray fan
  function spawnMote(R: () => number, initial: boolean): Mote {
    const ang = ((110 + R() * 55) * Math.PI) / 180
    const dist = DIAG * (0.15 + Math.pow(R(), 0.8) * 0.6)
    let x = SX + Math.cos(ang) * dist
    let y = SY + Math.sin(ang) * dist
    if (!initial) {
      x = W * (0.55 + R() * 0.45)
      y = H * (0.05 + R() * 0.5)
    }
    return {
      x,
      y,
      vx: -1.5 - R() * 2.5,
      vy: 0.4 + R() * 1.6,
      s: 1 + R() * 1.6,
      o: 0.55 + R() * 0.45,
      per: 4 + R() * 6,
      ph: R() * TAU,
    }
  }

  function placeBands() {
    const prev = bands
    bands = bandSprites.length
      ? defs.map((d, i) => {
          const w = bandSprites[i].width / S
          return {
            sprite: bandSprites[i],
            y: d.y0,
            w,
            h: bandSprites[i].height / S,
            v: d.v,
            x: prev[i] && prev[i].w === w ? prev[i].x : rng(d.seed)() * w, // keep the drift position across resizes
          }
        })
      : []
  }

  function cancelJob() {
    if (job) window.clearTimeout(job.timer)
    job = null
  }

  // cloud sprites take a few hundred ms of pixel maths: build them in ~8ms slices so the page stays responsive
  function pump() {
    if (!job) return
    const j = job
    const end = performance.now() + 8
    while (j.out.length < j.gens.length && performance.now() < end) {
      const r = j.gens[j.out.length].next()
      if (r.done) j.out.push(r.value)
    }
    if (j.out.length < j.gens.length) {
      j.timer = window.setTimeout(pump, 0)
      return
    }
    job = null
    for (const c of bandSprites) freeCanvas(c)
    bandSprites = j.out
    bandKey = j.key
    placeBands()
    invalidate()
  }

  function release() {
    cancelJob()
    for (const c of [sky, rayC, seaC, warmC]) freeCanvas(c)
    sky = rayC = seaC = warmC = null
    rayG = seaG = null
  }

  function layoutSea(U: number) {
    const sea = cfg.sea
    if (!sea || !canvas) {
      defs = []
      bands = []
      return
    }
    const Tw = Math.round(Math.min(Math.max(W, 900), 1600) * 1.1)
    const depth = H - seaTop
    const all: BandDef[] = [
      {
        y0: seaTop - U * 0.02,
        line: U * 0.03,
        rMax: U * 0.03,
        haze: 0.5,
        z: U * 0.01,
        v: -1.6,
        seed: 5,
      },
      {
        y0: seaTop + depth * 0.1,
        line: U * 0.05,
        rMax: U * 0.055,
        haze: 0.22,
        z: U * 0.02,
        v: -3,
        seed: 9,
      },
      {
        y0: seaTop + depth * 0.34,
        line: U * 0.08,
        rMax: U * 0.12,
        haze: 0,
        z: U * 0.03,
        v: -5,
        seed: 13,
      },
    ]
    defs = all
    const key = `${U}|${Tw}|${Math.round(depth / 40)}`
    if (key !== bandKey && job?.key !== key) {
      cancelJob()
      // a little extra height so small viewport changes don't need a rebuild
      const gens = defs.map((d) =>
        makeBand(Tw, H - d.y0 + 4 + U * 0.08, {
          seed: d.seed,
          rMax: d.rMax,
          lineY: d.line,
          haze: d.haze,
          zBase: d.z,
        }),
      )
      job = { key, gens, out: [], timer: window.setTimeout(pump, 0) }
    }
    placeBands() // current sprites (if any) at the new positions until fresh ones land
    seaY0 = Math.floor(defs[0].y0 - U * 0.03)
    ;[seaC, seaG] = makeLayer(canvas.width, (H - seaY0) * DPR + 2, DPR, seaY0)
    hazeGrad = []
    hazeY = []
    for (let i = 0; i < defs.length - 1; i++) {
      const y0 = defs[i].y0 - U * 0.02
      const y1 = defs[i + 1].y0 + U * 0.04
      const hg = seaG.createLinearGradient(0, y0, 0, y1)
      hg.addColorStop(0, 'rgba(240,244,250,0)')
      hg.addColorStop(0.3, 'rgba(240,244,250,0.4)')
      hg.addColorStop(0.65, 'rgba(240,244,250,0.15)')
      hg.addColorStop(1, 'rgba(240,244,250,0)')
      hazeGrad.push(hg)
      hazeY.push([y0, y1])
    }
    // cloud banks off to one side: fade them out across the screen
    seaMask = null
    if (sea.side === 'left') {
      const reach = W > H ? 0.72 : 1.05
      seaMask = seaG.createLinearGradient(0, 0, W * reach, 0)
      seaMask.addColorStop(0, 'rgba(0,0,0,1)')
      seaMask.addColorStop(0.45, 'rgba(0,0,0,0.85)')
      seaMask.addColorStop(1, 'rgba(0,0,0,0)')
    }
    // sunlight on the cloud tops: a cached multiply layer, warm toward the sun, white (= no-op) elsewhere
    warmY0 = seaY0 - U * 0.06
    let wg: Ctx
    ;[warmC, wg] = makeLayer(W / 4, (H - warmY0) / 4 + 1, 0.25, warmY0)
    const wr = wg.createRadialGradient(SX, SY, 0, SX, SY, DIAG * 1.1)
    wr.addColorStop(0, '#ffeacf')
    wr.addColorStop(0.5, '#fff0de')
    wr.addColorStop(0.75, '#fff8f0')
    wr.addColorStop(0.95, '#ffffff')
    wg.fillStyle = wr
    wg.fillRect(0, warmY0, W, H - warmY0)
    const wv = wg.createLinearGradient(0, warmY0, 0, seaY0 + U * 0.05)
    wv.addColorStop(0, '#ffffff')
    wv.addColorStop(1, 'rgba(255,255,255,0)')
    wg.fillStyle = wv
    wg.fillRect(0, warmY0, W, H - warmY0)
  }

  return {
    fps: cfg.fps,

    layout(target, env, onInvalidate) {
      invalidate = onInvalidate
      if (canvas !== target) {
        canvas = target
        ctx = target.getContext('2d')
      }
      if (!ctx) return
      const prevW = W
      W = env.w
      H = env.h
      DPR = env.dpr
      release()
      SX = W * cfg.sun[0]
      SY = H * cfg.sun[1]
      DIAG = Math.hypot(W, H)
      const content = env.content
      if (cfg.sea?.top === 'content') {
        const contentBottom = content ? content.y + content.h + 8 : H * 0.72
        seaTop = Math.min(H * 0.86, Math.max(H * 0.75, contentBottom))
      } else seaTop = H * (cfg.sea ? cfg.sea.top : 0.84)
      const horizon = seaTop - H * 0.01

      // ── sky, painted outward from the sun so gold → blue passes through bright haze, not grey ──
      let g: Ctx
      ;[sky, g] = makeLayer(canvas.width, canvas.height, DPR)
      const grad = g.createRadialGradient(SX, SY, 0, SX, SY, DIAG * cfg.reach)
      for (const [k, col] of cfg.sky) grad.addColorStop(k, col)
      g.fillStyle = grad
      g.fillRect(0, 0, W, H)
      // luminous haze resting on the horizon: cool on the left, sun-warmed on the right
      if (cfg.horizon > 0) {
        const k = cfg.horizon
        const hz0 = horizon - H * 0.24
        const [hc, hg] = makeLayer(canvas.width, (H - hz0) * DPR + 2, DPR, hz0)
        const hx = hg.createLinearGradient(0, 0, W, 0)
        hx.addColorStop(0, `rgba(240,246,253,${0.85 * k})`)
        hx.addColorStop(0.55, `rgba(246,246,246,${0.8 * k})`)
        hx.addColorStop(1, `rgba(255,242,222,${0.85 * k})`)
        hg.fillStyle = hx
        hg.fillRect(0, hz0, W, H - hz0)
        const hv = hg.createLinearGradient(0, hz0, 0, H)
        hv.addColorStop(0, 'rgba(255,255,255,0)')
        hv.addColorStop(0.6, 'rgba(255,255,255,1)')
        hv.addColorStop(1, 'rgba(255,255,255,1)')
        hg.globalCompositeOperation = 'destination-in'
        hg.fillStyle = hv
        hg.fillRect(0, hz0, W, H - hz0)
        g.save()
        g.setTransform(1, 0, 0, 1, 0, 0)
        g.drawImage(hc, 0, Math.round(hz0 * DPR))
        g.restore()
        freeCanvas(hc)
      }
      // golden-white bloom at the source
      if (cfg.bloom > 0) {
        const bloom = g.createRadialGradient(SX, SY, 0, SX, SY, DIAG * cfg.bloomR)
        bloom.addColorStop(0, `rgba(255,255,250,${cfg.bloom})`)
        bloom.addColorStop(0.35, `rgba(255,250,236,${0.75 * cfg.bloom})`)
        bloom.addColorStop(1, 'rgba(255,240,210,0)')
        g.fillStyle = bloom
        g.fillRect(0, 0, W, H)
      }
      // soft brightening behind the content (keeps text contrast high where it matters)
      if (cfg.veil) {
        const a = cfg.veil.alpha
        if (cfg.veil.kind === 'radial') {
          const vx = content ? content.x + content.w / 2 : W * 0.5
          const vy = content ? content.y + content.h / 2 : H * 0.45
          const rv = Math.min(W * 0.52, 560)
          g.save()
          g.translate(vx, vy)
          g.scale(1, 0.85)
          const v = g.createRadialGradient(0, 0, 0, 0, 0, rv)
          v.addColorStop(0, `rgba(252,251,248,${a})`)
          v.addColorStop(0.6, `rgba(252,251,248,${a * 0.44})`)
          v.addColorStop(1, 'rgba(252,251,248,0)')
          g.fillStyle = v
          g.fillRect(-rv, -rv, rv * 2, rv * 2)
          g.restore()
        } else {
          // full-height reading column with soft side edges (long pages scroll over it)
          const cw = content ? content.w : Math.min(W * 0.62, 768)
          const x0 = content ? content.x : (W - cw) / 2
          const soft = Math.min(160, W * 0.08)
          const v = g.createLinearGradient(x0 - soft, 0, x0 + cw + soft, 0)
          const span = cw + soft * 2
          v.addColorStop(0, 'rgba(252,251,248,0)')
          v.addColorStop(soft / span, `rgba(252,251,248,${a})`)
          v.addColorStop(1 - soft / span, `rgba(252,251,248,${a})`)
          v.addColorStop(1, 'rgba(252,251,248,0)')
          g.fillStyle = v
          g.fillRect(x0 - soft, 0, span, H)
        }
      }
      applyGrain(sky, grainTile('light'))

      // ── god-rays (quarter res) + specks of light ──
      const R = rng(7)
      rays = []
      if (cfg.rays) {
        ;[rayC, rayG] = makeLayer(W * RS, H * RS, RS)
        const n = cfg.rays.count
        for (let i = 0; i < n; i++) {
          rays.push({
            a: ((102 + (i + 0.15 + R() * 0.7) * (70 / n)) * Math.PI) / 180, // fan toward the lower left
            wd: ((1.8 + R() * 3.6) * Math.PI) / 180,
            len: DIAG * (0.55 + R() * 0.45),
            alpha: (0.1 + R() * 0.12) * cfg.rays.alpha,
            per: 14 + R() * 14,
            ph: R() * TAU,
            sway: 30 + R() * 20,
          })
        }
      }
      const count = cfg.motes
        ? Math.round(Math.min(cfg.motes, Math.max(cfg.motes / 3, (W * H) / 42000)))
        : 0
      if (prevW !== W || motes.length !== count) {
        motes = []
        for (let i = 0; i < count; i++) motes.push(spawnMote(R, true))
      }

      // ── sea of clouds: three tiling depth bands, scrolled slowly ──
      // puff scale follows the (quantised) height so URL-bar jitter never rebuilds the sprites
      layoutSea(Math.min(Math.max(Math.round(H / 80) * 80, 600), 1100))

      // ── high wisps (sprites keyed by size, so height jitter keeps them) ──
      const prevWisps = wisps
      wisps = cfg.wisps.map((wd, i) => {
        const w = Math.min(W * wd.w, wd.maxW)
        const h = Math.min(H * wd.h, wd.maxH)
        const key = `${Math.round(w)}|${Math.round(h / 8)}|${wd.seed}`
        const old = prevWisps[i]
        const sprite = old && old.key === key ? old.sprite : makeWisp(w, h, wd.seed)
        if (old && old.sprite !== sprite) freeCanvas(old.sprite)
        return {
          sprite,
          key,
          x: old ? old.x : W * wd.x,
          y: H * wd.y,
          w,
          h,
          alpha: wd.alpha,
          v: wd.v,
        }
      })
    },

    draw(t, dt, shift, still) {
      if (!ctx || !canvas || !sky) return
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.drawImage(sky, 0, 0)
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      const lift = shift * 0.08 // high wisps drift up a touch when the page scrolls

      for (const w of wisps) {
        w.x += w.v * dt
        if (w.x > W + 10) w.x = -w.w - 10
        ctx.globalAlpha = w.alpha
        ctx.drawImage(w.sprite, w.x, w.y - lift, w.w, w.h)
      }
      ctx.globalAlpha = 1

      // sea: bands + aerial haze between them, then warm sunlight multiplied over the lower sky
      if (seaC && seaG && warmC) {
        seaG.globalCompositeOperation = 'source-over'
        seaG.clearRect(0, seaY0, W, H - seaY0)
        bands.forEach((b, i) => {
          if (!seaG) return
          b.x = (((b.x + b.v * dt) % b.w) + b.w) % b.w
          for (let x = b.x - b.w; x < W; x += b.w) seaG.drawImage(b.sprite, x, b.y, b.w + 0.5, b.h)
          if (i < bands.length - 1) {
            seaG.fillStyle = hazeGrad[i]
            seaG.fillRect(0, hazeY[i][0], W, hazeY[i][1] - hazeY[i][0])
          }
        })
        if (seaMask && bands.length) {
          seaG.globalCompositeOperation = 'destination-in'
          seaG.fillStyle = seaMask
          seaG.fillRect(0, seaY0, W, H - seaY0)
          seaG.globalCompositeOperation = 'source-over'
        }
        if (bands.length) seaAlpha = still ? 1 : Math.min(1, seaAlpha + dt / 1.2)
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        if (seaAlpha > 0) {
          ctx.globalAlpha = seaAlpha * seaAlpha * (3 - 2 * seaAlpha)
          ctx.drawImage(seaC, 0, Math.round(seaY0 * DPR))
          ctx.globalAlpha = 1
        }
        ctx.globalCompositeOperation = 'multiply'
        ctx.drawImage(warmC, 0, warmY0 * DPR, canvas.width, canvas.height - warmY0 * DPR)
        ctx.globalCompositeOperation = 'source-over'
      }

      // god-rays: each = 3 nested soft wedges with a radial alpha profile, breathing on long periods
      if (rayC && rayG && rays.length) {
        rayG.clearRect(0, 0, W, H)
        for (const r of rays) {
          const breathe = 0.55 + 0.45 * Math.sin((t * TAU) / r.per + r.ph)
          const a0 = r.a + Math.sin((t * TAU) / (r.sway * 2) + r.ph) * 0.006
          const al = (r.alpha * breathe) / 2.2
          for (let k = 1; k <= 3; k++) {
            const half = (r.wd * k) / 3
            const gr = rayG.createRadialGradient(SX, SY, 0, SX, SY, r.len)
            gr.addColorStop(0, 'rgba(255,248,228,0)')
            gr.addColorStop(0.2, `rgba(255,248,228,${al * 0.8})`)
            gr.addColorStop(0.5, `rgba(255,250,236,${al})`)
            gr.addColorStop(0.75, `rgba(255,250,240,${al * 0.45})`)
            gr.addColorStop(1, 'rgba(255,248,232,0)')
            rayG.fillStyle = gr
            rayG.beginPath()
            rayG.moveTo(SX, SY)
            rayG.arc(SX, SY, r.len, a0 - half, a0 + half)
            rayG.closePath()
            rayG.fill()
          }
        }
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.globalCompositeOperation = 'screen'
        ctx.drawImage(rayC, 0, 0, canvas.width, canvas.height)
        ctx.globalCompositeOperation = 'source-over'
      }

      // specks of light, drifting in the sunbeams
      if (moteSprite && motes.length) {
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
        for (const m of motes) {
          if (!still) {
            m.x += (m.vx + Math.sin(t * 0.21 + m.ph) * 1.6) * dt
            m.y += (m.vy + Math.cos(t * 0.17 + m.ph * 1.3) * 1.2) * dt
            if (m.x < -20 || m.x > W + 20 || m.y < -20 || m.y > seaTop)
              Object.assign(m, spawnMote(Math.random, false))
          }
          const d = Math.hypot(m.x - SX, m.y - SY) / DIAG
          const tw = 0.55 + 0.45 * Math.sin((t * TAU) / m.per + m.ph)
          ctx.globalAlpha = Math.min(1, smooth(0.95, 0.25, d) * tw * m.o)
          const s = m.s * 8
          ctx.drawImage(moteSprite, m.x - s / 2, m.y - s / 2 - lift * 1.5, s, s)
        }
        ctx.globalAlpha = 1
      }
    },

    release,
  }
}
