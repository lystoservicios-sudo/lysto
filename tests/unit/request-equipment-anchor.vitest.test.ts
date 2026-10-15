// @vitest-environment node
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { equipmentScreenAnchor } from '@/components/customer/hogar/equipment-anchor'
describe('actual placed equipment projection', () => {
  it('projects the actual air body rather than its backing wall or selection marker', () => {
    const model = new THREE.Group(), air = new THREE.Group()
    air.userData = { equipmentRoot: true, equipmentId: 'air' }
    air.add(new THREE.Mesh(new THREE.BoxGeometry(1.3, 3, .09)))
    air.add(new THREE.Mesh(new THREE.BoxGeometry(1.18, .36, .22)))
    const marker = new THREE.Group(); marker.add(new THREE.Mesh(new THREE.BoxGeometry(3, 4, 2))); air.add(marker)
    air.position.set(1, 1, 0); model.add(air); model.updateMatrixWorld(true)
    const camera = new THREE.OrthographicCamera(-4, 4, 4, -4, .1, 100)
    camera.position.set(0, 0, 10); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true)
    const anchor = equipmentScreenAnchor(model, camera, 'air', 400, 400)
    expect(anchor?.x).toBeCloseTo(250)
    expect(anchor?.y).toBeCloseTo(150)
    expect(anchor?.width).toBeCloseTo(59)
    expect(anchor?.height).toBeCloseTo(18)
    expect(equipmentScreenAnchor(model, camera, 'another-air', 400, 400)).toBeNull()
  })
})
