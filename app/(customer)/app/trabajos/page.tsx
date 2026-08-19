import { PageScaffold } from '@/components/layout/page-scaffold'
import { JobCard } from '@/components/business/job-card'
import { jobs } from '@/lib/mock/lysto-data'

export default function CustomerJobsPage() {
  return <PageScaffold title="Mis trabajos" eyebrow="Cliente" description="Trabajos confirmados, en curso, terminados y casos de garantía."><div className="grid gap-4">{jobs.map((job) => <JobCard key={job.id} job={job} href={`/app/trabajos/${job.id}`} />)}</div></PageScaffold>
}
