import { notFound } from 'next/navigation'
import { ProfessionalJobWorkspace } from '@/components/pro/job-workspace'
import { z } from 'zod'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) notFound()
  return <ProfessionalJobWorkspace requestId={id} />
}
