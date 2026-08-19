import { z } from 'zod'

export type EnvSource = NodeJS.ProcessEnv | Record<string, string | undefined>

const REDACTED = '[REDACTED]' as const

const requiredValue = (name: string) => z.string().trim().min(1, `${name} is required`)
const optionalValue = z.string().trim().optional()
const explicitBoolean = (name: string) => z
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
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
  }))

const serverEnvShape = {
  ...publicEnvShape,
  SUPABASE_SERVICE_ROLE_KEY: requiredValue('SUPABASE_SERVICE_ROLE_KEY'),
  PAYMENTS_PROVIDER: z.enum(['mock', 'mercadopago']).default('mock'),
  MERCADOPAGO_PUBLIC_KEY: optionalValue,
  MERCADOPAGO_ACCESS_TOKEN: optionalValue,
  MERCADOPAGO_WEBHOOK_SECRET: optionalValue,
  MERCADOPAGO_MARKETPLACE_CLIENT_ID: optionalValue,
  MERCADOPAGO_MARKETPLACE_CLIENT_SECRET: optionalValue,
  NOTIFICATIONS_EMAIL_ENABLED: explicitBoolean('NOTIFICATIONS_EMAIL_ENABLED'),
  RESEND_API_KEY: optionalValue,
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
    requireWhenEnabled(env, context, env.PAYMENTS_PROVIDER === 'mercadopago', [
      'MERCADOPAGO_PUBLIC_KEY',
      'MERCADOPAGO_ACCESS_TOKEN',
      'MERCADOPAGO_WEBHOOK_SECRET',
      'MERCADOPAGO_MARKETPLACE_CLIENT_ID',
      'MERCADOPAGO_MARKETPLACE_CLIENT_SECRET'
    ])
    requireWhenEnabled(env, context, env.NOTIFICATIONS_EMAIL_ENABLED, ['RESEND_API_KEY'])
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
    public: {
      appUrl: env.NEXT_PUBLIC_APP_URL,
      supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
      supabasePublishableKey:
        env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
    },
    supabase: {
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY
    },
    payments: env.PAYMENTS_PROVIDER === 'mercadopago'
      ? {
          provider: 'mercadopago' as const,
          publicKey: env.MERCADOPAGO_PUBLIC_KEY as string,
          accessToken: env.MERCADOPAGO_ACCESS_TOKEN as string,
          webhookSecret: env.MERCADOPAGO_WEBHOOK_SECRET as string,
          marketplaceClientId: env.MERCADOPAGO_MARKETPLACE_CLIENT_ID as string,
          marketplaceClientSecret: env.MERCADOPAGO_MARKETPLACE_CLIENT_SECRET as string
        }
      : { provider: 'mock' as const },
    email: env.NOTIFICATIONS_EMAIL_ENABLED
      ? { enabled: true as const, resendApiKey: env.RESEND_API_KEY as string }
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
    public: {
      appUrl: env.public.appUrl,
      supabaseUrl: env.public.supabaseUrl,
      supabasePublishableKey: REDACTED
    },
    supabase: {
      serviceRoleKey: REDACTED
    },
    payments: env.payments.provider === 'mercadopago'
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
      ? { enabled: true, resendApiKey: REDACTED }
      : { enabled: false },
    whatsapp: env.whatsapp.enabled
      ? { enabled: true, apiToken: REDACTED, phoneNumberId: REDACTED }
      : { enabled: false },
    ai: env.ai.enabled
      ? { enabled: true, provider: env.ai.provider, apiKey: REDACTED }
      : { enabled: false }
  }
}
