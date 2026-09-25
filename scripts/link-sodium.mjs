import { copyFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const pnpm = join(root, 'node_modules', '.pnpm')
if (!existsSync(pnpm)) process.exit(0)

const dirs = readdirSync(pnpm)
const sumo = dirs.find((d) => d.startsWith('libsodium-sumo@'))
const wrap = dirs.find((d) => d.startsWith('libsodium-wrappers-sumo@'))
if (!sumo || !wrap) process.exit(0)

const src = join(pnpm, sumo, 'node_modules', 'libsodium-sumo', 'dist', 'modules-sumo-esm', 'libsodium-sumo.mjs')
const dest = join(pnpm, wrap, 'node_modules', 'libsodium-wrappers-sumo', 'dist', 'modules-sumo-esm', 'libsodium-sumo.mjs')
if (existsSync(src)) copyFileSync(src, dest)
