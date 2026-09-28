import { groupNameError } from '@ma/protocol'
import { Button, Dialog, Input } from '@ma/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

type Person = { id: string; username: string; display_name: string; state: string }

export function CreateGroup({
  contacts,
  onCreate,
}: {
  contacts: Person[]
  onCreate: (title: string, memberIds: string[]) => Promise<void>
}) {
  const { t } = useTranslation('common')
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const accepted = contacts.filter((c) => c.state === 'accepted')
  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>{t('newGroup')}</Button>
      <Dialog open={open} onOpenChange={setOpen} title={t('newGroup')} description={t('newGroupLead')}>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (groupNameError(title) || picked.length < 1) return
            void onCreate(title.trim(), picked).then(() => setOpen(false))
          }}
        >
          <Input placeholder={t('groupName')} aria-label={t('groupName')} value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {accepted.map((person) => (
              <label key={person.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={picked.includes(person.id)}
                  onChange={(e) => setPicked((prev) => (e.target.checked ? [...prev, person.id] : prev.filter((id) => id !== person.id)))}
                />
                {person.display_name || person.username}
              </label>
            ))}
          </div>
          <Button type="submit">{t('create')}</Button>
        </form>
      </Dialog>
    </>
  )
}
