import { loadProjectDetail } from '@ma/content'

export const loadDetailBody = () => import('./detail-body')

/** Warm a project's detail chunk and the body renderer, e.g. when a card is hovered or focused. */
export function prefetchProject(slug: string) {
  void loadDetailBody().catch(() => undefined)
  void loadProjectDetail(slug).catch(() => undefined)
}
