import * as THREE from 'three'
import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas, extend, useThree, useFrame } from '@react-three/fiber'
import { useGLTF, Environment, Lightformer, Text } from '@react-three/drei'
import { BallCollider, CuboidCollider, Physics, RigidBody, useRopeJoint, useSphericalJoint } from '@react-three/rapier'
import { MeshLineGeometry, MeshLineMaterial } from 'meshline'

extend({ MeshLineGeometry, MeshLineMaterial })
useGLTF.preload('./lanyard.glb')

// Card dimensions (portrait badge, in Three.js units)
const W  = 1.6    // full width
const H  = 2.25   // full height
const D  = 0.04   // thickness
const HW = W / 2  // half-width  = 0.8
const HH = H / 2  // half-height = 1.125
const HD = D / 2  // half-depth  = 0.02

export default function App() {
  return (
    <Canvas camera={{ position: [0, 0, 13], fov: 25 }}>
      <ambientLight intensity={Math.PI} />
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
      <Environment background blur={0.75}>
        <color attach="background" args={['black']} />
        <Lightformer intensity={2}  color="white" position={[0, -1, 5]}    rotation={[0, 0, Math.PI / 3]}     scale={[100, 0.1, 1]} />
        <Lightformer intensity={3}  color="white" position={[-1, -1, 1]}   rotation={[0, 0, Math.PI / 3]}     scale={[100, 0.1, 1]} />
        <Lightformer intensity={3}  color="white" position={[1, 1, 1]}     rotation={[0, 0, Math.PI / 3]}     scale={[100, 0.1, 1]} />
        <Lightformer intensity={10} color="white" position={[-10, 0, 14]}  rotation={[0, Math.PI / 2, Math.PI / 3]} scale={[100, 10, 1]} />
      </Environment>
    </Canvas>
  )
}

// Scene: resolves GLB (Suspense) BEFORE Physics mounts to avoid Suspense conflict
function Scene() {
  useGLTF('./lanyard.glb') // pre-resolve so Physics doesn't suspend
  return (
    <Physics interpolate gravity={[0, -40, 0]} timeStep={1 / 60}>
      <Band />
    </Physics>
  )
}

function Band({ maxSpeed = 50, minSpeed = 10 }) {
  const band  = useRef()
  const fixed = useRef()
  const j1    = useRef()
  const j2    = useRef()
  const j3    = useRef()
  const card  = useRef()

  const vec = useRef(new THREE.Vector3())
  const ang = useRef(new THREE.Vector3())
  const rot = useRef(new THREE.Vector3())
  const dir = useRef(new THREE.Vector3())

  const segmentProps = {
    type: 'dynamic',
    canSleep: true,
    colliders: false,
    angularDamping: 2,
    linearDamping: 2,
  }

  const { width, height } = useThree((state) => state.size)

  // catmullrom avoids NaN when control points start coincident
  const [curve] = useState(() => {
    const c = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.5, 1, 0),
      new THREE.Vector3(0, 2, 0),
      new THREE.Vector3(0, 4, 0),
    ])
    c.curveType = 'catmullrom'
    return c
  })

  const [dragged, drag] = useState(false)
  const [hovered, hover] = useState(false)

  useRopeJoint(fixed, j1, [[0, 0, 0], [0, 0, 0], 1])
  useRopeJoint(j1,    j2, [[0, 0, 0], [0, 0, 0], 1])
  useRopeJoint(j2,    j3, [[0, 0, 0], [0, 0, 0], 1])
  // joint at card-local [0, HH + 0.15, 0] = top of card + clip ring offset
  useSphericalJoint(j3, card, [[0, 0, 0], [0, HH + 0.15, 0]])

  useEffect(() => {
    document.body.style.cursor = hovered ? (dragged ? 'grabbing' : 'grab') : 'auto'
  }, [hovered, dragged])

  useFrame((state, delta) => {
    if (dragged) {
      vec.current.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera)
      dir.current.copy(vec.current).sub(state.camera.position).normalize()
      vec.current.add(dir.current.multiplyScalar(state.camera.position.length()))
      ;[card, j1, j2, j3, fixed].forEach((ref) => ref.current?.wakeUp())
      card.current?.setNextKinematicTranslation({
        x: vec.current.x - dragged.x,
        y: vec.current.y - dragged.y,
        z: vec.current.z - dragged.z,
      })
    }

    if (fixed.current) {
      ;[j1, j2].forEach((ref) => {
        if (!ref.current.lerped)
          ref.current.lerped = new THREE.Vector3().copy(ref.current.translation())
        const clampedDistance = Math.max(
          0.1,
          Math.min(1, ref.current.lerped.distanceTo(ref.current.translation()))
        )
        ref.current.lerped.lerp(
          ref.current.translation(),
          delta * (minSpeed + clampedDistance * (maxSpeed - minSpeed))
        )
      })

      curve.points[0].copy(j3.current.translation())
      curve.points[1].copy(j2.current.lerped)
      curve.points[2].copy(j1.current.lerped)
      curve.points[3].copy(fixed.current.translation())
      band.current.geometry.setPoints(curve.getPoints(32))

      ang.current.copy(card.current.angvel())
      rot.current.copy(card.current.rotation())
      card.current.setAngvel({
        x: ang.current.x,
        y: ang.current.y - rot.current.y * 0.25,
        z: ang.current.z,
      })
    }
  })

  return (
    <>
      <group position={[0, 4, 0]}>
        {/* Fixed anchor at top */}
        <RigidBody ref={fixed} {...segmentProps} type="fixed" />

        {/* Chain segments */}
        <RigidBody position={[0.5, 0, 0]} ref={j1} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1,   0, 0]} ref={j2} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1.5, 0, 0]} ref={j3} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>

        {/* Badge card */}
        <RigidBody
          ref={card}
          {...segmentProps}
          type={dragged ? 'kinematicPosition' : 'dynamic'}
          position={[2, 0, 0]}
        >
          {/* Physics collider — half-extents match card geometry */}
          <CuboidCollider args={[HW, HH, HD]} />

          {/* Visual group — pointer events on the whole badge */}
          <group
            onPointerOver={() => hover(true)}
            onPointerOut={() => hover(false)}
            onPointerUp={(e) => {
              e.target.releasePointerCapture(e.pointerId)
              drag(false)
            }}
            onPointerDown={(e) => {
              e.target.setPointerCapture(e.pointerId)
              drag(
                new THREE.Vector3()
                  .copy(e.point)
                  .sub(vec.current.copy(card.current.translation()))
              )
            }}
          >
            {/* ── Card body ── */}
            <mesh>
              <boxGeometry args={[W, H, D]} />
              <meshPhysicalMaterial
                color="#0d1b2a"
                clearcoat={1}
                clearcoatRoughness={0.1}
                roughness={0.25}
                metalness={0.1}
              />
            </mesh>

            {/* ── Front face decorations (z = HD + ε, facing camera) ── */}

            {/* Top accent band */}
            <mesh position={[0, 0.72, HD + 0.001]}>
              <planeGeometry args={[W, 0.65]} />
              <meshStandardMaterial color="#c0392b" />
            </mesh>

            {/* Thin highlight line below band */}
            <mesh position={[0, 0.395, HD + 0.001]}>
              <planeGeometry args={[W, 0.012]} />
              <meshStandardMaterial color="#e74c3c" />
            </mesh>

            {/* Event title */}
            <Text
              position={[0, 0.72, HD + 0.012]}
              fontSize={0.14}
              letterSpacing={0.06}
              color="#ffffff"
              anchorX="center"
              anchorY="middle"
            >
              DEV CONF 2025
            </Text>

            {/* Avatar ring outer */}
            <mesh position={[0, 0.1, HD + 0.001]}>
              <circleGeometry args={[0.29, 48]} />
              <meshStandardMaterial color="#c0392b" />
            </mesh>
            {/* Avatar ring inner (fill) */}
            <mesh position={[0, 0.1, HD + 0.002]}>
              <circleGeometry args={[0.26, 48]} />
              <meshStandardMaterial color="#1a2d45" />
            </mesh>

            {/* Name */}
            <Text
              position={[0, -0.38, HD + 0.012]}
              fontSize={0.155}
              color="#ffffff"
              anchorX="center"
              anchorY="middle"
            >
              Phuong Nguyen
            </Text>

            {/* Role */}
            <Text
              position={[0, -0.60, HD + 0.012]}
              fontSize={0.095}
              color="#e74c3c"
              anchorX="center"
              anchorY="middle"
            >
              Full Stack Developer
            </Text>

            {/* Bottom separator */}
            <mesh position={[0, -0.80, HD + 0.001]}>
              <planeGeometry args={[1.2, 0.01]} />
              <meshStandardMaterial color="#e74c3c" opacity={0.5} transparent />
            </mesh>

            {/* ID number */}
            <Text
              position={[0, -0.96, HD + 0.012]}
              fontSize={0.075}
              color="#4a6282"
              anchorX="center"
              anchorY="middle"
            >
              ID: 2025-0419
            </Text>

            {/* ── Clip hardware at top of card ── */}
            <ClipHardware />
          </group>
        </RigidBody>
      </group>

      {/* ── Lanyard rope — generated in code via physics + meshline ── */}
      <mesh ref={band} frustumCulled={false}>
        <meshLineGeometry />
        <meshLineMaterial color="#c0392b" resolution={[width, height]} lineWidth={1} />
      </mesh>
    </>
  )
}

function ClipHardware() {
  return (
    // Positioned at card top (HH = 1.125), ring center at HH + 0.15
    <group position={[0, HH, 0]}>
      {/* Rectangular clip bar */}
      <mesh>
        <boxGeometry args={[0.26, 0.09, 0.06]} />
        <meshPhysicalMaterial color="#aaaaaa" metalness={0.95} roughness={0.05} clearcoat={1} />
      </mesh>
      {/* Ring that the rope threads through */}
      <mesh position={[0, 0.18, 0]}>
        <torusGeometry args={[0.09, 0.022, 16, 32]} />
        <meshPhysicalMaterial color="#cccccc" metalness={0.95} roughness={0.04} clearcoat={1} />
      </mesh>
    </group>
  )
}
