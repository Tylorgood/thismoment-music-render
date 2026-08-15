import { Canvas, useFrame } from "@react-three/fiber";
import { SpotLight, Sparkles, Float, Environment } from "@react-three/drei";
import { Suspense, useRef, useMemo } from "react";
import * as THREE from "three";

/**
 * HeroStage3D
 * A cinematic dark stage with volumetric spotlights, floating dust,
 * a subtle rotating stage disc, and camera breathing. Renders as an
 * absolutely positioned canvas that fills its parent.
 */

function StageFloor() {
  const meshRef = useRef();
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.z = state.clock.getElapsedTime() * 0.04;
    }
  });
  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.2, 0]} receiveShadow>
      <circleGeometry args={[8, 96]} />
      <meshStandardMaterial
        color="#0a0a0a"
        metalness={0.85}
        roughness={0.35}
        envMapIntensity={0.6}
      />
    </mesh>
  );
}

function GoldOrb({ position = [0, 0, 0], scale = 1 }) {
  const ref = useRef();
  useFrame((state) => {
    if (ref.current) {
      const t = state.clock.getElapsedTime();
      ref.current.position.y = position[1] + Math.sin(t * 0.6) * 0.15;
      ref.current.rotation.y = t * 0.2;
    }
  });
  return (
    <mesh ref={ref} position={position} scale={scale} castShadow>
      <icosahedronGeometry args={[0.55, 2]} />
      <meshStandardMaterial
        color="#D4AF37"
        metalness={1}
        roughness={0.18}
        emissive="#D4AF37"
        emissiveIntensity={0.25}
      />
    </mesh>
  );
}

function SweepingSpotlight({ color = "#ffffff", speed = 0.4, phase = 0, distance = 15 }) {
  const lightRef = useRef();
  const targetRef = useRef();
  useFrame((state) => {
    const t = state.clock.getElapsedTime() * speed + phase;
    if (targetRef.current) {
      targetRef.current.position.x = Math.sin(t) * 4;
      targetRef.current.position.z = Math.cos(t * 0.7) * 3;
      targetRef.current.position.y = -2;
      targetRef.current.updateMatrixWorld();
    }
  });
  return (
    <>
      <SpotLight
        ref={lightRef}
        position={[0, 6, 0]}
        angle={0.35}
        penumbra={0.9}
        distance={distance}
        intensity={2.2}
        color={color}
        attenuation={5}
        anglePower={5}
        target={targetRef.current || undefined}
        castShadow
      />
      <object3D ref={targetRef} />
    </>
  );
}

function CameraRig() {
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    state.camera.position.x = Math.sin(t * 0.15) * 0.6;
    state.camera.position.y = 1 + Math.sin(t * 0.2) * 0.15;
    state.camera.lookAt(0, 0.2, 0);
  });
  return null;
}

function BackCurtain() {
  const geo = useMemo(() => new THREE.PlaneGeometry(30, 12, 40, 12), []);
  return (
    <mesh position={[0, 1, -6]} geometry={geo}>
      <meshStandardMaterial color="#0a0806" side={THREE.DoubleSide} roughness={1} />
    </mesh>
  );
}

export default function HeroStage3D() {
  return (
    <Canvas
      dpr={[1, 1.7]}
      shadows
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 1, 6], fov: 45 }}
      style={{ position: "absolute", inset: 0 }}
    >
      <color attach="background" args={["#050505"]} />
      <fog attach="fog" args={["#050505", 6, 18]} />
      <ambientLight intensity={0.06} />
      <hemisphereLight args={["#D4AF37", "#050505", 0.12]} />

      <Suspense fallback={null}>
        <Environment preset="night" />
        <BackCurtain />
        <StageFloor />

        <Float speed={1.2} rotationIntensity={0.4} floatIntensity={0.6}>
          <GoldOrb position={[-1.6, 0.4, -0.5]} scale={0.9} />
        </Float>
        <Float speed={1} rotationIntensity={0.6} floatIntensity={0.8}>
          <GoldOrb position={[1.9, -0.1, -1]} scale={0.7} />
        </Float>
        <Float speed={0.9} rotationIntensity={0.3} floatIntensity={0.5}>
          <GoldOrb position={[0.2, 1.1, -2.5]} scale={0.5} />
        </Float>

        <SweepingSpotlight color="#ffffff" speed={0.35} phase={0} />
        <SweepingSpotlight color="#D4AF37" speed={0.5} phase={2} />
        <SweepingSpotlight color="#ffffff" speed={0.28} phase={4} />

        <Sparkles
          count={80}
          scale={[10, 5, 5]}
          size={2}
          speed={0.25}
          opacity={0.5}
          color="#D4AF37"
        />
        <Sparkles
          count={120}
          scale={[14, 6, 6]}
          size={1.2}
          speed={0.4}
          opacity={0.3}
          color="#ffffff"
        />
      </Suspense>

      <CameraRig />
    </Canvas>
  );
}
