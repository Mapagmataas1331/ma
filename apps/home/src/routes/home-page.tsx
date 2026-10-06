import { socials } from '@ma/content/socials'
import { SkyBackdrop } from '@ma/ui/sky-backdrop'
import { useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import en from '../locales/en/home.json'
import ru from '../locales/ru/home.json'

const links = [
  { href: import.meta.env.VITE_APP_ORIGIN_RESUME || 'https://me.ma.cyou', short: 'me', key: 'resumeBlurb' as const },
  { href: import.meta.env.VITE_APP_ORIGIN_PROJECTS || 'https://projects.ma.cyou', short: 'projects', key: 'projectsBlurb' as const },
  { href: 'https://pocketcam.ma.cyou/', short: 'pocketcam', key: 'pocketcamBlurb' as const },
  { href: import.meta.env.VITE_APP_ORIGIN_CHAT || 'https://chat.ma.cyou', short: 'chat', key: 'chatBlurb' as const },
]

export function HomePage() {
  const { t, i18n } = useTranslation('common')
  const copy = useMemo(() => (i18n.language.startsWith('ru') ? ru : en), [i18n.language])
  const contentRef = useRef<HTMLDivElement>(null)

  return (
    <div className="home-sky relative flex h-full min-h-0 flex-1 flex-col overflow-y-auto px-6 sm:px-10 lg:px-14">
      <SkyBackdrop parallax contentRef={contentRef} />

      {/* min-h-full + justify-center: center on tall screens; when content is taller than the
          viewport, the frame grows so scroll starts at the top (my-auto alone can clip it). */}
      <div className="home-frame relative z-[1] flex min-h-full w-full flex-col justify-center py-6">
        <div ref={contentRef} className="home-panel mx-auto flex w-full max-w-2xl flex-col self-center">
          <div className="home-rise home-brand mb-8 text-center sm:mb-10" style={{ animationDelay: '40ms' }}>
            <p className="home-wordmark text-[clamp(3rem,14vw,5.5rem)] leading-none font-semibold tracking-tight">
              <span className="text-fg">ma</span>
              <span className="text-muted">.cyou</span>
            </p>
            <h1 className="mt-4 text-xl font-medium tracking-tight sm:text-2xl">{copy.name}</h1>
          </div>

          <p className="home-rise home-lead mb-2 max-w-lg text-sm leading-relaxed text-muted sm:text-base" style={{ animationDelay: '120ms' }}>
            {copy.lead}
          </p>

          <nav className="home-rise home-links" aria-label={t('sites')} style={{ animationDelay: '160ms' }}>
            <ul className="flex flex-col">
              {links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="home-link ma-focusable group -mx-3 flex items-center gap-4 rounded-md px-3 py-3.5 transition duration-200 ease-[cubic-bezier(.2,.8,.2,1)] hover:bg-surface-2/70 focus-visible:bg-surface-2/70"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-medium tracking-tight sm:text-lg">
                        <span className="text-accent">{link.short}</span>
                        <span className="text-muted">.ma.cyou</span>
                      </span>
                      <span className="home-link-blurb mt-0.5 block text-sm text-muted">{copy[link.key]}</span>
                    </span>
                    <span
                      className="home-link-arrow flex size-9 shrink-0 items-center justify-center rounded-full text-xl leading-none text-muted transition group-hover:translate-x-0.5 group-hover:bg-surface-3 group-hover:text-accent"
                      aria-hidden
                    >
                      →
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="home-fade home-social mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-5" style={{ animationDelay: '300ms' }}>
            {socials.map((s) => (
              <a key={s.href} href={s.href} target="_blank" rel="noopener noreferrer" className="ma-focusable rounded-sm text-sm text-muted transition hover:text-fg">
                {s.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
