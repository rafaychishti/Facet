"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer, RoundedBox, Float } from "@react-three/drei";
import * as THREE from "three";

const glass = {
  transmission: 1,
  thickness: 0.8,
  roughness: 0.12,
  ior: 1.45,
  clearcoat: 1,
  clearcoatRoughness: 0.1,
  attenuationColor: new THREE.Color("#3550ff"),
  attenuationDistance: 1.2,
  color: new THREE.Color("#9fb2ff"),
};

/** 3x3x3 glass cube cluster that slowly turns and "explodes" with scroll. */
function Cluster({ scroll }: { scroll: React.RefObject<number> }) {
  const group = useRef<THREE.Group>(null);
  const cubes = useMemo(() => {
    const out: { p: [number, number, number]; glow: boolean }[] = [];
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) out.push({ p: [x, y, z], glow: (x + y * 2 + z * 3 + 9) % 7 === 0 });
    return out;
  }, []);
  const refs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame((state, dt) => {
    const s = scroll.current ?? 0;
    if (group.current) {
      group.current.rotation.y += dt * 0.15;
      group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, 0.45 + state.pointer.y * 0.2, 0.05);
      group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, state.pointer.x * 0.15, 0.05);
    }
    const spread = 1.08 + Math.min(s, 1) * 0.9;
    refs.current.forEach((m, i) => {
      if (!m) return;
      const [x, y, z] = cubes[i].p;
      m.position.lerp(new THREE.Vector3(x * spread, y * spread, z * spread), 0.08);
    });
  });

  return (
    <group ref={group} rotation={[0.45, 0.6, 0]} scale={0.62}>
      {cubes.map((c, i) => (
        <RoundedBox key={i} ref={(m: THREE.Mesh | null) => { refs.current[i] = m; }} args={[1, 1, 1]} radius={0.08} smoothness={4} position={c.p}>
          {c.glow ? (
            <meshStandardMaterial color="#c9d4ff" emissive="#4d6bff" emissiveIntensity={2.2} roughness={0.3} />
          ) : (
            <meshPhysicalMaterial {...glass} />
          )}
        </RoundedBox>
      ))}
    </group>
  );
}

function Floaters() {
  const items = useMemo(
    () => Array.from({ length: 14 }, (_, i) => ({
      p: [Math.sin(i * 2.4) * (4 + (i % 3)), Math.cos(i * 1.7) * 2.6, -2 - (i % 4)] as [number, number, number],
      s: 0.25 + ((i * 37) % 10) / 30,
      r: i,
    })),
    [],
  );
  return (
    <>
      {items.map((it) => (
        <Float key={it.r} speed={1 + (it.r % 3) * 0.4} rotationIntensity={1.4} floatIntensity={1.2}>
          <RoundedBox args={[it.s, it.s, it.s]} radius={0.03} position={it.p} rotation={[it.r, it.r * 0.5, 0]}>
            {it.r % 4 === 0 ? <meshStandardMaterial color="#ffffff" emissive="#9fb2ff" emissiveIntensity={1.2} /> : <meshPhysicalMaterial {...glass} />}
          </RoundedBox>
        </Float>
      ))}
    </>
  );
}

export default function SceneCubes({ scroll }: { scroll: React.RefObject<number> }) {
  return (
    <Canvas dpr={[1, 1.6]} camera={{ position: [0, 0, 9.5], fov: 40 }} gl={{ antialias: true, alpha: true }}>
      <ambientLight intensity={0.25} />
      <pointLight position={[0, 0, 0]} intensity={30} color="#4d6bff" distance={8} />
      <directionalLight position={[4, 6, 5]} intensity={1.6} color="#dfe5ff" />
      <pointLight position={[-6, -3, 2]} intensity={40} color="#2f4bff" />
      <Cluster scroll={scroll} />
      <Floaters />
      {/* Local studio lighting for reflections; no HDR file is downloaded */}
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={3} color="#9fb2ff" position={[0, 4, -6]} scale={[10, 2, 1]} />
        <Lightformer form="rect" intensity={2} color="#2f4bff" position={[-6, 0, 2]} rotation-y={Math.PI / 2} scale={[8, 4, 1]} />
        <Lightformer form="circle" intensity={4} color="#ffffff" position={[5, 3, 4]} scale={2} />
      </Environment>
    </Canvas>
  );
}
