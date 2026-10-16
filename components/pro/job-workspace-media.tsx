'use client'

import dynamic from 'next/dynamic'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { Camera, RotateCcw } from 'lucide-react'
import type { ProfessionalJobContext } from '@/lib/professional/job-context-contract'
import styles from './job-workspace.module.css'

const HomeScene = dynamic(() => import('@/components/customer/hogar/home-scene'), { ssr: false, loading: () => <p className={styles.quiet}>Preparando el ambiente 3D…</p> })

export function ProfessionalJobPhotos({ ids, label }: { ids: readonly string[]; label: string }) {
  return <JobPhotos key={ids.join('|')} ids={ids} label={label} />
}

function JobPhotos({ ids, label }: { ids: readonly string[]; label: string }) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [failedIds, setFailedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const urlsRef = useRef<Record<string, string>>({})
  const loadingRef = useRef(true)
  const identity = ids.join('|')
  useEffect(() => {
    const controller = new AbortController()
    let disposed = false
    const current = identity ? [...new Set(identity.split('|'))].filter(id => !urlsRef.current[id]) : []
    const timeout = window.setTimeout(() => controller.abort(), 20_000)
    loadingRef.current = true; setLoading(true)
    void Promise.allSettled(current.map(async id => {
      const response = await fetch('/api/uploads/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ intentId: id }), signal: controller.signal })
      const body = await response.json()
      if (!response.ok || typeof body.url !== 'string') throw new Error('Foto no disponible')
      const url = new URL(body.url)
      if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Foto no disponible')
      return [id, url.toString()] as const
    })).then(results => {
      if (disposed) return
      const next = { ...urlsRef.current }
      for (const result of results) {
        if (result.status === 'fulfilled') next[result.value[0]] = result.value[1]
      }
      urlsRef.current = next; setUrls(next)
      setFailedIds(identity ? [...new Set(identity.split('|'))].filter(id => !next[id]) : [])
    }).finally(() => {
      window.clearTimeout(timeout)
      if (!disposed) { loadingRef.current = false; setLoading(false) }
    })
    return () => { disposed = true; window.clearTimeout(timeout); controller.abort() }
  }, [identity, revision])
  function unavailable(id: string) {
    const next = { ...urlsRef.current }
    delete next[id]
    urlsRef.current = next; setUrls(next)
    setFailedIds(current => [...new Set([...current, id])])
    setSelected(current => current === id ? null : current)
  }
  useEffect(() => {
    if (!selected) return
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelected(null) }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [selected])
  if (!ids.length) return <p className={styles.quiet}>No hay fotos registradas en esta etapa.</p>
  return <section aria-label={label} className={styles.section}>
    <h2 className={styles.sectionHeading}>{label}</h2>
    <div className={styles.photoGrid}>{ids.map((id, index) => <button key={id} type="button" className={styles.photoButton} disabled={!urls[id]} aria-label={`Abrir foto ${index + 1} de ${label.toLowerCase()}`} aria-pressed={selected === id} onClick={() => setSelected(selected === id ? null : id)}>
      {urls[id] ? <Image unoptimized src={urls[id]} width={140} height={120} alt={`Foto ${index + 1} de ${label.toLowerCase()}`} onError={() => unavailable(id)} /> : <span className={styles.photoPlaceholder}><Camera size={20} aria-hidden="true" />Foto {index + 1}</span>}
    </button>)}</div>
    {selected && urls[selected] ? <div><Image unoptimized src={urls[selected]} width={800} height={600} alt="Evidencia ampliada del servicio" className={styles.photo} onError={() => unavailable(selected)} /><button type="button" className={styles.secondary} onClick={() => setSelected(null)}>Cerrar foto</button></div> : null}
    {loading ? <p role="status" className={styles.quiet}>Consultando fotos privadas…</p> : null}
    {failedIds.length ? <div role="status" className={styles.notice}>No pudimos abrir alguna foto o venció su enlace privado. <button type="button" className={styles.quiet} disabled={loading} onClick={() => {
      if (loadingRef.current) return
      loadingRef.current = true; setLoading(true); setRevision(value => value + 1)
    }}>Volver a consultar fotos</button></div> : null}
  </section>
}

export function ProfessionalJobEquipment({ context }: { context: ProfessionalJobContext }) {
  const placement = context.home?.placements.find(value => value.equipmentId === context.equipment?.id)
  const floor = context.home?.floors.find(value => value.rooms.some(room => room.id === placement?.roomId))
  // Unrelated payment/context refreshes preserve the explored view; a changed
  // equipment placement starts at its newly confirmed location instead.
  const identity = [context.home?.id, context.equipment?.id, floor?.id, placement?.roomId, placement?.wall, placement?.offset, placement?.height].join(':')
  return <EquipmentView key={identity} context={context} />
}

const equipmentLabels: Record<string, string> = {
  split: 'Split de pared', inverter: 'Inverter', on_off: 'Convencional (on/off)',
  window: 'De ventana', floor_ceiling: 'Piso-techo', central: 'Central'
}

function EquipmentView({ context }: { context: ProfessionalJobContext }) {
  const { home, equipment } = context
  const placement = home?.placements.find(value => value.equipmentId === equipment?.id)
  const assignedFloor = home?.floors.find(floor => floor.rooms.some(room => room.id === placement?.roomId))
  const assignedRoom = assignedFloor?.rooms.find(room => room.id === placement?.roomId)
  const [floorId, setFloorId] = useState(assignedFloor?.id ?? home?.floors[0]?.id ?? '')
  const [roomId, setRoomId] = useState(placement?.roomId ?? null)
  const [focused, setFocused] = useState(Boolean(placement))
  const [unavailable, setUnavailable] = useState(false)
  const [tab, setTab] = useState('ambient')
  const floor = home?.floors.find(value => value.id === floorId) ?? assignedFloor ?? home?.floors[0]
  const room = floor?.rooms.find(value => value.id === roomId) ?? floor?.rooms.find(value => value.id === placement?.roomId) ?? floor?.rooms[0]
  return <>
    <div className={styles.tabs} role="tablist" aria-label="Información del equipo">{[['ambient', 'Ambiente'], ['facts', 'Ficha'], ['history', 'Historial']].map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} aria-controls="equipment-panel" className={styles.tab} onClick={() => setTab(id)}>{label}</button>)}</div>
    <div id="equipment-panel" role="tabpanel" aria-label={tab === 'ambient' ? 'Ambiente' : tab === 'facts' ? 'Ficha' : 'Historial'} className={styles.stack}>
      <h1 className={styles.title}>{equipment?.nickname ?? 'Equipo de este servicio'}</h1>
      {tab === 'ambient' ? <>
        {home && equipment && placement && floor ? <>
          {home.floors.length > 1 ? <div className={styles.floorTabs} role="group" aria-label="Plantas del lugar">{home.floors.map(item => <button key={item.id} type="button" className={styles.secondary} aria-pressed={floor.id === item.id} onClick={() => { setFloorId(item.id); setRoomId(item.rooms.find(r => r.id === placement.roomId)?.id ?? item.rooms[0]?.id ?? null); setFocused(item.id === assignedFloor?.id) }}>{item.name}</button>)}</div> : null}
          <div className={styles.scene}>{unavailable ? <p className={styles.sceneFallback}>El 3D no está disponible en este dispositivo. Podés consultar la ubicación y la ficha del equipo.</p> : <HomeScene home={home} floorId={floor.id} roomId={room?.id ?? null} focused={focused} equipment={[equipment]} selectedEquipmentId={equipment.id} onSelectRoom={id => { setRoomId(id); setFocused(true) }} onSelectEquipment={() => { setFloorId(assignedFloor?.id ?? floor.id); setRoomId(placement.roomId); setFocused(true) }} onUnavailable={() => setUnavailable(true)} />}</div>
          <p className={styles.subtitle}>{floor.name}{room ? ` · ${room.name}` : ''} · Vista orientativa</p>
          <div className={styles.inlineActions}><button type="button" className={styles.secondary} onClick={() => setFocused(false)}>Ver planta</button><button type="button" className={styles.secondary} onClick={() => { setFloorId(assignedFloor?.id ?? floor.id); setRoomId(placement.roomId); setFocused(true) }}><RotateCcw size={16} aria-hidden="true" />Enfocar equipo</button></div>
        </> : <><Image src="/images/service-request/air-neutral.webp" width={360} height={220} alt="Ilustración orientativa de un aire acondicionado" className={styles.thumbnail} /><p className={styles.notice}>El cliente todavía no ubicó este equipo en un ambiente.</p></>}
        <p className={styles.notice}>Información del equipo de este servicio. La distribución del hogar se muestra en modo consulta.</p>
      </> : null}
      {tab !== 'history' ? <dl className={styles.facts}>{[
        ['Tipo de equipo', equipment?.equipmentType ? equipmentLabels[equipment.equipmentType] ?? 'Aire acondicionado' : null], ['Marca', equipment?.brand], ['Modelo', equipment?.model], ['Número de serie', equipment?.serialNumber], ['Capacidad', equipment?.frigorias ? `${equipment.frigorias} frigorías` : null], ...(tab === 'facts' ? [['Ubicación', assignedRoom ? `${assignedFloor?.name} · ${assignedRoom.name}` : null]] : [])
      ].map(([label, value]) => <div key={label} className={styles.fact}><dt>{label}</dt><dd>{value || 'No informado'}</dd></div>)}</dl> : <section className={styles.section}><h2 className={styles.sectionHeading}>Historial técnico</h2>{context.history.length ? context.history.map(record => <article key={record.id} className={styles.activityItem}><div><h3>{new Date(record.createdAt).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}</h3><p>{record.diagnosis ?? 'Sin diagnóstico publicado'}</p><p className={styles.quiet}>{record.work ?? 'Sin trabajo registrado'}</p>{record.nextMaintenanceDate ? <p className={styles.small}>Mantenimiento recomendado: {record.nextMaintenanceDate}</p> : null}</div></article>) : <p className={styles.quiet}>No hay antecedentes técnicos publicados para este equipo.</p>}</section>}
    </div>
  </>
}
