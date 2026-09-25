import { Avatar, Badge, Button, Card, EmptyState, Input, MessageBubble, PageHeader, Progress, Switch } from '@ma/ui'
import { useState } from 'react'

export function GalleryPage() {
  const [on, setOn] = useState(true)
  if (!import.meta.env.DEV) return <p className="text-muted">Gallery is available in development.</p>
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Drift" title="Components" lead="Both themes use the same surfaces." />
      <Card className="flex flex-wrap items-center gap-3">
        <Button>Primary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Badge>chip</Badge>
        <Avatar name="Alex Kim" />
        <Switch checked={on} onCheckedChange={setOn} label="Toggle" />
      </Card>
      <Input placeholder="Name" aria-label="Name" />
      <Progress value={40} label="Progress" />
      <MessageBubble time="12:04" status="delivered">A short message on a floating surface.</MessageBubble>
      <EmptyState title="Nothing here" body="Empty states stay quiet." />
    </div>
  )
}
