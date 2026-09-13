/* global __ENV */
import http from 'k6/http'
import { check, fail, sleep } from 'k6'
import { Trend } from 'k6/metrics'

const baseUrl = (__ENV.BASE_URL || '').replace(/\/$/, '')
const targetEnv = __ENV.TARGET_ENV || ''
const profile = __ENV.LOAD_PROFILE || 'smoke'
const authCookie = __ENV.LYSTO_LOAD_TEST_AUTH_COOKIE || ''
const productionHost = __ENV.PRODUCTION_HOST || ''

if (!baseUrl || !['local', 'staging'].includes(targetEnv)) fail('BASE_URL and TARGET_ENV=local|staging are required')
const target = baseUrl.match(/^(https?):\/\/([^/:?#]+|\[[^\]]+\])(?::\d+)?$/)
if (!target) fail('BASE_URL must be an origin without path, query or fragment')
const protocol = `${target[1]}:`
const hostname = target[2]
if (!['localhost', '127.0.0.1', '[::1]'].includes(hostname) && protocol !== 'https:') fail('Remote load targets require HTTPS')
if (targetEnv === 'production' || (productionHost && hostname === productionHost)) fail('Production load testing is forbidden')
if (!authCookie) fail('A designated synthetic customer session cookie is required')

const profiles = {
  smoke: { readVus: 2, readDuration: '1m', mutationVus: 1, mutationDuration: '1m' },
  peak: { readVus: 5, readDuration: '10m', mutationVus: 2, mutationDuration: '10m' },
  double_peak: { readVus: 10, readDuration: '15m', mutationVus: 4, mutationDuration: '15m' },
  burst: { readVus: 20, readDuration: '2m', mutationVus: 5, mutationDuration: '2m' },
  sustained: { readVus: 5, readDuration: '60m', mutationVus: 2, mutationDuration: '60m' }
}
if (!profiles[profile]) fail('Unknown LOAD_PROFILE')
const selected = profiles[profile]

export const options = {
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  scenarios: {
    reads: { executor: 'constant-vus', exec: 'reads', vus: selected.readVus, duration: selected.readDuration },
    safe_mutations: { executor: 'constant-vus', exec: 'safeMutations', vus: selected.mutationVus, duration: selected.mutationDuration, startTime: '5s' }
  },
  thresholds: {
    'http_req_duration{operation:read}': ['p(95)<1000'],
    'http_req_duration{operation:mutation}': ['p(95)<2000'],
    http_req_failed: ['rate<0.01'],
    own_read_latency: ['p(95)<1000'],
    own_mutation_latency: ['p(95)<2000']
  }
}

const ownRead = new Trend('own_read_latency', true)
const ownMutation = new Trend('own_mutation_latency', true)
const headers = { Cookie: authCookie, Origin: baseUrl, 'Content-Type': 'application/json', 'X-Lysto-Load-Test': 'synthetic' }

export function reads() {
  const live = http.get(`${baseUrl}/api/health/live`, { tags: { operation: 'read', endpoint: 'live' } })
  const addresses = http.get(`${baseUrl}/api/customer/addresses`, { headers, tags: { operation: 'read', endpoint: 'addresses' } })
  check(live, { 'live is 200': response => response.status === 200 })
  check(addresses, { 'authorized list is 200': response => response.status === 200 })
  ownRead.add(addresses.timings.duration)
  sleep(1)
}

export function safeMutations() {
  const response = http.post(`${baseUrl}/api/diagnosis/generate`, JSON.stringify({ issue: 'mantenimiento', timeSince: 'months' }), { headers, tags: { operation: 'mutation', endpoint: 'diagnosis' } })
  check(response, { 'bounded synthetic calculation is 200': value => value.status === 200 })
  ownMutation.add(response.timings.duration)
  // Keep the shared synthetic identity below the 60/minute mutation guard.
  sleep(6)
}

export function handleSummary(data) {
  return { stdout: `${JSON.stringify({ targetEnv, profile, generatedAt: new Date().toISOString(), metrics: data.metrics }, null, 2)}\n` }
}
