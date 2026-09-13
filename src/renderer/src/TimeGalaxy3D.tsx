import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

type TimeGalaxy3DProps = {
  immersive?: boolean
  onUnavailable: () => void
}

const TIMELINE = [
  { year: '2020', label: '问题出现', value: '12%', detail: '早期信号进入讨论场', color: '#8178ff' },
  { year: '2022', label: '讨论扩散', value: '34%', detail: '关键叙事开始聚集', color: '#5e9dff' },
  { year: '2024', label: '观点分化', value: '57%', detail: '立场形成明显分叉', color: '#42c6ef' },
  { year: '2026', label: '共识重组', value: '81%', detail: '新证据改变主流判断', color: '#64eadb' },
]

function seededRandom(seed: number) {
  let value = seed >>> 0
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 4294967296
  }
}

function glowTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const context = canvas.getContext('2d')
  if (!context) return new THREE.Texture()
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(218,255,252,1)')
  gradient.addColorStop(0.12, 'rgba(91,235,224,.86)')
  gradient.addColorStop(0.38, 'rgba(61,138,255,.25)')
  gradient.addColorStop(1, 'rgba(15,35,90,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, 128, 128)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export default function TimeGalaxy3D({ immersive = false, onUnavailable }: TimeGalaxy3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)
  const [activeIndex, setActiveIndex] = useState(TIMELINE.length - 1)
  const activeIndexRef = useRef(TIMELINE.length - 1)
  const selectEvent = (index: number) => {
    activeIndexRef.current = index
    setActiveIndex(index)
  }

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

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x071024, immersive ? 0.038 : 0.072)
    const camera = new THREE.PerspectiveCamera(immersive ? 48 : 43, 1, 0.1, 100)
    camera.position.set(immersive ? 0.6 : 0.25, immersive ? 1.45 : 1.1, immersive ? 8.8 : 7.5)

    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, immersive ? 2 : 1.65))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.18

    const controls = new OrbitControls(camera, canvas)
    controls.enableDamping = true
    controls.dampingFactor = 0.045
    controls.enablePan = false
    controls.minDistance = immersive ? 4.4 : 4.8
    controls.maxDistance = immersive ? 13 : 10
    controls.autoRotate = !reduceMotion
    controls.autoRotateSpeed = immersive ? 0.42 : 0.55
    controls.target.set(0, 0.1, 0)

    scene.add(new THREE.HemisphereLight(0x91aaff, 0x080c1b, 1.65))
    const cyanLight = new THREE.PointLight(0x5af7df, 58, 22)
    cyanLight.position.set(3.5, 2.8, 4)
    scene.add(cyanLight)
    const violetLight = new THREE.PointLight(0x7166ff, 48, 20)
    violetLight.position.set(-4.5, -1.8, 2)
    scene.add(violetLight)

    const universe = new THREE.Group()
    universe.rotation.set(-0.12, -0.18, -0.06)
    scene.add(universe)

    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(immersive ? 0.72 : 0.58, 4),
      new THREE.MeshPhysicalMaterial({
        color: 0x4dded2,
        emissive: 0x155db9,
        emissiveIntensity: 2.1,
        metalness: 0.32,
        roughness: 0.14,
        clearcoat: 1,
        clearcoatRoughness: 0.12,
      }),
    )
    universe.add(core)

    const shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(immersive ? 1.04 : 0.82, 2),
      new THREE.MeshBasicMaterial({
        color: 0x87fff4,
        wireframe: true,
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
      }),
    )
    universe.add(shell)

    const glowMap = glowTexture()
    const aura = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowMap,
        color: 0x8dfff5,
        transparent: true,
        opacity: 0.66,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )
    aura.scale.setScalar(immersive ? 4.5 : 3.2)
    universe.add(aura)

    ;[
      { radius: 1.35, tube: 0.014, rotation: [1.2, 0.2, 0.1], color: 0x7de8e2 },
      { radius: 1.95, tube: 0.011, rotation: [0.55, 0.7, -0.35], color: 0x668dff },
      { radius: 2.6, tube: 0.008, rotation: [1.1, -0.42, 0.6], color: 0x87f9e9 },
    ].forEach(({ radius, tube, rotation, color }) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius * (immersive ? 1.14 : 1), tube, 8, 180),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.32,
          blending: THREE.AdditiveBlending,
        }),
      )
      ring.rotation.set(rotation[0], rotation[1], rotation[2])
      ring.userData.spin = 0.018 + radius * 0.006
      universe.add(ring)
    })

    const curveScale = immersive ? 1.28 : 1
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-2.8 * curveScale, -1.25 * curveScale, 0.25),
      new THREE.Vector3(-1.15 * curveScale, -0.35 * curveScale, 0.85),
      new THREE.Vector3(0.35 * curveScale, 0.25 * curveScale, 0.25),
      new THREE.Vector3(1.5 * curveScale, 0.85 * curveScale, -0.35),
      new THREE.Vector3(2.85 * curveScale, 1.3 * curveScale, 0.15),
    ])
    const path = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 140, immersive ? 0.032 : 0.025, 8, false),
      new THREE.MeshBasicMaterial({
        color: 0x72dff2,
        transparent: true,
        opacity: 0.74,
        blending: THREE.AdditiveBlending,
      }),
    )
    universe.add(path)

    const nodeMeshes: THREE.Mesh[] = []
    TIMELINE.forEach((event, index) => {
      const point = curve.getPoint(index / (TIMELINE.length - 1))
      const node = new THREE.Mesh(
        new THREE.SphereGeometry((index === TIMELINE.length - 1 ? 0.18 : 0.135) * (immersive ? 1.28 : 1), 28, 28),
        new THREE.MeshPhysicalMaterial({
          color: event.color,
          emissive: new THREE.Color(event.color),
          emissiveIntensity: index === TIMELINE.length - 1 ? 2.6 : 1.55,
          roughness: 0.14,
          clearcoat: 1,
        }),
      )
      node.position.copy(point)
      node.userData.phase = index * 0.9
      node.userData.baseScale = 1
      node.userData.timelineIndex = index
      nodeMeshes.push(node)
      universe.add(node)

      const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowMap,
          color: event.color,
          transparent: true,
          opacity: 0.5,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )
      halo.position.copy(point)
      halo.scale.setScalar(immersive ? 1.25 : 0.82)
      halo.userData.phase = index * 0.9
      halo.userData.baseScale = immersive ? 1.25 : 0.82
      universe.add(halo)
    })

    const flowParticles: THREE.Mesh[] = []
    const flowGeometry = new THREE.SphereGeometry(immersive ? 0.036 : 0.028, 10, 10)
    const flowCount = immersive ? 26 : 16
    for (let index = 0; index < flowCount; index += 1) {
      const particle = new THREE.Mesh(
        flowGeometry,
        new THREE.MeshBasicMaterial({
          color: index % 2 ? 0x7dfff2 : 0x7fa4ff,
          transparent: true,
          opacity: 0.8,
          blending: THREE.AdditiveBlending,
        }),
      )
      particle.userData.offset = index / flowCount
      universe.add(particle)
      flowParticles.push(particle)
    }

    const random = seededRandom(20260913)
    const starCount = immersive ? 1200 : 460
    const starPositions = new Float32Array(starCount * 3)
    for (let index = 0; index < starCount; index += 1) {
      const radius = 2.8 + random() * (immersive ? 13 : 7.2)
      const theta = random() * Math.PI * 2
      const phi = Math.acos(2 * random() - 1)
      starPositions[index * 3] = radius * Math.sin(phi) * Math.cos(theta)
      starPositions[index * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
      starPositions[index * 3 + 2] = radius * Math.cos(phi)
    }
    const starsGeometry = new THREE.BufferGeometry()
    starsGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
    const stars = new THREE.Points(
      starsGeometry,
      new THREE.PointsMaterial({
        color: 0xb2dcff,
        size: immersive ? 0.036 : 0.025,
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )
    scene.add(stars)

    const dustCount = immersive ? 760 : 260
    const dustPositions = new Float32Array(dustCount * 3)
    const dustColors = new Float32Array(dustCount * 3)
    for (let index = 0; index < dustCount; index += 1) {
      const arm = index % 3
      const radius = 0.8 + random() * 5.8
      const angle = radius * 1.65 + arm * ((Math.PI * 2) / 3) + (random() - 0.5) * 0.5
      dustPositions[index * 3] = Math.cos(angle) * radius
      dustPositions[index * 3 + 1] = (random() - 0.5) * (0.25 + radius * 0.09)
      dustPositions[index * 3 + 2] = Math.sin(angle) * radius
      const color = new THREE.Color(arm === 0 ? 0x5ee7de : arm === 1 ? 0x6c79ff : 0x3bb8ef)
      dustColors[index * 3] = color.r
      dustColors[index * 3 + 1] = color.g
      dustColors[index * 3 + 2] = color.b
    }
    const dustGeometry = new THREE.BufferGeometry()
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3))
    dustGeometry.setAttribute('color', new THREE.BufferAttribute(dustColors, 3))
    const dust = new THREE.Points(
      dustGeometry,
      new THREE.PointsMaterial({
        size: immersive ? 0.045 : 0.03,
        vertexColors: true,
        transparent: true,
        opacity: 0.46,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )
    dust.rotation.x = 0.56
    scene.add(dust)

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2(2, 2)
    let hoveredIndex = -1
    const pointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      const hit = raycaster.intersectObjects(nodeMeshes, false)[0]
      const nextIndex = hit ? Number(hit.object.userData.timelineIndex) : -1
      if (nextIndex !== hoveredIndex) {
        hoveredIndex = nextIndex
        canvas.classList.toggle('is-pointing', hoveredIndex >= 0)
        if (hoveredIndex >= 0) selectEvent(hoveredIndex)
      }
    }
    canvas.addEventListener('pointermove', pointerMove)

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
        core.rotation.y = elapsed * 0.34
        core.rotation.x = elapsed * 0.15
        shell.rotation.y = -elapsed * 0.16
        shell.rotation.z = elapsed * 0.1
        stars.rotation.y = elapsed * 0.006
        dust.rotation.y = -elapsed * 0.018
        universe.children.forEach((child) => {
          if (typeof child.userData.spin === 'number') child.rotation.z += child.userData.spin * 0.01
          if (typeof child.userData.phase === 'number') {
            const scale = 1 + Math.sin(elapsed * 2 + child.userData.phase) * 0.13
            child.scale.setScalar((child.userData.baseScale ?? 1) * scale)
          }
        })
      }
      flowParticles.forEach((particle) => {
        const progress = (particle.userData.offset + elapsed * 0.055) % 1
        particle.position.copy(curve.getPoint(progress))
        const pulse = 0.72 + Math.sin(progress * Math.PI) * 0.55
        particle.scale.setScalar(pulse)
      })
      nodeMeshes.forEach((node, index) => {
        const material = node.material as THREE.MeshPhysicalMaterial
        material.emissiveIntensity = index === activeIndexRef.current ? 3.4 : index === hoveredIndex ? 2.8 : 1.55
      })
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
      canvas.removeEventListener('pointermove', pointerMove)
      canvas.removeEventListener('webglcontextlost', contextLost)
      controls.dispose()
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Sprite)) return
        if ('geometry' in object && object.geometry) object.geometry.dispose()
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        materials.forEach((material) => material.dispose())
      })
      glowMap.dispose()
      renderer.dispose()
    }
  }, [immersive, onUnavailable])

  const active = TIMELINE[activeIndex]
  return (
    <div className={`time-galaxy ${immersive ? 'immersive' : ''} ${ready ? 'is-ready' : ''}`}>
      <canvas ref={canvasRef} aria-label="可拖拽旋转和滚轮缩放的动态观点时间宇宙" />
      <div className="galaxy-scan" aria-hidden="true" />
      <div className="galaxy-event-card" aria-live="polite">
        <span>{active.year} / SIGNAL {String(activeIndex + 1).padStart(2, '0')}</span>
        <strong>{active.label}</strong>
        <small>{active.detail}</small>
        <b>{active.value}</b>
      </div>
      <div className="galaxy-labels" aria-label="时间节点">
        {TIMELINE.map((event, index) => (
          <button
            className={activeIndex === index ? 'active' : ''}
            key={event.year}
            type="button"
            onClick={() => selectEvent(index)}
          >
            <strong>{event.year}</strong>
            <small>{event.label}</small>
          </button>
        ))}
      </div>
      {!ready && <span className="galaxy-loading">正在点亮时间宇宙…</span>}
    </div>
  )
}
