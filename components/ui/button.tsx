import Link from 'next/link'
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary: 'bg-lysto-blue text-white shadow-soft hover:bg-lysto-blueDark',
  secondary: 'border border-slate-200 bg-white text-slate-950 hover:bg-slate-50',
  ghost: 'bg-transparent text-slate-700 hover:bg-slate-100',
  danger: 'bg-red-600 text-white hover:bg-red-700'
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-5 text-sm',
  lg: 'h-12 px-6 text-base'
}

export function Button({ className, variant = 'primary', size = 'md', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button className={cn('inline-flex items-center justify-center rounded-2xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-50', variants[variant], sizes[size], className)} {...props} />
}

export function ButtonLink({ className, variant = 'primary', size = 'md', href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; variant?: Variant; size?: Size; children: ReactNode }) {
  return <Link href={href} className={cn('inline-flex items-center justify-center rounded-2xl font-semibold transition', variants[variant], sizes[size], className)} {...props}>{children}</Link>
}
