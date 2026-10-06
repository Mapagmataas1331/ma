import { useContext, useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { cn } from '../lib/cn'
import { ThemeContext } from '../theme'
import { createDayScene } from './sky/day'
import type { SceneEnv, SkyScene } from './sky/kit'
import { createNightScene } from './sky/night'
import { SKY_PRESETS, skyBaseCss, type SkyVariant } from './sky/presets'

export type { SkyVariant }

type Mode = 'day' | 'night'

type BatteryLike = {
  charging: boolean
  level: number
  addEventListener: (type: string, listener: () => void) => void
  removeEventListener: (type: string, listener: () => void) => void
}

const FADE_MS = 600
const htmlMode = (): Mode => (document.documentElement.classList.contains('dark') ? 'night' : 'day')
const keyOf = (variant: SkyVariant, mode: Mode) => `${variant}:${mode}`

/** Nearest ancestor that scrolls on Y (even if it doesn't overflow yet), else the document. */
function findScrollParent(el: HTMLElement): HTMLElement {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const oy = getComputedStyle(node).overflowY
    if (oy === 'auto' || oy === 'scroll' || oy === 'overlay') return node
  }
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement
}

/**
 * Full-viewport canvas sky behind a page. One world — a starry night in dark mode, a sunlit sky
 * in light mode — composed differently per page (`scene`). Follows the `dark` class on <html>
 * and `scene` changes with a short crossfade; static under reduced motion; pauses when hidden
 * or offscreen. While mounted it marks <html data-sky="…"> so chrome (header) and page tokens
 * can adapt.
 */
export function SkyBackdrop({
  className,
  scene = 'home',
  parallax = false,
  contentRef,
}: {
  className?: string
  /** Which composition to show. */
  scene?: SkyVariant
  /** Nudge the far layers (stars, high wisps) a little when the page scrolls. */
  parallax?: boolean
  /** Content column: light skies keep a soft veil behind it (and the homepage sea below it). */
  contentRef?: RefObject<HTMLElement | null>
}) {
  const theme = useContext(ThemeContext)
  const mode: Mode = theme
    ? theme.resolved === 'dark'
      ? 'night'
      : 'day'
    : typeof document === 'undefined'
      ? 'day'
      : htmlMode()
  const initial = useRef({ scene, mode })
  const setVariant = useRef<((variant: SkyVariant) => void) | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const aRef = useRef<HTMLCanvasElement>(null)
  const bRef = useRef<HTMLCanvasElement>(null)

  useLayoutEffect(() => {
    const html = document.documentElement
    html.dataset.sky = scene
    return () => {
      if (html.dataset.sky === scene) delete html.dataset.sky
    }
  }, [scene])

  useEffect(() => {
    setVariant.current?.(scene)
  }, [scene])

  useEffect(() => {
    const root = rootRef.current
    const a = aRef.current
    const b = bRef.current
    if (!root || !a || !b) return
    // no canvas / observers (old browsers, jsdom): the container's CSS gradient stays as a static sky
    if (typeof window.matchMedia !== 'function' || typeof ResizeObserver === 'undefined') return
    if (!a.getContext('2d') || !b.getContext('2d')) return

    const canvases = [a, b]
    const slotKey: (string | null)[] = [null, null]
    const scenes = new Map<string, SkyScene>()
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const coarse = window.matchMedia('(pointer: coarse)')
    const saveData = !!(navigator as Navigator & { connection?: { saveData?: boolean } }).connection
      ?.saveData

    let variant: SkyVariant = initial.current.scene
    let current: Mode = initial.current.mode
    let active = 0 // slot index on top
    let fading: number | null = null // outgoing slot, still shown until the crossfade ends
    let fadeTimer = 0
    let resizeTimer = 0
    let raf = 0
    let last = 0
    let t = 0
    let lastW = 0
    let lastH = 0
    let lastContent = ''
    let pageVisible = document.visibilityState === 'visible'
    let onScreen = true
    let battery: { charging: boolean; level: number } | null = null
    let lowPower = saveData || coarse.matches
    let scroll = 0
    let shift = 0

    const capDpr = () => Math.min(lowPower ? 1.5 : 2, window.devicePixelRatio || 1)

    const env = (): SceneEnv => {
      const r = contentRef?.current?.getBoundingClientRect()
      return {
        w: root.clientWidth,
        h: root.clientHeight,
        dpr: capDpr(),
        content: r && r.height > 0 ? { x: r.left, y: r.top, w: r.width, h: r.height } : null,
      }
    }
    const contentKey = (e: SceneEnv) =>
      e.content
        ? [e.content.x, e.content.y, e.content.w, e.content.h].map(Math.round).join(',')
        : ''

    const sceneFor = (key: string) => {
      let s = scenes.get(key)
      if (!s) {
        const [v, m] = key.split(':') as [SkyVariant, Mode]
        s =
          m === 'day' ? createDayScene(SKY_PRESETS[v].day) : createNightScene(SKY_PRESETS[v].night)
        scenes.set(key, s)
      }
      return s
    }
    const slotScene = (slot: number) => {
      const key = slotKey[slot]
      return key ? sceneFor(key) : null
    }

    const drawing = () => (fading !== null ? [active, fading] : [active])
    const still = (s: SkyScene) => reduced.matches || s.fps === 0
    const paint = (slot: number, dt: number) => {
      const s = slotScene(slot)
      if (s) s.draw(t, dt, reduced.matches ? 0 : shift, still(s))
    }

    const prepare = (slot: number) => {
      const s = slotScene(slot)
      const e = env()
      if (!s || e.w < 2 || e.h < 2) return false
      const c = canvases[slot]
      c.width = Math.round(e.w * e.dpr)
      c.height = Math.round(e.h * e.dpr)
      s.layout(c, e, () => {
        if (!raf && slotScene(slot) === s) paint(slot, 0)
      })
      lastW = e.w
      lastH = e.h
      lastContent = contentKey(e)
      return true
    }

    const relayout = () => {
      for (const slot of drawing()) if (prepare(slot)) paint(slot, 0)
    }

    const stop = () => {
      if (raf) window.cancelAnimationFrame(raf)
      raf = 0
    }

    // frame cap of whatever is on screen; 0 = nothing moves (static scene) → no loop at all
    const frameRate = () => {
      const fps = Math.max(0, ...drawing().map((slot) => slotScene(slot)?.fps ?? 0))
      return lowPower ? Math.min(30, fps) : fps
    }

    const tick = (now: number) => {
      raf = 0
      const fps = frameRate()
      if (reduced.matches || !pageVisible || !onScreen || !fps) return
      if (last && now - last < 1000 / fps - 4) {
        raf = window.requestAnimationFrame(tick)
        return
      }
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0
      last = now
      t += dt
      if (parallax) shift += (scroll - shift) * Math.min(1, dt * 6)
      for (const slot of drawing()) paint(slot, dt)
      raf = window.requestAnimationFrame(tick)
    }

    const kick = () => {
      if (reduced.matches || !pageVisible || !onScreen || !frameRate()) {
        stop()
        return
      }
      if (raf) return
      last = 0
      raf = window.requestAnimationFrame(tick)
    }

    const endFade = () => {
      window.clearTimeout(fadeTimer)
      fadeTimer = 0
      if (fading === null) return
      const out = fading
      fading = null
      canvases[out].style.opacity = '0'
      slotScene(out)?.release()
      slotKey[out] = null
      canvases[out].width = 0
      canvases[out].height = 0
    }

    const show = (nextVariant: SkyVariant, nextMode: Mode) => {
      variant = nextVariant
      current = nextMode
      const key = keyOf(nextVariant, nextMode)
      if (slotKey[active] === key) return
      endFade() // a crossfade already running: settle it first
      const prev = active
      const next = 1 - prev
      slotKey[next] = key
      root.style.background = skyBaseCss(nextVariant, nextMode)
      if (prepare(next)) paint(next, 0)
      const inC = canvases[next]
      const outC = canvases[prev]
      inC.style.zIndex = '1'
      outC.style.zIndex = '0'
      inC.style.transition = 'none'
      inC.style.opacity = '0'
      void inC.offsetWidth // commit the start state so the fade runs
      inC.style.transition = `opacity ${FADE_MS}ms ease`
      inC.style.opacity = '1'
      active = next
      fading = slotKey[prev] ? prev : null
      fadeTimer = window.setTimeout(endFade, reduced.matches ? 0 : FADE_MS + 60)
      stop()
      kick()
    }
    setVariant.current = (v) => show(v, current)

    // ── first frame ──
    slotKey[active] = keyOf(variant, current)
    canvases[active].style.opacity = '1'
    canvases[active].style.zIndex = '1'
    canvases[1 - active].style.opacity = '0'
    canvases[1 - active].style.zIndex = '0'
    const scrollParent = findScrollParent(root)
    const readScroll = () =>
      Math.min(800, Math.max(0, scrollParent.scrollTop || window.scrollY || 0))
    if (parallax) shift = scroll = readScroll()
    relayout()
    kick()

    // ── observers & listeners ──
    const scheduleRelayout = () => {
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(relayout, 140)
    }
    const ro = new ResizeObserver(() => {
      if (root.clientWidth === lastW && root.clientHeight === lastH) return
      scheduleRelayout()
    })
    ro.observe(root)
    // light skies place their veil (and the homepage sea) around the content column
    const content = contentRef?.current
    const contentRo = new ResizeObserver(() => {
      if (contentKey(env()) !== lastContent) scheduleRelayout()
    })
    if (content) contentRo.observe(content)

    const io = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting
        if (onScreen) kick()
        else stop()
      },
      { threshold: [0] },
    )
    io.observe(root)

    const mo = new MutationObserver(() => show(variant, htmlMode()))
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    const onVisibility = () => {
      pageVisible = document.visibilityState === 'visible'
      if (pageVisible) kick()
      else stop()
    }
    const onReduced = () => {
      stop()
      for (const slot of drawing()) paint(slot, 0)
      kick()
    }
    const recomputeLowPower = () => {
      const batLow = !!battery && !battery.charging && battery.level > 0 && battery.level <= 0.25
      const next = saveData || coarse.matches || batLow
      if (next === lowPower) return
      lowPower = next
      relayout()
    }
    const onScroll = () => {
      scroll = readScroll()
      kick()
    }

    let batteryRef: BatteryLike | null = null
    let disposed = false
    const onBattery = () => {
      if (!batteryRef) return
      battery = { charging: batteryRef.charging, level: batteryRef.level }
      recomputeLowPower()
    }
    const navWithBattery = navigator as Navigator & { getBattery?: () => Promise<BatteryLike> }
    void navWithBattery
      .getBattery?.()
      .then((bat) => {
        if (disposed) return
        batteryRef = bat
        onBattery()
        bat.addEventListener('chargingchange', onBattery)
        bat.addEventListener('levelchange', onBattery)
      })
      .catch(() => {})

    document.addEventListener('visibilitychange', onVisibility)
    reduced.addEventListener('change', onReduced)
    coarse.addEventListener('change', recomputeLowPower)
    if (parallax) {
      scrollParent.addEventListener('scroll', onScroll, { passive: true })
      window.addEventListener('scroll', onScroll, { passive: true })
    }

    return () => {
      disposed = true
      setVariant.current = null
      stop()
      window.clearTimeout(fadeTimer)
      window.clearTimeout(resizeTimer)
      document.removeEventListener('visibilitychange', onVisibility)
      reduced.removeEventListener('change', onReduced)
      coarse.removeEventListener('change', recomputeLowPower)
      if (parallax) {
        scrollParent.removeEventListener('scroll', onScroll)
        window.removeEventListener('scroll', onScroll)
      }
      if (batteryRef) {
        batteryRef.removeEventListener('chargingchange', onBattery)
        batteryRef.removeEventListener('levelchange', onBattery)
      }
      ro.disconnect()
      contentRo.disconnect()
      io.disconnect()
      mo.disconnect()
      for (const s of scenes.values()) s.release()
      for (const c of canvases) {
        c.width = 0
        c.height = 0
      }
    }
  }, [parallax, contentRef])

  return (
    <div
      ref={rootRef}
      className={cn('ma-sky', className)}
      style={{ background: skyBaseCss(scene, mode) }}
      data-scene={mode}
      data-variant={scene}
      aria-hidden
    >
      <canvas ref={aRef} className="ma-sky__layer" />
      <canvas ref={bRef} className="ma-sky__layer" />
    </div>
  )
}
