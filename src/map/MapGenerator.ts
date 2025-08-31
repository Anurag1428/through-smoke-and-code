// src/map/MapGenerator.ts
import * as THREE from "three";
import { getRapier } from "../physics.js";

export const ARENA_SIZE = 200;

/* ---------- FLAT GROUND ---------- */
export function createArenaFloor(
  scene: THREE.Scene,
  world: any
): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(ARENA_SIZE, ARENA_SIZE);
  geo.rotateX(-Math.PI / 2);

  const mat = new THREE.MeshStandardMaterial({ color: 0x4a7c59 });
  const floor = new THREE.Mesh(geo, mat);
  floor.receiveShadow = true;
  scene.add(floor);

  // Physics collider (static floor)
  const RAPIER = getRapier();
  const floorBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const floorCollider = RAPIER.ColliderDesc.cuboid(
    ARENA_SIZE / 2,
    0.1,
    ARENA_SIZE / 2
  );
  world.createCollider(floorCollider, floorBody);

  return floor;
}

/* ---------- WALLS ---------- */
export function createArenaWalls(
  scene: THREE.Scene,
  world: any
): THREE.Mesh[] {
  const walls: THREE.Mesh[] = [];
  const wallHeight = 20;
  const wallThickness = 2;

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x888888 });

  const positions = [
    [0, wallHeight / 2, -ARENA_SIZE / 2], // back
    [0, wallHeight / 2, ARENA_SIZE / 2], // front
    [-ARENA_SIZE / 2, wallHeight / 2, 0], // left
    [ARENA_SIZE / 2, wallHeight / 2, 0], // right
  ];

  const scales = [
    [ARENA_SIZE, wallHeight, wallThickness], // back
    [ARENA_SIZE, wallHeight, wallThickness], // front
    [wallThickness, wallHeight, ARENA_SIZE], // left
    [wallThickness, wallHeight, ARENA_SIZE], // right
  ];

  for (let i = 0; i < 4; i++) {
    const geo = new THREE.BoxGeometry(scales[i][0], scales[i][1], scales[i][2]);
    const wall = new THREE.Mesh(geo, wallMat);
    wall.position.set(positions[i][0], positions[i][1], positions[i][2]);
    wall.castShadow = true;
    wall.receiveShadow = true;
    scene.add(wall);
    walls.push(wall);

    // Physics collider
    const RAPIER = getRapier();
    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(
      positions[i][0],
      positions[i][1],
      positions[i][2]
    );
    const body = world.createRigidBody(bodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.cuboid(
      scales[i][0] / 2,
      scales[i][1] / 2,
      scales[i][2] / 2
    );
    world.createCollider(colliderDesc, body);
  }

  return walls;
}

/* ---------- CRATES ---------- */
export function createCrate(
  scene: THREE.Scene,
  world: any,
  x: number,
  z: number
): THREE.Mesh {
  const size = Math.random() * 3 + 2;
  const geo = new THREE.BoxGeometry(size, size, size);
  const mat = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
  const crate = new THREE.Mesh(geo, mat);
  crate.position.set(x, size / 2, z);
  crate.castShadow = crate.receiveShadow = true;
  scene.add(crate);

  // Physics collider
  const RAPIER = getRapier();
  const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, size / 2, z);
  const body = world.createRigidBody(bodyDesc);
  const colliderDesc = RAPIER.ColliderDesc.cuboid(size / 2, size / 2, size / 2);
  world.createCollider(colliderDesc, body);

  return crate;
}

/* ---------- SIMPLE BUILDING ---------- */
export function createBuilding(
  scene: THREE.Scene,
  world: any,
  x: number,
  z: number
): THREE.Group {
  const group = new THREE.Group();

  const width = 15;
  const depth = 10;
  const height = 12;

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({ color: 0xd2b48c })
  );
  body.position.y = height / 2;
  body.castShadow = body.receiveShadow = true;

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(width + 1, 2, depth + 1),
    new THREE.MeshStandardMaterial({ color: 0x7a3e1d })
  );
  roof.position.y = height + 1;

  group.add(body, roof);
  group.position.set(x, 0, z);
  scene.add(group);

  // Physics collider for building body
  const RAPIER = getRapier();
  const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(
    x,
    height / 2,
    z
  );
  const rigid = world.createRigidBody(bodyDesc);
  const colliderDesc = RAPIER.ColliderDesc.cuboid(
    width / 2,
    height / 2,
    depth / 2
  );
  world.createCollider(colliderDesc, rigid);

  return group;
}
