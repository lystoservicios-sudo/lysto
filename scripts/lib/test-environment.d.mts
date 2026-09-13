export interface DisposableIdentity {
  projectId: string
  databasePort: number
  apiPort: number
  production: false
}
export function assertTestEnvironment(env: Record<string, string | undefined>, identity: unknown): { projectId: string; apiUrl: string; databaseUrl: string }
export function readTestIdentity(env: Record<string, string | undefined>): DisposableIdentity
