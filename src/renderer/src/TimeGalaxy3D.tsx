import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

type TimeGalaxy3DProps = {
  onUnavailable: () => void
}

const TIMELINE = [
  { year: '2020', label: '问题出现', color: '#7976ff' },
  { year: '2022', label: '讨论扩散', color: '#5e9dff' },
  { year: '2024', label: '观点分化', color: '#4fc4ed' },
  { year: '2026', label: '共识重组', color: '#64e6d8' },
]

function seededRandom(seed: number) {
  let value = seed >>> 0
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 4294967296
  }
}

export default function TimeGalaxy3D({ onUnavailable }: TimeGalaxy3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      })
    } catch {
      onUnavailable()
      return
    }

    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x101a32, 0.075)
    const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 80)
    camera.position.set(0.25, 1.1, 7.5)

    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    renderer.outputColorSpace = THREE.SRGBColorSpace

    const controls = new OrbitControls(camera, canvas)
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    controls.enableDamping = true
    controls.enablePan = false
    controls.minDistance = 4.8
    controls.maxDistance = 10
    controls.autoRotate = !reduceMotion
    controls.autoRotateSpeed = 0.55
    controls.target.set(0, 0.1, 0)

    scene.add(new THREE.AmbientLight(0x8ba7ff, 1.35))
    const cyanLight = new THREE.PointLight(0x56f4df, 45, 18)
    cyanLight.position.set(3.5, 2.5, 4)
    scene.add(cyanLight)
    const violetLight = new THREE.PointLight(0x7166ff, 35, 16)
    violetLight.position.set(-4, -1.5, 2)
    scene.add(violetLight)

    const universe = new THREE.Group()
    universe.rotation.set(-0.12, -0.18, -0.06)
    scene.add(universe)

    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.58, 3),
      new THREE.MeshPhysicalMaterial({
        color: 0x4dded2,
        emissive: 0x155db9,
        emissiveIntensity: 1.8,
        metalness: 0.25,
        roughness: 0.18,
        clearcoat: 1,
        clearcoatRoughness: 0.16,
      }),
    )
    universe.add(core)

    const shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.82, 2),
      new THREE.MeshBasicMaterial({
        color: 0x77fff0,
        wireframe: true,
        transparent: true,
        opacity: 0.12,
      }),
    )
    universe.add(shell)

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x7de8e2,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
    })
    ;[
      { radius: 1.35, tube: 0.012, rotation: [1.2, 0.2, 0.1] },
      { radius: 1.9, tube: 0.009, rotation: [0.55, 0.7, -0.35] },
      { radius: 2.5, tube: 0.007, rotation: [1.1, -0.42, 0.6] },
    ].forEach(({ radius, tube, rotation }) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius, tube, 8, 160),
        ringMaterial.clone(),
      )
      ring.rotation.set(rotation[0], rotation[1], rotation[2])
      universe.add(ring)
    })

    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-2.8, -1.25, 0.25),
      new THREE.Vector3(-1.15, -0.35, 0.85),
      new THREE.Vector3(0.35, 0.25, 0.25),
      new THREE.Vector3(1.5, 0.85, -0.35),
      new THREE.Vector3(2.85, 1.3, 0.15),
    ])
    const path = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 96, 0.025, 8, false),
      new THREE.MeshBasicMaterial({
        color: 0x6bcfea,
        transparent: true,
        opacity: 0.62,
        blending: THREE.AdditiveBlending,
      }),
    )
    universe.add(path)

    TIMELINE.forEach((event, index) => {
      const point = curve.getPoint(index / (TIMELINE.length - 1))
      const node = new THREE.Mesh(
        new THREE.SphereGeometry(index === TIMELINE.length - 1 ? 0.16 : 0.115, 24, 24),
        new THREE.MeshPhysicalMaterial({
          color: event.color,
          emissive: new THREE.Color(event.color),
          emissiveIntensity: index === TIMELINE.length - 1 ? 2.2 : 1.25,
          roughness: 0.2,
        }),
      )
      node.position.copy(point)
      node.userData.phase = index * 0.9
      universe.add(node)
    })

    const random = seededRandom(20260913)
    const starPositions = new Float32Array(420 * 3)
    for (let i = 0; i < 420; i += 1) {
      const radius = 2.8 + random() * 7.2
      const theta = random() * Math.PI * 2
      const phi = Math.acos(2 * random() - 1)
      starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
      starPositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
      starPositions[i * 3 + 2] = radius * Math.cos(phi)
    }
    const starsGeometry = new THREE.BufferGeometry()
    starsGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
    const stars = new THREE.Points(
      starsGeometry,
      new THREE.PointsMaterial({
        color: 0xa9d8ff,
        size: 0.025,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
      }),
    )
    scene.add(stars)

    const clock = new THREE.Clock()
    let frame = 0
    let stopped = false
    const resize = () => {
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

    const animate = () => {
      if (stopped) return
      frame = requestAnimationFrame(animate)
      if (document.hidden) return
      const elapsed = clock.getElapsedTime()
      if (!reduceMotion) {
        core.rotation.y = elapsed * 0.28
        core.rotation.x = elapsed * 0.12
        shell.rotation.y = -elapsed * 0.12
        shell.rotation.z = elapsed * 0.08
        stars.rotation.y = elapsed * 0.008
        universe.children.forEach((child) => {
          if (typeof child.userData.phase === 'number') {
            const scale = 1 + Math.sin(elapsed * 2 + child.userData.phase) * 0.14
            child.scale.setScalar(scale)
          }
        })
      }
      controls.update()
      renderer.render(scene, camera)
    }

    const contextLost = (event: Event) => {
      event.preventDefault()
      onUnavailable()
    }
    canvas.addEventListener('webglcontextlost', contextLost)
    setReady(true)
    animate()

    return () => {
      stopped = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      canvas.removeEventListener('webglcontextlost', contextLost)
      controls.dispose()
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh || object instanceof THREE.Points)) return
        object.geometry.dispose()
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        materials.forEach((material) => material.dispose())
      })
      renderer.dispose()
    }
  }, [onUnavailable])

  return (
    <div className={`time-galaxy ${ready ? 'is-ready' : ''}`}>
      <canvas ref={canvasRef} aria-label="可拖拽旋转和滚轮缩放的观点时间星轨" />
      <div className="galaxy-labels" aria-hidden="true">
        {TIMELINE.map((event) => (
          <span key={event.year}>
            <strong>{event.year}</strong>
            <small>{event.label}</small>
          </span>
        ))}
      </div>
      {!ready && <span className="galaxy-loading">正在点亮时间星轨…</span>}
    </div>
  )
}
