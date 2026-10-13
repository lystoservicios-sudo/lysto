import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import * as THREE from 'three'
import { ROOM_CATALOG, type CustomerHome, type HomeRoom } from '@/lib/customer-homes/contracts'
import type { CustomerAssetEquipment } from '@/lib/customer-assets/contracts'
import { buildHomeFloor, disposeGroup, fitHomeView, getEquipmentTransform, getPlacementFromWall, pickSelectionFromObject, pickWallSurface, setHomeSelection, updateCutawayWalls } from '@/components/customer/hogar/scene-builders'
import HomeScene from '@/components/customer/hogar/home-scene'

const room = (id: string, kind = 'bedroom', variant = 'principal', patch = {}): HomeRoom => ({
  id, name: id, kind, variant, x: 0, z: 0, width: 3.6, depth: 3.6, rotation: 0, windows: 'small', ...patch,
} as HomeRoom)
const home = (rooms: HomeRoom[], patch = {}): CustomerHome => ({
  id: 'home', name: 'Mi hogar', addressId: 'address', kind: 'apartment', building: 'low',
  features: { balcony: false, terrace: false, windows: 'small' },
  floors: [{ id: 'floor-a', name: 'Planta baja', order: 0, rooms }, { id: 'floor-b', name: 'Primer piso', order: 1, rooms: [room('upstairs')] }],
  placements: [], version: 1, ...patch,
} as CustomerHome)
const equipment = (id: string, equipmentType = 'split'): CustomerAssetEquipment => ({ id, nickname: id, addressId: 'address', equipmentType, brand: null, model: null, serialNumber: null, frigorias: null, version: 1, createdAt: '2026-10-13', archivedAt: null } as unknown as CustomerAssetEquipment)
const objects = (group: THREE.Object3D) => { const result: THREE.Object3D[] = []; group.traverse(value => result.push(value)); return result }
const signature = (group: THREE.Object3D) => objects(group).filter(value => value instanceof THREE.Mesh).map(value => `${value.geometry.type}:${value.position.toArray().join(',')}:${value.scale.toArray().join(',')}`).join('|')

describe('Hogar production 3D geometry', () => {
  it('builds only the active floor and never stacks a second floor', () => {
    const scene = buildHomeFloor({ home: home([room('downstairs')]), floorId: 'floor-a', roomId: null, focused: false, equipment: [] })
    expect(objects(scene).filter(value => value.userData.roomRoot).map(value => value.userData.roomId)).toEqual(['downstairs'])
    disposeGroup(scene)
  })

  it('isolates one focused room including only its existing equipment', () => {
    const model = home([room('first'), room('second', 'kitchen', 'linear', { x: 4 })], { placements: [{ equipmentId: 'ac-first', roomId: 'first', wall: 'north', offset: .5, height: .75 }, { equipmentId: 'ac-second', roomId: 'second', wall: 'north', offset: .5, height: .75 }] })
    const scene = buildHomeFloor({ home: model, floorId: 'floor-a', roomId: 'first', focused: true, equipment: [equipment('ac-first'), equipment('ac-second')] })
    expect(objects(scene).filter(value => value.userData.roomRoot).map(value => value.userData.roomId)).toEqual(['first'])
    expect(objects(scene).filter(value => value.userData.equipmentRoot).map(value => value.userData.equipmentId)).toEqual(['ac-first'])
    disposeGroup(scene)
  })

  it('does not fabricate equipment or a patio based on home type', () => {
    const scene = buildHomeFloor({ home: home([room('room')], { kind: 'house' }), floorId: 'floor-a', roomId: null, focused: false, equipment: [] })
    expect(objects(scene).some(value => value.userData.equipmentRoot || value.userData.kind === 'patio')).toBe(false)
    disposeGroup(scene)
  })

  it('renders meaningful distinct geometry for variants of the same room', () => {
    for (const [kind, first, second] of [['kitchen', 'linear', 'island'], ['bedroom', 'principal', 'double'], ['office', 'individual', 'shared'], ['bathroom', 'shower', 'bathtub'], ['living', 'compact', 'dining']]) {
      const a = buildHomeFloor({ home: home([room('room', kind, first)]), floorId: 'floor-a', roomId: null, focused: false, equipment: [] })
      const b = buildHomeFloor({ home: home([room('room', kind, second)]), floorId: 'floor-a', roomId: null, focused: false, equipment: [] })
      expect(signature(a), kind).not.toEqual(signature(b))
      disposeGroup(a); disposeGroup(b)
    }
  })

  it('renders every approved room kind with furnishings and explicit exterior rooms', () => {
    for (const kind of ['living', 'bedroom', 'kitchen', 'bathroom', 'office', 'dining', 'laundry', 'hall', 'storage', 'garage', 'patio', 'balcony', 'terrace', 'meeting', 'reception', 'commercial']) {
      const scene = buildHomeFloor({ home: home([room('room', kind, 'default')]), floorId: 'floor-a', roomId: null, focused: false, equipment: [] })
      expect(objects(scene).filter(value => value.userData.furnishings).some(value => value.children.length > 0), kind).toBe(true)
      disposeGroup(scene)
    }
  })

  it('builds every catalog variant with genuinely distinct furniture layouts', () => {
    for (const [kind, config] of Object.entries(ROOM_CATALOG)) {
      const layouts = new Set<string>()
      for (const variant of config.variants) {
        const scene = buildHomeFloor({ home: home([room('room', kind, variant.value)]), floorId: 'floor-a', roomId: null, focused: false, equipment: [] })
        const furniture = objects(scene).find(value => value.userData.furnishings)!
        layouts.add(signature(furniture)); disposeGroup(scene)
      }
      expect(layouts.size, kind).toBe(config.variants.length)
    }
  })

  it('makes large windows geometrically larger than small windows', () => {
    const a = buildHomeFloor({ home: home([room('room', 'living', 'compact', { windows: 'small' })]), floorId: 'floor-a', roomId: null, focused: false, equipment: [] })
    const b = buildHomeFloor({ home: home([room('room', 'living', 'compact', { windows: 'large' })]), floorId: 'floor-a', roomId: null, focused: false, equipment: [] })
    const windowBounds = (group: THREE.Group) => new THREE.Box3().setFromObject(objects(group).find(value => value.userData.windowRoot)!).getSize(new THREE.Vector3())
    expect(windowBounds(b).x).toBeGreaterThan(windowBounds(a).x)
    disposeGroup(a); disposeGroup(b)
  })

  it('tags all four actual wall pick surfaces, never furniture or floor', () => {
    const scene = buildHomeFloor({ home: home([room('room')]), floorId: 'floor-a', roomId: 'room', focused: true, equipment: [] })
    const surfaces = objects(scene).filter(value => pickWallSurface(value))
    expect(surfaces.map(value => pickWallSurface(value)?.wall).sort()).toEqual(['east', 'north', 'south', 'west'])
    expect(objects(scene).filter(value => value.userData.furnishings || value.userData.floorRoot).every(value => pickWallSurface(value) === null)).toBe(true)
    disposeGroup(scene)
  })

  it('makes a front-facing tall wall translucent so rotated rooms remain visible', () => {
    const scene = buildHomeFloor({ home: home([room('room', 'bedroom', 'principal', { rotation: 180 })]), floorId: 'floor-a', roomId: 'room', focused: true, equipment: [] })
    const camera = new THREE.OrthographicCamera(); camera.position.set(10, 12, 17)
    updateCutawayWalls(scene, camera)
    const walls = objects(scene).filter(value => value.userData.cutawayWall) as THREE.Mesh[]
    expect(walls.some(value => (value.material as THREE.MeshStandardMaterial).opacity < 1)).toBe(true)
    camera.position.set(-10, 12, -17); updateCutawayWalls(scene, camera)
    expect(walls.every(value => (value.material as THREE.MeshStandardMaterial).opacity === 1)).toBe(true)
    disposeGroup(scene)
  })

  it('uses the entire 0..1 slider range within width-aware safe equipment bounds', () => {
    const compact = room('compact', 'bedroom', 'principal', { x: -1, z: -1, width: 2, depth: 2 })
    const left = getEquipmentTransform(compact, { wall: 'north', offset: 0, height: .75 }, 'split').position
    const next = getEquipmentTransform(compact, { wall: 'north', offset: .05, height: .75 }, 'split').position
    const right = getEquipmentTransform(compact, { wall: 'north', offset: 1, height: .75 }, 'split').position
    expect(left.x).toBeGreaterThanOrEqual(-1 + .59 + .06)
    expect(right.x).toBeLessThanOrEqual(1 - .59 - .06)
    expect(next.x).toBeGreaterThan(left.x)
    expect(right.x).toBeGreaterThan(next.x)
  })

  it('projects a click against its tagged wall rather than the nearest wall', () => {
    const value = room('room')
    const result = getPlacementFromWall(value, 'north', new THREE.Vector3(3.6, 1.2, 3.6), 'split')
    expect(result.wall).toBe('north')
    expect(result.offset).toBe(1)
    expect(result.height).toBeCloseTo(1.2)
  })

  it('transforms placement correctly for rotated rooms', () => {
    const value = room('room', 'bedroom', 'principal', { x: 5, z: 2, rotation: 90 })
    const placement = getEquipmentTransform(value, { wall: 'north', offset: .5, height: .75 }, 'split')
    expect(placement.position.x).toBeCloseTo(5 + .18)
    expect(placement.position.z).toBeCloseTo(2 + 1.8)
    expect(placement.rotation).toBeCloseTo(Math.PI / 2)
  })

  it('differentiates every real air-conditioning type without creating new inventory IDs', () => {
    const signatures = new Set<string>()
    for (const type of ['split', 'inverter', 'on_off', 'window', 'floor_ceiling', 'central']) {
      const scene = buildHomeFloor({ home: home([room('room')], { placements: [{ equipmentId: 'actual-id', roomId: 'room', wall: 'north', offset: .5, height: .75 }] }), floorId: 'floor-a', roomId: null, focused: false, equipment: [equipment('actual-id', type)] })
      const root = objects(scene).find(value => value.userData.equipmentRoot)!
      expect(root.userData.equipmentId).toBe('actual-id')
      signatures.add(signature(root))
      disposeGroup(scene)
    }
    expect(signatures.size).toBe(6)
  })

  it('keeps a wall support behind an AC on a cutaway front wall', () => {
    const scene = buildHomeFloor({ home: home([room('room')], { placements: [{ equipmentId: 'ac', roomId: 'room', wall: 'south', offset: .5, height: 1.65 }] }), floorId: 'floor-a', roomId: null, focused: false, equipment: [equipment('ac')] })
    const unit = objects(scene).find(value => value.userData.equipmentRoot)!
    expect(new THREE.Box3().setFromObject(unit).min.y).toBeLessThanOrEqual(.06)
    disposeGroup(scene)
  })

  it('ignores selection markers when hidden by an ancestor', () => {
    const group = new THREE.Group(); group.userData.roomId = 'room'; group.visible = false
    const child = new THREE.Group(); child.userData.equipmentId = 'ac'; group.add(child)
    expect(pickSelectionFromObject(child)).toEqual({})
  })

  it('does not intercept equipment selection with a translucent cutaway wall', () => {
    const scene = buildHomeFloor({ home: home([room('room', 'bedroom', 'principal', { rotation: 180 })]), floorId: 'floor-a', roomId: null, focused: false, equipment: [] })
    const camera = new THREE.OrthographicCamera(); camera.position.set(10, 12, 17); updateCutawayWalls(scene, camera)
    const wall = objects(scene).find(value => value.userData.cutawayWall)!
    expect(pickSelectionFromObject(wall)).toEqual({})
    disposeGroup(scene)
  })

  it('updates selection without rebuilding room geometry', () => {
    const scene = buildHomeFloor({ home: home([room('first'), room('second', 'kitchen', 'linear', { x: 4 })]), floorId: 'floor-a', roomId: 'first', focused: false, equipment: [] })
    setHomeSelection(scene, 'second')
    expect(objects(scene).filter(value => value.userData.selectionRoomId && value.visible).map(value => value.userData.selectionRoomId)).toEqual(['second'])
    disposeGroup(scene)
  })

  it('fits full room and floor bounds in portrait and landscape viewports', () => {
    const scene = buildHomeFloor({ home: home([room('first'), room('second', 'kitchen', 'linear', { x: 4 })]), floorId: 'floor-a', roomId: null, focused: false, equipment: [] })
    for (const [width, height] of [[360, 500], [1200, 400]]) {
      const camera = new THREE.OrthographicCamera(-6, 6, 6, -6, .1, 150)
      const bounds = new THREE.Box3().setFromObject(scene)
      const center = bounds.getCenter(new THREE.Vector3())
      camera.position.copy(center).add(new THREE.Vector3(10, 14, 17)); camera.lookAt(center)
      fitHomeView(scene, camera, width, height)
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
        const point = new THREE.Vector3(x, y, z).project(camera)
        expect(Math.abs(point.x)).toBeLessThanOrEqual(1)
        expect(Math.abs(point.y)).toBeLessThanOrEqual(1)
      }
    }
    disposeGroup(scene)
  })

  it('also fits the clipping depth for an extensive floor', () => {
    const scene = buildHomeFloor({ home: home([room('first', 'bedroom', 'principal', { x: -70, z: -70, width: 12, depth: 12 }), room('second', 'kitchen', 'linear', { x: 70, z: 70, width: 12, depth: 12 })]), floorId: 'floor-a', roomId: null, focused: false, equipment: [] })
    const camera = new THREE.OrthographicCamera(-6, 6, 6, -6, .1, 150), bounds = new THREE.Box3().setFromObject(scene), center = bounds.getCenter(new THREE.Vector3())
    camera.position.copy(center).add(new THREE.Vector3(10, 14, 17)); camera.lookAt(center)
    fitHomeView(scene, camera, 360, 500)
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) expect(Math.abs(new THREE.Vector3(x, y, z).project(camera).z)).toBeLessThanOrEqual(1)
    disposeGroup(scene)
  })

  it('disposes every shared geometry and material exactly once', () => {
    const scene = buildHomeFloor({ home: home([room('room')]), floorId: 'floor-a', roomId: null, focused: false, equipment: [] })
    const geometries = new Set(objects(scene).filter(value => value instanceof THREE.Mesh).map(value => value.geometry))
    const materials = new Set(objects(scene).filter(value => value instanceof THREE.Mesh).flatMap(value => Array.isArray(value.material) ? value.material : [value.material]))
    const watchers = [...geometries, ...materials].map(value => vi.spyOn(value, 'dispose'))
    disposeGroup(scene)
    expect(watchers.length).toBeGreaterThan(0)
    for (const watcher of watchers) expect(watcher).toHaveBeenCalledOnce()
  })
})

describe('Hogar 3D accessible fallback', () => {
  it('reports missing WebGL and keeps an understandable non-blocking fallback', () => {
    const onUnavailable = vi.fn()
    render(createElement(HomeScene, { home: home([room('room')]), floorId: 'floor-a', roomId: null, focused: false, equipment: [], onSelectRoom: vi.fn(), onSelectEquipment: vi.fn(), onUnavailable }))
    expect(screen.getByRole('status').textContent).toContain('El 3D no está disponible')
    expect(screen.getByRole('status').textContent).toContain('lista')
    expect(onUnavailable).toHaveBeenCalledOnce()
    expect((screen.getByRole('button', { name: 'Acercar maqueta' }) as HTMLButtonElement).disabled).toBe(true)
    cleanup()
  })
})
