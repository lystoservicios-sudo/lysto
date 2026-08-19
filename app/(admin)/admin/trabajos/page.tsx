import { PageScaffold } from '@/components/layout/page-scaffold'
import { JobCard } from '@/components/business/job-card'
import { jobs } from '@/lib/mock/lysto-data'

export default function AdminJobsPage() {
  return <PageScaffold title="Trabajos" eyebrow="Admin" description="Trabajos futuros, en curso, terminados, disputas y garantías."><div className="grid gap-4">{jobs.map((job) => <JobCard key={job.id} job={job} href={`/admin/trabajos/${job.id}`} />)}</div></PageScaffold>
}
