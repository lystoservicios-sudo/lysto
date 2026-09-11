import Link from 'next/link'
import { PublicShell } from '@/components/layout/page-shell'
import { RecoveryForm } from './recovery-form'
export default function RecoverPage() { return <PublicShell><main className="mx-auto max-w-xl px-4 py-12"><h1 className="text-3xl font-black">Recuperá tu acceso</h1><p className="mt-3 text-sm leading-6">Ingresá el correo de tu cuenta para recibir instrucciones.</p><RecoveryForm /><Link href="/login" className="mt-6 inline-block font-bold text-blue-700 underline">Volver al ingreso</Link></main></PublicShell> }
