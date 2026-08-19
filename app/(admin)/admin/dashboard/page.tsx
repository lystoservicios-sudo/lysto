import { PageScaffold } from '@/components/layout/page-scaffold'
import { MetricGrid } from '@/components/business/metric-card'
import { JobCard } from '@/components/business/job-card'
import { RequestCard } from '@/components/business/request-card'
import { ProfessionalCard } from '@/components/business/professional-card'
import { adminMetrics, jobs, professionals, requests } from '@/lib/mock/lysto-data'

export default function AdminDashboardPage() {
  return <PageScaffold title="Dashboard admin" eyebrow="Admin" description="Centro de comando operativo: solicitudes, trabajos, profesionales, pagos, calidad y auditoría."><MetricGrid metrics={adminMetrics} /><div className="grid gap-5 xl:grid-cols-3"><RequestCard request={requests[0]} /><JobCard job={jobs[1]} href="/admin/trabajos/JOB-5008" /><ProfessionalCard professional={professionals[0]} /></div></PageScaffold>
}
