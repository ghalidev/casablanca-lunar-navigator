import { ThreeCanvas } from '@remotion/three'
import { useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { continueRender, delayRender, staticFile } from 'remotion'
import * as THREE from 'three'

/*
 * The real Moon (NASA SVS CGI Moon Kit: LROC colour, LOLA relief) lit by a Sun placed behind it.
 * Everything is a pure function of the props, so every frame renders the same way twice.
 * `sunDir` points from the Moon's centre to the Sun; the Moon has radius 1.
 */

export type MoonShot = {
  cam: [number, number, number]
  look: [number, number, number]
  fov: number
  sunDir: [number, number, number]
  /** Rotation of the globe (radians): [x, y, z]. x = PI puts the south pole on top. */
  rot: [number, number, number]
  /** 0..1 global exposure (fade from black). */
  exposure: number
  /** Camera roll: the up vector. */
  up?: [number, number, number]
}

/**
 * Direction (from the Moon's centre) of a Sun sitting `e` radians above the upper limb as seen from a camera
 * in the y-z plane at `cam`. e < 0 hides it behind the limb.
 */
export function sunAtLimb(cam: [number, number, number], e: number): [number, number, number] {
  const [, cy, cz] = cam
  const r = Math.hypot(cy, cz)
  const a = Math.asin(1 / r)
  const phiD = Math.atan2(-cy, -cz)
  const c1 = phiD + a
  const c2 = phiD - a
  const up1 = Math.sin(c1) > Math.sin(c2)
  const phi = up1 ? c1 + e : c2 - e
  return [0, Math.sin(phi), Math.cos(phi)]
}

/** Camera forward along the upper-limb tangent, tilted up by `tilt` radians (so the limb sits below centre). */
export function lookAlongLimb(cam: [number, number, number], tilt: number): [number, number, number] {
  const d = sunAtLimb(cam, tilt)
  return [cam[0] + d[0], cam[1] + d[1], cam[2] + d[2]]
}

const SUN_DIST = 40

// A fixed star field on a big sphere (deterministic).
const STARS = (() => {
  const n = 2200
  const a = new Float32Array(n * 3)
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < n; i++) {
    const u = rnd() * 2 - 1
    const t = rnd() * Math.PI * 2
    const r = 60 + rnd() * 20
    const q = Math.sqrt(1 - u * u)
    a.set([r * q * Math.cos(t), r * u, r * q * Math.sin(t)], i * 3)
  }
  return a
})()

function useTexture(url: string, color: boolean) {
  const [tex, setTex] = useState<THREE.Texture | null>(null)
  const [handle] = useState(() => delayRender(`texture ${url}`))
  useEffect(() => {
    new THREE.TextureLoader().load(
      url,
      (t) => {
        if (color) t.colorSpace = THREE.SRGBColorSpace
        t.anisotropy = 8
        setTex(t)
        // Let React swap the material and three draw it before Remotion captures the frame.
        continueRender(handle)
      },
      undefined,
      (err) => {
        console.error('TEXTURE FAILED', url, String(err))
        continueRender(handle)
      },
    )
  }, [url, color, handle])
  return tex
}

function glowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(0.08, 'rgba(255,246,225,0.95)')
  grd.addColorStop(0.22, 'rgba(255,196,110,0.35)')
  grd.addColorStop(0.5, 'rgba(255,150,60,0.08)')
  grd.addColorStop(1, 'rgba(255,140,40,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 256, 256)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function Rig({ shot }: { shot: MoonShot }) {
  const { camera } = useThree()
  useLayoutEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    cam.position.set(...shot.cam)
    cam.fov = shot.fov
    cam.near = 0.01
    cam.far = 200
    cam.up.set(...(shot.up ?? [0, 1, 0]))
    cam.lookAt(...shot.look)
    cam.updateProjectionMatrix()
  }, [camera, shot])
  return null
}

function Scene({ shot, color, height }: { shot: MoonShot; color: THREE.Texture | null; height: THREE.Texture | null }) {
  const glow = useMemo(glowTexture, [])
  const s = new THREE.Vector3(...shot.sunDir).normalize()
  const sunPos = s.clone().multiplyScalar(SUN_DIST)
  return (
    <>
      <Rig shot={shot} />
      <ambientLight intensity={0.3 * shot.exposure} color="#9fb4ff" />
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[STARS, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.16} sizeAttenuation color="#ffffff" transparent opacity={0.85 * shot.exposure} depthWrite={false} />
      </points>
      <directionalLight position={sunPos.toArray()} intensity={4.2 * shot.exposure} color="#fff4e2" />
      <mesh rotation={shot.rot}>
        <sphereGeometry args={[1, 256, 256]} />
        {color && height ? (
          <meshStandardMaterial map={color} bumpMap={height} bumpScale={6} roughness={0.96} metalness={0} />
        ) : (
          <meshStandardMaterial color="#777" />
        )}
      </mesh>
      {/* The Sun: a white core and a wide warm halo, hidden by the Moon when behind it (depth test). */}
      <sprite position={sunPos.toArray()} scale={[2.6, 2.6, 1]} renderOrder={2}>
        <spriteMaterial map={glow} blending={THREE.AdditiveBlending} depthWrite={false} transparent opacity={shot.exposure} toneMapped={false} />
      </sprite>
      <sprite position={sunPos.toArray()} scale={[16, 16, 1]} renderOrder={3}>
        <spriteMaterial map={glow} blending={THREE.AdditiveBlending} depthWrite={false} transparent opacity={0.55 * shot.exposure} toneMapped={false} />
      </sprite>
    </>
  )
}

export function MoonCanvas({ shot, width, height }: { shot: MoonShot; width: number; height: number }) {
  // Loaded in the DOM tree (Remotion waits for these), then handed to the 3D scene.
  const color = useTexture(staticFile('moon/color_4k.jpg'), true)
  const relief = useTexture(staticFile('moon/globe_height.png'), false)
  if (!color || !relief) return <div style={{ width, height, background: '#000' }} />
  return (
    <ThreeCanvas width={width} height={height} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }} style={{ background: '#000' }} camera={{ fov: shot.fov, position: shot.cam }}>
      <Scene shot={shot} color={color} height={relief} />
    </ThreeCanvas>
  )
}

/**
 * Where the Sun lands on screen, and how much of it shows past the limb (0 = hidden, 1 = clear),
 * computed with the same camera, so DOM flares sit exactly on the 3D Sun.
 */
export function sunOnScreen(shot: MoonShot, width: number, height: number) {
  const cam = new THREE.PerspectiveCamera(shot.fov, width / height, 0.01, 200)
  cam.position.set(...shot.cam)
  cam.up.set(...(shot.up ?? [0, 1, 0]))
  cam.lookAt(...shot.look)
  cam.updateMatrixWorld()
  cam.updateProjectionMatrix()
  const sun = new THREE.Vector3(...shot.sunDir).normalize().multiplyScalar(SUN_DIST)
  const p = sun.clone().project(cam)
  // Closest approach of the camera->Sun ray to the Moon's centre, minus the radius: > 0 means clear.
  const o = cam.position.clone()
  const d = sun.clone().sub(o).normalize()
  const tc = -o.dot(d)
  const closest = tc > 0 ? o.clone().add(d.clone().multiplyScalar(tc)).length() : o.length()
  const margin = closest - 1
  const angular = margin / Math.max(tc, 0.01) // radians past the limb, as seen from the camera
  const sunRad = (0.6 / SUN_DIST) // core sprite half-size, in the same units
  const clear = Math.max(0, Math.min(1, (angular + sunRad) / (2 * sunRad)))
  return { x: ((p.x + 1) / 2) * width, y: ((1 - p.y) / 2) * height, clear, inFront: p.z < 1 }
}
