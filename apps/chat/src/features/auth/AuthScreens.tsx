import { displayNameError, passwordError, usernameError } from '@ma/protocol'
import { Button, Input, PageHeader } from '@ma/ui'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

type Values = { username: string; password: string; display: string; invite: string; code: string }

export function AuthScreens({
  mode,
  onMode,
  onLogin,
  onRegister,
  on2fa,
}: {
  mode: 'login' | 'register' | '2fa'
  onMode: (mode: 'login' | 'register') => void
  onLogin: (values: { username: string; password: string }) => Promise<void>
  onRegister: (values: { username: string; password: string; display: string; invite: string }) => Promise<void>
  on2fa: (code: string) => Promise<void>
}) {
  const { t } = useTranslation('common')
  const form = useForm<Values>({ defaultValues: { username: '', password: '', display: '', invite: '', code: '' } })
  return (
    <form
      className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-3 overflow-y-auto px-4 py-6"
      onSubmit={form.handleSubmit(async (values) => {
        if (mode === 'register') {
          const nameError = usernameError(values.username)
          const shown = displayNameError(values.display || values.username)
          const passError = passwordError(values.password)
          if (nameError || shown || passError) return
          await onRegister(values)
          return
        }
        if (mode === '2fa') {
          await on2fa(values.code)
          return
        }
        if (passwordError(values.password)) return
        await onLogin(values)
      })}
    >
      <PageHeader title={mode === 'register' ? t('createAccount') : mode === '2fa' ? t('twoFactorCode') : t('signIn')} lead={t('signInLead')} />
      {mode === 'register' ? <Input placeholder={t('inviteCode')} aria-label={t('inviteCode')} {...form.register('invite', { required: true })} /> : null}
      {mode !== '2fa' ? <Input placeholder={t('username')} aria-label={t('username')} autoComplete="username" {...form.register('username', { required: true })} /> : null}
      {mode === 'register' ? <Input placeholder={t('displayName')} aria-label={t('displayName')} {...form.register('display')} /> : null}
      {mode !== '2fa' ? <Input type="password" placeholder={t('accountPassword')} aria-label={t('accountPassword')} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} {...form.register('password', { required: true })} /> : null}
      {mode === '2fa' ? <Input placeholder={t('code')} aria-label={t('code')} inputMode="numeric" {...form.register('code', { required: true })} /> : null}
      <p className="text-xs text-muted">{mode === 'register' ? t('accountPasswordHint') : t('vaultPasswordSeparate')}</p>
      <Button type="submit">{mode === 'register' ? t('register') : t('continue')}</Button>
      {mode === 'login' ? (
        <button type="button" className="block text-sm text-muted" onClick={() => onMode('register')}>
          {t('haveInvite')}
        </button>
      ) : null}
    </form>
  )
}
