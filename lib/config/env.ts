import { z } from 'zod'

export type EnvSource = NodeJS.ProcessEnv | Record<string, string | undefined>

const REDACTED = '[REDACTED]' as const

const requiredValue = (name: string) => z.string().trim().min(1, `${name} is required`)
const optionalValue = z.string().trim().optional()
const explicitBoolean = (name: string) =>
  z
    .enum(['true', 'false'], {
      errorMap: () => ({ message: `${name} must be "true" or "false"` })
    })
    .default('false')
    .transform((value) => value === 'true')

const publicEnvShape = {
  NEXT_PUBLIC_APP_URL: z.string().trim().url('NEXT_PUBLIC_APP_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().trim().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalValue,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalValue
}

function requirePublicSupabaseKey(
  env: {
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string
    NEXT_PUBLIC_SUPABASE_ANON_KEY?: string
  },
  context: z.RefinementCtx
): void {
  if (env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return

  context.addIssue({
    code: z.ZodIssueCode.custom,
    message: 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY is required',
    path: ['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY']
  })
}

export const publicEnvSchema = z
  .object(publicEnvShape)
  .superRefine(requirePublicSupabaseKey)
  .transform((env) => ({
    appUrl: env.NEXT_PUBLIC_APP_URL,
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    supabasePublishableKey:
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || (env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string)
  }))

const serverEnvShape = {
  ...publicEnvShape,
  APP_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  LYSTO_ACCEPT_NEW_REQUESTS: z.enum(['true', 'false']).optional(),
  LYSTO_ALLOW_NEW_CHECKOUTS: z.enum(['true', 'false']).optional(),
  RATE_LIMIT_HASH_KEY: optionalValue,
  SUPABASE_SERVICE_ROLE_KEY: requiredValue('SUPABASE_SERVICE_ROLE_KEY'),
  PAYMENTS_PROVIDER: z.enum(['mock', 'mercadopago', 'mercadopago_split']).default('mock'),
  MERCADOPAGO_MODE: z.enum(['test', 'live']).optional(),
  MERCADOPAGO_DATABASE_URL: optionalValue,
  MERCADOPAGO_ENCRYPTION_KEY: optionalValue,
  MERCADOPAGO_PUBLIC_KEY: optionalValue,
  MERCADOPAGO_ACCESS_TOKEN: optionalValue,
  MERCADOPAGO_WEBHOOK_SECRET: optionalValue,
  MERCADOPAGO_MARKETPLACE_CLIENT_ID: optionalValue,
  MERCADOPAGO_MARKETPLACE_CLIENT_SECRET: optionalValue,
  NOTIFICATIONS_EMAIL_ENABLED: explicitBoolean('NOTIFICATIONS_EMAIL_ENABLED'),
  RESEND_API_KEY: optionalValue,
  NOTIFICATIONS_EMAIL_FROM: optionalValue,
  OUTBOX_WORKER_ENABLED: explicitBoolean('OUTBOX_WORKER_ENABLED'),
  OUTBOX_WORKER_SECRET: optionalValue,
  REFUND_WORKER_ENABLED: explicitBoolean('REFUND_WORKER_ENABLED'),
  REFUND_WORKER_SECRET: optionalValue,
  WHATSAPP_ENABLED: explicitBoolean('WHATSAPP_ENABLED'),
  WHATSAPP_API_TOKEN: optionalValue,
  WHATSAPP_PHONE_NUMBER_ID: optionalValue,
  AI_ENABLED: explicitBoolean('AI_ENABLED'),
  AI_PROVIDER: optionalValue,
  OPENAI_API_KEY: optionalValue
}

type ServerEnvInput = z.output<z.ZodObject<typeof serverEnvShape>>

function requireWhenEnabled(
  env: ServerEnvInput,
  context: z.RefinementCtx,
  enabled: boolean,
  names: Array<keyof ServerEnvInput>
): void {
  if (!enabled) return

  names.forEach((name) => {
    if (env[name]) return

    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${String(name)} is required when its provider or feature is enabled`,
      path: [name]
    })
  })
}

export const serverEnvSchema = z
  .object(serverEnvShape)
  .superRefine((env, context) => {
    requirePublicSupabaseKey(env, context)
    if (env.APP_ENV === 'production') {
      for (const name of ['LYSTO_ACCEPT_NEW_REQUESTS', 'LYSTO_ALLOW_NEW_CHECKOUTS'] as const) {
        if (env[name] !== undefined) continue
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${name} is required in production`,
          path: [name]
        })
      }
    }
    if (
      ['staging', 'production'].includes(env.APP_ENV) &&
      !/^[A-Za-z0-9_-]{32,128}$/.test(env.RATE_LIMIT_HASH_KEY ?? '')
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'RATE_LIMIT_HASH_KEY must contain 32 to 128 safe characters outside local environments',
        path: ['RATE_LIMIT_HASH_KEY']
      })
    }
    if (env.APP_ENV === 'production' && env.PAYMENTS_PROVIDER !== 'mercadopago_split') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Production requires PAYMENTS_PROVIDER=mercadopago_split',
        path: ['PAYMENTS_PROVIDER']
      })
    }
    requireWhenEnabled(env, context, env.PAYMENTS_PROVIDER === 'mercadopago_split', [
      'MERCADOPAGO_MODE',
      'MERCADOPAGO_DATABASE_URL',
      'MERCADOPAGO_ENCRYPTION_KEY',
      'MERCADOPAGO_WEBHOOK_SECRET',
      'MERCADOPAGO_MARKETPLACE_CLIENT_ID',
      'MERCADOPAGO_MARKETPLACE_CLIENT_SECRET'
    ])
    requireWhenEnabled(env, context, env.PAYMENTS_PROVIDER === 'mercadopago', [
      'MERCADOPAGO_PUBLIC_KEY',
      'MERCADOPAGO_ACCESS_TOKEN',
      'MERCADOPAGO_WEBHOOK_SECRET',
      'MERCADOPAGO_MARKETPLACE_CLIENT_ID',
      'MERCADOPAGO_MARKETPLACE_CLIENT_SECRET'
    ])
    requireWhenEnabled(env, context, env.NOTIFICATIONS_EMAIL_ENABLED, [
      'RESEND_API_KEY',
      'NOTIFICATIONS_EMAIL_FROM'
    ])
    requireWhenEnabled(env, context, env.OUTBOX_WORKER_ENABLED, ['OUTBOX_WORKER_SECRET'])
    if (
      env.OUTBOX_WORKER_ENABLED &&
      !/^[A-Za-z0-9_-]{32,128}$/.test(env.OUTBOX_WORKER_SECRET ?? '')
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'OUTBOX_WORKER_SECRET must contain 32 to 128 safe characters',
        path: ['OUTBOX_WORKER_SECRET']
      })
    }
    requireWhenEnabled(env, context, env.REFUND_WORKER_ENABLED, ['REFUND_WORKER_SECRET'])
    if (
      env.REFUND_WORKER_ENABLED &&
      !/^[A-Za-z0-9_-]{32,128}$/.test(env.REFUND_WORKER_SECRET ?? '')
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'REFUND_WORKER_SECRET must contain 32 to 128 safe characters',
        path: ['REFUND_WORKER_SECRET']
      })
    }
    requireWhenEnabled(env, context, env.WHATSAPP_ENABLED, [
      'WHATSAPP_API_TOKEN',
      'WHATSAPP_PHONE_NUMBER_ID'
    ])
    requireWhenEnabled(env, context, env.AI_ENABLED, ['AI_PROVIDER', 'OPENAI_API_KEY'])
    if (env.AI_ENABLED && env.AI_PROVIDER && env.AI_PROVIDER !== 'openai') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'AI_PROVIDER must be "openai" when AI is enabled',
        path: ['AI_PROVIDER']
      })
    }
  })
  .transform((env) => ({
    runtime: {
      appEnv: env.APP_ENV,
      acceptNewRequests: env.LYSTO_ACCEPT_NEW_REQUESTS === 'true',
      allowNewCheckouts: env.LYSTO_ALLOW_NEW_CHECKOUTS === 'true',
      rateLimitHashKey: env.RATE_LIMIT_HASH_KEY
    },
    public: {
      appUrl: env.NEXT_PUBLIC_APP_URL,
      supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
      supabasePublishableKey:
        env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || (env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string)
    },
    supabase: {
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY
    },
    payments:
      env.PAYMENTS_PROVIDER === 'mercadopago'
        ? {
            provider: 'mercadopago' as const,
            publicKey: env.MERCADOPAGO_PUBLIC_KEY as string,
            accessToken: env.MERCADOPAGO_ACCESS_TOKEN as string,
            webhookSecret: env.MERCADOPAGO_WEBHOOK_SECRET as string,
            marketplaceClientId: env.MERCADOPAGO_MARKETPLACE_CLIENT_ID as string,
            marketplaceClientSecret: env.MERCADOPAGO_MARKETPLACE_CLIENT_SECRET as string
          }
        : env.PAYMENTS_PROVIDER === 'mercadopago_split'
          ? {
              provider: 'mercadopago_split' as const,
              mode: env.MERCADOPAGO_MODE as 'test' | 'live',
              databaseUrl: env.MERCADOPAGO_DATABASE_URL as string,
              encryptionKey: env.MERCADOPAGO_ENCRYPTION_KEY as string,
              webhookSecret: env.MERCADOPAGO_WEBHOOK_SECRET as string,
              marketplaceClientId: env.MERCADOPAGO_MARKETPLACE_CLIENT_ID as string,
              marketplaceClientSecret: env.MERCADOPAGO_MARKETPLACE_CLIENT_SECRET as string
            }
          : { provider: 'mock' as const },
    email: env.NOTIFICATIONS_EMAIL_ENABLED
      ? {
          enabled: true as const,
          resendApiKey: env.RESEND_API_KEY as string,
          from: env.NOTIFICATIONS_EMAIL_FROM as string
        }
      : { enabled: false as const },
    outboxWorker: env.OUTBOX_WORKER_ENABLED
      ? { enabled: true as const, secret: env.OUTBOX_WORKER_SECRET as string }
      : { enabled: false as const },
    refundWorker: env.REFUND_WORKER_ENABLED
      ? { enabled: true as const, secret: env.REFUND_WORKER_SECRET as string }
      : { enabled: false as const },
    whatsapp: env.WHATSAPP_ENABLED
      ? {
          enabled: true as const,
          apiToken: env.WHATSAPP_API_TOKEN as string,
          phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID as string
        }
      : { enabled: false as const },
    ai: env.AI_ENABLED
      ? {
          enabled: true as const,
          provider: env.AI_PROVIDER as 'openai',
          apiKey: env.OPENAI_API_KEY as string
        }
      : { enabled: false as const }
  }))

export type PublicEnv = z.output<typeof publicEnvSchema>
export type ServerEnv = z.output<typeof serverEnvSchema>

export function parsePublicEnv(env: EnvSource): PublicEnv {
  return publicEnvSchema.parse(env)
}

export function parseServerEnv(env: EnvSource): ServerEnv {
  return serverEnvSchema.parse(env)
}

export function redactEnvForLogs(env: ServerEnv) {
  return {
    runtime: {
      appEnv: env.runtime.appEnv,
      acceptNewRequests: env.runtime.acceptNewRequests,
      allowNewCheckouts: env.runtime.allowNewCheckouts,
      rateLimitHashKey: REDACTED
    },
    public: {
      appUrl: env.public.appUrl,
      supabaseUrl: env.public.supabaseUrl,
      supabasePublishableKey: REDACTED
    },
    supabase: {
      serviceRoleKey: REDACTED
    },
    payments:
      env.payments.provider === 'mercadopago'
        ? {
            provider: env.payments.provider,
            publicKey: REDACTED,
            accessToken: REDACTED,
            webhookSecret: REDACTED,
            marketplaceClientId: REDACTED,
            marketplaceClientSecret: REDACTED
          }
        : { provider: env.payments.provider },
    email: env.email.enabled
      ? { enabled: true, resendApiKey: REDACTED, from: env.email.from }
      : { enabled: false },
    outboxWorker: env.outboxWorker.enabled
      ? { enabled: true, secret: REDACTED }
      : { enabled: false },
    refundWorker: env.refundWorker.enabled
      ? { enabled: true, secret: REDACTED }
      : { enabled: false },
    whatsapp: env.whatsapp.enabled
      ? { enabled: true, apiToken: REDACTED, phoneNumberId: REDACTED }
      : { enabled: false },
    ai: env.ai.enabled
      ? { enabled: true, provider: env.ai.provider, apiKey: REDACTED }
      : { enabled: false }
  }
}
