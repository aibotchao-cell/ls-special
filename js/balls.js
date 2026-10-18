import * as THREE from 'three';
import { ballTexture } from './logo.js';

// ---------------------------------------------------------------------------
// LS 特輯：三種足球
//   一般直球  ⚽ 快、直、好控制
//   火焰球    🔥 命中會燒起來＋小爆炸
//   旋風旋球  🌀 會轉彎、擊飛力超強（被打到會轉著飛出去）
// ---------------------------------------------------------------------------

export const BALLS = [
  { key: 'straight', name: '一般直球', ico: '⚽', cd: 0.30, speed: 32, gravity: 5.5, damage: 42, knock: 9, radius: 0.42, life: 2.6, pierce: false,
    color: 0xffffff, glow: 0x000000, desc: '又直又快，最容易打到人' },
  { key: 'fire', name: '火焰球', ico: '🔥', cd: 0.70, speed: 24, gravity: 4.5, damage: 30, knock: 12, radius: 0.46, life: 3.0, pierce: false,
    color: 0xff8a2a, glow: 0xff4a00, burn: 13, burnSec: 3.2, blast: 3.2, blastDamage: 20, desc: '命中後燒起來，還會炸到附近的人' },
  { key: 'cyclone', name: '旋風旋球', ico: '🌀', cd: 0.55, speed: 26, gravity: 3.2, damage: 36, knock: 22, radius: 0.5, life: 3.2, pierce: true,
    color: 0xdff2ff, glow: 0x5ad0ff, curve: 6.5, spin: true, desc: '會轉彎、打中把人轉著擊飛（還會穿透）' },
];

const G = 1;                 // 重力已在各球上設定
const MAX_BALLS = 24;

export class Footballs {
  constructor(scene) {
    this.scene = scene;
    this.balls = [];
    this.effects = [];
    this.index = 0;
    this.cool = 0;
    this.geo = new THREE.SphereGeometry(1, 24, 18);   // 球面更細緻，花紋不會糊掉
    this.shadowGeo = new THREE.CircleGeometry(1, 12);
    this.shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false });
    this.spinGeo = new THREE.TorusGeometry(1, 0.16, 4, 14);
  }

  get current() { return BALLS[this.index]; }
  select(i) { this.index = Math.max(0, Math.min(BALLS.length - 1, i | 0)); return this.current; }

  // 玩家發射
  fire(origin, dir, ownerVel) {
    const cfg = this.current;
    if (this.cool > 0) return false;
    this.cool = cfg.cd;
    const mat = new THREE.MeshLambertMaterial({ map: ballTexture(), color: cfg.color, emissive: cfg.glow });
    const mesh = new THREE.Mesh(this.geo, mat);
    const s = cfg.radius;
    mesh.scale.setScalar(s);
    mesh.position.copy(origin);
    this.scene.add(mesh);

    const vel = new THREE.Vector3(dir.x, dir.y, dir.z).normalize().multiplyScalar(cfg.speed);
    if (ownerVel) { vel.x += ownerVel.x * 0.35; vel.z += ownerVel.z * 0.35; }

    const shadow = new THREE.Mesh(this.shadowGeo, this.shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    this.scene.add(shadow);

    let spin = null;
    if (cfg.spin) {
      spin = new THREE.Mesh(this.spinGeo, new THREE.MeshBasicMaterial({
        color: cfg.glow, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      this.scene.add(spin);
    }

    const b = {
      cfg, mesh, mat, shadow, spin, vel,
      pos: origin.clone(), life: cfg.life, bounces: 0,
      hitSet: new Set(), trail: 0,
    };
    this.balls.push(b);
    if (this.balls.length > MAX_BALLS) this.remove(0);
    return true;
  }

  remove(i) {
    const b = this.balls[i];
    this.scene.remove(b.mesh);
    this.scene.remove(b.shadow);
    if (b.spin) this.scene.remove(b.spin);
    b.mat.dispose();
    if (b.spin) b.spin.material.dispose();
    this.balls.splice(i, 1);
  }

  clear() {
    while (this.balls.length) this.remove(0);
    for (const e of this.effects) { this.scene.remove(e.mesh); e.mesh.geometry.dispose(); e.mesh.material.dispose(); }
    this.effects.length = 0;
  }

  burst(x, y, z, radius, color) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), mat);
    mesh.position.set(x, y, z);
    mesh.scale.setScalar(0.4);
    this.scene.add(mesh);
    this.effects.push({ mesh, t: 0, radius, mat });
  }

  update(dt, world, enemies, player, onHit) {
    this.cool = Math.max(0, this.cool - dt);

    // 爆炸特效
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.t += dt;
      const k = Math.min(1, e.t / 0.35);
      e.mesh.scale.setScalar(0.4 + k * e.radius);
      e.mat.opacity = 0.8 * (1 - k);
      if (k >= 1) { this.scene.remove(e.mesh); e.mesh.geometry.dispose(); e.mat.dispose(); this.effects.splice(i, 1); }
    }

    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      const cfg = b.cfg;
      b.life -= dt;
      b.vel.y -= cfg.gravity * G * dt;

      // 旋風球：飛行時側向轉彎
      if (cfg.curve) {
        const ax = -b.vel.z, az = b.vel.x;
        const al = Math.hypot(ax, az) || 1;
        b.vel.x += (ax / al) * cfg.curve * dt;
        b.vel.z += (az / al) * cfg.curve * dt;
      }

      // 分段移動（避免穿透）
      const total = b.vel.length() * dt;
      const steps = Math.max(1, Math.ceil(total / 0.35));
      let dead = false;
      const rest = 0.55;
      for (let s = 0; s < steps && !dead; s++) {
        const sx = (b.vel.x * dt) / steps;
        const sy = (b.vel.y * dt) / steps;
        const sz = (b.vel.z * dt) / steps;

        // 逐軸處理方塊碰撞（鐵網／球門／地板）→ 反彈 + 推出方塊，才不會卡在裡面一直算反彈
        if (world.isSolid(b.pos.x + sx, b.pos.y, b.pos.z)) {
          if (Math.abs(sx) > 0.05) b.bounces++;
          b.vel.x = -b.vel.x * rest;
        } else {
          b.pos.x += sx;
        }
        if (world.isSolid(b.pos.x, b.pos.y + sy, b.pos.z)) {
          const hitY = b.pos.y + sy;
          b.pos.y = (b.vel.y < 0) ? Math.floor(hitY) + 1 + cfg.radius : Math.floor(hitY) - cfg.radius;
          if (Math.abs(sy) > 0.06) b.bounces++;
          b.vel.y = -b.vel.y * rest;
          if (Math.abs(b.vel.y) < 2.2) b.vel.y = 0;
        } else {
          b.pos.y += sy;
        }
        if (world.isSolid(b.pos.x, b.pos.y, b.pos.z + sz)) {
          if (Math.abs(sz) > 0.05) b.bounces++;
          b.vel.z = -b.vel.z * rest;
        } else {
          b.pos.z += sz;
        }

        // 打到敵人？
        for (const e of enemies) {
          if (!e.alive || b.hitSet.has(e)) continue;
          const ex = e.pos.x, ez = e.pos.z, ey = e.pos.y;
          if (Math.abs(b.pos.x - ex) < 0.55 + cfg.radius &&
              Math.abs(b.pos.z - ez) < 0.55 + cfg.radius &&
              b.pos.y > ey - 0.3 && b.pos.y < ey + 2.0) {
            b.hitSet.add(e);
            const kx = b.vel.x, kz = b.vel.z;
            const kl = Math.hypot(kx, kz) || 1;
            e.hitByBall(cfg, { x: (kx / kl) * cfg.knock, z: (kz / kl) * cfg.knock, up: cfg.spin ? 7.5 : 4.5, spin: !!cfg.spin });
            if (onHit) onHit(cfg, e);
            // 火焰球：命中爆炸 + 濺射
            if (cfg.blast) {
              this.burst(b.pos.x, b.pos.y, b.pos.z, cfg.blast, cfg.color);
              for (const o of enemies) {
                if (o === e || !o.alive) continue;
                const d = Math.hypot(o.pos.x - b.pos.x, o.pos.z - b.pos.z);
                if (d < cfg.blast) o.takeDamage(cfg.blastDamage, null);
              }
            }
            if (!cfg.pierce) { dead = true; }
            break;
          }
        }
      }

      // 更新外觀
      b.mesh.position.copy(b.pos);
      b.mesh.rotation.x += dt * 9;
      b.mesh.rotation.z += dt * 6;
      const gy = Math.max(0, Math.floor(b.pos.y));
      b.shadow.position.set(b.pos.x, 1.02, b.pos.z);
      b.shadow.scale.setScalar(cfg.radius * (1 + b.pos.y * 0.06));
      b.shadow.material.opacity = Math.max(0, 0.3 - b.pos.y * 0.02);
      if (b.spin) {
        b.spin.position.copy(b.pos);
        b.spin.rotation.y += dt * 14;
        b.spin.rotation.x = Math.PI / 2 + Math.sin(performance.now() * 0.008) * 0.35;
        b.spin.scale.setScalar(cfg.radius * 1.9);
      }
      // 火焰球的拖尾
      if (cfg.burn) {
        b.trail += dt;
        if (b.trail > 0.05) {
          b.trail = 0;
          this.burst(b.pos.x, b.pos.y, b.pos.z, 0.55, cfg.color);
        }
      }

      if (dead || b.life <= 0 || b.bounces > 14 || b.pos.y < -3) this.remove(i);
    }
  }
}
