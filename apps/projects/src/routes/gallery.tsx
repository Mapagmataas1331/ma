import type { ProjectImage } from '@ma/content'
import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, CloseIcon, imageText, isPortrait, smallSrc, srcSet } from './media'

/**
 * Screenshot grid plus a full-size viewer. The viewer is a native <dialog>, so it needs no Radix
 * chunk: Esc closes it, focus is trapped by the browser, arrows and swipes move between images.
 */
export function Gallery({ images, title }: { images: ProjectImage[]; title: string }) {
  const { t, i18n } = useTranslation('common')
  const ru = i18n.language.startsWith('ru')
  const [open, setOpen] = useState<number | null>(null)
  if (!images.length) return null
  const [first, ...rest] = images
  return (
    <section aria-label={t('projectGallery')} className="project-gallery">
      {first ? <Shot image={first} index={0} hero ru={ru} title={title} onOpen={setOpen} /> : null}
      {rest.length ? (
        <ul className={`project-thumbs ${rest.length === 1 ? 'project-thumbs--one' : ''}`}>
          {rest.map((image, i) => (
            <li key={image.src} className="min-w-0">
              <Shot image={image} index={i + 1} ru={ru} title={title} onOpen={setOpen} />
            </li>
          ))}
        </ul>
      ) : null}
      {open !== null ? <Viewer images={images} index={open} onIndex={setOpen} onClose={() => setOpen(null)} /> : null}
    </section>
  )
}

function Shot({ image, index, hero = false, ru, title, onOpen }: { image: ProjectImage; index: number; hero?: boolean; ru: boolean; title: string; onOpen: (i: number) => void }) {
  const { t } = useTranslation('common')
  const { alt, caption } = imageText(image, ru)
  const portrait = isPortrait(image)
  return (
    <figure className="m-0 min-w-0">
      <a
        href={image.src}
        className={`project-shot ma-focusable ${hero ? 'project-shot--hero' : ''} ${portrait ? 'project-shot--portrait' : ''}`}
        style={hero && !portrait ? { aspectRatio: `${image.width} / ${image.height}` } : undefined}
        aria-label={t('openFullSize', { name: caption || alt })}
        onClick={(e) => {
          // a plain link still works without JS or with a modifier key (new tab)
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
          e.preventDefault()
          onOpen(index)
        }}
      >
        <img
          src={hero ? image.src : smallSrc(image)}
          srcSet={srcSet(image)}
          sizes={hero ? '(min-width: 72rem) 70rem, 100vw' : '(min-width: 48rem) 22rem, 50vw'}
          width={image.width}
          height={image.height}
          alt={alt}
          loading={hero ? 'eager' : 'lazy'}
          decoding="async"
          {...(hero ? { fetchPriority: 'high' as const } : {})}
          title={`${title} — ${caption || alt}`}
        />
      </a>
      {caption ? <figcaption className="mt-2 text-xs text-muted">{caption}</figcaption> : null}
    </figure>
  )
}

function Viewer({ images, index, onIndex, onClose }: { images: ProjectImage[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const { t, i18n } = useTranslation('common')
  const ru = i18n.language.startsWith('ru')
  const dialog = useRef<HTMLDialogElement>(null)
  const swipe = useRef<number | null>(null)
  const image = images[index]
  const count = images.length
  const go = useCallback((step: number) => onIndex((index + step + count) % count), [index, count, onIndex])

  useEffect(() => {
    const node = dialog.current
    if (!node) return
    if (!node.open) node.showModal()
    const root = document.documentElement
    const overflow = root.style.overflow
    root.style.overflow = 'hidden'
    return () => {
      root.style.overflow = overflow
      if (node.open) node.close()
    }
  }, [])

  useEffect(() => {
    if (count < 2) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, count])

  // warm the neighbours so arrows feel instant
  useEffect(() => {
    if (count < 2) return
    for (const step of [1, -1]) {
      const next = images[(index + step + count) % count]
      if (next) new Image().src = next.src
    }
  }, [images, index, count])

  if (!image) return null
  const { alt, caption } = imageText(image, ru)
  const onPointerDown = (e: PointerEvent) => {
    swipe.current = e.clientX
  }
  const onPointerUp = (e: PointerEvent) => {
    const start = swipe.current
    swipe.current = null
    if (start === null || count < 2) return
    const dx = e.clientX - start
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1)
  }
  return (
    <dialog
      ref={dialog}
      className="project-viewer"
      aria-label={caption || alt}
      // Esc: let React unmount the viewer instead of the browser closing the dialog underneath it.
      // (Listening to `close` would also fire when the effect cleanup closes it, e.g. under StrictMode.)
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="project-viewer__stage"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        <figure className="project-viewer__figure">
          <img key={image.src} src={image.src} width={image.width} height={image.height} alt={alt} decoding="async" />
          <figcaption>
            <span>{caption || alt}</span>
            {count > 1 ? <span className="font-mono tabular-nums opacity-70">{t('imageCounter', { index: index + 1, total: count })}</span> : null}
          </figcaption>
        </figure>
      </div>
      <button type="button" className="project-viewer__btn project-viewer__close" aria-label={t('close')} onClick={onClose} autoFocus>
        <CloseIcon className="size-5" />
      </button>
      {count > 1 ? (
        <>
          <button type="button" className="project-viewer__btn project-viewer__prev" aria-label={t('previousImage')} onClick={() => go(-1)}>
            <ChevronLeft className="size-5" />
          </button>
          <button type="button" className="project-viewer__btn project-viewer__next" aria-label={t('nextImage')} onClick={() => go(1)}>
            <ChevronRight className="size-5" />
          </button>
        </>
      ) : null}
    </dialog>
  )
}
