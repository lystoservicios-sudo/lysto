export type OperationsSnapshot = {
  totalRequests: number
  paidRequests: number
  assignedJobs: number
  completedJobs: number
  cancelledJobs: number
  complaints: number
  averageRating?: number
  totalRevenue: number
  platformRevenue: number
}

export function calculateOperationsKpis(snapshot: OperationsSnapshot) {
  const conversionRate = snapshot.totalRequests === 0 ? 0 : snapshot.paidRequests / snapshot.totalRequests
  const assignmentRate = snapshot.paidRequests === 0 ? 0 : snapshot.assignedJobs / snapshot.paidRequests
  const completionRate = snapshot.assignedJobs === 0 ? 0 : snapshot.completedJobs / snapshot.assignedJobs
  const cancellationRate = snapshot.assignedJobs === 0 ? 0 : snapshot.cancelledJobs / snapshot.assignedJobs
  const complaintRate = snapshot.completedJobs === 0 ? 0 : snapshot.complaints / snapshot.completedJobs
  const platformMargin = snapshot.totalRevenue === 0 ? 0 : snapshot.platformRevenue / snapshot.totalRevenue
  return {
    conversionRate: roundRate(conversionRate),
    assignmentRate: roundRate(assignmentRate),
    completionRate: roundRate(completionRate),
    cancellationRate: roundRate(cancellationRate),
    complaintRate: roundRate(complaintRate),
    platformMargin: roundRate(platformMargin),
    health: operationalHealth({ completionRate, cancellationRate, complaintRate, averageRating: snapshot.averageRating })
  }
}

function roundRate(value: number): number {
  return Number(value.toFixed(4))
}

export function operationalHealth(input: { completionRate: number; cancellationRate: number; complaintRate: number; averageRating?: number }): 'healthy' | 'watch' | 'critical' {
  if (input.complaintRate > 0.08 || input.cancellationRate > 0.2 || (input.averageRating !== undefined && input.averageRating < 3.6)) return 'critical'
  if (input.complaintRate > 0.03 || input.cancellationRate > 0.1 || input.completionRate < 0.8 || (input.averageRating !== undefined && input.averageRating < 4.2)) return 'watch'
  return 'healthy'
}
