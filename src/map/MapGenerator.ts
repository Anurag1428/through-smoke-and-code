// src/map/MapGenerator.ts
import * as THREE from 'three';
import { SimplexNoise } from 'three/examples/jsm/math/SimplexNoise.js';

export const TERRAIN_SIZE = 512;
const MAX_HEIGHT = 40;
const SEGMENTS = 128;

/* ---------- HEIGHTFIELD ---------- */
const noise = new SimplexNoise();
const heightData = new Float32Array((SEGMENTS + 1) ** 2);
for (let i = 0; i <= SEGMENTS; i++) {
  for (let j = 0; j <= SEGMENTS; j++) {
    const x = (i / SEGMENTS - 0.5) * TERRAIN_SIZE;
    const z = (j / SEGMENTS - 0.5) * TERRAIN_SIZE;
    const h =
      noise.noise3d(x * 0.003, z * 0.003, 0) * MAX_HEIGHT +
      noise.noise3d(x * 0.01,  z * 0.01,  0) * MAX_HEIGHT * 0.3;
    heightData[i * (SEGMENTS + 1) + j] = h;
  }
}

export function heightAt(x: number, z: number): number {
  const seg = SEGMENTS;
  const s = TERRAIN_SIZE / seg;
  const gx = (x + TERRAIN_SIZE / 2) / s;
  const gz = (z + TERRAIN_SIZE / 2) / s;
  const ix = THREE.MathUtils.clamp(Math.floor(gx), 0, seg - 1);
  const iz = THREE.MathUtils.clamp(Math.floor(gz), 0, seg - 1);
  const fx = gx - ix;
  const fz = gz - iz;
  const h00 = heightData[ix   * (seg + 1) + iz];
  const h10 = heightData[(ix + 1) * (seg + 1) + iz];
  const h01 = heightData[ix   * (seg + 1) + (iz + 1)];
  const h11 = heightData[(ix + 1) * (seg + 1) + (iz + 1)];
  return (1 - fx) * (1 - fz) * h00 +
         fx      * (1 - fz) * h10 +
         (1 - fx) * fz      * h01 +
         fx      * fz      * h11;
}

/* ---------- TEXTURE ---------- */
function createCheckerTexture(c1: string, c2: string, size = 32): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = c1;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = c2;
  for (let x = 0; x < size; x += 4)
    for (let y = 0; y < size; y += 4)
      if ((x + y / 4) % 2) ctx.fillRect(x, y, 4, 4);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(32, 32);
  return tex;
}

/* ---------- TERRAIN MESH ---------- */
export function createTerrain(): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, SEGMENTS, SEGMENTS);
  geo.rotateX(-Math.PI / 2);
  for (let i = 0; i < geo.attributes.position.count; i++) {
    geo.attributes.position.setY(i, heightData[i]);
  }
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    map: createCheckerTexture('#6d9e5d', '#5a8a4d'),
  });
  const terrain = new THREE.Mesh(geo, mat);
  terrain.receiveShadow = true;
  return terrain;
}

/* ---------- PROPS ---------- */
export function createHouse(x: number, z: number): THREE.Group {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(8, 6, 8),
    new THREE.MeshStandardMaterial({ color: 0xd2b48c })
  );
  body.position.y = 3;
  body.castShadow = body.receiveShadow = true;
  group.add(body);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(6, 4, 4),
    new THREE.MeshStandardMaterial({ color: 0x7a3e1d })
  );
  roof.position.y = 8;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  group.add(roof);

  group.position.set(x, heightAt(x, z), z);
  return group;
}

export function createTree(x: number, z: number): THREE.Group {
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.6, 5, 8),
    new THREE.MeshStandardMaterial({ color: 0x3d2817 })
  );
  trunk.position.y = 2.5;
  trunk.castShadow = true;

  const foliage = new THREE.Mesh(
    new THREE.ConeGeometry(2.5, 6, 8),
    new THREE.MeshStandardMaterial({ color: 0x2d4c1e })
  );
  foliage.position.y = 8;
  foliage.castShadow = true;

  const g = new THREE.Group();
  g.add(trunk, foliage);
  g.position.set(x, heightAt(x, z), z);
  return g;
}

export function createRock(x: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.DodecahedronGeometry(1.5, 0),
    new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  m.position.set(x, heightAt(x, z) + 1, z);
  m.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
  m.scale.setScalar(Math.random() * 0.6 + 0.8);
  m.castShadow = m.receiveShadow = true;
  return m;
}