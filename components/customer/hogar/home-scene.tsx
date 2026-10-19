'use client'

import { useEffect, useRef, useState } from 'react'
import { Minus, Plus, RotateCcw, RotateCw } from 'lucide-react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { CustomerHome, EquipmentPlacement } from '@/lib/customer-homes/contracts'
import type { CustomerAssetEquipment } from '@/lib/customer-assets/contracts'
import { equipmentScreenAnchor, type EquipmentScreenAnchor } from './equipment-anchor'
import { isCustomerMotionReduced, subscribeCustomerMotionPreference } from '@/lib/customer/motion-preference'
import type { RoomAdditionSlot } from '@/lib/customer-homes/room-additions'
import styles from './customer-hogar.module.css'
import { buildHomeFloor, disposeGroup, fitHomeView, getPlacementFromWall, getRoomCenter, pickSelectionFromObject, pickWallSurface, setHomeSelection, updateCutawayWalls } from './scene-builders'

export type HomeSceneProps = {
  home: CustomerHome
  floorId: string
  roomId: string | null
  focused: boolean
  equipment: CustomerAssetEquipment[]
  selectedEquipmentId?: string | null
  placementDraft?: EquipmentPlacement | null
  onSelectRoom: (id: string) => void
  onSelectEquipment: (id: string) => void
  onPlace?: (patch: Pick<EquipmentPlacement, 'wall' | 'offset' | 'height'>) => void
  onUnavailable?: () => void
  onEquipmentAnchor?: (anchor: EquipmentScreenAnchor | null) => void
  roomAdditions?: RoomAdditionSlot[]
  onAddRoom?: (slot: RoomAdditionSlot) => void
  previewOnly?: boolean
}
type Command = 'reset' | 'rotate' | 'zoomIn' | 'zoomOut'
type Runtime = { update: (props: HomeSceneProps) => void; command: (type: Command) => void }
type SavedView = { position: THREE.Vector3; target: THREE.Vector3; zoom: number }

export default function HomeScene(props: HomeSceneProps) {
  const container = useRef<HTMLDivElement>(null)
  const labels = useRef(new Map<string, HTMLButtonElement>())
  const latest = useRef(props)
  latest.current = props
  const runtime = useRef<Runtime | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const floor = props.home.floors.find(value => value.id === props.floorId)
  const rooms = props.focused ? floor?.rooms.filter(value => value.id === props.roomId) ?? [] : floor?.rooms ?? []

  useEffect(() => {
    const host = container.current
    if (!host) return
    const reportUnavailable = () => { setUnavailable(true); latest.current.onUnavailable?.() }
    // Three requires WebGL2. Do not probe canvas in unsupported environments:
    // the rest of Hogar remains usable through its list and regular forms.
    if (typeof window.WebGL2RenderingContext === 'undefined') { reportUnavailable(); return }
    let renderer: THREE.WebGLRenderer
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' }) }
    catch { reportUnavailable(); return }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
    renderer.setClearColor('#ffffff', 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.18
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    const canvas = renderer.domElement
    canvas.style.cssText = 'width:100%;height:100%;display:block;touch-action:none;outline:none'
    canvas.setAttribute('role', 'img')
    canvas.setAttribute('aria-label', latest.current.previewOnly
      ? 'Vista previa 3D del ambiente. Deslizá a izquierda o derecha para cambiar de variante.'
      : 'Maqueta 3D orientativa del hogar. Arrastrá para girar; usá dos dedos para acercar y mover. La lista de ambientes y los controles también permiten manejar la vista.')
    canvas.setAttribute('data-testid', 'hogar-3d-canvas')
    host.prepend(canvas)

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-6, 6, 6, -6, .1, 180)
    camera.position.set(10, 14, 17)
    const controls = new OrbitControls(camera, canvas)
    controls.enableDamping = !isCustomerMotionReduced()
    controls.dampingFactor = .16
    controls.enablePan = true
    controls.screenSpacePanning = true
    controls.minPolarAngle = .12
    controls.maxPolarAngle = Math.PI / 2.3
    controls.minZoom = .65
    controls.maxZoom = 3.5
    controls.rotateSpeed = .58
    controls.zoomSpeed = .6
    controls.panSpeed = .55
    controls.enabled = !latest.current.previewOnly
    if (latest.current.previewOnly) canvas.style.touchAction = 'pan-y'
    controls.touches.ONE = THREE.TOUCH.ROTATE
    controls.touches.TWO = THREE.TOUCH.DOLLY_PAN
    scene.add(new THREE.HemisphereLight('#ffffff', '#cbc5b9', 2.15))
    const sun = new THREE.DirectionalLight('#fff9ed', 3.25)
    sun.position.set(-5, 14, 9)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    sun.shadow.camera.near = .5; sun.shadow.camera.far = 90
    sun.shadow.bias = -.0007; sun.shadow.normalBias = .035; sun.shadow.radius = 3
    scene.add(sun)
    const fill = new THREE.DirectionalLight('#e9f3ff', .65); fill.position.set(8, 8, -10); scene.add(fill)
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.ShadowMaterial({ color: '#47556b', opacity: .12 }))
    ground.rotation.x = -Math.PI / 2; ground.position.y = -.13; ground.receiveShadow = true; scene.add(ground)
    let model: THREE.Group | null = null, current: HomeSceneProps | null = null
    let frame = 0, disposed = false, lost = false, inView = true, width = 1, height = 1
    const center = new THREE.Vector3(), projected = new THREE.Vector3()
    const labelPositions = new Map<string, THREE.Vector3>()
    const savedFloorViews = new Map<string, SavedView>()

    const positionLabels = () => {
      if (latest.current.onEquipmentAnchor) latest.current.onEquipmentAnchor(model && latest.current.selectedEquipmentId ? equipmentScreenAnchor(model, camera, latest.current.selectedEquipmentId, width, height) : null)
      for (const [id, element] of labels.current) {
        const slot = latest.current.roomAdditions?.find(value => value.id === id)
        // Lift markers behind standing walls so they stay outside the room's silhouette.
        const behindWall = slot && (
          (slot.side === 'north' && camera.position.z > controls.target.z) ||
          (slot.side === 'south' && camera.position.z < controls.target.z) ||
          (slot.side === 'west' && camera.position.x > controls.target.x) ||
          (slot.side === 'east' && camera.position.x < controls.target.x)
        )
        const position = slot ? new THREE.Vector3(slot.markerX, behindWall ? 2.9 : .2, slot.markerZ) : labelPositions.get(id)
        if (!position) { element.style.visibility = 'hidden'; continue }
        projected.copy(position).project(camera)
        const x = (projected.x * .5 + .5) * width, y = (-projected.y * .5 + .5) * height
        element.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)`
        element.style.visibility = projected.z > -1 && projected.z < 1 && x > 16 && x < width - 16 && y > 16 && y < height - 16 ? 'visible' : 'hidden'
      }
    }
    const requestRender = () => {
      if (!frame && !disposed && !lost && inView && document.visibilityState !== 'hidden') frame = requestAnimationFrame(draw)
    }
    const draw = () => {
      frame = 0
      if (disposed || lost || !inView || document.visibilityState === 'hidden') return
      const changed = controls.update()
      if (model) updateCutawayWalls(model, camera)
      renderer.render(scene, camera); positionLabels()
      if (changed) requestRender()
    }
    const resize = () => {
      width = Math.max(1, host.clientWidth); height = Math.max(1, host.clientHeight)
      if (model) { camera.lookAt(controls.target); fitHomeView(model, camera, width, height) }
      renderer.setSize(width, height, false); requestRender()
    }
    const resetView = () => {
      controls.target.copy(center); camera.position.copy(center).add(new THREE.Vector3(10, 14, 17))
      camera.zoom = 1; controls.update(); resize()
    }
    const saveFloorView = (value: HomeSceneProps) => {
      savedFloorViews.set(`${value.home.id}:${value.floorId}`, { position: camera.position.clone(), target: controls.target.clone(), zoom: camera.zoom })
    }
    const update = (next: HomeSceneProps) => {
      if (model && current && current.home === next.home && current.floorId === next.floorId && current.focused === next.focused && (!next.focused || current.roomId === next.roomId) && current.equipment === next.equipment && current.placementDraft === next.placementDraft && current.roomAdditions === next.roomAdditions) {
        current = next; setHomeSelection(model, next.roomId, next.selectedEquipmentId); requestRender(); return
      }
      const previous = current
      if (previous && !previous.focused && next.focused && previous.home.id === next.home.id && previous.floorId === next.floorId) saveFloorView(previous)
      const restoring = previous?.focused && !next.focused && previous.home.id === next.home.id && previous.floorId === next.floorId
      current = next
      if (next.roomAdditions && !previous?.roomAdditions) camera.zoom = 1
      if (model) { scene.remove(model); disposeGroup(model) }
      model = buildHomeFloor(next); scene.add(model)
      // Invisible geometry extends the camera fit around the actionable edges.
      if (next.roomAdditions?.length) {
        const points = next.roomAdditions.flatMap(slot => [new THREE.Vector3(slot.markerX - .7, 0, slot.markerZ - .7), new THREE.Vector3(slot.markerX + .7, 3.6, slot.markerZ + .7)])
        const extent = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints(points), new THREE.MeshBasicMaterial({ visible: false }))
        model.add(extent)
      }
      const bounds = new THREE.Box3().setFromObject(model)
      center.copy(bounds.isEmpty() ? new THREE.Vector3() : bounds.getCenter(new THREE.Vector3()))
      const shadowRadius = Math.max(10, bounds.isEmpty() ? 10 : bounds.getSize(new THREE.Vector3()).length() / 2 + 3)
      sun.position.copy(center).add(new THREE.Vector3(-5, 14, 9).normalize().multiplyScalar(Math.max(17, shadowRadius * 2.5))); sun.target.position.copy(center); scene.add(sun.target)
      sun.shadow.camera.far = shadowRadius * 4 + 40
      sun.shadow.camera.left = -shadowRadius; sun.shadow.camera.right = shadowRadius; sun.shadow.camera.top = shadowRadius; sun.shadow.camera.bottom = -shadowRadius; sun.shadow.camera.updateProjectionMatrix()
      labelPositions.clear()
      const active = next.home.floors.find(value => value.id === next.floorId)
      for (const room of active?.rooms ?? []) if (!next.focused || room.id === next.roomId) labelPositions.set(room.id, getRoomCenter(room).add(new THREE.Vector3(0, .93, room.depth * .07)))
      const saved = restoring ? savedFloorViews.get(`${next.home.id}:${next.floorId}`) : null
      if (saved) { controls.target.copy(saved.target); camera.position.copy(saved.position); camera.zoom = saved.zoom; controls.update(); resize() }
      else if (previous && previous.home.id === next.home.id && previous.floorId === next.floorId && previous.focused === next.focused && (!next.focused || previous.roomId === next.roomId)) resize()
      else resetView()
      requestRender()
    }
    const pointers = new Map<number, { x: number; y: number }>()
    let dragged = false, multiple = false
    const pointerDown = (event: PointerEvent) => {
      if (!pointers.size) { dragged = false; multiple = false }
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY }); if (pointers.size > 1) multiple = true
    }
    const pointerMove = (event: PointerEvent) => {
      const start = pointers.get(event.pointerId)
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 7) dragged = true
    }
    const raycaster = new THREE.Raycaster()
    const pointerUp = (event: PointerEvent) => {
      const start = pointers.get(event.pointerId); pointers.delete(event.pointerId)
      if (!start || dragged || multiple || !model || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 7) return
      const rect = canvas.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera)
      const value = latest.current
      if (value.previewOnly || value.roomAdditions) return
      if (value.placementDraft && value.onPlace) {
        const surfaces: THREE.Object3D[] = []; model.traverse(object => { if (pickWallSurface(object)) surfaces.push(object) })
        const intersection = raycaster.intersectObjects(surfaces, false)[0]
        const target = intersection ? pickWallSurface(intersection.object) : null
        const room = target && value.home.floors.find(f => f.id === value.floorId)?.rooms.find(r => r.id === target.roomId)
        if (intersection && target && room && room.id === value.placementDraft.roomId) value.onPlace(getPlacementFromWall(room, target.wall, intersection.point, value.equipment.find(e => e.id === value.placementDraft?.equipmentId)?.equipmentType ?? 'split'))
        return
      }
      for (const intersection of raycaster.intersectObject(model, true)) {
        if (pickWallSurface(intersection.object)) continue
        const selected = pickSelectionFromObject(intersection.object)
        if (!selected.roomId) continue
        value.onSelectRoom(selected.roomId)
        if (selected.equipmentId) value.onSelectEquipment(selected.equipmentId)
        break
      }
    }
    const pointerCancel = (event: PointerEvent) => { pointers.delete(event.pointerId); dragged = true }
    const contextLost = (event: Event) => {
      event.preventDefault(); lost = true; if (frame) cancelAnimationFrame(frame); frame = 0; reportUnavailable()
    }
    const contextRestored = () => { lost = false; setUnavailable(false); resize() }
    const visibilityChanged = () => {
      if (document.visibilityState === 'hidden') { if (frame) cancelAnimationFrame(frame); frame = 0 }
      else requestRender()
    }
    const motionChanged = () => { controls.enableDamping = !isCustomerMotionReduced(); requestRender() }
    const releaseMotion = subscribeCustomerMotionPreference(motionChanged)
    controls.addEventListener('change', requestRender)
    canvas.addEventListener('pointerdown', pointerDown); canvas.addEventListener('pointermove', pointerMove); canvas.addEventListener('pointerup', pointerUp); canvas.addEventListener('pointercancel', pointerCancel)
    canvas.addEventListener('webglcontextlost', contextLost); canvas.addEventListener('webglcontextrestored', contextRestored)
    document.addEventListener('visibilitychange', visibilityChanged)
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize)
    resizeObserver?.observe(host)
    if (!resizeObserver) window.addEventListener('resize', resize)
    const visibilityObserver = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
      inView = entries.some(entry => entry.isIntersecting)
      if (!inView) { if (frame) cancelAnimationFrame(frame); frame = 0 } else requestRender()
    }, { rootMargin: '80px' })
    visibilityObserver?.observe(host)
    runtime.current = {
      update,
      command(type) {
        if (type === 'reset') { resetView(); return }
        if (type === 'zoomIn' || type === 'zoomOut') { camera.zoom = THREE.MathUtils.clamp(camera.zoom * (type === 'zoomIn' ? 1.18 : 1 / 1.18), controls.minZoom, controls.maxZoom); camera.updateProjectionMatrix() }
        if (type === 'rotate') { const offset = camera.position.clone().sub(controls.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 5); camera.position.copy(controls.target).add(offset); camera.lookAt(controls.target); if (model) fitHomeView(model, camera, width, height) }
        controls.update(); requestRender()
      },
    }
    update(latest.current)
    return () => {
      disposed = true; runtime.current = null; if (frame) cancelAnimationFrame(frame)
      resizeObserver?.disconnect(); visibilityObserver?.disconnect(); if (!resizeObserver) window.removeEventListener('resize', resize)
      controls.removeEventListener('change', requestRender); controls.dispose()
      canvas.removeEventListener('pointerdown', pointerDown); canvas.removeEventListener('pointermove', pointerMove); canvas.removeEventListener('pointerup', pointerUp); canvas.removeEventListener('pointercancel', pointerCancel)
      canvas.removeEventListener('webglcontextlost', contextLost); canvas.removeEventListener('webglcontextrestored', contextRestored)
      document.removeEventListener('visibilitychange', visibilityChanged); releaseMotion()
      disposeGroup(scene); sun.shadow.map?.dispose(); renderer.dispose(); renderer.forceContextLoss(); canvas.remove()
      savedFloorViews.clear(); labelPositions.clear(); pointers.clear()
    }
  }, [])

  useEffect(() => { runtime.current?.update(props) }, [props])

  return <div className={`hogar-scene${props.focused ? ' is-focused' : ''}${props.placementDraft ? ' is-placing' : ''}`} style={{ position: 'relative', width: '100%', minHeight: 360 }}>
    <div ref={container} className="hogar-scene-viewport" style={{ position: 'absolute', inset: 0, visibility: unavailable ? 'hidden' : 'visible' }}>
      {!props.previewOnly && !props.placementDraft && !props.roomAdditions && rooms.map(room => <button key={room.id} ref={element => { if (element) labels.current.set(room.id, element); else labels.current.delete(room.id) }} className={`hogar-scene-label${room.id === props.roomId ? ' is-selected' : ''}`} style={{ position: 'absolute', top: 0, left: 0, zIndex: 1, visibility: 'hidden' }} type="button" aria-label={`Seleccionar ${room.name} en la maqueta`} aria-pressed={room.id === props.roomId} onClick={() => props.onSelectRoom(room.id)}>{room.name}</button>)}
      {props.roomAdditions?.map(slot => <button key={slot.id} ref={element => { if (element) labels.current.set(slot.id, element); else labels.current.delete(slot.id) }} className={styles.additionMarker} style={{ position: 'absolute', top: 0, left: 0, zIndex: 2, visibility: 'hidden' }} type="button" aria-label={slot.label} title={slot.label} onClick={() => props.onAddRoom?.(slot)}><Plus size={24} aria-hidden /></button>)}
    </div>
    {unavailable && <div className="hogar-scene-fallback" role="status" style={{ padding: '80px 24px', textAlign: 'center', color: '#5d6c84' }}><strong style={{ display: 'block', color: '#0d1830', marginBottom: 10 }}>El 3D no está disponible en este dispositivo</strong>{props.previewOnly ? 'Podés elegir el tipo y recorrer las variantes con las flechas.' : 'Podés organizar tus ambientes y equipos desde la vista de lista.'}</div>}
    {!props.previewOnly && <div className="hogar-scene-controls" role="group" aria-label="Controles de la maqueta" style={{ position: 'absolute', right: 12, bottom: 12, display: 'flex', gap: 6 }}>
      <button type="button" disabled={unavailable} aria-label="Girar maqueta" title="Girar" onClick={() => runtime.current?.command('rotate')}><RotateCw size={18} aria-hidden="true" /></button>
      <button type="button" disabled={unavailable} aria-label="Acercar maqueta" title="Acercar" onClick={() => runtime.current?.command('zoomIn')}><Plus size={18} aria-hidden="true" /></button>
      <button type="button" disabled={unavailable} aria-label="Alejar maqueta" title="Alejar" onClick={() => runtime.current?.command('zoomOut')}><Minus size={18} aria-hidden="true" /></button>
      <button type="button" disabled={unavailable} aria-label="Restablecer vista" title="Restablecer" onClick={() => runtime.current?.command('reset')}><RotateCcw size={18} aria-hidden="true" /></button>
    </div>}
  </div>
}
