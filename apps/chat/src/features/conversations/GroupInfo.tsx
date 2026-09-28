import { ApiError, api } from '@ma/api-client'
import { groupNameError } from '@ma/protocol'
import { Button, Dialog, Input, PresenceDot, UserAvatar, toast } from '@ma/ui'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

export type GroupMember = { id: string; username: string; display_name: string; role: string }
export type GroupConversation = { id: string; kind?: string; title?: string; members?: GroupMember[] }
type Person = { id: string; username: string; display_name: string; state: string }

export function GroupInfo({
  conversation,
  me,
  contacts,
  online,
  open,
  onOpenChange,
  onChanged,
  onLeft,
}: {
  conversation: GroupConversation | null
  me: string
  contacts: Person[]
  online: Set<string>
  open: boolean
  onOpenChange: (open: boolean) => void
  onChanged: () => Promise<void> | void
  onLeft: () => void
}) {
  const { t } = useTranslation('common')
  const [title, setTitle] = useState(conversation?.title || '')
  const [adding, setAdding] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => setTitle(conversation?.title || ''), [conversation?.title, conversation?.id])
  if (!conversation) return null
  const members = conversation.members ?? []
  const mine = members.find((member) => member.id === me)
  const manager = mine?.role === 'owner' || mine?.role === 'admin'
  const owner = mine?.role === 'owner'
  const alone = members.length <= 1
  const candidates = contacts.filter((c) => c.state === 'accepted' && c.id !== me && !members.some((member) => member.id === c.id))

  function explain(err: unknown) {
    if (err instanceof ApiError) {
      if (err.code === 'group_full') return t('groupFull')
      if (err.code === 'not_contact') return t('groupNotContact')
      if (err.code === 'owner_must_transfer') return t('ownerMustTransfer')
      if (err.code === 'forbidden') return t('notAllowed')
    }
    return err instanceof Error ? err.message : t('somethingWentWrong')
  }

  async function run(action: () => Promise<unknown>, after?: () => void) {
    setBusy(true)
    try {
      await action()
      await onChanged()
      after?.()
    } catch (err) {
      toast(explain(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={conversation.title || t('newGroup')} description={t('groupMembersCount', { count: members.length, max: 20 })}>
      <div className="flex flex-col gap-4">
        {manager ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              const problem = groupNameError(title)
              if (problem) {
                toast(problem)
                return
              }
              if (title.trim() === conversation.title) return
              void run(() => api(`/v1/conversations/${conversation.id}`, { method: 'PATCH', body: JSON.stringify({ title: title.trim() }) }))
            }}
          >
            <Input value={title} aria-label={t('groupName')} placeholder={t('groupName')} onChange={(e) => setTitle(e.target.value)} />
            <Button type="submit" variant="outline" className="shrink-0" disabled={busy || title.trim() === conversation.title}>{t('rename')}</Button>
          </form>
        ) : null}
        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {members.map((member) => (
            <li key={member.id} className="flex items-center gap-3 rounded-sm px-1 py-1.5">
              <span className="relative shrink-0">
                <UserAvatar username={member.username} className="size-8" />
                <span className="absolute right-0 bottom-0"><PresenceDot online={member.id === me || online.has(member.id)} /></span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{member.display_name || member.username}{member.id === me ? ` · ${t('you')}` : ''}</span>
                <span className="block text-xs text-muted">@{member.username} · {t(`role_${member.role}`)}</span>
              </span>
              {manager && member.id !== me && member.role !== 'owner' && !(mine?.role === 'admin' && member.role === 'admin') ? (
                <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void run(() => api(`/v1/conversations/${conversation.id}/members/${member.id}`, { method: 'DELETE' }))}>
                  {t('remove')}
                </Button>
              ) : null}
              {owner && member.id !== me ? (
                <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => { if (window.confirm(t('transferOwnershipConfirm', { name: member.display_name || member.username }))) void run(() => api(`/v1/conversations/${conversation.id}/transfer`, { method: 'POST', body: JSON.stringify({ user_id: member.id }) })) }}>
                  {t('makeOwner')}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
        {manager && candidates.length && members.length < 20 ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (!adding) return
              void run(() => api(`/v1/conversations/${conversation.id}/members`, { method: 'POST', body: JSON.stringify({ user_id: adding }) }), () => setAdding(''))
            }}
          >
            <select className="h-10 min-w-0 flex-1 rounded-sm border border-line bg-surface-1 px-2 text-sm" aria-label={t('addMember')} value={adding} onChange={(e) => setAdding(e.target.value)}>
              <option value="">{t('addMember')}</option>
              {candidates.map((person) => (
                <option key={person.id} value={person.id}>{person.display_name || person.username}</option>
              ))}
            </select>
            <Button type="submit" variant="outline" className="shrink-0" disabled={busy || !adding}>{t('add')}</Button>
          </form>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-3">
          {owner && !alone ? <p className="mr-auto self-center text-xs text-muted">{t('ownerMustTransfer')}</p> : null}
          {owner ? (
            <Button type="button" variant="danger" disabled={busy} onClick={() => { if (window.confirm(t('deleteGroupConfirm'))) void run(() => api(`/v1/conversations/${conversation.id}`, { method: 'DELETE' }), onLeft) }}>
              {t('deleteGroup')}
            </Button>
          ) : null}
          {!owner || alone ? (
            <Button type="button" variant="outline" disabled={busy} onClick={() => { if (window.confirm(t('leaveGroupConfirm'))) void run(() => api(`/v1/conversations/${conversation.id}/leave`, { method: 'POST' }), onLeft) }}>
              {t('leaveGroup')}
            </Button>
          ) : null}
        </div>
      </div>
    </Dialog>
  )
}
