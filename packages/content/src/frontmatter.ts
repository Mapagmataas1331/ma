/** Browser-safe YAML subset for the project markdown files. */
export function parseFrontMatter(raw: string): { data: Record<string, unknown>; content: string } {
  const text = raw.replace(/^\uFEFF/, '')
  if (!text.startsWith('---')) return { data: {}, content: text.trim() }
  const end = text.indexOf('\n---', 3)
  if (end < 0) return { data: {}, content: text.trim() }
  return { data: parseBlock(text.slice(3, end).trim()), content: text.slice(end + 4).trim() }
}

function parseBlock(block: string): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  const lines = block.split(/\r?\n/)
  let key = ''
  let list: unknown[] | null = null
  const flush = () => {
    if (key && list) data[key] = list
    list = null
  }
  for (const line of lines) {
    const item = /^\s+-\s+(.*)$/.exec(line)
    if (item && key) {
      list ??= []
      const rest = item[1] ?? ''
      const field = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(rest)
      if (field?.[1]) list.push({ [field[1]]: coerce(field[2] ?? '') })
      else list.push(unquote(rest))
      continue
    }
    const nested = /^\s+([A-Za-z0-9_]+):\s*(.*)$/.exec(line)
    const last = list?.[list.length - 1]
    if (nested?.[1] && key && last && typeof last === 'object' && !Array.isArray(last)) {
      ;(last as Record<string, unknown>)[nested[1]] = coerce(nested[2] ?? '')
      continue
    }
    flush()
    const field = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(line)
    if (!field) continue
    key = field[1] ?? ''
    const value = (field[2] ?? '').trim()
    if (value === '' || value === '|' || value === '>') {
      list = []
      continue
    }
    data[key] = coerce(value)
    key = ''
  }
  flush()
  return data
}

function unquote(value: string) {
  const trimmed = value.trim()
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function coerce(value: string): unknown {
  if (value === '[]') return []
  if (value === 'true') return true
  if (value === 'false') return false
  if (/^-?\d+$/.test(value)) return Number(value)
  return unquote(value)
}
