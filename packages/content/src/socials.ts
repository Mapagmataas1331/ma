import type { Social } from './schema'
import socialsJson from './socials.json'

/**
 * Socials without the zod runtime, for pages that only need this list (the homepage).
 * The same JSON is still schema-checked by loadSocials() in content.test.ts.
 */
export const socials: Social[] = socialsJson
