import { cn } from '../lib/cn'

function hash32(input: string) {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry(seed: number) {
  let state = seed || 1
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function smoothClosed(pts: [number, number][]) {
  const n = pts.length
  let d = `M ${pts[0]![0].toFixed(1)} ${pts[0]![1].toFixed(1)}`
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]!
    const p1 = pts[i]!
    const p2 = pts[(i + 1) % n]!
    const p3 = pts[(i + 2) % n]!
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
  }
  return `${d} Z`
}

function polar(n: number, rand: () => number, spin: number) {
  const pts: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const a = spin + (i / n) * Math.PI * 2
    const r = 8 + rand() * 28
    pts.push([40 + Math.cos(a) * r, 40 + Math.sin(a) * r])
  }
  return pts
}

function mark(username: string) {
  const seed = hash32(username.trim().toLowerCase())
  const rand = mulberry(seed)
  const hue = Math.floor(rand() * 360)
  const hue2 = (hue + 40 + Math.floor(rand() * 160)) % 360
  const style = Math.floor(rand() * 4)
  const shapes: { d: string; fill: string; stroke?: string; width?: number }[] = []
  const bg = `oklch(${(0.55 + rand() * 0.3).toFixed(2)} ${(0.08 + rand() * 0.12).toFixed(2)} ${hue})`
  const ink = `oklch(${(0.25 + rand() * 0.35).toFixed(2)} ${(0.12 + rand() * 0.14).toFixed(2)} ${hue2})`
  const line = `oklch(0.97 0.02 ${hue})`

  if (style === 0) {
    const lobes = 3 + Math.floor(rand() * 5)
    shapes.push({ d: smoothClosed(polar(lobes, rand, rand() * Math.PI)), fill: ink })
    shapes.push({ d: smoothClosed(polar(lobes, rand, rand() * Math.PI)), fill: 'none', stroke: line, width: 2 + rand() * 3 })
  } else if (style === 1) {
    for (let i = 0; i < 2 + Math.floor(rand() * 3); i++) {
      const cx = 18 + rand() * 44
      const cy = 18 + rand() * 44
      const r = 10 + rand() * 22
      shapes.push({ d: `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0`, fill: i % 2 ? ink : 'none', stroke: line, width: 3 })
    }
  } else if (style === 2) {
    const turns = 2 + Math.floor(rand() * 3)
    for (let i = 0; i < turns; i++) {
      const y = 12 + rand() * 56
      const bend = (rand() - 0.5) * 70
      shapes.push({
        d: `M -4 ${y.toFixed(1)} C 20 ${(y + bend).toFixed(1)} 60 ${(y - bend).toFixed(1)} 84 ${y.toFixed(1)}`,
        fill: 'none',
        stroke: i === 0 ? ink : line,
        width: 4 + rand() * 8,
      })
    }
  } else {
    shapes.push({ d: smoothClosed(polar(4 + Math.floor(rand() * 3), rand, rand() * Math.PI)), fill: ink })
    const x = 20 + rand() * 40
    const y = 20 + rand() * 40
    shapes.push({ d: `M ${x} ${y} m -18 0 a 18 18 0 1 0 36 0 a 18 18 0 1 0 -36 0`, fill: line })
  }

  return { bg, shapes }
}

export function UserAvatar({ username, className }: { username: string; className?: string }) {
  const { bg, shapes } = mark(username || '?')
  const clip = `mark-${hash32(username || '?')}`
  return (
    <svg viewBox="0 0 80 80" className={cn('inline-block size-10 shrink-0 rounded-full', className)} role="img" aria-label={username}>
      <defs>
        <clipPath id={clip}>
          <circle cx="40" cy="40" r="40" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect width="80" height="80" fill={bg} />
        {shapes.map((shape) => (
          <path key={shape.d} d={shape.d} fill={shape.fill} stroke={shape.stroke} strokeWidth={shape.width} strokeLinecap="round" />
        ))}
      </g>
    </svg>
  )
}
