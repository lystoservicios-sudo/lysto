'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createContext, useContext, useEffect, useId, useState, type ReactNode, type ButtonHTMLAttributes } from 'react'
import { ArrowLeft, ArrowRight, Check, ChevronDown, CircleHelp, LayoutGrid, Search, SlidersHorizontal, X } from 'lucide-react'
import { adminLabel, adminModules, matchesSearch } from './admin-model'

type Drafts = Record<string, Record<string, string>>
const DraftContext = createContext<{ drafts: Drafts; save: (key: string, values: Record<string, string>) => void }>({ drafts: {}, save: () => {} })
export function useAdminDraft(key: string) {
  const { drafts, save } = useContext(DraftContext)
  return { draft: drafts[key], save: (values: Record<string, string>) => save(key, values) }
}
export function AdminWorkspace({ children }: { children: ReactNode }) {
  const [drafts, setDrafts] = useState<Drafts>({})
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const pathname = usePathname()
  const connected = pathname === '/admin/configuracion' || pathname === '/admin/auditoria'
  useEffect(() => { setOpen(false); setQuery('') }, [pathname])
  return <DraftContext.Provider value={{ drafts, save: (key, values) => setDrafts(previous => ({ ...previous, [key]: values })) }}>
    <div className="admin-workspace">
      <div className="adm-workspace-bar"><span><span className="adm-live-dot" /> {connected ? 'Administración de la cuenta' : 'Entorno de demostración'}</span><button className="adm-button adm-button-quiet" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="admin-tools"><LayoutGrid size={16} /> Todas las herramientas <ChevronDown size={15} /></button></div>
      {open && <nav id="admin-tools" aria-label="Todas las herramientas de administración" className="adm-panel adm-modules" onKeyDown={event => { if (event.key === 'Escape') { setOpen(false); document.querySelector<HTMLButtonElement>('[aria-controls="admin-tools"]')?.focus() } }}>
        <div className="adm-panel-heading"><h2>¿Qué necesitás gestionar?</h2><button className="adm-icon-button" aria-label="Cerrar herramientas" onClick={() => setOpen(false)}><X size={20} /></button></div>
        <label className="adm-search"><Search size={18} /><input aria-label="Buscar herramienta" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar una herramienta…" /></label>
        <div className="adm-module-grid">{adminModules.map(group => <section key={group.group}><h3>{group.group}</h3>{group.items.filter(([label]) => matchesSearch(query, [label])).map(([label, route]) => <Link aria-current={pathname === `/admin/${route}` ? 'page' : undefined} href={`/admin/${route}`} key={route}>{label}<ArrowRight size={14} /></Link>)}</section>)}</div>
        {adminModules.every(group => group.items.every(([label]) => !matchesSearch(query, [label]))) && <p>No encontramos herramientas con ese nombre.</p>}
      </nav>}
      {children}
      {!connected && <p className="adm-demo-footnote"><CircleHelp size={15} /> Datos demostrativos. Los borradores duran esta sesión; no se envían mensajes ni se realizan cobros.</p>}
    </div>
  </DraftContext.Provider>
}
export function Header({ title, description, section = 'Operaciones', action, back }: { title: string; description: string; section?: string; action?: ReactNode; back?: { href: string; label: string } }) {
  return <header className="adm-page-header"><div>{back ? <Link className="adm-back" href={back.href}><ArrowLeft size={15} />{back.label}</Link> : <span className="adm-eyebrow">{section}</span>}<h1>{title}</h1><p>{description}</p></div>{action && <div className="adm-header-action">{action}</div>}</header>
}
export function Button({ children, variant = 'secondary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'quiet' }) {
  return <button type="button" className={`adm-button adm-button-${variant} ${className}`} {...props}>{children}</button>
}
export function ActionLink({ href, children, primary = false }: { href: string; children: ReactNode; primary?: boolean }) {
  return <Link className={`adm-button adm-button-${primary ? 'primary' : 'secondary'}`} href={href}>{children}</Link>
}
export function Panel({ title, description, action, children, className = '' }: { title: string; description?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`adm-panel ${className}`}><div className="adm-panel-heading"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{action}</div><div className="adm-panel-body">{children}</div></section>
}
export function Metrics({ items }: { items: { label: string; value: ReactNode; detail: string; icon?: ReactNode; tone?: string }[] }) {
  return <div className="adm-metrics">{items.map(item => <div className="adm-metric" key={item.label}>{item.icon && <span className={`adm-metric-icon ${item.tone ?? ''}`}>{item.icon}</span>}<div><p>{item.label}</p><strong>{item.value}</strong><small>{item.detail}</small></div></div>)}</div>
}
export function Badge({ value }: { value: string }) {
  const tone = /cancel|suspend|critical|attention|Rechazada/i.test(value) ? 'red' : /pending|review|priority|warning|revisión|Abierta|Pendiente/i.test(value) ? 'amber' : /approved|captured|completed$|connected$|Activa|Aprobada|Resuelta/i.test(value) && value !== 'not_connected' ? 'green' : 'blue'
  return <span className={`adm-badge ${tone}`}>{adminLabel(value)}</span>
}
export function Person({ name, detail }: { name: string; detail?: string }) { return <div className="adm-person"><span className="adm-avatar" aria-hidden="true">{name.split(' ').map(word => word[0]).slice(0, 2).join('')}</span><div><strong>{name}</strong>{detail && <small>{detail}</small>}</div></div> }
export function Facts({ items }: { items: [string, ReactNode][] }) { return <dl className="adm-facts">{items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl> }
export function Notice({ children, success = false }: { children: ReactNode; success?: boolean }) { return <div className={`adm-notice ${success ? 'success' : ''}`} role={success ? 'status' : undefined}>{success ? <Check size={18} /> : <CircleHelp size={18} />}<div>{children}</div></div> }
export function Tabs({ options, value, onChange, label = 'Filtrar por estado' }: { options: string[]; value: string; onChange: (value: string) => void; label?: string }) { return <div className="adm-tabs" role="group" aria-label={label}>{options.map(option => <button key={option} aria-pressed={value === option} onClick={() => onChange(option)}>{option}</button>)}</div> }
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) { return <label className="adm-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label> }
export function Checklist({ items }: { items: string[] }) { return <div className="adm-checklist">{items.map(item => <label key={item}><input type="checkbox" /><span>{item}</span></label>)}</div> }
export function Bars({ items }: { items: { label: string; value: number; detail?: string }[] }) {
  const max = Math.max(1, ...items.map(item => item.value))
  return <div className="adm-bars">{items.map(item => <div key={item.label}><div><span>{item.label}</span><strong>{item.detail ?? item.value}</strong></div><meter aria-label={item.label} min={0} max={max} value={item.value}>{item.value}</meter></div>)}</div>
}
export type TableColumn<T> = { key: string; label: string; render: (row: T) => ReactNode }
export function DataTable<T extends { id: string }>({ rows, columns, search, filters = [], title, action }: { rows: T[]; columns: TableColumn<T>[]; search: (row: T) => string[]; filters?: { label: string; value: (row: T) => string }[]; title: string; action?: ReactNode }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Record<string, string>>({})
  const id = useId()
  const filtered = rows.filter(row => matchesSearch(query, search(row)) && filters.every(filter => !selected[filter.label] || filter.value(row) === selected[filter.label]))
  return <section className="adm-panel adm-table-panel" aria-label={title}>
    <div className="adm-table-toolbar"><label className="adm-search"><Search size={18} aria-hidden="true" /><input aria-label={`Buscar en ${title.toLowerCase()}`} placeholder="Buscar por nombre o identificador…" value={query} onChange={event => setQuery(event.target.value)} /></label><div className="adm-filters"><SlidersHorizontal size={17} aria-hidden="true" />{filters.map(filter => <select aria-label={filter.label} key={filter.label} value={selected[filter.label] ?? ''} onChange={event => setSelected({ ...selected, [filter.label]: event.target.value })}><option value="">{filter.label}: todos</option>{[...new Set(rows.map(filter.value))].map(value => <option key={value} value={value}>{adminLabel(value)}</option>)}</select>)}{action}</div></div>
    <div aria-live="polite" className="adm-result-count" id={id}>{filtered.length} {filtered.length === 1 ? 'registro' : 'registros'}</div>
    <table className="adm-table" aria-describedby={id}><caption className="sr-only">{title}</caption><thead><tr>{columns.map(column => <th scope="col" key={column.key}>{column.label}</th>)}</tr></thead><tbody>{filtered.map(row => <tr key={row.id}>{columns.map(column => <td key={column.key} data-label={column.label}>{column.render(row)}</td>)}</tr>)}</tbody></table>
    {filtered.length === 0 && <div className="adm-empty"><Search size={28} /><h3>No encontramos resultados</h3><p>Probá otro nombre o quitá los filtros.</p><Button onClick={() => { setQuery(''); setSelected({}) }}>Limpiar filtros</Button></div>}
    <div className="adm-table-footer">Mostrando {filtered.length} de {rows.length} registros <span>Datos de demostración</span></div>
  </section>
}
