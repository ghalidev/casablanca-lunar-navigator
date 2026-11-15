import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { Html, PerformanceMonitor } from '@react-three/drei'
import { Bloom, EffectComposer, Noise, ToneMapping, Vignette } from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode } from 'postprocessing'
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { injectReliefDetail } from './reliefDetail'
import { heat, heatText } from './charts'
import { EXAG, MOON_R_KM, localFrame, siteXZ, skyDir, type PoleTerrain } from './terrain'
import type { GhostLander, Site } from '../data/types'
import { buildFlight, clonePose, resumeFlight, sampleFlight, sampleFlightAt, turnUp, type Flight, type Pose } from '../film/camera'
import { camBus } from '../film/bus'
import { Lander, Orbiter, StarField } from './SpaceExtras'

/*
 * One continuous world in kilometres. The Moon's centre is at (0, -R, 0) with its south
 * pole pointing up (+y), so the real LOLA pole tile sits on top of the globe at the origin.
 * The camera flies between "shots"; the globe fades out and the relief fades in as it dives.
 */

export type Shot =
  | { kind: 'globe' }
  | { kind: 'pole' }
  | { kind: 'surface'; x: number; z: number; lookAz: number }
  | { kind: 'crash'; x: number; z: number; viewAz: number }

/** Ghost landers for the crash-test chapter: Monte Carlo sample around a target, at a given hour. */
export interface Crash {
  x: number
  z: number
  landers: GhostLander[]
  hour: { readonly current: number }
  /** performance.now() when the drop started (landers fall in, staggered). */
  dropAt: number
}

export interface Light {
  /** Sun direction in world space, already scaled for the relief exaggeration. */
  dir: { x: number; y: number; z: number }
}

const CENTER = new THREE.Vector3(0, -MOON_R_KM, 0)

function Globe({ fade, spin }: { fade: React.MutableRefObject<number>; spin: boolean }) {
  const [color, height] = useLoader(THREE.TextureLoader, ['/moon/color_4k.jpg', '/moon/globe_height.png'])
  // Configure once per texture. Setting needsUpdate on every render re-uploaded the 4K map
  // to the GPU each time the shot changed: a ~200 ms freeze at the start of every flight.
  useMemo(() => {
    color.colorSpace = THREE.SRGBColorSpace
    color.anisotropy = 8
    // Wrap horizontally so filtering blends across the 180° meridian (no visible seam).
    for (const t of [color, height]) {
      t.wrapS = THREE.RepeatWrapping
      t.needsUpdate = true
    }
  }, [color, height])
  const mat = useRef<THREE.MeshStandardMaterial>(null)
  const turn = useRef<THREE.Group>(null)
  const angle = useRef(0)
  useFrame((_, dt) => {
    // Alive when idle: one full turn about the polar axis every ~3 minutes on the opening shot.
    // Elsewhere it eases back to rest so the globe lines up with the pole relief it fades into.
    if (spin) angle.current += Math.min(dt, 0.1) * 0.035
    else {
      const wrapped = Math.atan2(Math.sin(angle.current), Math.cos(angle.current))
      angle.current = wrapped * Math.exp(-Math.min(dt, 0.1) * 2.5)
    }
    if (turn.current) turn.current.rotation.y = angle.current
    if (mat.current) {
      mat.current.opacity = fade.current
      mat.current.visible = fade.current > 0.01
    }
  })
  return (
    // Outer group puts 0° longitude at -z and 90° E at +x; inner flips the south pole up.
    <group position={CENTER} rotation={[0, Math.PI / 2, 0]}>
      <group ref={turn}>
      <mesh rotation={[Math.PI, 0, 0]}>
        <sphereGeometry args={[MOON_R_KM, 256, 128]} />
        <meshStandardMaterial ref={mat} map={color} displacementMap={height} displacementScale={19.38 * 2} displacementBias={-8.88 * 2} roughness={1} metalness={0} transparent />
      </mesh>
      </group>
    </group>
  )
}

function Relief({ terrain, fade }: { terrain: PoleTerrain; fade: React.MutableRefObject<number> }) {
  const [tex, normal] = useLoader(THREE.TextureLoader, ['/moon/pole_color.jpg', '/moon/pole_normal.png'])
  useMemo(() => {
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
    normal.anisotropy = 8
  }, [tex, normal])
  const geo = useMemo(() => {
    const size = terrain.meta.radius_km * 2
    const seg = reliefSeg()
    const g = new THREE.PlaneGeometry(size, size, seg, seg)
    g.rotateX(-Math.PI / 2)
    const p = g.attributes.position as THREE.BufferAttribute
    const R = terrain.meta.radius_km
    const col = new Float32Array(p.count * 3)
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i)
      const r = Math.hypot(x, z)
      // Outside the tile's circle, fall away smoothly so the disc edge reads as a horizon.
      const y = r <= R ? terrain.surfaceY(x, z) : terrain.surfaceY((x / r) * R, (z / r) * R) - (r - R) * 0.6
      p.setY(i, y)
      // Fade the outer ring to black so the tile has no hard edge.
      const k = 1 - THREE.MathUtils.smoothstep(r, R * 0.72, R * 0.98)
      col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = k
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    g.computeVertexNormals()
    return g
  }, [terrain])
  const mat = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(() => {
    if (mat.current) {
      mat.current.opacity = 1 - fade.current
      mat.current.visible = fade.current < 0.99
    }
  })
  return (
    <mesh geometry={geo} receiveShadow castShadow>
      <meshStandardMaterial ref={mat} map={tex} normalMap={normal} normalScale={new THREE.Vector2(1.8, 1.8)} vertexColors roughness={0.95} metalness={0} transparent color="#ffffff" onBeforeCompile={injectReliefDetail} customProgramCacheKey={() => 'relief-detail'} />
    </mesh>
  )
}

const reliefSeg = () => (window.innerWidth < 700 ? 280 : 420)

/** Height of the rendered relief mesh (not the raw DEM), so markers sit exactly on it. */
function meshY(terrain: PoleTerrain, x: number, z: number) {
  const R = terrain.meta.radius_km
  const cell = (2 * R) / reliefSeg()
  const gx = (x + R) / cell, gz = (z + R) / cell
  const x0 = Math.floor(gx), z0 = Math.floor(gz)
  const tx = gx - x0, tz = gz - z0
  const at = (i: number, j: number) => terrain.surfaceY(i * cell - R, j * cell - R)
  return (at(x0, z0) * (1 - tx) + at(x0 + 1, z0) * tx) * (1 - tz) + (at(x0, z0 + 1) * (1 - tx) + at(x0 + 1, z0 + 1) * tx) * tz
}

// Landers are drawn 3x their real size (~4 m) so they read from the drone; positions are data.
const GHOST_SIZE_KM = 0.012
const ALIVE = new THREE.Color('#ffb547')
const DEAD = new THREE.Color('#3a3c42')

let _lander: THREE.BufferGeometry | null = null
/** A small lander: octagonal body, flat solar wing, three legs. Built once, shared by every ghost. */
function landerGeometry() {
  if (_lander) return _lander
  const u = GHOST_SIZE_KM
  const body = new THREE.CylinderGeometry(u * 0.32, u * 0.4, u * 0.5, 8)
  body.translate(0, u * 0.1, 0)
  const wing = new THREE.BoxGeometry(u * 1.1, u * 0.05, u * 0.42)
  wing.translate(0, u * 0.42, 0)
  const parts = [body, wing]
  for (let i = 0; i < 3; i++) {
    const leg = new THREE.CylinderGeometry(u * 0.03, u * 0.03, u * 0.55, 4)
    leg.rotateZ(0.5)
    leg.translate(u * 0.3, -u * 0.12, 0)
    leg.rotateY((i * Math.PI * 2) / 3)
    parts.push(leg)
  }
  _lander = mergeGeometries(parts.map((g) => g.toNonIndexed()))!
  _lander.computeVertexNormals()
  return _lander
}

function CrashGhosts({ terrain, crash }: { terrain: PoleTerrain; crash: Crash }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  // Resting place of each ghost on the real relief (km), computed once per sample.
  const rest = useMemo(() => {
    const { north, east } = localFrame(crash.x, crash.z)
    return crash.landers.map((l) => {
      const x = crash.x + (east.x * l.dx_m + north.x * l.dy_m) / 1000
      const z = crash.z + (east.z * l.dx_m + north.z * l.dy_m) / 1000
      return new THREE.Vector3(x, meshY(terrain, x, z) + GHOST_SIZE_KM * 0.45, z)
    })
  }, [crash.x, crash.z, crash.landers, terrain])
  useFrame(() => {
    const m = mesh.current
    if (!m) return
    const since = (performance.now() - crash.dropAt) / 1000
    const hour = crash.hour.current
    crash.landers.forEach((l, i) => {
      // Staggered drop over ~2.4 s, from 1.2 km up.
      const t = Math.min(1, Math.max(0, (since - (i % 50) * 0.04 - Math.floor(i / 50) * 0.02) / 0.9))
      const e = 1 - Math.pow(1 - t, 3)
      dummy.position.copy(rest[i]).setY(rest[i].y + (1 - e) * 1.2)
      dummy.rotation.set(0, ((l.yaw_deg ?? 0) * Math.PI) / 180, 0)
      dummy.rotateX((Math.min(l.tilt_deg, 100) * Math.PI) / 180)
      const dead = l.died_at_h != null && l.died_at_h <= hour
      dummy.scale.setScalar(t === 0 ? 0.0001 : dead ? 0.8 : 1)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
      m.setColorAt(i, dead ? DEAD : ALIVE)
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  })
  const y0 = meshY(terrain, crash.x, crash.z)
  return (
    <>
      <GroundGrid terrain={terrain} x={crash.x} z={crash.z} />
      <instancedMesh key={crash.landers.length} ref={mesh} args={[undefined, undefined, crash.landers.length]} frustumCulled={false}>
        <primitive object={landerGeometry()} attach="geometry" />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      {/* Target and 100 / 250 / 400 m rings, draped flat at the target's height. */}
      <group position={[crash.x, y0 + 0.004, crash.z]}>
        {[0.1, 0.25, 0.4].map((r) => (
          <mesh key={r} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[r - 0.0025, r + 0.0025, 160]} />
            <meshBasicMaterial color={r === 0.1 ? '#ffb547' : '#ecebe6'} transparent opacity={r === 0.1 ? 0.9 : 0.35} depthWrite={false} toneMapped={false} />
          </mesh>
        ))}
        <mesh position={[0, 0.03, 0]}>
          <coneGeometry args={[0.008, 0.024, 4]} />
          <meshBasicMaterial color="#ffb547" toneMapped={false} />
        </mesh>
      </group>
    </>
  )
}

let _grid: THREE.Texture | null = null
function gridTexture() {
  if (_grid) return _grid
  // One tile = 100 m; a thin line on two edges, so tiles repeat into a grid.
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = 'rgba(236,235,230,0.55)'
  g.fillRect(0, 0, 128, 2)
  g.fillRect(0, 0, 2, 128)
  _grid = new THREE.CanvasTexture(c)
  _grid.wrapS = _grid.wrapT = THREE.RepeatWrapping
  _grid.anisotropy = 8
  return _grid
}

/** A 100 m grid draped on the real relief around the target: shows the ground and the scale. */
function GroundGrid({ terrain, x, z }: { terrain: PoleTerrain; x: number; z: number }) {
  const SIZE = 1.6 // km
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(SIZE, SIZE, 64, 64)
    g.rotateX(-Math.PI / 2)
    // Align grid lines with local east / north (the axes of the landing offsets).
    g.rotateY(-Math.atan2(x, -z))
    const p = g.attributes.position as THREE.BufferAttribute
    const col = new Float32Array(p.count * 4)
    for (let i = 0; i < p.count; i++) {
      const wx = x + p.getX(i), wz = z + p.getZ(i)
      p.setY(i, meshY(terrain, wx, wz) + 0.003)
      // Fade out toward the edge so the grid has no hard border.
      const a = 1 - THREE.MathUtils.smoothstep(Math.hypot(p.getX(i), p.getZ(i)), SIZE * 0.25, SIZE * 0.5)
      col.set([1, 1, 1, a], i * 4)
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 4))
    g.translate(x, 0, z)
    return g
  }, [terrain, x, z])
  const tex = useMemo(() => {
    const t = gridTexture().clone()
    t.repeat.set(SIZE / 0.1, SIZE / 0.1)
    t.needsUpdate = true
    return t
  }, [])
  return (
    <mesh geometry={geo} renderOrder={1}>
      <meshBasicMaterial map={tex} vertexColors transparent opacity={0.5} depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

/** A number that glides to its new value instead of jumping. */
function Count({ value }: { value: number }) {
  const [v, setV] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    const start = performance.now()
    const a = from.current
    let raf = 0
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 420)
      const e = 1 - Math.pow(1 - k, 3)
      const x = a + (value - a) * e
      from.current = x
      setV(x)
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <>{Math.round(v)}</>
}

/** One bar on the pole. Height and colour glide toward the survival of the picked day, no jumps. */
function Beacon({ tone, show }: { tone: number | undefined; show: boolean }) {
  const mesh = useRef<THREE.Mesh>(null)
  const mat = useRef<THREE.MeshBasicMaterial>(null)
  const h = useRef(12)
  const target = useMemo(() => new THREE.Color(), [])
  useFrame((_, dt) => {
    const m = mesh.current
    if (!m || !mat.current) return
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 8)
    h.current += ((tone != null ? 3 + 9 * tone : 12) - h.current) * k
    const r = tone != null ? 0.3 : 0.18
    m.scale.set(r, h.current, r)
    m.position.y = h.current / 2
    target.set(tone != null ? heat(tone) : '#ffb547')
    mat.current.color.lerp(target, k)
  })
  return (
    <mesh ref={mesh} visible={show}>
      <cylinderGeometry args={[1, 1, 1, 10]} />
      <meshBasicMaterial ref={mat} color="#ffb547" transparent opacity={0.92} />
    </mesh>
  )
}

const PIN_Y = 15
const PIN_GAP_PX = 4

function SiteMarkers({ sites, terrain, onPick, active, show, badges, tones }: { sites: Site[]; terrain: PoleTerrain; onPick: (s: Site) => void; active: string | null; show: boolean; badges?: Record<string, string>; tones?: Record<string, number> }) {
  // Labels of neighbouring regions overlap on screen. Every frame, in screen space, the lower label stays and
  // any label it covers is lifted just above it; the lift is converted back to world units and eased.
  const anchors = useRef<Record<string, THREE.Group | null>>({})
  const labels = useRef<Record<string, HTMLButtonElement | null>>({})
  const lift = useRef<Record<string, number>>({})
  const { camera, size } = useThree()
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), sc: new THREE.Vector3(), up: new THREE.Vector3(), right: new THREE.Vector3() }), [])
  const shift = useRef<Record<string, number>>({})
  useFrame((_, dt) => {
    if (!show) return
    const cam = camera as THREE.PerspectiveCamera
    const items: { id: string; sx: number; sy: number; sy0: number; dx?: number; w: number; h: number; wpp: number; g: THREE.Group }[] = []
    for (const st of sites) {
      const g = anchors.current[st.id]
      const el = labels.current[st.id]
      if (!g?.parent || !el) continue
      const v = g.parent.localToWorld(tmp.v.set(0, PIN_Y, 0))
      const dist = v.distanceTo(cam.position)
      v.project(cam)
      if (v.z > 1) continue
      g.parent.getWorldScale(tmp.sc)
      const wpp = (2 * dist * Math.tan(((cam.fov ?? 40) * Math.PI) / 360)) / size.height / (tmp.sc.y || 1)
      const sy0 = ((1 - v.y) / 2) * size.height
      items.push({ id: st.id, sx: ((v.x + 1) / 2) * size.width, sy: sy0, sy0, w: el.offsetWidth, h: el.offsetHeight, wpp, g })
    }
    // Keep every label on screen and below the top bar: a label at the edge still points at its own bar.
    const top = 84
    for (const it of items) {
      const x0 = it.sx
      it.sx = Math.min(Math.max(it.sx, it.w / 2 + 8), size.width - it.w / 2 - 8)
      it.dx = it.sx - x0
      it.sy = Math.max(it.sy, top + it.h / 2)
    }
    items.sort((a, b) => b.sy - a.sy)
    const placed: { sx: number; y: number; w: number; h: number }[] = []
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 10)
    // Lift along the camera's own up axis, so a pixel of lift is a pixel on screen even when looking down.
    const up = tmp.up.set(0, 1, 0).applyQuaternion(cam.quaternion)
    const right = tmp.right.set(1, 0, 0).applyQuaternion(cam.quaternion)
    const settle = (it: (typeof items)[number], dir: -1 | 1) => {
      let y = it.sy
      for (let pass = 0; pass <= items.length; pass++) {
        const hit = placed.find((p) => Math.abs(it.sx - p.sx) < (it.w + p.w) / 2 + PIN_GAP_PX && Math.abs(y - p.y) < (it.h + p.h) / 2 + PIN_GAP_PX)
        if (!hit) break
        y = hit.y + dir * ((it.h + hit.h) / 2 + PIN_GAP_PX)
      }
      return y
    }
    for (const it of items) {
      let y = settle(it, -1)
      // No room above (top of the screen): stack it below its neighbour instead.
      if (y - it.h / 2 < top && y !== it.sy) y = settle(it, 1)
      placed.push({ sx: it.sx, y, w: it.w, h: it.h })
      const want = (it.sy - y + (it.sy0 - it.sy)) * it.wpp
      const wantX = (it.dx ?? 0) * it.wpp
      const curX = shift.current[it.id] ?? wantX
      shift.current[it.id] = curX + (wantX - curX) * k
      const cur = lift.current[it.id] ?? want
      lift.current[it.id] = cur + (want - cur) * k
      const L = lift.current[it.id]
      const X = shift.current[it.id]
      it.g.position.set(up.x * L + right.x * X, PIN_Y + up.y * L + right.y * X, up.z * L + right.z * X)
    }
  })
  return (
    <>
      {sites.map((s) => {
        const { x, z } = siteXZ(s.lat, s.lon)
        const y = terrain.surfaceY(x, z)
        const t = tones?.[s.id]
        return (
          <group key={s.id} position={[x, y, z]}>
            <Beacon tone={t} show={show} />
            {show && (
              <group ref={(g) => { anchors.current[s.id] = g }} position={[0, PIN_Y, 0]}>
              <Html center zIndexRange={[20, 0]}>
                <button ref={(b) => { labels.current[s.id] = b }} className={'pin' + (active === s.id ? ' sel' : '') + (active === s.id || badges?.[s.id] ? ' on' : '') + (badges && !badges[s.id] ? ' dim' : '')} onClick={() => onPick(s)}>
                  {t != null ? (
                    <span className="pin-p num" style={{ color: heatText(t) }}>
                      <Count value={t * 100} />%
                    </span>
                  ) : (
                    <span className="pin-dot" />
                  )}
                  <span className="pin-name">{s.name}</span>
                  {badges?.[s.id] && <span className="pin-badge num">{badges[s.id]}</span>}
                </button>
              </Html>
              </group>
            )}
          </group>
        )
      })}
    </>
  )
}

function AthenaMark({ terrain, at }: { terrain: PoleTerrain; at: { lat: number; lon: number } }) {
  const { x, z } = siteXZ(at.lat, at.lon)
  const y = terrain.surfaceY(x, z)
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 3, 6]} />
        <meshBasicMaterial color="#ffb547" />
      </mesh>
      <Html position={[0, 3.4, 0]} center zIndexRange={[20, 0]}>
        <div className="pin fail">
          <span className="pin-dot" />
          Athena, 6 March 2025
        </div>
      </Html>
    </group>
  )
}

function FillLight({ light }: { light: React.MutableRefObject<Light> }) {
  const dl = useRef<THREE.DirectionalLight>(null)
  useFrame(() => {
    const d = light.current.dir
    // Opposite the Sun, slightly from above: a soft bounce that reveals shadowed relief.
    dl.current?.position.set(-d.x * 500, 260, -d.z * 500)
  })
  return <directionalLight ref={dl} intensity={0.45} color="#b4b6bc" />
}

function SunRig({ light, label = false }: { light: React.MutableRefObject<Light>; label?: boolean }) {
  const dl = useRef<THREE.DirectionalLight>(null)
  const sun = useRef<THREE.Group>(null)
  const { camera, gl } = useThree()
  // The 4096² shadow map is re-rendered only when the Sun or the focus has moved enough to show.
  const last = useMemo(() => ({ dir: new THREE.Vector3(), focus: new THREE.Vector3(Infinity, 0, 0) }), [])
  useFrame(() => {
    const d = light.current.dir
    const v = new THREE.Vector3(d.x, d.y, d.z).normalize()
    if (dl.current) {
      // Shadow frustum follows the camera's focus so detail stays sharp where you look.
      const focus = new THREE.Vector3()
      camera.getWorldDirection(focus)
      const target = camera.position.clone().addScaledVector(focus, 60)
      target.y = Math.min(target.y, 0)
      dl.current.target.position.copy(target)
      dl.current.target.updateMatrixWorld()
      dl.current.position.copy(target.clone().addScaledVector(v, 900))
      if (v.dot(last.dir) < 0.99999 || target.distanceTo(last.focus) > 8) {
        last.dir.copy(v)
        last.focus.copy(target)
        gl.shadowMap.needsUpdate = true
      }
    }
    if (sun.current) sun.current.position.copy(camera.position.clone().addScaledVector(v, 6000))
  })
  return (
    <>
      <directionalLight
        ref={dl}
        intensity={4.2}
        color="#fff8ef"
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-camera-left={-260}
        shadow-camera-right={260}
        shadow-camera-top={260}
        shadow-camera-bottom={-260}
        shadow-camera-near={1}
        shadow-camera-far={2400}
        shadow-bias={-0.0004}
        shadow-normalBias={0.6}
      />
      <group ref={sun}>
        <mesh>
          <sphereGeometry args={[28, 24, 24]} />
          <meshBasicMaterial color={[26, 23, 18]} toneMapped={false} />
        </mesh>
        <sprite scale={[260, 260, 1]}>
          <spriteMaterial map={glowTexture()} color="#ffb547" transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </sprite>
        {label && (
          <Html position={[0, -150, 0]} center zIndexRange={[20, 0]}>
            <span className="sky-tag sun">Sun</span>
          </Html>
        )}
      </group>
    </>
  )
}

let _glow: THREE.Texture | null = null
function glowTexture() {
  if (_glow) return _glow
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grd.addColorStop(0, 'rgba(255,255,255,0.9)')
  grd.addColorStop(0.15, 'rgba(255,200,120,0.45)')
  grd.addColorStop(1, 'rgba(255,160,60,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 128, 128)
  _glow = new THREE.CanvasTexture(c)
  return _glow
}

function Earth({ dir, label = false }: { dir: React.MutableRefObject<{ x: number; y: number; z: number }>; label?: boolean }) {
  const g = useRef<THREE.Group>(null)
  const { camera } = useThree()
  useFrame(() => {
    const d = dir.current
    if (g.current) g.current.position.copy(camera.position.clone().add(new THREE.Vector3(d.x, d.y, d.z).normalize().multiplyScalar(5000)))
    g.current?.lookAt(camera.position)
  })
  return (
    <group ref={g}>
      {/* About 1.9° wide from the Moon, like the real Earth. */}
      <mesh>
        <sphereGeometry args={[83, 32, 32]} />
        <meshBasicMaterial color="#9fb4cc" toneMapped={false} />
      </mesh>
      <mesh position={[-14, 18, 70]}>
        <circleGeometry args={[34, 24]} />
        <meshBasicMaterial color="#e9f3ff" transparent opacity={0.35} toneMapped={false} />
      </mesh>
      {label && (
        <Html position={[0, -150, 0]} center zIndexRange={[20, 0]}>
          <span className="sky-tag">Earth</span>
        </Html>
      )}
    </group>
  )
}

/** Relief coordinates of a site by id (for the lander model). */
function siteAt(sites: Site[], id: string) {
  const s = sites.find((x) => x.id === id)
  return s ? siteXZ(s.lat, s.lon) : null
}

function poseFor(shot: Shot, terrain: PoleTerrain) {
  if (shot.kind === 'globe') {
    // Portrait screens: the whole Moon centred in the top half, above the headline.
    if (window.innerWidth / window.innerHeight < 1) return { pos: CENTER.clone().add(new THREE.Vector3(0, 3800, -15500)), look: CENTER.clone().add(new THREE.Vector3(0, 3400, 0)), up: new THREE.Vector3(0, -1, 0), fade: 1 }
    // The familiar near side (0° longitude faces -z), north up, tilted ~20° so the south
    // pole shows at the bottom. Moon right of centre so the headline has room.
    return { pos: CENTER.clone().add(new THREE.Vector3(0, 2100, -5800)), look: CENTER.clone().add(new THREE.Vector3(-1150, 0, 0)), up: new THREE.Vector3(0, -1, 0), fade: 1 }
  }
  if (shot.kind === 'pole') {
    // Portrait screens: higher and further back, closer to top-down, so all nine regions fit the width.
    if (window.innerWidth / window.innerHeight < 1) return { pos: new THREE.Vector3(407, 560, -93), look: new THREE.Vector3(-18, -40, -85), up: new THREE.Vector3(0, 1, 0), fade: 0 }
    return { pos: new THREE.Vector3(40, 165, 245), look: new THREE.Vector3(10, -25, -25), up: new THREE.Vector3(0, 1, 0), fade: 0 }
  }
  if (shot.kind === 'crash') {
    // Drone shot over the landing ellipse, about 1.4 km out and 1 km up.
    const { x, z, viewAz } = shot
    const d = skyDir(x, z, viewAz, 0)
    const y = meshY(terrain, x, z)
    // Portrait screens: pull back and aim short of the target, so the ellipse sits in the top half above the text.
    const tall = window.innerWidth / window.innerHeight < 1
    const back = tall ? 2.4 : 1.35
    const pos = new THREE.Vector3(x - d.x * back, y + (tall ? 2.0 : 1.0), z - d.z * back)
    pos.y = Math.max(pos.y, terrain.surfaceY(pos.x, pos.z) + 0.4)
    const ahead = tall ? -0.55 : 0.12
    return { pos, look: new THREE.Vector3(x + d.x * ahead, y, z + d.z * ahead), up: new THREE.Vector3(0, 1, 0), fade: 0 }
  }
  const { x, z, lookAz } = shot
  const y = terrain.surfaceY(x, z)
  const d = skyDir(x, z, lookAz, 0)
  const back = new THREE.Vector3(-d.x, 0, -d.z).normalize()
  // Drone height above the site, looking toward the Sun's side of the sky. Portrait screens are narrow:
  // higher and further back, looking down a little more, so the site and its skyline both fit.
  const tall = window.innerWidth / window.innerHeight < 1
  const pos = new THREE.Vector3(x, y + (tall ? 16 : 9), z).addScaledVector(back, tall ? 44 : 26)
  pos.y = Math.max(pos.y, terrain.surfaceY(pos.x, pos.z) + 6)
  const look = new THREE.Vector3(x + d.x * 90, y - (tall ? 7 : 2), z + d.z * 90)
  return { pos, look, up: new THREE.Vector3(0, 1, 0), fade: 0 }
}

/**
 * Compile every shader and upload every texture once, at load. Without this the relief's
 * material and its 4K maps are first touched mid-flight and freeze a frame for ~200 ms.
 */
function Warmup() {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      scene.traverse((o) => {
        const m = (o as THREE.Mesh).material
        for (const mat of Array.isArray(m) ? m : m ? [m] : []) {
          for (const v of Object.values(mat)) if (v instanceof THREE.Texture) gl.initTexture(v)
        }
      })
      gl.compileAsync(scene, camera).catch(() => undefined)
    })
    return () => cancelAnimationFrame(id)
  }, [gl, scene, camera])
  return null
}

/** Shots with the same key are one place: small target changes are followed, not flown. */
const shotKey = (s: Shot) => (s.kind === 'globe' || s.kind === 'pole' ? s.kind : `${s.kind}:${s.x.toFixed(2)}:${s.z.toFixed(2)}`)

/** Scroll scrubbing: -1..1 toward the previous / next shot. Written by the page, read every frame. */
export interface Scrub {
  current: number
}

function CameraDirector({ shot, terrain, fade, scrub, prev, next }: { shot: Shot; terrain: PoleTerrain; fade: React.MutableRefObject<number>; scrub: Scrub; prev: Shot | null; next: Shot | null }) {
  const { camera, pointer, size } = useThree()
  const viewOff = useRef({ x: 0, y: 0 })
  const sp = useRef({ x: 0, y: 0 })
  const target = useMemo(() => poseFor(shot, terrain), [shot, terrain])
  const key = shotKey(shot)
  const reduce = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const pose = useRef<Pose | null>(null)
  const flight = useRef<Flight | null>(null)
  const arrived = useRef(0)
  const lastKey = useRef<string | null>(null)
  const drift = useMemo(() => new THREE.Vector3(), [])
  const view = useMemo(() => new THREE.Vector3(), [])
  // Paths toward the neighbouring shots, sampled directly by the scroll position.
  const toward = useMemo(
    () => ({ next: next ? buildFlight(target, poseFor(next, terrain), 0) : null, prev: prev ? buildFlight(target, poseFor(prev, terrain), 0) : null }),
    [target, next, prev, terrain],
  )
  const shown = useRef(0)
  const lastToward = useRef(toward)

  // Layout effect, not effect: it must run before the next rendered frame, or that frame samples the NEW
  // shot's scroll path with the OLD scroll value and the camera visibly jumps for one frame.
  useLayoutEffect(() => {
    const now = performance.now() / 1000
    if (!pose.current || reduce) {
      // First shot (or reduced motion): cut, no flight. Deep links open in place.
      pose.current = clonePose(target)
      flight.current = null
      arrived.current = now
      shown.current = 0
      scrub.current = 0
      camBus.setFlying(false)
    } else if (key !== lastKey.current) {
      // Continuity: if a scroll gesture was already carrying the camera toward this very shot, finish that
      // same path from where it is. Otherwise fly from wherever the camera is now.
      const u = shown.current
      const path = u > 0 ? lastToward.current.next : u < 0 ? lastToward.current.prev : null
      // The page leaves the scroll value in place on commit so it is read here, then cleared.
      shown.current = 0
      scrub.current = 0
      if (pose.current.pos.distanceTo(target.pos) < 0.05) {
        arrived.current = now
        camBus.setFlying(false)
      } else if (path && path.to.pos.distanceTo(target.pos) < 0.05) {
        flight.current = resumeFlight(path, Math.abs(u), now)
        camBus.setFlying(true)
      } else {
        flight.current = buildFlight(pose.current, target, now)
        camBus.setFlying(true)
      }
    }
    lastKey.current = key
    lastToward.current = toward
  }, [key, target, reduce, toward, scrub])

  useFrame((state, dt) => {
    if (import.meta.env.DEV) Object.assign(window as object, { __cam: camera, __gl: state.gl })
    const now = performance.now() / 1000
    const p = pose.current
    if (!p) return
    if (flight.current) {
      const s = sampleFlight(flight.current, now)
      p.pos.copy(s.pos)
      p.look.copy(s.look)
      p.up.copy(s.up)
      if (s.done) {
        flight.current = null
        arrived.current = now
        camBus.setFlying(false)
      }
    } else {
      // Scroll scrubbing, smoothed so wheel notches glide.
      shown.current += (scrub.current - shown.current) * (1 - Math.exp(-dt * 12))
      if (Math.abs(shown.current) < 1e-4) shown.current = 0
      const f = shown.current > 0 ? toward.next : shown.current < 0 ? toward.prev : null
      if (f) {
        const s = sampleFlightAt(f, Math.abs(shown.current))
        p.pos.copy(s.pos)
        p.look.copy(s.look)
        p.up.copy(s.up)
      } else {
        // Follow mode: the ground shot turns slowly with the Sun.
        const k = reduce ? 1 : 1 - Math.exp(-dt * 1.2)
        p.pos.lerp(target.pos, k)
        p.look.lerp(target.look, k)
        turnUp(p.up, target.up, k, view.subVectors(p.look, p.pos))
      }
    }
    // Idle drift, faded in after landing. Pointer parallax only on overview shots.
    const t = state.clock.getElapsedTime()
    const settle = flight.current || reduce || shown.current ? 0 : Math.min(1, (now - arrived.current) / 2)
    const amp = shot.kind === 'globe' ? 140 : shot.kind === 'pole' ? 10 : shot.kind === 'crash' ? 0.03 : 0.25
    // The pointer is eased (it arrives in steps), so the parallax glides instead of stuttering.
    const ease = reduce ? 1 : 1 - Math.exp(-dt * 3.2)
    sp.current.x += (pointer.x - sp.current.x) * ease
    sp.current.y += (pointer.y - sp.current.y) * ease
    const px = shot.kind === 'globe' || shot.kind === 'pole' ? sp.current.x : 0
    const py = shot.kind === 'globe' || shot.kind === 'pole' ? sp.current.y : 0
    drift.set(Math.sin(t * 0.11) * 0.6 + px, Math.sin(t * 0.15) * 0.4 + py * 0.5, 0).multiplyScalar(amp * settle)
    camera.position.copy(p.pos).add(drift)
    // Never dip under the relief.
    if (camera.position.length() < 600) {
      const floor = terrain.surfaceY(camera.position.x, camera.position.z) + (shot.kind === 'crash' ? 0.25 : 1.5)
      if (camera.position.y < floor) camera.position.y = floor
    }
    camera.up.copy(p.up)
    camera.lookAt(p.look)
    // Frame each shot into the free part of the screen: the text sits left and the bottom bar sits low,
    // so the subject is shifted right and up instead of hiding behind them. Eased, never a jump.
    {
      const mobile = size.width < 760
      const narrow = size.width < 1100
      const framed = shot.kind === 'pole' || shot.kind === 'crash' || shot.kind === 'surface'
      const wantY = framed ? (mobile ? (shot.kind === 'surface' ? 0.3 : 0.17) : narrow ? 0.12 : 0.09) : 0
      const wantX = framed && !narrow ? -0.07 : 0
      const k2 = reduce ? 1 : 1 - Math.exp(-dt * 3)
      viewOff.current.x += (wantX - viewOff.current.x) * k2
      viewOff.current.y += (wantY - viewOff.current.y) * k2
      const cam2 = camera as THREE.PerspectiveCamera
      if (Math.abs(viewOff.current.x) + Math.abs(viewOff.current.y) > 1e-4) {
        cam2.setViewOffset(size.width, size.height, viewOff.current.x * size.width, viewOff.current.y * size.height, size.width, size.height)
      } else if (cam2.view?.enabled) cam2.clearViewOffset()
    }
    // Globe visible far away, relief visible close in.
    const dist = camera.position.length()
    const want = THREE.MathUtils.smoothstep(dist, 700, 1900)
    fade.current += (want - fade.current) * Math.min(1, dt * 4)
    const cam = camera as THREE.PerspectiveCamera
    const near = dist > 1500 ? 50 : shot.kind === 'crash' ? 0.01 : 0.05
    if (cam.near !== near) {
      cam.near = near
      cam.far = 30000
      cam.updateProjectionMatrix()
    }
  })
  return null
}

function MissionSceneImpl({
  terrain,
  sites,
  shot,
  light,
  earthDir,
  onPick,
  activeSite,
  showPins,
  badges,
  tones,
  athena,
  crash,
  scrub,
  skyLabels = false,
  prev,
  next,
}: {
  terrain: PoleTerrain
  sites: Site[]
  shot: Shot
  light: React.MutableRefObject<Light>
  earthDir: React.MutableRefObject<{ x: number; y: number; z: number }>
  onPick: (s: Site) => void
  activeSite: string | null
  showPins: boolean
  badges?: Record<string, string>
  tones?: Record<string, number>
  athena: { lat: number; lon: number } | null
  crash: Crash | null
  scrub: Scrub
  /** Name the Sun and the Earth in the sky (the Planner's live view). */
  skyLabels?: boolean
  prev: Shot | null
  next: Shot | null
}) {
  const fade = useRef(1)
  const [dpr, setDpr] = useState(() => Math.min(1.5, window.devicePixelRatio))
  useEffect(() => {
    document.body.style.overscrollBehavior = 'none'
    return () => {
      document.body.style.overscrollBehavior = ''
    }
  }, [])
  return (
    <Canvas
      shadows="percentage"
      dpr={dpr}
      gl={{ antialias: false, powerPreference: 'high-performance', logarithmicDepthBuffer: true, preserveDrawingBuffer: window.location.search.includes('clean') }}
      camera={{ fov: 42, position: [2600, -MOON_R_KM - 1500, 4300], near: 1, far: 30000 }}
      onCreated={({ gl }) => {
        gl.shadowMap.autoUpdate = false
        gl.setClearColor('#03050b')
        // Tone mapping happens in the post chain (ToneMapping effect), not in the renderer.
        gl.toneMapping = THREE.NoToneMapping
        gl.toneMappingExposure = 1.15
      }}
    >
      {/* Faint fill: sunlight reflected by Earth onto the night side. */}
      {/* Fill: sunlight reflected by Earth and nearby slopes, so shadows keep their detail. */}
      <hemisphereLight args={['#8e9198', '#16171a', 0.75]} />
      <FillLight light={light} />
      <SunRig light={light} label={skyLabels} />
      <Earth dir={earthDir} label={skyLabels} />
      <StarField fade={fade} />
      <Globe fade={fade} spin={shot.kind === 'globe'} />
      <Orbiter visible={shot.kind === 'globe' || shot.kind === 'pole'} />
      <Lander terrain={terrain} at={shot.kind === 'surface' && activeSite ? siteAt(sites, activeSite) : null} />
      <Relief terrain={terrain} fade={fade} />
      <SiteMarkers sites={sites} terrain={terrain} onPick={onPick} active={activeSite} show={showPins} badges={badges} tones={tones} />
      {athena && <AthenaMark terrain={terrain} at={athena} />}
      {crash && crash.landers.length > 0 && <CrashGhosts terrain={terrain} crash={crash} />}
      <CameraDirector shot={shot} terrain={terrain} fade={fade} scrub={scrub} prev={prev} next={next} />
      <Warmup />
      {/* Film grade: bloom catches only the HDR Sun, then ACES, light grain and vignette. */}
      <EffectComposer multisampling={2}>
        <Bloom mipmapBlur luminanceThreshold={4} luminanceSmoothing={0.3} intensity={1.1} radius={0.7} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.22} />
        <Vignette offset={0.32} darkness={0.62} />
      </EffectComposer>
      {/* Resolution changes reallocate every buffer (a visible hitch): step down once if the GPU struggles, never back up. */}
      <PerformanceMonitor onDecline={() => setDpr(1)} flipflops={1} onFallback={() => setDpr(1)} />
    </Canvas>
  )
}

export { EXAG }

/** Memoised: the page re-renders up to 10× a second for its readouts; the 3D scene only when its inputs change. */
export const MissionScene = memo(MissionSceneImpl)
