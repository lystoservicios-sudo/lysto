import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { CustomerHome, EquipmentPlacement, HomeRoom, PlacementWall } from '@/lib/customer-homes/contracts'
import type { CustomerAssetEquipment } from '@/lib/customer-assets/contracts'

type Palette = Record<string, THREE.MeshStandardMaterial>
export type HomeSceneInput = {
  home: CustomerHome; floorId: string; roomId: string | null; focused: boolean
  equipment: CustomerAssetEquipment[]; selectedEquipmentId?: string | null; placementDraft?: EquipmentPlacement | null
}
const WALL_HEIGHT = 2.5
const EDGE_MARGIN = .06
const exteriorKinds = new Set(['patio', 'balcony', 'terrace'])

function palette(): Palette {
  const colors = { wall: '#f2f1ed', trim: '#fffefd', wood: '#b7966f', woodLight: '#ccb294', woodDark: '#887252', cloth: '#e6e0d3', cream: '#f4f0e7', sage: '#a7b0a0', blueGrey: '#79919e', tile: '#dcdad2', grout: '#bbbeb8', metal: '#a9b3b4', dark: '#344142', leaves: '#637852', pot: '#a89171', blue: '#075cff', selected: '#cfe3ff', bath: '#f0efe9', rug: '#d6c9b6' }
  const cache = new Map<string, THREE.BufferGeometry>()
  return Object.fromEntries(Object.entries(colors).map(([key, color]) => {
    const material = new THREE.MeshStandardMaterial({ color, roughness: key === 'metal' ? .3 : .86, metalness: key === 'metal' ? .38 : 0 })
    material.userData.geometryCache = cache
    return [key, material]
  }))
}
function cachedGeometry(material: THREE.Material, key: string, create: () => THREE.BufferGeometry) {
  const cache = material.userData.geometryCache as Map<string, THREE.BufferGeometry>
  if (!cache.has(key)) cache.set(key, create())
  return cache.get(key)!
}
function box(group: THREE.Group, p: Palette, color: string, size: [number, number, number], position: [number, number, number], rounded = false) {
  const mesh = new THREE.Mesh(cachedGeometry(p[color], `box:${rounded}:${size.join(',')}`, () => rounded ? new RoundedBoxGeometry(...size, 2, Math.min(...size) * .2) : new THREE.BoxGeometry(...size)), p[color])
  mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh)
  return mesh
}
function cylinder(group: THREE.Group, p: Palette, color: string, radius: number, height: number, position: [number, number, number], topRadius = radius) {
  const mesh = new THREE.Mesh(cachedGeometry(p[color], `cylinder:${radius}:${topRadius}:${height}`, () => new THREE.CylinderGeometry(topRadius, radius, height, 16)), p[color])
  mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh)
  return mesh
}
function plant(group: THREE.Group, p: Palette, x: number, z: number, scale = 1, floor = .04) {
  cylinder(group, p, 'pot', .13 * scale, .24 * scale, [x, floor + .12 * scale, z], .17 * scale)
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(cachedGeometry(p.leaves, 'leaf', () => new THREE.SphereGeometry(.16, 7, 5)), p.leaves)
    leaf.scale.set(.5 * scale, (1.5 + i % 3 * .3) * scale, .55 * scale)
    leaf.position.set(x + Math.cos(i * 2.4) * .09 * scale, floor + (.36 + i % 3 * .05) * scale, z + Math.sin(i * 2.4) * .09 * scale)
    leaf.rotation.z = Math.cos(i * 2.4) * .55; leaf.rotation.x = Math.sin(i * 2.4) * .5; leaf.castShadow = true; group.add(leaf)
  }
}
function lamp(group: THREE.Group, p: Palette, x: number, z: number, floor: number, height: number) {
  cylinder(group, p, 'woodDark', .018, height, [x, floor + height / 2, z])
  cylinder(group, p, 'cream', .17, .23, [x, floor + height, z], .12)
  cylinder(group, p, 'woodDark', .11, .025, [x, floor + .02, z])
}
function table(group: THREE.Group, p: Palette, x: number, z: number, width: number, depth: number, height: number) {
  box(group, p, 'wood', [width, .07, depth], [x, height, z], true)
  for (const side of [-1, 1]) for (const end of [-1, 1]) box(group, p, 'woodDark', [.065, height - .05, .065], [x + side * (width / 2 - .12), height / 2, z + end * (depth / 2 - .12)])
}
function chair(group: THREE.Group, p: Palette, x: number, z: number, angle = 0) {
  const seat = new THREE.Group(); seat.position.set(x, 0, z); seat.rotation.y = angle
  box(seat, p, 'wood', [.43, .055, .45], [0, .48, 0], true)
  box(seat, p, 'wood', [.43, .38, .045], [0, .7, -.21], true)
  for (const side of [-1, 1]) for (const end of [-1, 1]) box(seat, p, 'woodDark', [.045, .48, .045], [side * .16, .24, end * .16])
  group.add(seat)
}
function dining(group: THREE.Group, p: Palette, variant: string, x = 0, z = 0, scale = 1) {
  const setting = new THREE.Group(); setting.position.set(x, 0, z); setting.scale.setScalar(scale)
  const family = variant === 'family' || variant === 'boardroom'
  table(setting, p, 0, 0, family ? 2.05 : 1.35, .9, .77)
  for (const side of [-1, 1]) for (const seat of family ? [-.7, 0, .7] : [-.37, .37]) chair(setting, p, seat, side * .73, side < 0 ? 0 : Math.PI)
  plant(setting, p, 0, 0, .36, .81); group.add(setting)
}
function sofa(group: THREE.Group, p: Palette, x: number, z: number, width = 2.28, angle = 0) {
  const setting = new THREE.Group(); setting.position.set(x, 0, z); setting.rotation.y = angle
  box(setting, p, 'cloth', [width, .34, .86], [0, .3, 0], true)
  box(setting, p, 'cloth', [width, .53, .23], [0, .66, -.34], true)
  for (const side of [-1, 1]) {
    box(setting, p, 'cloth', [.2, .48, .85], [side * (width / 2 - .1), .55, 0], true)
    const cushion = box(setting, p, side < 0 ? 'blueGrey' : 'sage', [.4, .38, .13], [side * (width / 2 - .37), .76, -.15], true)
    cushion.rotation.z = side * .22; cushion.rotation.x = -.2
  }
  for (let i = 0; i < 3; i++) box(setting, p, 'cream', [width / 3 - .1, .18, .64], [-width / 3 + i * width / 3, .52, .02], true)
  group.add(setting)
}
function living(group: THREE.Group, p: Palette, variant: string) {
  box(group, p, 'rug', [2.6, .024, 1.9], [0, .055, .4], true)
  for (let i = 0; i < 8; i++) box(group, p, 'cream', [2.53, .002, .008], [0, .07, -.4 + i * .22])
  sofa(group, p, -.12, -.85, variant === 'compact' ? 1.85 : 2.28)
  if (variant === 'family') sofa(group, p, -1.12, .5, 1.4, Math.PI / 2)
  cylinder(group, p, 'wood', .49, .065, [-.05, .48, .62]); cylinder(group, p, 'woodDark', .16, .44, [-.05, .24, .62]); plant(group, p, -.07, .62, .42, .52)
  box(group, p, 'wood', [.38, .42, 1.45], [1.35, .27, .13], true)
  box(group, p, 'dark', [.05, .75, 1.02], [1.33, .87, .13], true)
  lamp(group, p, -1.34, -.74, .05, 1.12); plant(group, p, 1.25, -1.22, 1.35)
  if (variant === 'dining') {
    const furniture = group.children.slice(); const sitting = new THREE.Group()
    for (const item of furniture) sitting.add(item)
    sitting.scale.set(.67, 1, .8); sitting.position.x = -.48; group.add(sitting)
    dining(group, p, 'compact', 1.02, .56, .63)
  }
}
function bed(group: THREE.Group, p: Palette, x: number, width: number) {
  box(group, p, 'wood', [width, .29, 2.23], [x, .25, .1], true)
  box(group, p, 'wood', [width + .1, .78, .13], [x, .56, -.98], true)
  box(group, p, 'cloth', [width - .03, .25, 2.13], [x, .49, .09], true)
  box(group, p, 'cream', [width - .08, .065, 2], [x, .64, .1], true)
  box(group, p, 'sage', [width - .04, .07, .73], [x, .687, .66], true)
  for (let i = 0; i < 7; i++) box(group, p, 'sage', [width - .08, .009, .012], [x, .725, .37 + i * .075])
  for (const side of width > 1.2 ? [-1, 1] : [0]) box(group, p, 'cloth', [width > 1.2 ? .66 : .64, .15, .46], [x + side * .39, .75, -.56], true)
}
function bedroom(group: THREE.Group, p: Palette, variant: string) {
  box(group, p, 'rug', [2.08, .021, 2.53], [-.32, .053, .12], true)
  if (variant === 'double') { bed(group, p, -.88, .83); bed(group, p, .65, .83) }
  else bed(group, p, -.28, variant === 'guest' ? 1.05 : 1.69)
  for (const side of variant === 'double' ? [0] : [-1, 1]) {
    const x = variant === 'double' ? -.1 : -.28 + side * 1.15
    box(group, p, 'wood', [.36, .51, .42], [x, .3, -.78], true); lamp(group, p, x, -.78, .56, .28)
  }
  if (variant !== 'double') {
    box(group, p, 'woodLight', [.51, 1.69, 1.62], [1.34, .9, -.27], true)
    for (let i = 0; i < 3; i++) {
      box(group, p, 'wood', [.009, 1.59, .009], [1.072, .91, -.82 + i * .55])
      box(group, p, 'woodDark', [.018, .24, .026], [1.061, .83, -.59 + i * .47])
    }
  } else box(group, p, 'woodLight', [1.24, 1.6, .4], [0, .85, 1.43], true)
  if (variant === 'guest') { table(group, p, -.95, 1.13, .9, .56, .76); chair(group, p, -.95, .65, Math.PI) }
  plant(group, p, -1.35, 1.12, 1.15)
}
function kitchen(group: THREE.Group, p: Palette, variant: string) {
  box(group, p, 'cloth', [.58, .86, 2.15], [1.35, .48, .28]); box(group, p, 'cream', [.67, .07, 2.18], [1.33, .95, .28])
  for (let i = 0; i < 4; i++) {
    box(group, p, 'woodLight', [.025, .74, .48], [1.045, .48, -.53 + i * .5], true)
    box(group, p, 'metal', [.026, .023, .18], [1.017, .76, -.53 + i * .5])
  }
  box(group, p, 'dark', [.45, .013, .52], [1.26, 1, .92], true)
  for (const x of [-1, 1]) for (const z of [-1, 1]) cylinder(group, p, 'metal', .077, .01, [1.26 + x * .12, 1.015, .92 + z * .145])
  box(group, p, 'metal', [.41, .018, .5], [1.27, .998, -.37], true); box(group, p, 'dark', [.31, .017, .39], [1.27, 1.01, -.37], true)
  cylinder(group, p, 'metal', .014, .24, [1.46, 1.12, -.37]); box(group, p, 'metal', [.16, .024, .024], [1.39, 1.23, -.37])
  // Refrigerator and furniture are decorative scene geometry, never inventory.
  box(group, p, 'metal', [.59, 1.67, .63], [1.33, .89, -1.16], true)
  box(group, p, 'grout', [.018, .013, .6], [1.019, 1.21, -1.16]); box(group, p, 'dark', [.026, .43, .024], [1.01, .9, -.91], true)
  box(group, p, 'woodLight', [.5, .64, 1.28], [1.34, 1.77, .1], true)
  if (variant === 'l') { box(group, p, 'woodLight', [2.18, .86, .56], [-.16, .48, -1.36]); box(group, p, 'cream', [2.24, .07, .63], [-.16, .95, -1.36]); table(group, p, -.7, .67, .95, .65, .78); chair(group, p, -.7, 1.18, Math.PI) }
  else if (variant === 'island') { box(group, p, 'woodLight', [1.33, .87, .72], [-.45, .49, .18], true); box(group, p, 'cream', [1.4, .075, .9], [-.45, .97, .18], true); chair(group, p, -.88, 1.08, Math.PI); chair(group, p, 0, 1.08, Math.PI); plant(group, p, -.45, .18, .38, 1.02) }
  else { table(group, p, -.43, .32, 1.25, .88, .78); chair(group, p, -.43, -.43); chair(group, p, -.43, 1.08, Math.PI); chair(group, p, -1.4, .31, -Math.PI / 2); plant(group, p, -.43, .32, .38, .83) }
}
function bathroom(group: THREE.Group, p: Palette, variant: string) {
  if (variant === 'bathtub') {
    box(group, p, 'bath', [1.13, .6, 2.2], [-.93, .36, -.23], true)
    box(group, p, 'blueGrey', [.87, .025, 1.95], [-.93, .667, -.23], true)
    box(group, p, 'cream', [.87, .033, 1.48], [-.93, .69, -.07], true)
  } else if (variant !== 'compact') {
    box(group, p, 'bath', [1.22, .09, 1.28], [-.96, .11, -.91], true)
    const glass = new THREE.MeshPhysicalMaterial({ color: '#b7d6d4', transparent: true, opacity: .28, roughness: .08, side: THREE.DoubleSide, depthWrite: false })
    const pane = new THREE.Mesh(new THREE.BoxGeometry(.035, 1.65, 1.28), glass); pane.position.set(-.34, .96, -.9); group.add(pane)
    cylinder(group, p, 'metal', .018, 1.61, [-.34, .93, -.28]); box(group, p, 'metal', [.025, .028, 1.24], [-.34, 1.77, -.9])
    cylinder(group, p, 'metal', .014, .77, [-1.03, 1.45, -1.58]); box(group, p, 'metal', [.31, .025, .2], [-1.03, 1.84, -1.42], true)
  }
  box(group, p, 'bath', [.46, .49, .23], [.48, .31, -1.39], true)
  const bowl = new THREE.Mesh(cachedGeometry(p.bath, 'toilet', () => new THREE.SphereGeometry(.32, 16, 10)), p.bath); bowl.scale.set(.83, .62, 1.1); bowl.position.set(.48, .38, -1.07); bowl.castShadow = true; group.add(bowl)
  cylinder(group, p, 'bath', .2, .29, [.48, .18, -1.13]); box(group, p, 'bath', [.47, .035, .52], [.48, .57, -1.05], true)
  box(group, p, 'woodLight', [.48, .72, variant === 'compact' ? .68 : 1.05], [1.28, .43, .4], true)
  box(group, p, 'bath', [.59, .09, variant === 'compact' ? .75 : 1.12], [1.26, .84, .4], true)
  box(group, p, 'bath', [.47, .12, .55], [1.23, .94, .4], true); box(group, p, 'metal', [.3, .005, .36], [1.21, 1.01, .4], true)
  cylinder(group, p, 'metal', .015, .2, [1.42, 1.07, .4]); box(group, p, 'metal', [.026, 1, .73], [1.67, 1.2, .4], true)
  box(group, p, 'rug', [1.05, .025, .68], [-.36, .066, .76], true); plant(group, p, 1.25, 1.17, .65)
}
function desk(group: THREE.Group, p: Palette, x: number, z: number, width = 1.18) {
  table(group, p, x, z, width, .67, .76)
  box(group, p, 'dark', [.58, .4, .035], [x, 1.02, z - .15], true); box(group, p, 'metal', [.09, .16, .055], [x, .84, z - .15]); box(group, p, 'metal', [.3, .02, .15], [x, .802, z - .15], true)
  box(group, p, 'dark', [.4, .014, .12], [x, .806, z + .18], true); chair(group, p, x, z + .71, Math.PI)
}
function shelf(group: THREE.Group, p: Palette, x: number, z: number, width = .8) {
  box(group, p, 'woodLight', [width, 1.65, .4], [x, .89, z], true)
  for (let i = 0; i < 4; i++) {
    box(group, p, 'wood', [width - .03, .035, .46], [x, .34 + i * .4, z + .03])
    for (let j = 0; j < 3; j++) box(group, p, j % 2 ? 'sage' : 'cream', [.11, .23 + j * .035, .17], [x - width * .3 + j * .2, .47 + i * .4, z + .16])
  }
}
function office(group: THREE.Group, p: Palette, variant: string) {
  if (variant === 'shared') { desk(group, p, -.77, -.62); desk(group, p, .77, -.62) }
  else if (variant === 'studio') { table(group, p, -.25, -.3, 2.1, 1.13, .83); box(group, p, 'cream', [1.25, .02, .75], [-.25, .88, -.3]); chair(group, p, -.25, .63, Math.PI); shelf(group, p, .9, -1.33, 1.1) }
  else { desk(group, p, -.45, -.62, 1.64); shelf(group, p, .92, -.8) }
  box(group, p, 'rug', [2.8, .017, 1.6], [0, .056, .54], true); plant(group, p, 1.25, 1.27, 1.45)
}
function miscellaneous(group: THREE.Group, p: Palette, kind: string, variant: string) {
  if (kind === 'dining' || kind === 'meeting') { dining(group, p, variant); shelf(group, p, -1.25, -1.3, .8); plant(group, p, 1.35, 1.22, 1.2) }
  if (kind === 'laundry') {
    for (const x of variant === 'separate' ? [-.95, .08] : [-.95]) { box(group, p, 'cream', [.8, .89, .76], [x, .5, -1.26], true); const drum = cylinder(group, p, 'metal', .27, .035, [x, .47, -.861]); drum.rotation.x = Math.PI / 2; const center = cylinder(group, p, 'blueGrey', .21, .04, [x, .47, -.84]); center.rotation.x = Math.PI / 2 }
    box(group, p, 'woodLight', [.8, .84, .75], [1.1, .48, -1.26]); box(group, p, 'bath', [.87, .09, .8], [1.1, .95, -1.26], true); box(group, p, 'dark', [.54, .025, .43], [1.1, 1.01, -1.26], true)
    if (variant === 'separate') { box(group, p, 'wood', [2.75, .065, .82], [0, 1.01, -1.3]); for (const x of [-1, 1]) cylinder(group, p, 'metal', .02, 1.35, [x, .8, .8]); box(group, p, 'metal', [2.03, .03, .5], [0, 1.5, .8]); box(group, p, 'cloth', [.8, .72, .03], [0, 1.17, .91]) }
  }
  if (kind === 'hall') {
    box(group, p, 'wood', [.42, .48, 1.3], [-1.34, .3, .1], true); box(group, p, 'metal', [.025, .92, .72], [-1.69, 1.12, .1]); box(group, p, 'rug', [variant === 'corridor' ? .85 : 1.4, .018, variant === 'corridor' ? 2.9 : 1.3], [0, .052, .3], true)
    if (variant === 'entrance') { lamp(group, p, 1.25, -1.1, .05, 1.2); plant(group, p, 1.1, 1.15, 1.3) }
    else for (const z of [-.8, .8]) box(group, p, 'woodLight', [.05, .75, .55], [1.62, 1.2, z], true)
  }
  if (kind === 'storage') {
    for (const x of [-1.18, 1.18]) {
      if (variant === 'utility') shelf(group, p, x, -.5, .9)
      else { box(group, p, 'woodLight', [.56, 1.9, 2.15], [x, 1.02, -.1], true); for (let i = 0; i < 4; i++) box(group, p, 'woodDark', [.03, .4, .025], [x + (x < 0 ? .3 : -.3), .98, -.9 + i * .5]) }
    }
    box(group, p, 'wood', [.85, .48, .6], [0, .31, .78], true)
  }
  if (kind === 'garage') {
    for (const x of variant === 'double' ? [-.75, .75] : [0]) {
      const car = new THREE.Group(); car.position.x = x; car.scale.set(variant === 'double' ? .62 : 1, 1, 1)
      box(car, p, 'blueGrey', [1.38, .53, 2.72], [0, .56, .05], true); box(car, p, 'metal', [1.1, .5, 1.32], [0, 1.06, -.15], true); box(car, p, 'dark', [1.02, .025, 1.02], [0, 1.32, -.15], true)
      for (const side of [-1, 1]) for (const z of [-.85, .89]) { const tire = cylinder(car, p, 'dark', .28, .16, [side * .69, .35, z]); tire.rotation.z = Math.PI / 2 }
      group.add(car)
    }
    shelf(group, p, -1.28, -1.43, .75)
  }
  if (exteriorKinds.has(kind)) {
    const garden = kind === 'patio' && variant === 'garden'
    if (garden) { box(group, p, 'sage', [2.95, .07, 1.3], [0, .08, -.97], true); for (const x of [-1.12, 1.12]) plant(group, p, x, -1.12, 1.6) }
    else { plant(group, p, -1.29, -1.05, 1.4); plant(group, p, 1.29, -1.05, 1.4) }
    if (kind === 'balcony' && variant === 'narrow') { box(group, p, 'wood', [2.4, .09, .42], [0, .43, 1.15], true); for (const x of [-.9, .9]) box(group, p, 'woodDark', [.08, .4, .32], [x, .2, 1.15]) }
    else { dining(group, p, 'compact', 0, .2, .76) }
    if (kind === 'terrace' && variant === 'covered') { for (const x of [-1.5, 1.5]) for (const z of [-1.5, 1.5]) box(group, p, 'woodDark', [.1, 2.25, .1], [x, 1.15, z]); for (let i = 0; i < 8; i++) box(group, p, 'wood', [3.15, .08, .13], [0, 2.32, -1.4 + i * .4]) }
  }
  if (kind === 'reception') {
    box(group, p, 'woodLight', [1.65, 1.06, .61], [-.35, .59, -1.1], true); box(group, p, 'cream', [1.72, .07, .67], [-.35, 1.16, -1.1], true); box(group, p, 'dark', [.5, .36, .045], [-.3, 1.38, -1.25], true)
    if (variant === 'lounge') { sofa(group, p, .1, .98, 2.02, Math.PI); cylinder(group, p, 'wood', .35, .07, [0, .48, .22]) }
    else { chair(group, p, -.87, .55, Math.PI); chair(group, p, .19, .55, Math.PI) }
    plant(group, p, 1.23, -1.2, 1.3)
  }
  if (kind === 'commercial') {
    if (variant === 'retail') { for (const x of [-1.2, 1.2]) shelf(group, p, x, -.95, .88); table(group, p, 0, .6, 1.45, .82, .73); for (const x of [-.4, .4]) box(group, p, 'cloth', [.4, .12, .4], [x, .84, .6], true) }
    else { for (const x of [-.85, .85]) { table(group, p, x, -.4, 1.08, .68, .78); chair(group, p, x, .3, Math.PI) } box(group, p, 'rug', [2.7, .023, 1.2], [0, .055, .85]) }
    plant(group, p, -1.3, 1.22, 1.4)
  }
}

export function getRoomCenter(room: HomeRoom) {
  const quarter = room.rotation % 180 !== 0
  return new THREE.Vector3(room.x + (quarter ? room.depth : room.width) / 2, 0, room.z + (quarter ? room.width : room.depth) / 2)
}
function buildFloor(group: THREE.Group, p: Palette, room: HomeRoom, selected: boolean) {
  const ground = new THREE.Group(); ground.userData.floorRoot = true
  box(ground, p, 'grout', [room.width + .12, .12, room.depth + .12], [0, -.045, 0])
  const tiled = ['bathroom', 'kitchen', 'laundry', 'garage', 'patio', 'balcony', 'terrace'].includes(room.kind)
  const columns = tiled ? 5 : 7, rows = 5, width = room.width / columns, depth = room.depth / rows
  for (let col = 0; col < columns; col++) for (let row = 0; row < rows; row++) box(ground, p, tiled ? 'tile' : (row + col) % 3 === 0 ? 'woodLight' : 'wood', [width - .009, .04, depth - .009], [-room.width / 2 + width * (col + .5), .025, -room.depth / 2 + depth * (row + .5)])
  group.add(ground)
  const source = new THREE.BoxGeometry(room.width + .16, .15, room.depth + .16)
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(source), new THREE.LineBasicMaterial({ color: '#9abff7', transparent: true, opacity: .85 })); source.dispose()
  edge.userData.selectionRoomId = room.id; edge.visible = selected; edge.position.y = -.02; group.add(edge)
}
function buildWalls(group: THREE.Group, p: Palette, room: HomeRoom, focused: boolean) {
  const w = room.width, d = room.depth, exterior = exteriorKinds.has(room.kind)
  const backHeight = exterior ? 1.1 : WALL_HEIGHT
  const north = box(group, p, 'wall', [w + .13, backHeight, .13], [0, backHeight / 2 + .02, -d / 2])
  const west = box(group, p, 'wall', [.13, backHeight, d], [-w / 2, backHeight / 2 + .02, 0])
  for (const [mesh, side] of [[north, 'north'], [west, 'west']] as const) {
    mesh.material = p.wall.clone(); mesh.material.transparent = true
    mesh.userData.cutawayWall = side
  }
  box(group, p, 'trim', [w + .16, .065, .17], [0, backHeight + .045, -d / 2]); box(group, p, 'trim', [.17, .065, d + .09], [-w / 2, backHeight + .045, 0])
  if (exterior) {
    for (const x of [-w / 2, w / 2]) for (let i = 0; i < 9; i++) box(group, p, 'metal', [.027, .85, .027], [x, .48, -d / 2 + i * d / 8])
    box(group, p, 'metal', [w, .04, .045], [0, .92, d / 2]); for (let i = 0; i < 10; i++) box(group, p, 'metal', [.025, .85, .025], [-w / 2 + i * w / 9, .48, d / 2])
  } else {
    box(group, p, 'wall', [.13, .66, d], [w / 2, .35, 0]); box(group, p, 'trim', [.16, .045, d], [w / 2, .703, 0])
    const segment = Math.max(.25, (w - .85) / 2)
    for (const side of [-1, 1]) { box(group, p, 'wall', [segment, .62, .13], [side * (w / 2 - segment / 2), .33, d / 2]); box(group, p, 'trim', [segment + .02, .045, .17], [side * (w / 2 - segment / 2), .663, d / 2]) }
    box(group, p, 'trim', [w - .15, .09, .025], [0, .103, -d / 2 + .081]); box(group, p, 'trim', [.025, .09, d - .17], [-w / 2 + .081, .103, 0])
  }
  if (room.windows !== 'none' && !exterior) {
    const window = new THREE.Group(); window.userData.windowRoot = true; window.position.set(0, room.windows === 'large' ? 1.3 : 1.5, -d / 2 + .084)
    const width = w * (room.windows === 'large' ? .65 : .27), height = room.windows === 'large' ? 1.55 : .67
    box(window, p, 'blueGrey', [width, height, .018], [0, 0, 0])
    for (const side of [-1, 1]) { box(window, p, 'trim', [width + .09, .045, .025], [0, side * height / 2, .017]); box(window, p, 'trim', [.045, height + .04, .025], [side * width / 2, 0, .017]) }
    box(window, p, 'trim', [.035, height, .035], [0, 0, .025]); group.add(window)
  }
  // Placement raycasts ONLY these room-local, wall-tagged surfaces. Furniture is never a target.
  const material = new THREE.MeshBasicMaterial({ color: '#075cff', transparent: true, opacity: focused ? .035 : 0, side: THREE.DoubleSide, depthWrite: false })
  for (const wall of ['north', 'east', 'south', 'west'] as const) {
    const length = wall === 'north' || wall === 'south' ? w : d
    const pick = new THREE.Mesh(new THREE.PlaneGeometry(length, WALL_HEIGHT), material)
    pick.position.set(wall === 'east' ? w / 2 - .076 : wall === 'west' ? -w / 2 + .076 : 0, WALL_HEIGHT / 2, wall === 'north' ? -d / 2 + .076 : wall === 'south' ? d / 2 - .076 : 0)
    pick.rotation.y = wall === 'east' ? -Math.PI / 2 : wall === 'west' ? Math.PI / 2 : wall === 'south' ? Math.PI : 0
    pick.userData.wallPick = { roomId: room.id, wall }; pick.renderOrder = 2; group.add(pick)
  }
}

export function equipmentWidth(type: string | null = 'split') { return type === 'window' ? .78 : type === 'central' ? .94 : type === 'floor_ceiling' ? 1.1 : 1.18 }
function equipmentHeight(type: string | null, height: number) {
  const safe = Number.isFinite(height) ? height : 1.65
  if (type === 'central') return 2.28
  if (type === 'floor_ceiling') return safe >= 1.5 ? 2.23 : THREE.MathUtils.clamp(safe, .45, 1.1)
  return THREE.MathUtils.clamp(safe, type === 'window' ? .55 : .35, type === 'window' ? 2.14 : 2.24)
}
function usableSpan(room: HomeRoom, wall: PlacementWall, type: string | null) {
  const length = wall === 'north' || wall === 'south' ? room.width : room.depth
  return Math.max(0, length - equipmentWidth(type) - EDGE_MARGIN * 2)
}
export function getEquipmentTransform(room: HomeRoom, placement: Pick<EquipmentPlacement, 'wall' | 'offset' | 'height'>, type: string | null = 'split') {
  const { wall } = placement, along = (THREE.MathUtils.clamp(Number.isFinite(placement.offset) ? placement.offset : .5, 0, 1) - .5) * usableSpan(room, wall, type)
  const position = new THREE.Vector3(0, equipmentHeight(type, placement.height), 0)
  let rotation = 0
  if (wall === 'north') position.set(along, position.y, -room.depth / 2 + .18)
  if (wall === 'south') { position.set(along, position.y, room.depth / 2 - .18); rotation = Math.PI }
  if (wall === 'east') { position.set(room.width / 2 - .18, position.y, along); rotation = -Math.PI / 2 }
  if (wall === 'west') { position.set(-room.width / 2 + .18, position.y, along); rotation = Math.PI / 2 }
  const angle = THREE.MathUtils.degToRad(room.rotation)
  position.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle).add(getRoomCenter(room))
  return { position, rotation: rotation + angle }
}
export function getPlacementFromWall(room: HomeRoom, wall: PlacementWall, point: THREE.Vector3, type: string | null = 'split') {
  const local = point.clone().sub(getRoomCenter(room)).applyAxisAngle(new THREE.Vector3(0, 1, 0), -THREE.MathUtils.degToRad(room.rotation))
  const span = usableSpan(room, wall, type), along = wall === 'north' || wall === 'south' ? local.x : local.z
  return { wall, offset: span > 0 ? THREE.MathUtils.clamp(along / span + .5, 0, 1) : .5, height: THREE.MathUtils.clamp(local.y, .35, 2.5) }
}
export function pickWallSurface(object: THREE.Object3D): { roomId: string; wall: PlacementWall } | null {
  if (!object.userData.wallPick) return null
  let current: THREE.Object3D | null = object
  while (current) { if (!current.visible) return null; current = current.parent }
  return object.userData.wallPick
}
export function pickSelectionFromObject(object: THREE.Object3D): { roomId?: string; equipmentId?: string } {
  if (object.userData.cutawayWall && (object as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>).material.opacity < 1) return {}
  let current: THREE.Object3D | null = object, selection: { roomId?: string; equipmentId?: string } = {}
  while (current) {
    if (!current.visible) return {}
    if (!selection.equipmentId && current.userData.equipmentId) selection = { roomId: current.userData.roomId, equipmentId: current.userData.equipmentId }
    else if (!selection.roomId && current.userData.roomId) selection.roomId = current.userData.roomId
    current = current.parent
  }
  return selection
}
function buildEquipment(parent: THREE.Group, p: Palette, room: HomeRoom, item: CustomerAssetEquipment, placement: EquipmentPlacement, selected: boolean) {
  const group = new THREE.Group(), type = item.equipmentType
  group.userData.roomId = room.id; group.userData.equipmentId = item.id; group.userData.equipmentRoot = true
  const transform = getEquipmentTransform(room, placement, type); group.position.copy(transform.position); group.rotation.y = transform.rotation
  // The cutaway must still communicate wall attachment rather than making
  // a mounted unit look as though it is floating above the front wall.
  if ((placement.wall === 'south' || placement.wall === 'east') && type !== 'central') box(group, p, 'wall', [equipmentWidth(type), WALL_HEIGHT, .09], [0, WALL_HEIGHT / 2 + .02 - transform.position.y, -.14])
  if (type === 'window') {
    box(group, p, 'cream', [.78, .58, .43], [0, 0, 0], true)
    for (let i = 0; i < 7; i++) box(group, p, 'grout', [.46, .028, .02], [-.08, -.19 + i * .052, .23])
    box(group, p, 'dark', [.12, .3, .016], [.26, 0, .23])
  } else if (type === 'central') {
    box(group, p, 'cream', [.94, .13, .9], [0, 0, .28], true)
    box(group, p, 'grout', [.62, .015, .58], [0, -.08, .28], true)
    for (const x of [-.35, .35]) box(group, p, 'dark', [.06, .018, .64], [x, -.08, .28])
    for (const z of [-.07, .63]) box(group, p, 'dark', [.68, .018, .04], [0, -.08, z])
  } else if (type === 'floor_ceiling') {
    const ceiling = placement.height >= 1.5
    box(group, p, 'cream', [1.1, ceiling ? .22 : .62, ceiling ? .58 : .24], [0, 0, ceiling ? .16 : .04], true)
    for (let i = 0; i < 5; i++) box(group, p, 'grout', [.92, .015, .02], [0, ceiling ? -.09 : -.18 + i * .065, ceiling ? .45 + i * .01 : .172])
  } else {
    const bodyHeight = type === 'inverter' ? .33 : .36
    box(group, p, 'cream', [1.18, bodyHeight, .22], [0, 0, .038], true)
    box(group, p, 'grout', [1.03, .017, .028], [0, -.116, .159]); box(group, p, 'trim', [1.01, .025, .075], [0, -.145, .11], true)
    box(group, p, 'blue', [type === 'inverter' ? .09 : .025, .008, .01], [.44, -.095, .154])
    if (type === 'inverter') box(group, p, 'metal', [.2, .035, .012], [.33, .045, .154], true)
    if (type === 'on_off') { for (const x of [.35, .42]) cylinder(group, p, 'dark', .015, .01, [x, -.03, .161]); box(group, p, 'grout', [.025, .2, .014], [-.48, 0, .159]) }
  }
  const highlight = new THREE.Group(); highlight.userData.selectionEquipmentId = item.id; highlight.visible = selected
  const width = equipmentWidth(type)
  box(highlight, p, 'selected', [width + .14, type === 'window' ? .75 : .52, .1], [0, -.005, -.08], true)
  const pin = new THREE.Mesh(cachedGeometry(p.blue, 'pin', () => new THREE.SphereGeometry(.14, 16, 12)), p.blue); pin.position.set(0, .46, .1); pin.castShadow = true; highlight.add(pin)
  const center = new THREE.Mesh(cachedGeometry(p.trim, 'pin-center', () => new THREE.SphereGeometry(.056, 12, 8)), p.trim); center.position.set(.01, .48, .229); highlight.add(center)
  cylinder(highlight, p, 'blue', .02, .18, [0, .3, .1], .09)
  group.add(highlight); parent.add(group)
}
export function buildHomeFloor(input: HomeSceneInput) {
  const root = new THREE.Group(); root.name = 'lysto-hogar'; root.userData.floorId = input.floorId
  const floor = input.home.floors.find(value => value.id === input.floorId)
  if (!floor) return root
  const p = palette(), rooms = input.focused ? floor.rooms.filter(value => value.id === input.roomId) : floor.rooms
  for (const room of rooms) {
    const group = new THREE.Group(); group.name = room.id; group.userData.roomId = room.id; group.userData.roomRoot = true; group.userData.kind = room.kind
    group.position.copy(getRoomCenter(room)); group.rotation.y = THREE.MathUtils.degToRad(room.rotation)
    buildFloor(group, p, room, room.id === input.roomId); buildWalls(group, p, room, input.focused)
    const furnishings = new THREE.Group(); furnishings.userData.furnishings = true
    furnishings.scale.set((room.width - .18) / 3.6, 1, (room.depth - .18) / 3.6)
    if (room.kind === 'living') living(furnishings, p, room.variant)
    else if (room.kind === 'bedroom') bedroom(furnishings, p, room.variant)
    else if (room.kind === 'kitchen') kitchen(furnishings, p, room.variant)
    else if (room.kind === 'bathroom') bathroom(furnishings, p, room.variant)
    else if (room.kind === 'office') office(furnishings, p, room.variant)
    else miscellaneous(furnishings, p, room.kind, room.variant)
    group.add(furnishings); root.add(group)
  }
  const placements = input.placementDraft ? [...input.home.placements.filter(value => value.equipmentId !== input.placementDraft!.equipmentId), input.placementDraft] : input.home.placements
  for (const placement of placements) {
    const room = rooms.find(value => value.id === placement.roomId), item = input.equipment.find(value => value.id === placement.equipmentId && !value.archivedAt)
    if (room && item) buildEquipment(root, p, room, item, placement, placement.equipmentId === input.selectedEquipmentId)
  }
  root.updateMatrixWorld(true)
  return root
}
export function setHomeSelection(root: THREE.Object3D, roomId: string | null, equipmentId?: string | null) {
  root.traverse(object => {
    if (object.userData.selectionRoomId) object.visible = object.userData.selectionRoomId === roomId
    if (object.userData.selectionEquipmentId) object.visible = object.userData.selectionEquipmentId === equipmentId
  })
}
export function updateCutawayWalls(root: THREE.Object3D, camera: THREE.Camera) {
  root.updateMatrixWorld(true)
  root.traverse(object => {
    if (!object.userData.cutawayWall || !object.parent) return
    const mesh = object as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
    const localCamera = object.parent.worldToLocal(camera.position.clone())
    const front = object.userData.cutawayWall === 'north' ? localCamera.z < 0 : localCamera.x < 0
    mesh.material.opacity = front ? .18 : 1
    mesh.material.depthWrite = !front
    mesh.castShadow = !front
  })
}
export function fitHomeView(root: THREE.Object3D, camera: THREE.OrthographicCamera, width: number, height: number) {
  const bounds = new THREE.Box3().setFromObject(root), aspect = Math.max(1, width) / Math.max(1, height)
  if (bounds.isEmpty()) { camera.left = -4 * aspect; camera.right = 4 * aspect; camera.top = 4; camera.bottom = -4; camera.updateProjectionMatrix(); return 4 }
  camera.updateMatrixWorld(true)
  let vertical = 0, horizontal = 0, nearDepth = Infinity, farDepth = -Infinity
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
    const point = new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse)
    vertical = Math.max(vertical, Math.abs(point.y)); horizontal = Math.max(horizontal, Math.abs(point.x))
    nearDepth = Math.min(nearDepth, -point.z); farDepth = Math.max(farDepth, -point.z)
  }
  // An orthographic fit must include depth too: extensive floors can otherwise
  // project within XY bounds while rooms are clipped behind the camera.
  if (nearDepth < .5) {
    const shift = .5 - nearDepth
    camera.position.addScaledVector(camera.getWorldDirection(new THREE.Vector3()), -shift)
    farDepth += shift
    camera.updateMatrixWorld(true)
  }
  camera.near = .1; camera.far = Math.max(150, farDepth + 20)
  const half = Math.max(.1, vertical, horizontal / Math.max(.1, aspect)) * 1.08
  camera.left = -half * aspect; camera.right = half * aspect; camera.top = half; camera.bottom = -half; camera.updateProjectionMatrix()
  return half
}
export function disposeGroup(group: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>()
  group.traverse(object => {
    const mesh = object as THREE.Mesh
    if (mesh.geometry) geometries.add(mesh.geometry)
    if (mesh.material) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material)
  })
  for (const geometry of geometries) geometry.dispose()
  for (const material of materials) material.dispose()
}
