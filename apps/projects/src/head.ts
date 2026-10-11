import { useEffect } from 'react'

// Static head tags for every route are written at build time (seoPagesPlugin, see vite.config.ts),
// so crawlers and link previews get them without JS. These keep the tab title, description and
// canonical in step when the app navigates client-side between those routes.
export const ORIGIN = 'https://projects.ma.cyou'
export const LIST_TITLE = 'Projects by Timofey · projects.ma.cyou'
export const LIST_DESCRIPTION =
  'Projects by Timofey that are actually online: PocketCam, an encrypted chat, a materials tracker, PostgreSQL and Redis tools, and a Go reverse proxy.'

export const projectTitle = (title: string) => `${title} · projects.ma.cyou`

function setAttr(selector: string, attr: string, value: string) {
  document.head.querySelector(selector)?.setAttribute(attr, value)
}

export function usePageHead(title: string | undefined, description: string | undefined, path: string) {
  useEffect(() => {
    if (!title) return
    document.title = title
    if (description) setAttr('meta[name="description"]', 'content', description)
    setAttr('link[rel="canonical"]', 'href', ORIGIN + path)
    setAttr('meta[property="og:url"]', 'content', ORIGIN + path)
  }, [title, description, path])
}
