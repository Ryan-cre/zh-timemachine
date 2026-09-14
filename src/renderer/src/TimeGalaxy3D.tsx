import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

// 研究数据星图：每个研究问题生成一张专属星图。
// 节点=观察时间段，颜色=该期主导立场（与2D堆叠图同配色），
// 大小=样本量；无样本年份渲染为暗星，对应“零样本如实留白”。
export type GalaxyPeriod = {
  label: string
  sampleCount: number
  dominantLabel: string
  dominantShare: number
  summary: string
}
export type GalaxyData = {
  question: string
  totalSamples: number
  periods: GalaxyPeriod[]
  colors: Record<string, string>
}

type TimeGalaxy3DProps = {
  immersive?: boolean
  onUnavailable: () => void
  data?: GalaxyData | null
  onSelectPeriod?: (index: number) => void
}

// 无研究数据时（首页概念区）使用的示意时间线，卡片明确标注非研究数据。
const FALLBACK = {
  question: '',
  totalSamples: 0,
  colors: {} as Record<string, string>,
  periods: [
    { label: '2020', sampleCount: 0, dominantLabel: '问题出现', dominantShare: 0, summary: '早期信号进入讨论场' },
    { label: '2022', sampleCount: 0, dominantLabel: '讨论扩散', dominantShare: 0, summary: '关键叙事开始聚集' },
    { label: '2024', sampleCount: 0, dominantLabel: '观点分化', dominantShare: 0, summary: '立场形成明显分叉' },
    { label: '2026', sampleCount: 0, dominantLabel: '共识重组', dominantShare: 0, summary: '新证据改变主流判断' },
  ],
}

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

export default function TimeGalaxy3D({ immersive = false, onUnavailable, data, onSelectPeriod }: TimeGalaxy3DProps) {
  const galaxy = data && data.periods.length ? data : FALLBACK
  const isLive = Boolean(data && data.periods.length)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)
  const [activeIndex, setActiveIndex] = useState(galaxy.periods.length - 1)
  const activeIndexRef = useRef(galaxy.periods.length - 1)
  const selectEvent = (index: number) => {
    activeIndexRef.current = index
    setActiveIndex(index)
  }
  // 切换研究后重置选中节点
  useEffect(() => {
    const last = galaxy.periods.length - 1
    activeIndexRef.current = last
    setActiveIndex(last)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [galaxy.question, galaxy.periods.length])

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

    const events = galaxy.periods
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
      new THREE.IcosahedronGeometry(immersive ? 0.44 : 0.36, 4),
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
        opacity: 0.08,
        blending: THREE.AdditiveBlending,
      }),
    )
    universe.add(shell)

    const glowMap = glowTexture()

    // 粒子球壳：斐波那契球面均匀撒点，构成“时间星核”的粒子化外观
    const particleShell = (() => {
      const COUNT = immersive ? 1800 : 1200
      const R = immersive ? 1.14 : 0.9
      const positions = new Float32Array(COUNT * 3)
      const colors = new Float32Array(COUNT * 3)
      const cA = new THREE.Color('#7df2e6')
      const cB = new THREE.Color('#6a8dff')
      const cC = new THREE.Color('#b9a7ff')
      const golden = Math.PI * (3 - Math.sqrt(5))
      for (let i = 0; i < COUNT; i += 1) {
        const y = 1 - (i / (COUNT - 1)) * 2
        const radius = Math.sqrt(1 - y * y)
        const theta = golden * i
        const jitter = 0.965 + ((i * 9301 + 49297) % 233) / 233 * 0.07
        const rr = R * jitter
        positions[i * 3] = Math.cos(theta) * radius * rr
        positions[i * 3 + 1] = y * rr
        positions[i * 3 + 2] = Math.sin(theta) * radius * rr
        const mix = (i * 9301 + 49297) % 233 / 233
        const c = mix < 0.55
          ? cA.clone().lerp(cB, mix / 0.55)
          : cB.clone().lerp(cC, (mix - 0.55) / 0.45)
        colors[i * 3] = c.r
        colors[i * 3 + 1] = c.g
        colors[i * 3 + 2] = c.b
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      const mat = new THREE.PointsMaterial({
        size: immersive ? 0.062 : 0.05,
        map: glowMap,
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      })
      const points = new THREE.Points(geo, mat)
      points.userData.spin = 0.06
      return points
    })()
    universe.add(particleShell)

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

    // 颜色：研究模式取主导立场的 2D 同配色；无数据/无立场用青色梯度
    const palette = ['#8178ff', '#5e9dff', '#42c6ef', '#64eadb']
    const eventColor = (event: GalaxyPeriod, index: number) => {
      if (isLive && event.sampleCount > 0) {
        const mapped = galaxy.colors[event.dominantLabel]
        if (mapped) return mapped
      }
      return palette[Math.min(index, palette.length - 1)]
    }
    // 大小：样本量驱动（平方根压缩，避免末年吞掉其他节点）
    const maxSamples = Math.max(1, ...events.map((e) => e.sampleCount))
    const nodeRadius = (event: GalaxyPeriod, index: number, last: boolean) => {
      const base = (last ? 0.17 : 0.125) * (immersive ? 1.28 : 1)
      if (!isLive) return base
      if (!event.sampleCount) return 0.062 * (immersive ? 1.28 : 1)
      return Math.max(0.09, 0.1 + Math.sqrt(event.sampleCount / maxSamples) * 0.12) * (immersive ? 1.28 : 1)
    }

    const nodeMeshes: THREE.Mesh[] = []
    events.forEach((event, index) => {
      const point = curve.getPoint(events.length === 1 ? 0.5 : index / (events.length - 1))
      const color = eventColor(event, index)
      const empty = isLive && event.sampleCount === 0
      const radius = nodeRadius(event, index, index === events.length - 1)
      const node = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 28, 28),
        new THREE.MeshPhysicalMaterial({
          color: empty ? 0x3a4566 : new THREE.Color(color),
          emissive: empty ? 0x141b30 : new THREE.Color(color),
          emissiveIntensity: empty ? 0.25 : index === events.length - 1 ? 2.6 : 1.55,
          roughness: 0.35,
          clearcoat: empty ? 0.2 : 1,
          transparent: empty,
          opacity: empty ? 0.55 : 1,
        }),
      )
      node.position.copy(point)
      node.userData.phase = index * 0.9
      node.userData.baseScale = 1
      node.userData.timelineIndex = index
      nodeMeshes.push(node)
      universe.add(node)

      if (!empty) {
        const halo = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: glowMap,
            color: new THREE.Color(color),
            transparent: true,
            opacity: 0.5,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
        )
        halo.position.copy(point)
        const haloScale = (immersive ? 1.25 : 0.82) * (radius / 0.135)
        halo.scale.setScalar(haloScale)
        halo.userData.phase = index * 0.9
        halo.userData.baseScale = haloScale
        universe.add(halo)
      }
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
    // 研究模式：点击节点跳到对应年份的证据视图
    const pointerClick = () => {
      if (hoveredIndex < 0) return
      selectEvent(hoveredIndex)
      onSelectPeriod?.(hoveredIndex)
    }
    canvas.addEventListener('pointermove', pointerMove)
    if (isLive) canvas.addEventListener('click', pointerClick)

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
        particleShell.rotation.y = elapsed * 0.07
        particleShell.rotation.x = Math.sin(elapsed * 0.12) * 0.12
        ;(particleShell.material as THREE.PointsMaterial).opacity =
          0.78 + Math.sin(elapsed * 1.1) * 0.17
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
        const empty = isLive && events[index].sampleCount === 0
        material.emissiveIntensity = empty
          ? 0.25
          : index === activeIndexRef.current
            ? 3.4
            : index === hoveredIndex
              ? 2.8
              : 1.55
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
      canvas.removeEventListener('click', pointerClick)
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
  }, [immersive, onUnavailable, isLive, galaxy, onSelectPeriod])

  const active = galaxy.periods[activeIndex]
  const activeEmpty = isLive && active && active.sampleCount === 0
  return (
    <div className={`time-galaxy ${immersive ? 'immersive' : ''} ${ready ? 'is-ready' : ''} ${isLive ? 'is-live' : ''}`}>
      <canvas ref={canvasRef} aria-label={isLive ? '每个节点代表一个时间段，点击可查看该期观点与证据' : '可拖拽旋转和滚轮缩放的动态观点时间宇宙'} />
      <div className="galaxy-scan" aria-hidden="true" />
      <div className="galaxy-event-card" aria-live="polite">
        <span>
          {active?.label} / SIGNAL {String(activeIndex + 1).padStart(2, '0')}
        </span>
        <strong>{activeEmpty ? '该年份无样本' : active?.dominantLabel}</strong>
        <small>
          {isLive
            ? activeEmpty
              ? '如实留白：未检索到可分析样本'
              : `${active?.sampleCount ?? 0} 条样本 · ${active?.summary ?? ''}`
            : active?.summary}
        </small>
        {!isLive && <b>示意</b>}
        {isLive && !activeEmpty && <b>{Math.round(active.dominantShare * 100)}%</b>}
      </div>
      <div className="galaxy-labels" aria-label="时间节点">
        {galaxy.periods.map((event, index) => (
          <button
            className={`${activeIndex === index ? 'active' : ''} ${isLive && event.sampleCount === 0 ? 'is-empty' : ''}`}
            key={`${event.label}-${index}`}
            type="button"
            onClick={() => {
              selectEvent(index)
              onSelectPeriod?.(index)
            }}
          >
            <strong>{event.label}</strong>
            <small>{isLive ? (event.sampleCount === 0 ? '无样本' : `${event.sampleCount}条`) : event.dominantLabel}</small>
          </button>
        ))}
      </div>
      {!ready && <span className="galaxy-loading">正在点亮时间宇宙…</span>}
    </div>
  )
}
