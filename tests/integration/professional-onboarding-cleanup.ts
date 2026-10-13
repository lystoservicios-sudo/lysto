type CleanupDatabase = {
  query(text: string, values: unknown[]): PromiseLike<unknown>
}

export type OwnedProfessionalOnboardingScope = {
  invitationIds: readonly string[]
  professionalIds: readonly string[]
  recipientProfileIds: readonly string[]
}

/** Only fixture IDs recorded by the caller may enter this disposable cleanup. */
export async function clearOwnedProfessionalOnboardingOutbox(
  database: CleanupDatabase,
  scope: OwnedProfessionalOnboardingScope
): Promise<void> {
  const recipients = [...new Set(scope.recipientProfileIds)]
  const aggregates = [...new Set([...scope.invitationIds, ...scope.professionalIds])]
  const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
  if ([...recipients, ...aggregates].some((id) => !uuid.test(id)))
    throw new Error('Invalid registered cleanup ID')
  if (!recipients.length && !aggregates.length) return
  await database.query(
    'delete from private.outbox_events where recipient_profile_id=any($1::uuid[]) or aggregate_id=any($2::uuid[])',
    [recipients, aggregates]
  )
}
