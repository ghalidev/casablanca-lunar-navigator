import { useFrame, useThree } from '@react-three/fiber'
import { Html, useGLTF } from '@react-three/drei'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import * as THREE from 'three'
import { MOON_R_KM, type PoleTerrain } from './terrain'

/*
 * Life in the scene: a twinkling star field, NASA spacecraft models and their info cards.
 * Models: NASA 3D Resources (https://github.com/nasa/NASA-3D-Resources), public domain.
 * Spacecraft are drawn at a constant on-screen size (NOT to scale) so they stay visible
 * from 6,000 km out to a few km; every card says so.
 */

const CENTER = new THREE.Vector3(0, -MOON_R_KM, 0)

// ---------------------------------------------------------------------------------------------
// Stars: points on a sphere that follows the camera (no parallax, like real stars), twinkling.

const STAR_VERT = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vTw;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
    float speed = 0.35 + aPhase * 1.4;
    vTw = 0.72 + 0.28 * sin(uTime * speed + aPhase * 37.0);
    vColor = aColor;
    gl_PointSize = aSize * uPixelRatio;
  }
`
const STAR_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vTw;
  #include <common>
  #include <logdepthbuf_pars_fragment>
  void main() {
    #include <logdepthbuf_fragment>
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    a *= a;
    gl_FragColor = vec4(vColor * (0.6 + vTw), a * vTw);
  }
`

function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

export function StarField({ fade }: { fade: React.MutableRefObject<number> }) {
  const group = useRef<THREE.Group>(null)
  const { camera, gl } = useThree()
  const { geo, mat } = useMemo(() => {
    const rnd = seeded(20260514)
    const R = 18000
    const N_FIELD = 5200
    const N_BAND = 3600
    const N = N_FIELD + N_BAND
    const pos = new Float32Array(N * 3)
    const col = new Float32Array(N * 3)
    const size = new Float32Array(N)
    const phase = new Float32Array(N)
    const palette = [
      [1, 1, 1],
      [0.82, 0.88, 1],
      [1, 0.93, 0.82],
      [0.7, 0.8, 1],
    ]
    // Milky Way band: stars clustered around a tilted great circle.
    const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.9, 0.3, 0.4))
    const v = new THREE.Vector3()
    for (let i = 0; i < N; i++) {
      if (i < N_FIELD) {
        const u = rnd() * 2 - 1
        const t = rnd() * Math.PI * 2
        const r = Math.sqrt(1 - u * u)
        v.set(r * Math.cos(t), u, r * Math.sin(t))
      } else {
        const t = rnd() * Math.PI * 2
        const g = (rnd() + rnd() + rnd() - 1.5) * 0.16 // ~gaussian spread off the band
        v.set(Math.cos(t), g, Math.sin(t)).normalize().applyQuaternion(tilt)
      }
      v.multiplyScalar(R)
      pos.set([v.x, v.y, v.z], i * 3)
      const bright = rnd()
      const c = palette[Math.floor(rnd() * palette.length)]
      const k = i < N_FIELD ? 0.55 + bright * 0.55 : 0.35 + bright * 0.35
      col.set([c[0] * k, c[1] * k, c[2] * k], i * 3)
      size[i] = i < N_FIELD ? (bright > 0.985 ? 3.6 : bright > 0.9 ? 2.4 : 1.5) : 1.2 + bright * 0.8
      phase[i] = rnd()
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1))
    const m = new THREE.ShaderMaterial({
      vertexShader: STAR_VERT,
      fragmentShader: STAR_FRAG,
      uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    return { geo: g, mat: m }
  }, [])
  useFrame((state) => {
    mat.uniforms.uTime.value = state.clock.getElapsedTime()
    mat.uniforms.uPixelRatio.value = gl.getPixelRatio()
    // Slightly dimmer once the camera is down on the relief, where the sunlit ground dominates.
    mat.opacity = 1
    if (group.current) {
      group.current.position.copy(camera.position)
      group.current.visible = true
    }
    void fade
  })
  return (
    <group ref={group}>
      <points geometry={geo} material={mat} frustumCulled={false} renderOrder={-10} />
    </group>
  )
}

// ---------------------------------------------------------------------------------------------
// Info card attached to a 3D object: a small label that opens on click.

function InfoTag({ title, kicker, children, open, onToggle }: { title: string; kicker: string; children: React.ReactNode; open: boolean; onToggle: () => void }) {
  // The card is a real DOM sheet outside the 3D canvas, so it never inherits the object's scale
  // and stays readable on any screen. The small tag stays attached to the object.
  useEffect(() => {
    if (!open) return
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onToggle()
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [open, onToggle])
  return (
    <div className={'sx-tag' + (open ? ' open' : '')}>
      <button className="sx-tag-btn" onClick={onToggle} aria-expanded={open}>
        <span className="sx-dot" />
        {title}
      </button>
      {open &&
        createPortal(
          <div className="sx-card" role="dialog" aria-label={title}>
            <button className="sx-close" onClick={onToggle} aria-label="Close">×</button>
            <p className="sx-kicker">{kicker}</p>
            <h3 className="sx-title">{title}</h3>
            {children}
            <p className="sx-credit">3D model: NASA 3D Resources. Shown enlarged, not to scale.</p>
          </div>,
          document.body,
        )}
    </div>
  )
}

/** Scale an object so it keeps a constant size on screen (fraction of its camera distance). */
function screenScale(obj: THREE.Object3D, camera: THREE.Camera, nativeSize: number, fraction: number) {
  const d = camera.position.distanceTo(obj.getWorldPosition(_w))
  obj.scale.setScalar((d * fraction) / nativeSize)
}
const _w = new THREE.Vector3()
const _a = new THREE.Vector3()
const _b = new THREE.Vector3()

/** True when the Moon's sphere blocks the line of sight from the camera to p. */
function behindMoon(camera: THREE.Camera, p: THREE.Vector3) {
  _a.subVectors(p, camera.position)
  const len = _a.length()
  _a.divideScalar(len)
  _b.subVectors(CENTER, camera.position)
  const t = _b.dot(_a)
  if (t <= 0 || t >= len) return false
  return _b.lengthSq() - t * t < (MOON_R_KM - 5) ** 2
}

function showLabel(el: HTMLDivElement | null, on: boolean) {
  if (el) el.style.display = on ? '' : 'none'
}

// ---------------------------------------------------------------------------------------------
// LRO: the orbiter whose laser altimeter (LOLA) measured the terrain in this app.

export function Orbiter({ visible }: { visible: boolean }) {
  const { scene } = useGLTF('/models/lro.glb')
  const model = useMemo(() => scene.clone(true), [scene])
  const holder = useRef<THREE.Group>(null)
  const [open, setOpen] = useState(false)
  const { camera } = useThree()
  const next = useMemo(() => new THREE.Vector3(), [])
  const label = useRef<HTMLDivElement>(null)
  useFrame((state) => {
    const g = holder.current
    if (!g) return
    g.visible = visible
    if (!visible) return showLabel(label.current, false)
    // Polar orbit about 150 km up (drawn), one pass every 70 s, passing over the south pole.
    const t = state.clock.getElapsedTime()
    const r = MOON_R_KM + 150
    const plane = 0.55 + t * 0.004
    const at = (a: number, out: THREE.Vector3) =>
      out.set(Math.sin(a) * r * Math.cos(plane), Math.cos(a) * r, Math.sin(a) * r * Math.sin(plane)).add(CENTER)
    const a = (t / 70) * Math.PI * 2 + 2.2
    at(a, g.position)
    at(a + 0.01, next)
    g.lookAt(next)
    screenScale(g, camera, 33, 0.055)
    showLabel(label.current, !behindMoon(camera, g.position))
  })
  return (
    <group ref={holder}>
      <primitive object={model} />
      {visible && <Html center position={[0, 24, 0]} zIndexRange={[20, 0]} style={{ pointerEvents: 'auto' }}>
        <div ref={label}><InfoTag title="LRO" kicker="Lunar Reconnaissance Orbiter · NASA" open={open} onToggle={() => setOpen((o) => !o)}>
          <p>Orbiting the Moon since 2009. Its laser altimeter, LOLA, measured the height of the lunar surface: the terrain and every skyline in LASTLIGHT come from it.</p>
        </InfoTag></div>
      </Html>}
    </group>
  )
}

// ---------------------------------------------------------------------------------------------
// Apollo Lunar Module at the chosen site; click to launch its ascent stage.

const LIFT_S = 7
const RESET_S = 10

export function Lander({ terrain, at }: { terrain: PoleTerrain; at: { x: number; z: number } | null }) {
  const { scene } = useGLTF('/models/apollo-lm.glb')
  const { camera } = useThree()
  const [open, setOpen] = useState(false)
  const launchAt = useRef<number | null>(null)
  const holder = useRef<THREE.Group>(null)
  const flame = useRef<THREE.Mesh>(null)
  // Split the model: parts above the deck are the ascent stage (the rocket that flew home).
  const { root, ascent } = useMemo(() => {
    const r = scene.clone(true)
    r.updateMatrixWorld(true)
    const asc = new THREE.Group()
    const box = new THREE.Box3()
    const c = new THREE.Vector3()
    const meshes: THREE.Mesh[] = []
    r.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh)
    })
    r.add(asc)
    for (const m of meshes) {
      box.setFromObject(m).getCenter(c)
      if (c.y > 2.75) asc.attach(m)
    }
    return { root: r, ascent: asc }
  }, [scene])
  const flameMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 2.6, 0.8), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), [])
  useFrame((state) => {
    const g = holder.current
    if (!g) return
    g.visible = !!at
    if (!at) return
    g.position.set(at.x, terrain.surfaceY(at.x, at.z), at.z)
    screenScale(g, camera, 5.2, 0.075)
    const now = state.clock.getElapsedTime()
    const t = launchAt.current == null ? -1 : now - launchAt.current
    if (t > RESET_S) launchAt.current = null
    const lifting = t >= 0 && t <= LIFT_S
    ascent.position.y = lifting ? 0.9 * t * t : 0
    ascent.visible = !(t > LIFT_S && t <= RESET_S)
    if (flame.current) {
      flame.current.visible = lifting
      flame.current.position.y = ascent.position.y + 2.55
      const f = 0.85 + Math.sin(now * 40) * 0.12 + Math.sin(now * 23) * 0.08
      flame.current.scale.set(f, f * (1.2 + Math.min(1, t) * 0.8), f)
    }
  })
  return (
    <group ref={holder}>
      <primitive object={root} />
      <mesh ref={flame} rotation={[Math.PI, 0, 0]} visible={false} material={flameMat}>
        <coneGeometry args={[0.55, 2.2, 20, 1, true]} />
      </mesh>
      {at && <Html center position={[0, 7, 0]} zIndexRange={[20, 0]} style={{ pointerEvents: 'auto' }}>
        <InfoTag title="Lander" kicker="Apollo Lunar Module · NASA" open={open} onToggle={() => setOpen((o) => !o)}>
          <p>Six Apollo Lunar Modules landed on the Moon between 1969 and 1972. The top half, the ascent stage, was a rocket that lifted the crew back to orbit.</p>
          <button
            className="sx-launch"
            onClick={(e) => {
              e.stopPropagation()
              window.dispatchEvent(new CustomEvent('lastlight:launch'))
            }}
          >
            Launch the ascent stage
          </button>
        </InfoTag>
      </Html>}
      <LaunchListener onLaunch={(t) => (launchAt.current = t)} />
    </group>
  )
}

/** Bridges the DOM button to the scene clock (the button has no access to useFrame's clock). */
function LaunchListener({ onLaunch }: { onLaunch: (t: number) => void }) {
  const clock = useThree((s) => s.clock)
  useEffect(() => {
    const h = () => onLaunch(clock.getElapsedTime())
    window.addEventListener('lastlight:launch', h)
    // ?launch=<seconds> fires the liftoff automatically (video capture, demos).
    const auto = Number(new URLSearchParams(window.location.search).get('launch'))
    const id = Number.isFinite(auto) && auto > 0 ? window.setTimeout(() => window.dispatchEvent(new CustomEvent('lastlight:launch')), auto * 1000) : 0
    return () => {
      window.removeEventListener('lastlight:launch', h)
      window.clearTimeout(id)
    }
  }, [clock, onLaunch])
  return null
}

// ---------------------------------------------------------------------------------------------
// Saturn V, drifting past the Moon in the opening shot (illustrative).

export function Rocket({ visible }: { visible: boolean }) {
  const label = useRef<HTMLDivElement>(null)
  const { scene } = useGLTF('/models/saturn-v.glb')
  const model = useMemo(() => scene.clone(true), [scene])
  const holder = useRef<THREE.Group>(null)
  const flame = useRef<THREE.Mesh>(null)
  const [open, setOpen] = useState(false)
  const { camera } = useThree()
  const flameMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 2.2, 0.9), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), [])
  useFrame((state) => {
    const g = holder.current
    if (!g) return
    g.visible = visible
    if (!visible) return
    const t = state.clock.getElapsedTime()
    // Placed in the camera's view (upper left, above the headline) and drifting slowly up and
    // to the right, nose first. Illustrative: Saturn V flew Apollo; Artemis flies SLS.
    const D = 2600
    const halfH = D * Math.tan(THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov / 2))
    const halfW = halfH * (camera as THREE.PerspectiveCamera).aspect
    _q.copy(camera.quaternion)
    const drift = (t * 0.012) % 1
    _fwd.set(0, 0, -1).applyQuaternion(_q)
    _right.set(1, 0, 0).applyQuaternion(_q)
    _up.set(0, 1, 0).applyQuaternion(_q)
    g.position.copy(camera.position).addScaledVector(_fwd, D)
      .addScaledVector(_right, halfW * (-0.62 + drift * 0.18))
      .addScaledVector(_up, halfH * (0.38 + drift * 0.12))
    g.quaternion.copy(_q).multiply(_tilt.setFromAxisAngle(_z, -0.95 + Math.sin(t * 0.3) * 0.02)).multiply(_roll.setFromAxisAngle(_y, t * 0.25))
    screenScale(g, camera, 12.9, 0.16)
    if (flame.current) {
      const f = 0.9 + Math.sin(t * 31) * 0.1 + Math.sin(t * 17) * 0.06
      flame.current.scale.set(f, f * 1.3, f)
    }
  })
  return (
    <group ref={holder}>
      <primitive object={model} />
      <mesh ref={flame} position={[0, -1.6, 0.75]} rotation={[Math.PI, 0, 0]} material={flameMat}>
        <coneGeometry args={[0.55, 3, 20, 1, true]} />
      </mesh>
      {visible && <Html center position={[0, 14, 0.75]} zIndexRange={[20, 0]} style={{ pointerEvents: 'auto' }}>
        <div ref={label}><InfoTag title="Saturn V" kicker="Apollo Moon rocket · NASA" open={open} onToggle={() => setOpen((o) => !o)}>
          <p>110.6 m tall. It launched every crewed Apollo mission to the Moon. Artemis III will go back to the south pole with NASA’s Space Launch System.</p>
        </InfoTag></div>
      </Html>}
    </group>
  )
}

const _q = new THREE.Quaternion()
const _tilt = new THREE.Quaternion()
const _roll = new THREE.Quaternion()
const _fwd = new THREE.Vector3()
const _right = new THREE.Vector3()
const _up = new THREE.Vector3()
const _z = new THREE.Vector3(0, 0, 1)
const _y = new THREE.Vector3(0, 1, 0)

// No preload: these load after the Moon is on screen (MissionScene's late stage).
