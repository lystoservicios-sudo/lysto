export type ProfessionalCandidate = {
  id: string
  name: string
  status: 'approved' | 'under_review' | 'suspended' | 'inactive'
  serviceSlugs: string[]
  zones: string[]
  available: boolean
  hasLicense: boolean
  toolsScore: number
  ratingAvg: number | null
  jobsCompleted: number
  activeJobs: number
  acceptanceRate: number
  distanceKm: number
  internalScore: number
}

export type MatchInput = {
  serviceSlug: string
  zone: string
  requiredToolScore?: number
  maxDistanceKm?: number
}

export type ScoredCandidate = ProfessionalCandidate & { score: number; reasons: string[] }

export function isEligible(candidate: ProfessionalCandidate, input: MatchInput): boolean {
  if (candidate.status !== 'approved') return false
  if (!candidate.serviceSlugs.includes(input.serviceSlug)) return false
  if (!candidate.zones.includes(input.zone)) return false
  if (!candidate.available) return false
  if (!candidate.hasLicense) return false
  if (candidate.toolsScore < (input.requiredToolScore ?? 0)) return false
  if (candidate.distanceKm > (input.maxDistanceKm ?? 35)) return false
  return true
}

export function scoreProfessional(
  candidate: ProfessionalCandidate,
  input: MatchInput
): ScoredCandidate | null {
  if (!isEligible(candidate, input)) return null
  const reasons: string[] = []
  let score = 25
  reasons.push('Profesional aprobado y matriculado')
  const rating = candidate.ratingAvg ?? 4.2
  score += Math.min(25, rating * 5)
  score += Math.min(15, candidate.jobsCompleted / 3)
  score += Math.min(15, candidate.toolsScore * 1.5)
  score += Math.min(10, candidate.acceptanceRate * 10)
  score -= Math.min(12, candidate.distanceKm * 0.4)
  score -= candidate.activeJobs * 4
  score += Math.min(10, candidate.internalScore / 10)
  reasons.push(`Rating considerado: ${rating.toFixed(1)}`)
  reasons.push(`Distancia aproximada: ${candidate.distanceKm} km`)
  return { ...candidate, score: Math.max(0, Number(score.toFixed(2))), reasons }
}

export function rankProfessionals(
  candidates: ProfessionalCandidate[],
  input: MatchInput
): ScoredCandidate[] {
  return candidates
    .map((candidate) => scoreProfessional(candidate, input))
    .filter((candidate): candidate is ScoredCandidate => candidate !== null)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
}
