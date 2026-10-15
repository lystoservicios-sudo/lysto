import * as THREE from 'three'
export type EquipmentScreenAnchor = { x: number; y: number; width: number; height: number }
/** Project an actual rendered air body, excluding its wall backing and selection pin. */
export function equipmentScreenAnchor(model: THREE.Object3D, camera: THREE.Camera, equipmentId: string, width: number, height: number): EquipmentScreenAnchor | null {
  if (width < 40 || height < 40) return null
  let body: THREE.Mesh | null = null
  model.traverse(object => {
    if (!object.userData.equipmentRoot || object.userData.equipmentId !== equipmentId) return
    const match = object.children.find(child => {
      if (!(child instanceof THREE.Mesh)) return false
      child.geometry.computeBoundingBox()
      const size = child.geometry.boundingBox?.getSize(new THREE.Vector3())
      return size && size.x > .5 && size.y > .1 && size.y < 1.5
    })
    if (match instanceof THREE.Mesh) body = match
  })
  if (!body) return null
  const bounds = new THREE.Box3().setFromObject(body)
  const center = bounds.getCenter(new THREE.Vector3()).project(camera)
  if (center.z < -1 || center.z > 1) return null
  const corners = [bounds.min.x, bounds.max.x].flatMap(x => [bounds.min.y, bounds.max.y].flatMap(y => [bounds.min.z, bounds.max.z].map(z => new THREE.Vector3(x, y, z).project(camera))))
  const projectedWidth = (Math.max(...corners.map(p => p.x)) - Math.min(...corners.map(p => p.x))) * width / 2
  const projectedHeight = (Math.max(...corners.map(p => p.y)) - Math.min(...corners.map(p => p.y))) * height / 2
  if (projectedWidth < 2 || !Number.isFinite(projectedWidth) || !Number.isFinite(projectedHeight)) return null
  return { x: (center.x + 1) * width / 2, y: (1 - center.y) * height / 2, width: projectedWidth, height: projectedHeight }
}
