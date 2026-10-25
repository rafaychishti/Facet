"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/** Particle globe for the contact section (Fibonacci sphere of points). */
function Points() {
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const n = 4200;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const g = Math.PI * (3 - Math.sqrt(5));
    const a = new THREE.Color("#6f8bff"), b = new THREE.Color("#e9ecff"), v = new THREE.Color("#8b6cff");
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = g * i;
      pos.set([Math.cos(th) * r * 2, y * 2, Math.sin(th) * r * 2], i * 3);
      const c = a.clone().lerp(i % 7 === 0 ? v : b, (((i * 9301 + 49297) % 233280) / 233280) * 0.6);
      col.set([c.r, c.g, c.b], i * 3);
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geom.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return geom;
  }, []);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.08;
  });
  return (
    <points ref={ref} geometry={geo} rotation={[0.3, 0, 0.15]}>
      <pointsMaterial size={0.022} vertexColors transparent opacity={0.9} sizeAttenuation depthWrite={false} />
    </points>
  );
}

export default function SceneGlobe() {
  return (
    <Canvas dpr={[1, 1.6]} camera={{ position: [0, 0, 5.4], fov: 45 }} gl={{ alpha: true }}>
      <Points />
    </Canvas>
  );
}
