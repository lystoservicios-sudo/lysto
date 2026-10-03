import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { changeProfessionalPassword } from '@/lib/professional/account-security'

function fakeClient(ready: boolean) {
  const getUser = vi.fn().mockResolvedValue({
    data: { user: { app_metadata: { app_role: 'professional' } } }, error: null
  })
  const rpc = vi.fn().mockResolvedValue({ data: ready, error: null })
  const updateUser = vi.fn().mockResolvedValue({ data: {}, error: null })
  return { client: { auth: { getUser, updateUser }, rpc } as never, getUser, rpc, updateUser }
}

it('blocks password changes until the technician finished setup', async () => {
  const fake = fakeClient(false)
  await expect(changeProfessionalPassword(fake.client, {
    currentPassword: '4827163', newPassword: 'MiClaveNuevaSegura1', confirmPassword: 'MiClaveNuevaSegura1'
  })).rejects.toMatchObject({ code: 'forbidden' })
  expect(fake.updateUser).not.toHaveBeenCalled()
})

it('requires the current password and changes it after setup completion', async () => {
  const fake = fakeClient(true)
  await expect(changeProfessionalPassword(fake.client, {
    currentPassword: '4827163', newPassword: 'MiClaveNuevaSegura1', confirmPassword: 'MiClaveNuevaSegura1'
  })).resolves.toEqual({ changed: true })
  expect(fake.updateUser).toHaveBeenCalledWith({
    password: 'MiClaveNuevaSegura1', current_password: '4827163'
  })
})

it('rejects mismatched passwords without asking Supabase to update them', async () => {
  const fake = fakeClient(true)
  await expect(changeProfessionalPassword(fake.client, {
    currentPassword: '4827163', newPassword: 'MiClaveNuevaSegura1', confirmPassword: 'OtraClaveNuevaSegura1'
  })).rejects.toThrow()
  expect(fake.updateUser).not.toHaveBeenCalled()
})
