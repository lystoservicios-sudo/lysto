import { CustomerWarrantyCenter } from '@/components/customer/customer-warranty-center'
import { PageScaffold } from '@/components/layout/page-scaffold'
import { CustomerWarrantyClaimForm } from '@/components/customer/customer-warranty-claim-form'
import { requirePageSession } from '@/lib/auth/session'
import { customerLiveData } from '@/lib/customer/live-model'

export default async function CustomerWarrantyPage() {
  const data = await customerLiveData(await requirePageSession('customer'))
  return (
    <PageScaffold
      title="Garantías y calidad"
      eyebrow="Respaldo Lysto"
      description="Consultá coberturas, reclamos y seguimientos posteriores al servicio."
    >
      <CustomerWarrantyCenter warranties={data.warranties} qualityFollowups={[]} />
      <CustomerWarrantyClaimForm
        jobs={data.jobs
          .filter((job) => job.status === 'completed')
          .map((job) => ({ id: job.id, label: `${job.issueLabel} · ${job.id.slice(0, 8)}` }))}
      />
    </PageScaffold>
  )
}
