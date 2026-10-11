import type { ProjectImage } from '@ma/content'
import type { SVGProps } from 'react'

/** Localized alt text and caption for a project image. */
export function imageText(image: ProjectImage, ru: boolean) {
  return {
    alt: ru && image.altRu ? image.altRu : image.alt,
    caption: ru && image.captionRu ? image.captionRu : image.caption,
  }
}

/** Raster screenshots ship a 720px `-sm.webp` next to the full image; SVG diagrams scale on their own. */
export function smallSrc(image: ProjectImage) {
  return image.src.endsWith('.webp') ? image.src.replace(/\.webp$/, '-sm.webp') : image.src
}

export function srcSet(image: ProjectImage) {
  if (!image.src.endsWith('.webp')) return undefined
  // the small variant is fitted into 720×720, like the build script that made it
  const smallWidth = image.width >= image.height ? Math.min(720, image.width) : Math.round((720 * image.width) / image.height)
  return `${smallSrc(image)} ${smallWidth}w, ${image.src} ${image.width}w`
}

export function isPortrait(image: ProjectImage) {
  return image.height > image.width
}

type IconProps = SVGProps<SVGSVGElement>

function Icon({ children, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  )
}

export const ArrowUpRight = (props: IconProps) => (
  <Icon {...props}>
    <path d="M7 7h10v10" />
    <path d="M7 17 17 7" />
  </Icon>
)
export const DownloadIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 15V3" />
    <path d="m7 10 5 5 5-5" />
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
  </Icon>
)
export const DocIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v5h5" />
    <path d="M9 13h6M9 17h6" />
  </Icon>
)
export const GithubIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </Icon>
)
export const CheckIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M20 6 9 17l-5-5" />
  </Icon>
)
export const ChevronLeft = (props: IconProps) => (
  <Icon {...props}>
    <path d="m15 18-6-6 6-6" />
  </Icon>
)
export const ChevronRight = (props: IconProps) => (
  <Icon {...props}>
    <path d="m9 18 6-6-6-6" />
  </Icon>
)
export const CloseIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Icon>
)
