import type { DayConfig, Floater, Wisp } from './day'
import type { Blob, NightConfig, Planet } from './night'

/**
 * One sky world, a different view per page. The homepage is the showpiece; the other pages
 * reuse the same palettes and renderers in calmer compositions (chat being the quietest).
 */
export type SkyVariant = 'home' | 'resume' | 'projects' | 'chat' | 'conversation' | 'account'

type Preset = { night: NightConfig; day: DayConfig }

const HOME_SKY: [number, string][] = [
  [0, '#fffbf2'],
  [0.1, '#fff3dc'],
  [0.24, '#fdeacc'],
  [0.38, '#f8eee0'],
  [0.5, '#e6eef5'],
  [0.64, '#c8ddf3'],
  [0.82, '#a0c6ef'],
  [1, '#86b5ea'],
]

const HOME_BLOBS: Blob[] = [
  { ax: 0.86, ay: 0.12, r: 0.34, c: [105, 150, 255], a: 0.3, amp: 0.04, T: 60, p: 0 },
  { ax: 0.98, ay: 0.36, r: 0.24, c: [150, 100, 235], a: 0.26, amp: 0.05, T: 60, p: 2.1 },
  { ax: 0.68, ay: -0.04, r: 0.2, c: [125, 115, 250], a: 0.16, amp: 0.04, T: 30, p: 4 },
  { ax: 0.03, ay: 0.62, r: 0.3, c: [40, 170, 190], a: 0.27, amp: 0.04, T: 60, p: 1 },
  { ax: -0.04, ay: 0.46, r: 0.22, c: [20, 120, 200], a: 0.26, amp: 0.05, T: 60, p: 3.3 },
]

/** Homepage: a low, flat limb along the bottom. */
const bottomLimb = (w: number, h: number): Planet => {
  const R = Math.max(w * 1.7, h * 2.4)
  return { cx: w * 0.5, cy: h * 0.885 + R, R }
}

/** Projects: a big world rising out of the lower-right corner. */
const cornerLimb = (w: number, h: number): Planet => {
  const R = Math.max(w, h) * 1.25
  const depth = Math.min(w, h) * (w > h ? 0.4 : 0.3) // how far the limb reaches in along the diagonal
  const s = (R - depth) / Math.SQRT2
  return { cx: w + s, cy: h + s, R }
}

const CALM_NIGHT: [string, string, string] = ['rgb(6,8,14)', 'rgb(8,11,19)', 'rgb(11,15,26)']

const CHAT_NIGHT: NightConfig = {
  fps: 30,
  base: CALM_NIGHT,
  lift: 0.32,
  stars: { density: 0.5, alpha: 0.7, twinkle: 0.5, speed: 0.4 },
  blobs: [],
  nebGain: 0,
  hole: null,
  planet: null,
  glow: 0,
  meteors: false,
}

/** Light skies: the cool blue that settles into the corner opposite the sun. */
const ZENITH: [number, number, number] = [92, 146, 226]

/** Pale calm sky for the chat pages (list, sign-in, conversation). */
const CALM_SKY: [number, string][] = [
  [0, '#fffaf0'],
  [0.14, '#fdf0dc'],
  [0.36, '#f9f4ee'],
  [0.58, '#e6eef7'],
  [0.8, '#c9dcf2'],
  [1, '#b4cff0'],
]

const cirrus = (x: number, y: number, w: number, alpha: number, seed: number, v: number): Wisp => ({
  x,
  y,
  w,
  h: w * 0.2,
  maxW: w * 1500,
  maxH: w * 280,
  alpha,
  seed,
  v,
})

const cumulus = (x: number, y: number, w: number, maxW: number, alpha: number, seed: number): Floater => ({
  x,
  y,
  w,
  maxW,
  alpha,
  seed,
  amp: 14 + (seed % 7) * 2,
  T: 70 + (seed % 5) * 9,
})

export const SKY_PRESETS: Record<SkyVariant, Preset> = {
  home: {
    night: {
      fps: 60,
      base: ['rgb(6,8,14)', 'rgb(9,13,21)', 'rgb(13,19,33)'],
      lift: 0.55,
      stars: { density: 1, alpha: 1, twinkle: 1, speed: 1 },
      blobs: HOME_BLOBS,
      nebGain: 0.6,
      hole: { x: 0.5, y: 0.47, rx: 0.38 },
      planet: bottomLimb,
      glow: 1,
      meteors: true,
    },
    day: {
      fps: 30,
      sun: [0.96, -0.07],
      sky: HOME_SKY,
      reach: 1.08,
      bloom: 1,
      bloomR: 0.22,
      horizon: 1,
      rays: { count: 9, alpha: 1 },
      motes: 30,
      sea: { side: 'full', top: 'content' },
      wisps: [
        { x: 0.04, y: 0.09, w: 0.42, h: 0.09, maxW: 620, maxH: 80, alpha: 0.85, seed: 77, v: 0.8 },
        cirrus(0.55, 0.2, 0.26, 0.6, 91, 0.6),
        cirrus(0.2, 0.33, 0.2, 0.45, 113, 0.45),
      ],
      veil: { kind: 'radial', alpha: 0.34 },
      zenith: { rgb: ZENITH, alpha: 0.34 },
      halo: { alpha: 0.42, r: 0.62 },
      moon: { x: 0.13, y: 0.2, r: 24, alpha: 0.85 },
      floaters: [
        cumulus(0.09, 0.52, 0.15, 240, 0.95, 21),
        cumulus(0.91, 0.62, 0.13, 210, 0.9, 34),
        cumulus(0.84, 0.36, 0.08, 130, 0.75, 47),
      ],
    },
  },

  // A reading page: high, still sky. Night — sparse stars and one violet wisp in the upper left.
  // Day — clear pale upper sky, soft sunlight from the right, a few thin cirrus streaks.
  resume: {
    night: {
      fps: 30,
      base: ['rgb(5,7,13)', 'rgb(8,11,19)', 'rgb(10,14,25)'],
      lift: 0.4,
      stars: { density: 0.55, alpha: 0.85, twinkle: 0.6, speed: 0.5 },
      blobs: [
        { ax: 0.04, ay: 0.06, r: 0.3, c: [120, 112, 245], a: 0.34, amp: 0.03, T: 90, p: 0.6 },
        { ax: -0.03, ay: 0.24, r: 0.2, c: [80, 130, 245], a: 0.26, amp: 0.04, T: 90, p: 2.4 },
      ],
      nebGain: 0.7,
      hole: { x: 0.5, y: 0.5, rx: 0.34, ry: 0.7 },
      planet: null,
      glow: 0,
      meteors: false,
    },
    day: {
      fps: 30,
      sun: [1.02, -0.16],
      sky: [
        [0, '#fffaf1'],
        [0.12, '#fff4e3'],
        [0.3, '#f8f1e8'],
        [0.5, '#eaf0f6'],
        [0.72, '#d5e4f5'],
        [1, '#bcd5f1'],
      ],
      reach: 1.1,
      bloom: 0.75,
      bloomR: 0.2,
      horizon: 0.55,
      rays: { count: 5, alpha: 0.55 },
      motes: 0,
      sea: null,
      wisps: [
        { x: 0.02, y: 0.08, w: 0.32, h: 0.06, maxW: 460, maxH: 54, alpha: 0.75, seed: 77, v: 0.5 },
        { x: 0.6, y: 0.17, w: 0.24, h: 0.05, maxW: 360, maxH: 44, alpha: 0.55, seed: 91, v: 0.35 },
        { x: 0.3, y: 0.3, w: 0.18, h: 0.04, maxW: 280, maxH: 36, alpha: 0.4, seed: 113, v: 0.25 },
      ],
      veil: { kind: 'column', alpha: 0.42 },
    },
  },

  // Night — a large planet curving out of the lower-right corner, a faint periwinkle glow upper left.
  // Day — low cloud banks off to the left, warm sun haze from the upper right, a cool upper left,
  // high cirrus and two small cumulus in the margins.
  projects: {
    night: {
      fps: 30,
      base: ['rgb(6,8,14)', 'rgb(9,12,20)', 'rgb(12,17,30)'],
      lift: 0.45,
      stars: { density: 0.8, alpha: 0.95, twinkle: 0.8, speed: 0.7 },
      blobs: [
        { ax: 0.03, ay: 0.08, r: 0.28, c: [105, 150, 255], a: 0.26, amp: 0.04, T: 75, p: 0.3 },
        { ax: 0.2, ay: -0.06, r: 0.18, c: [150, 100, 235], a: 0.18, amp: 0.04, T: 75, p: 2.7 },
      ],
      nebGain: 0.5,
      hole: { x: 0.5, y: 0.45, rx: 0.4 },
      planet: cornerLimb,
      glow: 0.85,
      meteors: false,
    },
    day: {
      fps: 30,
      sun: [0.94, -0.08],
      sky: HOME_SKY,
      reach: 1.08,
      bloom: 0.85,
      bloomR: 0.2,
      horizon: 0.7,
      rays: { count: 6, alpha: 0.6 },
      motes: 14,
      sea: { side: 'left', top: 0.8 },
      wisps: [cirrus(0.42, 0.06, 0.3, 0.6, 77, 0.5), cirrus(0.66, 0.22, 0.2, 0.45, 91, 0.35)],
      veil: null,
      zenith: { rgb: ZENITH, alpha: 0.24 },
      halo: { alpha: 0.36, r: 0.58 },
      floaters: [cumulus(0.935, 0.5, 0.1, 170, 0.85, 34), cumulus(0.065, 0.36, 0.08, 120, 0.7, 47)],
    },
  },

  // Chat list / sign-in: dim and calm. Night — faint stars over a slight gradient.
  // Day — warm sun haze against a cool corner, two small cumulus off to the sides, a low sea of clouds.
  chat: {
    night: CHAT_NIGHT,
    day: {
      fps: 20,
      sun: [0.95, -0.1],
      sky: CALM_SKY,
      reach: 1.1,
      bloom: 0.7,
      bloomR: 0.2,
      horizon: 0.6,
      rays: { count: 4, alpha: 0.5 },
      motes: 0,
      sea: { side: 'full', top: 0.87 },
      wisps: [cirrus(0.04, 0.12, 0.3, 0.65, 77, 0.5), cirrus(0.62, 0.3, 0.2, 0.45, 113, 0.35)],
      veil: { kind: 'radial', alpha: 0.22 },
      zenith: { rgb: ZENITH, alpha: 0.26 },
      halo: { alpha: 0.34, r: 0.55 },
      floaters: [cumulus(0.07, 0.56, 0.1, 170, 0.8, 21), cumulus(0.93, 0.44, 0.08, 140, 0.7, 34)],
    },
  },

  // Inside a conversation: the most minimal. Night — a few barely-twinkling, motionless stars at
  // 10fps. Day — a fully static pale sky: warm corner, cool corner, two still cirrus streaks.
  conversation: {
    night: {
      fps: 10,
      base: CALM_NIGHT,
      lift: 0.22,
      stars: { density: 0.35, alpha: 0.55, twinkle: 0.25, speed: 0 },
      blobs: [],
      nebGain: 0,
      hole: null,
      planet: null,
      glow: 0,
      meteors: false,
    },
    day: {
      fps: 0,
      sun: [0.95, -0.1],
      sky: [
        [0, '#fdf8ef'],
        [0.25, '#f8f1e6'],
        [0.55, '#e9eef5'],
        [1, '#d0e0f2'],
      ],
      reach: 1.1,
      bloom: 0.5,
      bloomR: 0.18,
      horizon: 0.3,
      rays: null,
      motes: 0,
      sea: null,
      wisps: [cirrus(0.06, 0.1, 0.26, 0.5, 77, 0), cirrus(0.6, 0.24, 0.18, 0.35, 91, 0)],
      veil: null,
      zenith: { rgb: ZENITH, alpha: 0.2 },
      halo: { alpha: 0.26, r: 0.5 },
    },
  },

  // Sign-in, register and vault unlock: a calm, open view. Night — the chat page's quiet stars.
  // Day — pale moon over a low sea of clouds, sun haze from the upper right, a soft glow behind the card.
  account: {
    night: CHAT_NIGHT,
    day: {
      fps: 20,
      sun: [0.95, -0.1],
      sky: CALM_SKY,
      reach: 1.1,
      bloom: 0.7,
      bloomR: 0.2,
      horizon: 0.7,
      rays: { count: 3, alpha: 0.45 },
      motes: 0,
      sea: { side: 'full', top: 0.8 },
      wisps: [cirrus(0.03, 0.08, 0.3, 0.7, 77, 0.5), cirrus(0.66, 0.26, 0.2, 0.45, 91, 0.35)],
      veil: { kind: 'radial', alpha: 0.28 },
      zenith: { rgb: ZENITH, alpha: 0.28 },
      halo: { alpha: 0.34, r: 0.55 },
      moon: { x: 0.16, y: 0.24, r: 22, alpha: 0.8 },
    },
  },
}

/** CSS twin of a scene's base, painted under the canvas (first paint, no-canvas fallback). */
export function skyBaseCss(variant: SkyVariant, mode: 'day' | 'night') {
  const p = SKY_PRESETS[variant]
  if (mode === 'night') {
    const [a, b, c] = p.night.base
    return `linear-gradient(${a}, ${b} 60%, ${c})`
  }
  const [x, y] = p.day.sun
  const stops = p.day.sky.map(([k, col]) => `${col} ${Math.round(k * 100)}%`).join(', ')
  return `radial-gradient(circle farthest-corner at ${Math.round(x * 100)}% ${Math.round(y * 100)}%, ${stops})`
}
