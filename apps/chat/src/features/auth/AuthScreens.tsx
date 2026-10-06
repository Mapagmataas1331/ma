import { displayNameError, passwordError, usernameError } from '@ma/protocol'
import { Button, Input, PageHeader, Surface } from '@ma/ui'
import { useState } from 'react'
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
  const [error, setError] = useState('')

  function explainValidation(message: string) {
    if (message.startsWith('username')) return t('usernameInvalid')
    if (message.startsWith('display name')) return t('displayNameInvalid')
    if (message.startsWith('password')) return t('passwordInvalid')
    return message
  }

  return (
    <form
      className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center overflow-y-auto px-4 py-6"
      onSubmit={form.handleSubmit(async (values) => {
        setError('')
        try {
          if (mode === 'register') {
            const nameError = usernameError(values.username)
            const shown = displayNameError(values.display || values.username)
            const passError = passwordError(values.password)
            if (nameError || shown || passError) {
              setError(explainValidation(nameError || shown || passError))
              return
            }
            await onRegister(values)
            return
          }
          if (mode === '2fa') {
            await on2fa(values.code)
            return
          }
          if (passwordError(values.password)) {
            setError(explainValidation(passwordError(values.password)))
            return
          }
          await onLogin(values)
        } catch (err) {
          setError(err instanceof Error ? err.message : t('somethingWentWrong'))
        }
      })}
    >
      <Surface strong className="flex flex-col gap-3 p-5 sm:p-6">
      <PageHeader title={mode === 'register' ? t('createAccount') : mode === '2fa' ? t('twoFactorCode') : t('signIn')} lead={t('signInLead')} />
      {mode === 'register' ? <Input placeholder={t('inviteCode')} aria-label={t('inviteCode')} {...form.register('invite', { required: true })} /> : null}
      {mode !== '2fa' ? <Input placeholder={t('username')} aria-label={t('username')} autoComplete="username" {...form.register('username', { required: true })} /> : null}
      {mode === 'register' ? (
        <>
          <Input placeholder={t('displayName')} aria-label={t('displayName')} {...form.register('display')} />
          <p className="text-xs text-muted">{t('usernameHint')}</p>
        </>
      ) : null}
      {mode !== '2fa' ? <Input type="password" placeholder={t('accountPassword')} aria-label={t('accountPassword')} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} {...form.register('password', { required: true })} /> : null}
      {mode === '2fa' ? <Input placeholder={t('code')} aria-label={t('code')} inputMode="numeric" {...form.register('code', { required: true })} /> : null}
      <p className="text-xs text-muted">{mode === 'register' ? t('accountPasswordHint') : mode === '2fa' ? t('twoFactorHintShort') : t('signInPasswordHint')}</p>
      {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
      <Button type="submit">{mode === 'register' ? t('register') : t('continue')}</Button>
      {mode === 'login' ? (
        <button type="button" className="ma-focusable block text-sm text-accent/80 underline decoration-accent/25 underline-offset-2 hover:text-accent hover:decoration-accent/50" onClick={() => { setError(''); onMode('register') }}>
          {t('haveInvite')}
        </button>
      ) : null}
      </Surface>
    </form>
  )
}
