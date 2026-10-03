import {
  BufferGeometry, CatmullRomCurve3, Color, CylinderGeometry, DirectionalLight,
  DoubleSide, Float32BufferAttribute, Group, HemisphereLight, InstancedMesh,
  LineBasicMaterial, LineSegments, Matrix4, Mesh, MeshStandardMaterial,
  PerspectiveCamera, Quaternion, Scene, SphereGeometry, TubeGeometry, Vector3,
  WebGLRenderer,
} from 'three'
import { RAIN_TIMING, smooth } from './rain-connection-timeline'

const PANELS = 8
const RADIAL_STEPS = 24
const PANEL_STEPS = 12
const APEX = .7
const UP = new Vector3(0, 1, 0)
const TAU = Math.PI * 2

// Cloth between two ribs, with a scalloped hem. Folding rotates each radial
// section around the crown: the fabric gathers down the shaft rather than
// shrinking a flat umbrella icon.
function canopyPoint(panel: number, t: number, u: number, closure: number, target: Vector3) {
  const openR = 3 * t
  const drop = 1.12 * t ** 1.55
  const length = Math.hypot(openR, drop)
  const openAngle = Math.atan2(openR, drop)
  const angle = openAngle * (1 - closure) + .055 * closure
  const radius = length * Math.sin(angle)
  const a = panel / PANELS * TAU
  const b = (panel + 1) / PANELS * TAU
  const scallop = Math.sin(u * Math.PI)
  const pleat = Math.sin(u * TAU) * .14 * closure * t
  const hem = 1 - .035 * scallop * t ** 5 * (1 - closure)
  const x = radius * ((1 - u) * Math.cos(a) + u * Math.cos(b)) * hem
  const z = radius * ((1 - u) * Math.sin(a) + u * Math.sin(b)) * hem
  const middle = (a + b) / 2
  return target.set(
    x + Math.cos(middle) * pleat,
    APEX - length * Math.cos(angle) - .085 * scallop * t * (1 - closure),
    z + Math.sin(middle) * pleat,
  )
}

export function createUmbrellaScene(canvas: HTMLCanvasElement) {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
  renderer.setClearColor(0x000000, 0)
  const scene = new Scene()
  const camera = new PerspectiveCamera(43, 1, .04, 60)
  const umbrella = new Group()
  scene.add(umbrella)
  const css = getComputedStyle(canvas)
  const clothColor = new Color(css.getPropertyValue('--umbrella-cloth').trim() || '#7bd3e2')
  const ribColor = new Color(css.getPropertyValue('--umbrella-rib').trim() || '#d8e9eb')
  scene.add(new HemisphereLight(0xf6ffff, 0x7098a1, 2.1))
  const key = new DirectionalLight(0xffffff, 1.35)
  key.position.set(-3, 6, 4)
  scene.add(key)
  const underside = new DirectionalLight(0xe2faff, 1.6)
  underside.position.set(1, -4, 1)
  scene.add(underside)

  const geometry = new BufferGeometry()
  const verticesPerPanel = (RADIAL_STEPS + 1) * (PANEL_STEPS + 1)
  const positions = new Float32Array(PANELS * verticesPerPanel * 3)
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  const indices: number[] = []
  const materials = Array.from({ length: PANELS }, (_, index) => {
    const color = clothColor.clone().multiplyScalar([1, .92, 1.035, .96, 1, .9, 1.025, .965][index])
    return new MeshStandardMaterial({ color, roughness: .88, metalness: .04, side: DoubleSide })
  })
  for (let panel = 0; panel < PANELS; panel++) {
    const start = indices.length
    for (let ring = 0; ring < RADIAL_STEPS; ring++) {
      for (let step = 0; step < PANEL_STEPS; step++) {
        const a = panel * verticesPerPanel + ring * (PANEL_STEPS + 1) + step
        const b = a + PANEL_STEPS + 1
        indices.push(a, b, a + 1, a + 1, b, b + 1)
      }
    }
    geometry.addGroup(start, indices.length - start, panel)
  }
  geometry.setIndex(indices)
  const canopy = new Mesh(geometry, materials)
  canopy.frustumCulled = false
  umbrella.add(canopy)

  const metal = new MeshStandardMaterial({ color: ribColor, roughness: .34, metalness: .65 })
  const shaftGeometry = new CylinderGeometry(.023, .027, 3.55, 16)
  const shaft = new Mesh(shaftGeometry, metal)
  shaft.position.y = -1.055
  umbrella.add(shaft)
  const handleCurve = new CatmullRomCurve3([
    new Vector3(0, -2.7, 0), new Vector3(0, -3.0, 0),
    new Vector3(-.18, -3.2, 0), new Vector3(-.43, -3.15, 0),
    new Vector3(-.51, -2.91, 0),
  ])
  const handleGeometry = new TubeGeometry(handleCurve, 40, .047, 8, false)
  const handleMaterial = new MeshStandardMaterial({ color: 0xf1f4ee, roughness: .62 })
  umbrella.add(new Mesh(handleGeometry, handleMaterial))
  const tipGeometry = new CylinderGeometry(.015, .032, .19, 12)
  const tip = new Mesh(tipGeometry, metal)
  tip.position.y = APEX + .09
  umbrella.add(tip)
  const hubGeometry = new SphereGeometry(.078, 16, 12)
  const hub = new Mesh(hubGeometry, metal)
  hub.position.y = APEX - .065
  umbrella.add(hub)
  const runnerGeometry = new CylinderGeometry(.065, .065, .12, 16)
  const runner = new Mesh(runnerGeometry, metal)
  umbrella.add(runner)

  const strutGeometry = new CylinderGeometry(.009, .009, 1, 6)
  const ribs = new InstancedMesh(strutGeometry, metal, PANELS * (RADIAL_STEPS + 1))
  ribs.frustumCulled = false
  umbrella.add(ribs)
  const linePositions = new Float32Array(PANELS * (RADIAL_STEPS + PANEL_STEPS) * 6)
  const lineGeometry = new BufferGeometry()
  lineGeometry.setAttribute('position', new Float32BufferAttribute(linePositions, 3))
  const lineMaterial = new LineBasicMaterial({ color: 0xe9fcff, transparent: true, opacity: .68 })
  const seams = new LineSegments(lineGeometry, lineMaterial)
  seams.frustumCulled = false
  umbrella.add(seams)

  const point = new Vector3()
  const from = new Vector3()
  const to = new Vector3()
  const center = new Vector3()
  const direction = new Vector3()
  const scale = new Vector3()
  const rotation = new Quaternion()
  const matrix = new Matrix4()
  function strut(index: number, a: Vector3, b: Vector3) {
    direction.subVectors(b, a)
    scale.set(1, direction.length(), 1)
    rotation.setFromUnitVectors(UP, direction.normalize())
    center.addVectors(a, b).multiplyScalar(.5)
    matrix.compose(center, rotation, scale)
    ribs.setMatrixAt(index, matrix)
  }
  let lastClosure = -1
  function fold(closure: number) {
    if (Math.abs(closure - lastClosure) < .0001) return
    lastClosure = closure
    const attribute = geometry.getAttribute('position')
    const lineAttribute = lineGeometry.getAttribute('position')
    let vertex = 0
    let lineVertex = 0
    let ribIndex = 0
    runner.position.y = .02 - 2.2 * closure
    for (let panel = 0; panel < PANELS; panel++) {
      for (let ring = 0; ring <= RADIAL_STEPS; ring++) {
        for (let step = 0; step <= PANEL_STEPS; step++) {
          canopyPoint(panel, ring / RADIAL_STEPS, step / PANEL_STEPS, closure, point)
          attribute.setXYZ(vertex++, point.x, point.y, point.z)
        }
      }
      for (let ring = 0; ring < RADIAL_STEPS; ring++) {
        canopyPoint(panel, ring / RADIAL_STEPS, 0, closure, from)
        canopyPoint(panel, (ring + 1) / RADIAL_STEPS, 0, closure, to)
        lineAttribute.setXYZ(lineVertex++, from.x, from.y + .006, from.z)
        lineAttribute.setXYZ(lineVertex++, to.x, to.y + .006, to.z)
        from.y -= .02
        to.y -= .02
        strut(ribIndex++, from, to)
      }
      for (let step = 0; step < PANEL_STEPS; step++) {
        canopyPoint(panel, 1, step / PANEL_STEPS, closure, from)
        canopyPoint(panel, 1, (step + 1) / PANEL_STEPS, closure, to)
        lineAttribute.setXYZ(lineVertex++, from.x, from.y, from.z)
        lineAttribute.setXYZ(lineVertex++, to.x, to.y, to.z)
      }
      canopyPoint(panel, .48, 0, closure, to)
      from.set(0, runner.position.y, 0)
      strut(ribIndex++, from, to)
    }
    attribute.needsUpdate = true
    lineAttribute.needsUpdate = true
    ribs.instanceMatrix.needsUpdate = true
    geometry.computeVertexNormals()
  }

  function resize() {
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    if (!width || !height) return
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }
  const observer = new ResizeObserver(resize)
  observer.observe(canvas)
  resize()

  return {
    render(elapsed: number, closure: number) {
      fold(closure)
      const orbit = smooth((elapsed - 500) / (RAIN_TIMING.orbit - 500))
      const approach = smooth((elapsed - RAIN_TIMING.orbit) / RAIN_TIMING.cover)
      const polar = (1 - orbit) * 2.78 + .001
      const azimuth = -.35 + orbit * Math.PI * 1.65
      const distance = 5.2 + 2.3 * Math.sin(orbit * Math.PI / 2)
      const portraitFit = Math.max(1, 1.12 / camera.aspect)
      const radius = Math.sin(polar) * distance * portraitFit
      const overviewHeight = .2 + Math.cos(polar) * distance * portraitFit
      // At the handoff every viewport corner lies under opaque cloth. During
      // folding the transparent canvas exposes the already mounted next page.
      const edgeHeight = APEX - 1.12
      const coverFov = Math.min(43, 2 * Math.atan(2.53 / ((APEX + 1.4 - edgeHeight) * Math.hypot(1, camera.aspect))) * 180 / Math.PI)
      camera.fov = 43 * (1 - approach) + coverFov * approach
      camera.updateProjectionMatrix()
      const coverHeight = edgeHeight + 2.53 / (Math.tan(coverFov * Math.PI / 360) * Math.hypot(1, camera.aspect))
      camera.position.set(
        Math.cos(azimuth) * radius * (1 - approach),
        overviewHeight * (1 - approach) + coverHeight * approach,
        Math.sin(azimuth) * radius * (1 - approach) + .001,
      )
      const overhead = smooth((orbit - .72) / .28)
      camera.up.set(-Math.sin(azimuth) * overhead, 1 - overhead, Math.cos(azimuth) * overhead)
      camera.lookAt(0, .2, 0)
      umbrella.rotation.z = smooth((closure - .78) / .22) * -.16
      renderer.render(scene, camera)
    },
    dispose() {
      observer.disconnect()
      geometry.dispose()
      lineGeometry.dispose()
      shaftGeometry.dispose()
      handleGeometry.dispose()
      tipGeometry.dispose()
      hubGeometry.dispose()
      runnerGeometry.dispose()
      strutGeometry.dispose()
      materials.forEach(material => material.dispose())
      metal.dispose()
      handleMaterial.dispose()
      lineMaterial.dispose()
      renderer.dispose()
    },
  }
}
