import { Canvas, useFrame } from "@react-three/fiber";
import { Sparkles, Float } from "@react-three/drei";
import { Suspense, useRef } from "react";
import * as THREE from "three";

/**
 * SceneAtmosphere
 * Lightweight ambient 3D block used behind Experience/Booking sections.
 * Renders low-cost sparkles, soft light halo and a slow-moving ring.
 */

function GoldRing({ color = "#D4AF37" }) {
  const ref = useRef();
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (ref.current) {
      ref.current.rotation.z = t * 0.08;
      ref.current.rotation.x = Math.sin(t * 0.15) * 0.2;
    }
  });
  return (
    <mesh ref={ref} position={[0, 0, -2]}>
      <torusGeometry args={[2.4, 0.02, 24, 160]} />
      <meshBasicMaterial color={color} transparent opacity={0.55} />
    </mesh>
  );
}

function Halo({ color = "#D4AF37", scale = 1 }) {
  return (
    <mesh position={[0, 0, -3]} scale={scale}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.05}
        side={THREE.BackSide}
      />
    </mesh>
  );
}

export default function SceneAtmosphere({
  intensity = 1,
  color = "#D4AF37",
  sparkleCount = 60,
}) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      camera={{ position: [0, 0, 5], fov: 50 }}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      <ambientLight intensity={0.15 * intensity} />
      <pointLight color={color} intensity={1.4 * intensity} position={[2, 2, 2]} />
      <pointLight color="#ffffff" intensity={0.4} position={[-3, -1, 1]} />

      <Suspense fallback={null}>
        <Halo color={color} scale={2.5} />
        <Float speed={0.6} rotationIntensity={0.3} floatIntensity={0.5}>
          <GoldRing color={color} />
        </Float>
        <Sparkles
          count={sparkleCount}
          scale={[10, 5, 5]}
          size={2}
          speed={0.2}
          opacity={0.55}
          color={color}
        />
      </Suspense>
    </Canvas>
  );
}
