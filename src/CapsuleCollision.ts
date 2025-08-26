// src/CapsuleCollision.ts – crash-safe
import * as THREE from "three";
// @ts-ignore
import * as RAPIER from "@dimforge/rapier3d-compat";

export interface CapsuleCollisionConfig {
  height: number;
  radius: number;
  stepHeight: number;
  slopeLimit: number; // degrees
  skinWidth: number;
  maxBounces: number;
}

export interface CollisionResult {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  grounded: boolean;
  groundNormal: THREE.Vector3;
  hitWall: boolean;
  wallNormal: THREE.Vector3;
  canStep: boolean;
}

export class CapsuleCollision {
  private world: RAPIER.World;
  private config: CapsuleCollisionConfig;
  private temp: THREE.Vector3[] = Array.from({ length: 10 }, () => new THREE.Vector3());

  constructor(world: RAPIER.World, cfg: Partial<CapsuleCollisionConfig> = {}) {
    this.world = world;
    this.config = { height: 1.8, radius: 0.4, stepHeight: 0.3, slopeLimit: 45, skinWidth: 0.02, maxBounces: 4, ...cfg };
  }

  public moveWithCollision(
    pos: THREE.Vector3,
    vel: THREE.Vector3,
    dt: number,
    exclude?: RAPIER.RigidBody
  ): CollisionResult {
    const res: CollisionResult = {
      position: pos.clone(),
      velocity: vel.clone(),
      grounded: false,
      groundNormal: new THREE.Vector3(0, 1, 0),
      hitWall: false,
      wallNormal: new THREE.Vector3(),
      canStep: false,
    };

    const move = this.temp[0].copy(vel).multiplyScalar(dt);
    if (move.lengthSq() < 1e-6) {
      this.checkGrounded(res, exclude);
      return res;
    }

    const horiz = this.temp[1].set(move.x, 0, move.z);
    const vert = this.temp[2].set(0, move.y, 0);

    if (horiz.lengthSq() > 1e-6) this.processHorizontal(res, horiz, dt, exclude);
    if (Math.abs(vert.y) > 1e-6) this.processVertical(res, vert, exclude);
    this.checkGrounded(res, exclude);

    if (res.hitWall && horiz.lengthSq() > 1e-6) this.tryStepUp(res, horiz, exclude);

    return res;
  }

  private processHorizontal(res: CollisionResult, m: THREE.Vector3, dt: number, ex?: RAPIER.RigidBody) {
    let left = m.clone();
    let bounces = 0;
    const startPos = res.position.clone();

    while (left.lengthSq() > 1e-6 && bounces < this.config.maxBounces) {
      const hit = this.castCapsule(res.position, left.normalize(), left.length(), ex);
      if (!hit) {
        res.position.add(left);
        break;
      }
      const safe = Math.max(0, hit.distance - this.config.skinWidth);
      res.position.add(left.clone().multiplyScalar(safe));

      const slide = this.calcSlide(left, hit.normal);
      const rem = left.length() - hit.distance;
      if (rem > 1e-6 && slide.lengthSq() > 1e-6) {
        left.copy(slide).multiplyScalar(rem * 0.98);
      } else break;

      res.hitWall = true;
      res.wallNormal.copy(hit.normal);
      bounces++;
    }

    if (dt > 0) {
      const actual = this.temp[3].subVectors(res.position, startPos);
      res.velocity.x = actual.x / dt;
      res.velocity.z = actual.z / dt;
    }
  }

  private processVertical(res: CollisionResult, m: THREE.Vector3, ex?: RAPIER.RigidBody) {
    const dir = m.y > 0 ? 1 : -1;
    const hit = this.castCapsule(res.position, this.temp[4].set(0, dir, 0), Math.abs(m.y), ex);
    if (!hit) {
      res.position.add(m);
      return;
    }
    const safe = Math.max(0, hit.distance - this.config.skinWidth);
    res.position.y += dir * safe;
    res.velocity.y = dir > 0 ? Math.min(0, res.velocity.y) : Math.max(0, res.velocity.y);
    if (dir < 0) {
      res.grounded = true;
      res.groundNormal.copy(hit.normal);
    }
  }

  private tryStepUp(res: CollisionResult, orig: THREE.Vector3, ex?: RAPIER.RigidBody) {
    const stepPos = res.position.clone().add(this.temp[5].set(0, this.config.stepHeight, 0));
    const upHit = this.castCapsule(res.position, this.temp[6].set(0, 1, 0), this.config.stepHeight, ex);
    if (upHit) return;

    const fwdHit = this.castCapsule(stepPos, orig.normalize(), orig.length(), ex);
    if (fwdHit) return;

    const landPos = stepPos.clone().add(orig);
    const downHit = this.castCapsule(landPos, this.temp[7].set(0, -1, 0), this.config.stepHeight + this.config.skinWidth, ex);
    if (downHit && downHit.distance <= this.config.stepHeight) {
      res.position.copy(landPos).add(this.temp[8].set(0, -(downHit.distance - this.config.skinWidth), 0));
      res.canStep = true;
      res.hitWall = false;
    }
  }

  private checkGrounded(res: CollisionResult, ex?: RAPIER.RigidBody) {
    const dist = this.config.skinWidth + 0.1;
    const offsets = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(this.config.radius * 0.7, 0, 0),
      new THREE.Vector3(-this.config.radius * 0.7, 0, 0),
      new THREE.Vector3(0, 0, this.config.radius * 0.7),
      new THREE.Vector3(0, 0, -this.config.radius * 0.7),
    ];
    for (const off of offsets) {
      const check = res.position.clone().add(off);
      check.y -= this.config.height / 2 - this.config.radius;
      const hit = this.castRay(check, this.temp[9].set(0, -1, 0), dist, ex);
      if (hit) {
        const slope = Math.acos(hit.normal.y) * (180 / Math.PI);
        if (slope <= this.config.slopeLimit) {
          res.grounded = true;
          res.groundNormal.copy(hit.normal);
          return;
        }
      }
    }
  }

  private castCapsule(pos: THREE.Vector3, dir: THREE.Vector3, len: number, ex?: RAPIER.RigidBody) {
    const half = this.config.height / 2 - this.config.radius;
    const shape = new RAPIER.Capsule(half, this.config.radius);
    const hit = this.world.castShape(
      { x: pos.x, y: pos.y, z: pos.z },
      { x: 0, y: 0, z: 0, w: 1 },
      { x: dir.x, y: dir.y, z: dir.z },
      shape,
      len,
      true,
      undefined,
      undefined,
      ex
    );
    if (!hit) return null;
    return {
      distance: hit.toi,
      normal: new THREE.Vector3(hit.normal1.x, hit.normal1.y, hit.normal1.z),
      point: new THREE.Vector3(hit.witness1.x, hit.witness1.y, hit.witness1.z),
    };
  }

  private castRay(origin: THREE.Vector3, dir: THREE.Vector3, len: number, ex?: RAPIER.RigidBody) {
    const ray = new RAPIER.Ray(
      { x: origin.x, y: origin.y, z: origin.z },
      { x: dir.x, y: dir.y, z: dir.z }
    );
    const hit = this.world.castRay(ray, len, true, undefined, undefined, ex);
    if (!hit) return null;
    const pt = origin.clone().add(dir.clone().multiplyScalar(hit.toi));
    return {
      distance: hit.toi,
      normal: new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z),
      point: pt,
    };
  }

  private calcSlide(move: THREE.Vector3, n: THREE.Vector3) {
    const slide = move.clone().sub(n.clone().multiplyScalar(move.dot(n)));
    if (n.y > 0 && n.y < Math.cos((this.config.slopeLimit * Math.PI) / 180)) slide.y = Math.min(0, slide.y);
    return slide;
  }

  /* ---------- config helpers ---------- */
  public setStepHeight(h: number) {
    this.config.stepHeight = h;
  }
  public setSlopeLimit(deg: number) {
    this.config.slopeLimit = Math.max(0, Math.min(90, deg));
  }
  public getConfig() {
    return { ...this.config };
  }
}