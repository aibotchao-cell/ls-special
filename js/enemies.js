import * as THREE from 'three';

// ---------------------------------------------------------------------------
// LS 特輯：場上的對手
//   8 種頭：鱷魚 / 恐龍 / 漢堡 / 金剛 / 小牛 / 紅鷹 / 紅豹 / 爆炸頭紅衣教練
//   規則：衝向玩家撞人（觸身傷害）；被球打到 HP 歸零 → 直接轉著飛出場外
// ---------------------------------------------------------------------------

export const HEADS = [
  { key: 'croc',    name: '鱷魚',       hp: 1.0, speed: 1.0 },
  { key: 'dino',    name: '恐龍',       hp: 1.15, speed: 0.95 },
  { key: 'burger',  name: '漢堡',       hp: 0.9, speed: 1.1 },
  { key: 'kong',    name: '金剛',       hp: 1.35, speed: 0.85 },
  { key: 'calf',    name: '小牛',       hp: 1.0, speed: 1.2 },
  { key: 'eagle',   name: '紅鷹',       hp: 0.95, speed: 1.15 },
  { key: 'panther', name: '紅豹',       hp: 1.05, speed: 1.25 },
  { key: 'coach',   name: '爆炸頭紅衣教練', hp: 1.5, speed: 0.9 },
];

const HALF = 0.36, HEIGHT = 1.85;
const GRAV = 22;

// 球衣上的 LS 隊徽（由 main.js 用 setTeamLogo 傳進來）
let LOGO_MAT = null;
export function setTeamLogo(tex) {
  LOGO_MAT = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, alphaTest: 0.05 });
}

// --- 小工具：做一個方塊 -----------------------------------------------------
function box(parent, w, h, d, x, y, z, color, emissive) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color, emissive: emissive || 0x000000 })
  );
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

// ---- 高解析度幾何體（圓滑造型；幾何體共用，材質各自獨立才能單獨閃光）----
const GEO = {};
const geoSphere = (r, w = 20, h = 14) => GEO[`s${r}_${w}_${h}`] || (GEO[`s${r}_${w}_${h}`] = new THREE.SphereGeometry(r, w, h));
const geoCone = (r, h, seg = 14) => GEO[`c${r}_${h}_${seg}`] || (GEO[`c${r}_${h}_${seg}`] = new THREE.ConeGeometry(r, h, seg));
const geoCyl = (rt, rb, h, seg = 16) => GEO[`y${rt}_${rb}_${h}_${seg}`] || (GEO[`y${rt}_${rb}_${h}_${seg}`] = new THREE.CylinderGeometry(rt, rb, h, seg));
const geoCap = (r, len, cs = 6, rs = 14) => GEO[`p${r}_${len}_${cs}_${rs}`] || (GEO[`p${r}_${len}_${cs}_${rs}`] = new THREE.CapsuleGeometry(r, len, cs, rs));
const geoTorus = (r, tube, seg = 8, seg2 = 20) => GEO[`t${r}_${tube}_${seg}_${seg2}`] || (GEO[`t${r}_${tube}_${seg}_${seg2}`] = new THREE.TorusGeometry(r, tube, seg, seg2));

function put(parent, geo, color, x, y, z, rot, scale) {
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color }));
  m.position.set(x, y, z);
  if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
  if (scale) m.scale.set(scale[0], scale[1], scale[2]);
  parent.add(m);
  return m;
}
const eye = (g, x, y, z, white = 0xf6f6f0, pupil = 0x121212) => {
  put(g, geoSphere(0.075, 16, 12), white, x, y, z);
  put(g, geoSphere(0.038, 12, 10), pupil, x * 1.05, y, z + 0.05);
};

// --- 8 種頭（高解析度：球面／圓柱／圓錐／膠囊／環面）-------------------------
function headCroc(g) {
  put(g, geoSphere(0.27, 22, 16), 0x3f8f3a, 0, 0.02, -0.1, null, [1.0, 0.9, 1.1]);   // 後腦
  put(g, geoCap(0.155, 0.3, 6, 16), 0x4aa544, 0, -0.05, 0.3, [Math.PI / 2, 0, 0]);   // 長嘴
  put(g, geoCyl(0.15, 0.18, 0.4, 16), 0x35802f, 0, 0.07, 0.28, [Math.PI / 2, 0, 0]); // 上顎
  put(g, geoCone(0.05, 0.12, 10), 0x2f6d2a, 0, 0.14, 0.46, [Math.PI / 2, 0, 0]);      // 鼻端
  for (let i = 0; i < 5; i++) {                                                       // 牙齒
    put(g, geoCone(0.028, 0.07, 6), 0xf8f8f2, -0.1 + i * 0.05, -0.19, 0.36 + i * 0.02, [Math.PI, 0, 0]);
  }
  put(g, geoSphere(0.055, 12, 10), 0x1d4a1a, -0.11, -0.12, 0.5);
  put(g, geoSphere(0.055, 12, 10), 0x1d4a1a, 0.11, -0.12, 0.5);
  eye(g, -0.13, 0.18, 0.06);
  eye(g, 0.13, 0.18, 0.06);
  put(g, geoCone(0.05, 0.1, 8), 0x2f6d2a, -0.08, 0.26, -0.02, [0, 0, -0.3]);          // 眉骨突起
  put(g, geoCone(0.05, 0.1, 8), 0x2f6d2a, 0.08, 0.26, -0.02, [0, 0, 0.3]);
}
function headDino(g) {
  put(g, geoSphere(0.27, 22, 16), 0x2f8f86, 0, 0.02, -0.06, null, [1.0, 1.0, 1.05]);
  put(g, geoCap(0.13, 0.22, 6, 16), 0x37a396, 0, -0.08, 0.28, [Math.PI / 2, 0, 0]);   // 吻部
  put(g, geoCone(0.13, 0.3, 10), 0xe0a63c, 0, 0.28, -0.24, [0.5, 0, 0]);              // 頭冠
  for (const [dx, dy] of [[-0.1, 0.3], [0.05, 0.34], [0.18, 0.28]]) {                 // 背刺
    put(g, geoCone(0.045, 0.14, 8), 0xc9553f, dx, dy - 0.08, -0.26, [0.6, 0, 0]);
  }
  eye(g, -0.14, 0.06, 0.22, 0xf6f4e2);
  eye(g, 0.14, 0.06, 0.22, 0xf6f4e2);
  put(g, geoSphere(0.03, 10, 8), 0x1a3b38, -0.07, -0.16, 0.36);
  put(g, geoSphere(0.03, 10, 8), 0x1a3b38, 0.07, -0.16, 0.36);
}
function headBurger(g) {
  put(g, geoCyl(0.24, 0.26, 0.13, 20), 0xd9a55a, 0, -0.24, 0, null, null);            // 下層麵包
  put(g, geoCyl(0.28, 0.28, 0.14, 20), 0x6b3b1e, 0, -0.1, 0);                        // 肉排
  put(g, geoTorus(0.24, 0.055, 6, 18), 0x74c23f, 0, 0.02, 0, [Math.PI / 2, 0, 0]);    // 生菜（環面）
  put(g, geoCyl(0.27, 0.27, 0.045, 4), 0xf2c53d, 0, 0.08, 0, [0, Math.PI / 4, 0]);    // 起司（方片）
  put(g, geoSphere(0.27, 22, 14), 0xe0ac5e, 0, 0.16, 0, null, [1, 0.62, 1]);          // 上層麵包
  for (let i = 0; i < 9; i++) {                                                        // 芝麻
    const a = (i / 9) * Math.PI * 2;
    put(g, geoSphere(0.032, 10, 8), 0xfff6dc, Math.cos(a) * 0.15, 0.29, Math.sin(a) * 0.15);
  }
  eye(g, -0.13, -0.04, 0.29, 0xf6f4e2);
  eye(g, 0.13, -0.04, 0.29, 0xf6f4e2);
}
function headKong(g) {
  put(g, geoSphere(0.3, 22, 16), 0x2b2622, 0, 0.03, -0.05, null, [1.0, 1.0, 0.98]);
  put(g, geoCap(0.14, 0.14, 6, 16), 0x6d5a4a, 0, -0.13, 0.22, [Math.PI / 2, 0, 0]);  // 嘴
  put(g, geoCyl(0.3, 0.32, 0.09, 20), 0x1d1a17, 0, 0.15, 0.16, [0.25, 0, 0]);         // 眉骨
  put(g, geoSphere(0.06, 12, 10), 0x8a7260, -0.06, -0.13, 0.33);                      // 鼻孔
  put(g, geoSphere(0.06, 12, 10), 0x8a7260, 0.06, -0.13, 0.33);
  eye(g, -0.15, 0.03, 0.24, 0xe8e0d0);
  eye(g, 0.15, 0.03, 0.24, 0xe8e0d0);
  for (const dx of [-0.24, 0.24]) put(g, geoSphere(0.1, 14, 10), 0x231f1c, dx, 0.05, -0.04);   // 耳朵
  for (let i = 0; i < 6; i++) {                                                                 // 毛
    const a = (i / 6) * Math.PI * 2;
    put(g, geoCone(0.045, 0.12, 8), 0x1d1a17, Math.cos(a) * 0.2, 0.26, Math.sin(a) * 0.18 + 0.02, [0.3, 0, 0]);
  }
}
function headCalf(g) {
  put(g, geoSphere(0.27, 22, 16), 0xf4f1ea, 0, 0.02, -0.05, null, [1.0, 0.96, 1.02]);  // 白頭
  put(g, geoCap(0.13, 0.16, 6, 16), 0xefeae0, 0, -0.11, 0.24, [Math.PI / 2, 0, 0]);    // 口鼻
  put(g, geoSphere(0.1, 14, 10), 0xf0a8b4, 0, -0.1, 0.36, null, [1, 0.8, 0.7]);        // 粉紅鼻
  eye(g, -0.13, 0.06, 0.22, 0xf8f8f4, 0x2a2320);
  eye(g, 0.13, 0.06, 0.22, 0xf8f8f4, 0x2a2320);
  for (const dx of [-0.19, 0.19]) {                                                     // 牛角
    put(g, geoCone(0.055, 0.24, 10), 0xe8dcc8, dx, 0.26, -0.06, [0.1, 0, dx < 0 ? 0.5 : -0.5]);
  }
  for (const dx of [-0.26, 0.26]) {                                                     // 耳朵
    put(g, geoSphere(0.09, 14, 10), 0xe0d6c0, dx, 0.06, -0.04, null, [1, 0.55, 0.7]);
  }
  for (let i = 0; i < 4; i++) {                                                          // 頭上的斑點
    put(g, geoSphere(0.045, 10, 8), 0xd8cfc0, -0.14 + i * 0.09, 0.2 + (i % 2) * 0.05, 0.02);
  }
}
function headEagle(g) {
  put(g, geoSphere(0.27, 22, 16), 0xc0392b, 0, 0.02, -0.05, null, [1.0, 0.98, 1.0]);  // 紅頭
  put(g, geoCone(0.1, 0.3, 12), 0xf0c040, 0, -0.05, 0.32, [Math.PI / 2 + 0.15, 0, 0]); // 黃喙
  put(g, geoCone(0.055, 0.1, 10), 0xd8a828, 0, -0.11, 0.42, [Math.PI / 2 + 0.5, 0, 0]); // 喙尖（下勾）
  for (const [dx, dy, dz] of [[-0.1, 0.3, -0.18], [0.1, 0.3, -0.18], [0, 0.36, -0.12]]) {  // 頭冠羽毛
    put(g, geoCone(0.05, 0.2, 8), 0xb03024, dx, dy - 0.05, dz, [0.7, 0, dx < 0 ? 0.25 : -0.25]);
  }
  put(g, geoSphere(0.085, 16, 12), 0xf8f8f2, -0.15, 0.07, 0.21, null, [1, 1.05, 0.8]);
  put(g, geoSphere(0.085, 16, 12), 0xf8f8f2, 0.15, 0.07, 0.21, null, [1, 1.05, 0.8]);
  put(g, geoSphere(0.04, 12, 10), 0x141414, -0.15, 0.07, 0.27);
  put(g, geoSphere(0.04, 12, 10), 0x141414, 0.15, 0.07, 0.27);
}
function headPanther(g) {
  put(g, geoSphere(0.27, 22, 16), 0xa8342b, 0, 0.02, -0.05, null, [1.0, 0.98, 1.02]);   // 紅豹頭
  put(g, geoCap(0.12, 0.12, 6, 16), 0xd8a08c, 0, -0.1, 0.24, [Math.PI / 2, 0, 0]);      // 吻
  put(g, geoSphere(0.06, 12, 10), 0xf2b8b0, 0, -0.08, 0.34, null, [1, 0.8, 0.7]);       // 鼻
  for (const dx of [-0.2, 0.2]) {                                                        // 尖耳
    put(g, geoCone(0.09, 0.16, 10), 0x8c2a22, dx, 0.26, -0.05, [0, 0, dx < 0 ? 0.35 : -0.35]);
  }
  for (const s of [-1, 1]) {                                                             // 鬍鬚
    for (let i = 0; i < 3; i++) {
      put(g, geoCyl(0.008, 0.008, 0.22, 6), 0xf2e6d8, s * 0.16, -0.08 - i * 0.04, 0.3, [Math.PI / 2, 0, s * (0.4 - i * 0.2)]);
    }
  }
  put(g, geoSphere(0.08, 16, 12), 0x9ee06a, -0.13, 0.06, 0.22, null, [1, 0.9, 0.8]);
  put(g, geoSphere(0.08, 16, 12), 0x9ee06a, 0.13, 0.06, 0.22, null, [1, 0.9, 0.8]);
  put(g, geoSphere(0.035, 10, 8), 0x0d0d0d, -0.13, 0.06, 0.28);
  put(g, geoSphere(0.035, 10, 8), 0x0d0d0d, 0.13, 0.06, 0.28);
  for (let i = 0; i < 5; i++) {                                                          // 頭上的斑紋
    put(g, geoSphere(0.035, 10, 8), 0x7c231c, -0.14 + i * 0.07, 0.24, -0.02);
  }
}
function headCoach(g) {
  put(g, geoSphere(0.25, 22, 16), 0xc98a5c, 0, 0.0, -0.04, null, [1.0, 1.0, 1.0]);      // 皮膚頭
  // 爆炸頭：三層共 30 顆球（高解析度的蓬鬆感）
  const shells = [
    { n: 14, r: 0.3, y: 0.2, rr: 0.15 },
    { n: 11, r: 0.26, y: 0.36, rr: 0.14 },
    { n: 5, r: 0.22, y: 0.48, rr: 0.13 },
  ];
  for (const sh of shells) {
    for (let i = 0; i < sh.n; i++) {
      const a = (i / sh.n) * Math.PI * 2 + sh.y * 3;
      put(g, geoSphere(sh.r, 14, 10), 0x17130f, Math.cos(a) * 0.3, sh.y, Math.sin(a) * 0.28, null, [1, 1, 1]);
    }
  }
  put(g, geoSphere(0.28, 18, 12), 0x1b1712, 0, 0.42, 0, null, [1, 0.8, 1]);             // 頭頂
  put(g, geoSphere(0.27, 18, 12), 0x241d16, 0, 0.13, 0, null, [1, 0.5, 1]);             // 髮際
  eye(g, -0.12, 0.03, 0.2, 0xf6f2ea);
  eye(g, 0.12, 0.03, 0.2, 0xf6f2ea);
  put(g, geoCap(0.05, 0.06, 4, 12), 0xc98a5c, 0, -0.09, 0.2, [Math.PI / 2, 0, 0]);      // 鼻
  put(g, geoCyl(0.035, 0.035, 0.05, 12), 0x3a3a3a, 0.12, -0.2, 0.14, [0, 0, Math.PI / 2]);  // 哨子
  put(g, geoSphere(0.045, 12, 10), 0xf2c33c, 0.17, -0.2, 0.14);
  put(g, geoCyl(0.006, 0.006, 0.18, 6), 0xf2f2ee, 0.06, -0.26, 0.12, [0, 0, 0.4]);      // 掛繩
}

const HEAD_BUILDERS = { croc: headCroc, dino: headDino, burger: headBurger, kong: headKong, calf: headCalf, eagle: headEagle, panther: headPanther, coach: headCoach };

// ---------------------------------------------------------------------------
export class Enemy {
  constructor(world, x, z, cfg) {
    this.world = world;
    this.cfg = cfg;
    this.kind = cfg.head;
    this.name = HEADS.find((h) => h.key === cfg.head)?.name || cfg.head;
    this.alive = true;
    this.flung = false;
    this.removeMe = false;
    this.pos = new THREE.Vector3(x, 1, z);
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.walkPhase = 0;
    this.maxHealth = cfg.health;
    this.health = cfg.health;
    this.tackleCd = 0;
    this.burn = 0;                 // 著火剩餘秒數
    this.burnDps = 0;
    this.hitFlash = 0;
    this.spinAxis = 0;
    this.materials = [];
    this.group = this.build();
  }

  build() {
    const g = new THREE.Group();
    const shirt = this.cfg.shirt || 0x2f6ea8;
    const skin = this.cfg.skin || 0xc98a5c;
    // 身體
    box(g, 0.62, 0.72, 0.36, 0, 1.18, 0, shirt);
    box(g, 0.66, 0.16, 0.4, 0, 1.5, 0, 0x22262c);
    box(g, 0.5, 0.1, 0.34, 0, 1.56, 0, 0xf2f2ee);          // 領口
    box(g, 0.64, 0.07, 0.38, 0, 1.06, 0, 0xf2f2ee);        // 球衣下襬白條
    box(g, 0.6, 0.22, 0.36, 0, 0.86, 0, 0x1e2530);         // 短褲
    // 球衣上的 LS 隊徽（胸前 + 背後）
    if (LOGO_MAT) {
      const front = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), LOGO_MAT);
      front.position.set(0, 1.24, 0.19);
      g.add(front);
      const back = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), LOGO_MAT);
      back.position.set(0, 1.24, -0.19);
      back.rotation.y = Math.PI;
      g.add(back);
    }
    // 手臂
    for (const dx of [-0.4, 0.4]) {
      const arm = new THREE.Group();
      arm.position.set(dx, 1.5, 0);
      box(arm, 0.16, 0.55, 0.16, 0, -0.28, 0, shirt);
      box(arm, 0.15, 0.16, 0.15, 0, -0.6, 0, skin);
      box(arm, 0.2, 0.08, 0.2, 0, -0.03, 0, 0xf2f2ee);      // 袖口
      g.add(arm);
      if (dx < 0) this.armL = arm; else this.armR = arm;
    }
    // 腿 + 球鞋
    for (const dx of [-0.17, 0.17]) {
      const leg = new THREE.Group();
      leg.position.set(dx, 0.82, 0);
      box(leg, 0.2, 0.62, 0.2, 0, -0.3, 0, 0x27313a);
      box(leg, 0.21, 0.14, 0.21, 0, -0.44, 0, 0xf2f2ee);     // 長襪白環
      box(leg, 0.22, 0.12, 0.34, 0, -0.62, 0.06, 0xf0f0ee);  // 白鞋
      g.add(leg);
      if (dx < 0) this.legL = leg; else this.legR = leg;
    }
    // 頭（8 種造型）
    const head = new THREE.Group();
    head.position.set(0, 1.68, 0);
    head.scale.setScalar(1.24);                 // 頭再放大一點，特色才看得清楚
    const build = HEAD_BUILDERS[this.kind] || headCroc;
    build(head);
    g.add(head);
    this.head = head;

    this.group = g;
    // 只有會發光的 Lambert 材質才進閃光清單（隊徽是 Basic 材質，沒有 emissive）
    g.traverse((o) => { if (o.isMesh && o.material && o.material.emissive) this.materials.push(o.material); });
    g.position.copy(this.pos);
    return g;
  }

  takeDamage(dmg, dir) {
    if (!this.alive) return;
    this.health -= dmg;
    this.hitFlash = 0.12;
    if (this.health <= 0) this.die(dir);
  }

  // 被球打到：一般傷害＋擊退；火焰球附帶燃燒
  hitByBall(cfg, knock) {
    if (!this.alive) return;
    if (cfg.burn) { this.burn = cfg.burnSec; this.burnDps = cfg.burn; }
    this.takeDamage(cfg.damage, null);
    if (!this.alive) return;
    this.vel.x += knock.x * 0.35;
    this.vel.z += knock.z * 0.35;
    if (knock.up > 6) this.vel.y = Math.max(this.vel.y, 3.2);      // 旋風球會把人大隻彈起來
    this.hitFlash = 0.15;
  }

  // 陣亡：直接轉著飛出場外
  die() {
    this.alive = false;
    this.flung = true;
    this.flungT = 0;
    const d = this.cfg.flyDir || { x: Math.sin(this.yaw) * -1, z: Math.cos(this.yaw) * -1 };
    this.vel.set(d.x * 11 + (Math.random() - 0.5) * 3, 12 + Math.random() * 3, d.z * 11 + (Math.random() - 0.5) * 3);
    this.spinAxis = Math.random() * Math.PI * 2;
    for (const m of this.materials) m.transparent = true;
  }

  update(dt, player, onPlayerHit) {
    if (this.burn > 0) {
      this.burn -= dt;
      this.health -= this.burnDps * dt;
      if (this.health <= 0 && this.alive) this.die();
    }

    if (!this.alive) {
      if (!this.flung) { this.removeMe = true; return; }
      // 飛出場外：拋物線 + 翻滾，飛遠了就移除
      this.flungT += dt;
      this.vel.y -= GRAV * dt;
      this.pos.addScaledVector(this.vel, dt);
      if (this.pos.y < 1) { this.pos.y = 1; this.vel.y = 0; }     // 飛出場外後落在地上躺著淡出
      this.group.position.copy(this.pos);
      this.group.rotation.z += dt * 9;
      this.group.rotation.x += dt * 5;
      const fade = Math.max(0, 1 - Math.max(0, this.flungT - 1.6) / 1.0);
      for (const m of this.materials) m.opacity = fade;
      if (this.flungT > 2.7) this.removeMe = true;
      return;
    }

    // 追玩家 → 撞人
    const dx = player.pos.x - this.pos.x;
    const dz = player.pos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    this.yaw = Math.atan2(dx, dz);
    const spd = this.cfg.speed * (this.burn > 0 ? 0.85 : 1);
    if (dist > 1.1) {
      this.vel.x = (dx / (dist || 1)) * spd;
      this.vel.z = (dz / (dist || 1)) * spd;
    } else {
      this.vel.x *= 0.5; this.vel.z *= 0.5;
    }
    this.tackleCd = Math.max(0, this.tackleCd - dt);
    if (dist < 1.5 && this.tackleCd <= 0 && player.alive) {
      this.tackleCd = 1.3;
      if (player.damage(this.cfg.tackleDamage)) {
        if (onPlayerHit) onPlayerHit(this.cfg.tackleDamage);
        const kx = dx / (dist || 1), kz = dz / (dist || 1);
        player.vel.x -= kx * 5.5; player.vel.z -= kz * 5.5; player.vel.y = Math.max(player.vel.y, 4.2);
      }
    }

    // 重力 / 移動（地面高度 1）
    this.vel.y -= GRAV * dt;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.pos.y += this.vel.y * dt;
    if (this.pos.y <= 1) { this.pos.y = 1; this.vel.y = 0; }

    // 簡易閃避：不要疊在同一個位置
    this.walkPhase += dt * 8;
    const sw = Math.sin(this.walkPhase) * 0.6;
    this.legL.rotation.x = sw;
    this.legR.rotation.x = -sw;
    this.armL.rotation.x = -sw * 0.7;
    this.armR.rotation.x = sw * 0.7;

    if (this.hitFlash > 0) {
      this.hitFlash -= dt;
      for (const m of this.materials) m.emissive.setHex(0x662222);
    } else if (this.burn > 0) {
      for (const m of this.materials) m.emissive.setHex(0x5a2200);
    } else {
      for (const m of this.materials) m.emissive.setHex(0x000000);
    }

    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
    this.group.rotation.z = 0;
  }
}

// ---------------------------------------------------------------------------
export class EnemyManager {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
  }

  spawnWave(world, count, wave) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const head = HEADS[Math.floor(Math.random() * HEADS.length)];
      const spot = world.randomSpot();
      const cfg = {
        head: head.key,
        health: Math.round(100 * head.hp * (1 + 0.12 * (wave - 1))),
        speed: (2.25 + 0.05 * wave) * head.speed,
        tackleDamage: Math.round(9 + 1.4 * wave),
        shirt: head.key === 'coach' ? 0xc0281f : (Math.random() < 0.5 ? 0x2f6ea8 : 0x3a3f47),
        skin: 0xc98a5c,
        flyDir: { x: 0, z: 0 },
      };
      const e = new Enemy(world, spot.x, spot.z, cfg);
      this.scene.add(e.group);
      this.list.push(e);
      out.push(e);
    }
    return out;
  }

  aliveCount() { return this.list.filter((e) => e.alive).length; }

  update(dt, world, player, onPlayerHit, balls) {
    for (const e of this.list) {
      // 每個敵人有自己的「飛出方向」＝從球場中心往外
      if (!e.cfg.flyDir || (e.cfg.flyDir.x === 0 && e.cfg.flyDir.z === 0)) {
        const wx = e.pos.x - (world.cx || 26), wz = e.pos.z - (world.cz || 18);
        const l = Math.hypot(wx, wz) || 1;
        e.cfg.flyDir = { x: wx / l, z: wz / l };
      }
      e.update(dt, player, onPlayerHit);
      // 敵人互相推開（不要疊在一起）
      for (const o of this.list) {
        if (o === e || !o.alive || !e.alive) continue;
        const dx = e.pos.x - o.pos.x, dz = e.pos.z - o.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.001 && d < 0.85) {
          const push = (0.85 - d) * 0.5;
          e.pos.x += (dx / d) * push;
          e.pos.z += (dz / d) * push;
        }
      }
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      if (this.list[i].removeMe) { this.scene.remove(this.list[i].group); this.list.splice(i, 1); }
    }
  }

  clear() {
    for (const e of this.list) this.scene.remove(e.group);
    this.list.length = 0;
  }
}
