'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Menu, X } from 'lucide-react'
import { Brand } from '@/components/marketing/brand'
import '@/components/marketing/marketing.css'

const links = [['Inicio', '/'], ['Solución', '/solucion'], ['Nosotros', '/nosotros'], ['Contacto', '/contacto']] as const

export function MarketingHeader() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const header = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() } }
    const onOutside = (event: PointerEvent) => { if (event.target instanceof Node && !header.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onOutside)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onOutside) }
  }, [open])
  const navigation = () => links.map(([label, href]) => <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined} onClick={() => setOpen(false)}>{label}</Link>)
  return <header className="m-header" ref={header}>
    <div className="m-container m-header-inner">
      <Link className="m-logo-link" href="/" aria-label="Lysto, inicio" onClick={() => setOpen(false)}><Brand /></Link>
      <nav className="m-desktop-nav" aria-label="Navegación principal">{navigation()}</nav>
      <div className="m-header-actions"><Link href="/login" className="m-login-link" onClick={() => setOpen(false)}>Iniciar sesión <ArrowUpRight size={16} aria-hidden="true" /></Link><button ref={trigger} type="button" className="m-menu-toggle" aria-label={open ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(!open)}>{open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}</button></div>
    </div>
    {open && <nav id="mobile-navigation" className="m-mobile-nav" aria-label="Navegación móvil">{navigation()}<p>Tu hogar, en buenas manos.</p></nav>}
  </header>
}
