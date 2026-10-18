import * as THREE from 'three';
import { World, buildCourt, buildMesh, SX, SY, SZ } from './world.js';
import { Player } from './player.js';
import { EnemyManager, setTeamLogo } from './enemies.js';
import { Footballs, BALLS } from './balls.js';
import { Controls } from './controls.js';
import { VERSION } from './version.js';
import { ballTexture, logoTexture, badgeMaterial } from './logo.js';
import { initAudio, kickSound, waveClearSound } from './sfx.js';

// 讓整個遊戲用同一個「足球花紋」貼圖（球場上的球、手上的球都一樣）
const BALL_TEX = ballTexture();
const LOGO_TEX = logoTexture();

// ---------------------------------------------------------------------------
// LS 特輯：街頭足球大亂鬥
// ---------------------------------------------------------------------------
const el = (id) => document.getElementById(id);

// ----------------------------- renderer ----------------------------------
const canvas = el('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fc4ea);
scene.fog = new THREE.Fog(0xbcd8ee, 46, 150);

const camera = new THREE.PerspectiveCamera(78, window.innerWidth / window.innerHeight, 0.05, 400);

const BASE_FOV = 78;
scene.add(new THREE.AmbientLight(0xffffff, 1.0));
const sun = new THREE.DirectionalLight(0xfff6e0, 1.0);
sun.position.set(0.4, 1, 0.35);
scene.add(sun);

// ----------------------------- world -------------------------------------
const world = new World();
const bounds = buildCourt(world);
world.cx = (bounds.x0 + bounds.x1) / 2;
world.cz = (bounds.z0 + bounds.z1) / 2;
const levelMesh = buildMesh(world);
scene.add(levelMesh);

// ---- LS 隊徽：只留場地中央一面 + 四周鐵網牆上各掛幾面 ----
function pitchLogo(size, x, z, rotZ = 0) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: LOGO_TEX, transparent: true, opacity: 0.95, depthWrite: false })
  );
  m.rotation.x = -Math.PI / 2;
  m.rotation.z = rotZ;
  m.position.set(x, 1.03, z);
  scene.add(m);
  return m;
}
pitchLogo(11, world.cx, world.cz);        // 場地中央：只放這一個（中圈大小）

// 四周鐵網牆上的隊徽（面向場內）
function wallLogo(x, y, z, rotY) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(5.5, 5.5),
    new THREE.MeshBasicMaterial({ map: LOGO_TEX, transparent: true, opacity: 0.92, depthWrite: false, side: THREE.DoubleSide })
  );
  m.position.set(x, y, z);
  m.rotation.y = rotY;
  scene.add(m);
  return m;
}
const F = bounds.fence;
for (const x of [12, 25.5, 39]) {                     // 前後兩道鐵網
  wallLogo(x, 2.9, F.z0 + 0.6, 0);
  wallLogo(x, 2.9, F.z1 - 0.6, Math.PI);
}
for (const z of [10, 17.5, 25]) {                     // 左右兩道鐵網
  wallLogo(F.x0 + 0.6, 2.9, z, Math.PI / 2);
  wallLogo(F.x1 - 0.6, 2.9, z, -Math.PI / 2);
}

const spawnX = world.cx, spawnZ = world.cz;
const player = new Player(world, spawnX, 1.2, spawnZ);

// ----------------------------- balls -------------------------------------
const balls = new Footballs(scene);
const hud = el('hud');
const controls = new Controls(document.body, canvas);
controls.setActiveWeapon(balls.index);

// ★ 轉視角（滑鼠／右半螢幕拖曳）—— 這是讓玩家能轉身的關鍵
const PITCH_LIMIT = Math.PI / 2 - 0.05;
controls.onLook = (dYaw, dPitch) => {
  player.yaw += dYaw;
  player.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, player.pitch + dPitch));
};

// 手上拿著球（跟著視角）
const handGroup = new THREE.Group();
camera.add(handGroup);
scene.add(camera);
let handBall = null;
function refreshHandBall() {
  if (handBall) { handGroup.remove(handBall); handBall.geometry.dispose(); handBall.material.dispose(); }
  const cfg = balls.current;
  handBall = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 12), new THREE.MeshLambertMaterial({ map: BALL_TEX, color: cfg.color, emissive: cfg.glow }));
  handBall.position.set(0.36, -0.30, -0.78);
  handGroup.add(handBall);
}
refreshHandBall();

// ----------------------------- enemies -----------------------------------
const enemyMgr = new EnemyManager(scene);
setTeamLogo(LOGO_TEX);       // 球衣胸前／背後的 LS 隊徽（要在敵人出生前設定）

// ----------------------------- HUD ---------------------------------------
let running = false, paused = false, betweenWaves = false;
let wave = 0, kills = 0, lastHead = '—', respawning = false;
const RADAR = null;

function showMsg(text, sec = 1.7) {
  const m = el('msg');
  m.textContent = text;
  m.classList.add('show');
  clearTimeout(showMsg._t);
  showMsg._t = setTimeout(() => m.classList.remove('show'), sec * 1000);
}

let vignetteT = 0;
function onPlayerHit() {
  vignetteT = 0.45;
  el('damage-vignette').classList.add('show');
  setTimeout(() => el('damage-vignette').classList.remove('show'), 180);
}

function updateHud() {
  el('hp-bar').style.width = Math.max(0, (player.health / player.maxHealth) * 100) + '%';
  el('hp-text').textContent = Math.ceil(player.health);
  el('wave').textContent = wave;
  el('kills').textContent = kills;
  el('enemies-left').textContent = enemyMgr.aliveCount();
  el('head-name').textContent = lastHead;
  el('weapon-name').textContent = balls.current.ico + ' ' + balls.current.name;
  const cd = balls.current.cd;
  el('ball-cd-fill').style.width = Math.min(100, ((cd - balls.cool) / cd) * 100) + '%';
  if (player.invuln > 0) {
    el('ward').classList.remove('hidden');
    el('ward-sec').textContent = player.invuln.toFixed(1);
  } else {
    el('ward').classList.add('hidden');
  }
  document.querySelectorAll('#ball-list .bl').forEach((n) => n.classList.toggle('active', +n.dataset.b === balls.index));
}

// ----------------------------- waves -------------------------------------
function startWave(n) {
  wave = n;
  betweenWaves = false;
  const count = Math.min(14, 6 + Math.round((n - 1) * 1.5));
  enemyMgr.spawnWave(world, count, n);
  showMsg(`🏁 第 ${n} 波：${count} 位對手進場！`, 2.0);
}

function startGame() {
  initAudio();                                  // 使用者點了才啟動音效（iOS 限制）
  el('overlay').classList.add('hidden');
  hud.classList.remove('hidden');
  el('touch').classList.toggle('hidden', !isTouch);
  running = true; paused = false;
  kills = 0; wave = 0; lastHead = '—';
  player.respawn(spawnX, 1.2, spawnZ);
  enemyMgr.clear();
  balls.clear();
  startWave(1);
  updateHud();
}

function backToMenu() {
  running = false; paused = false;
  enemyMgr.clear();
  balls.clear();
  hud.classList.add('hidden');
  el('touch').classList.add('hidden');
  el('pause').classList.add('hidden');
  el('overlay').classList.remove('hidden');
}

// ----------------------------- input -------------------------------------
const isTouch = matchMedia('(hover: none) and (pointer: coarse)').matches || 'ontouchstart' in window;
el('btn-start').addEventListener('click', startGame);
// 保險：任何點擊都嘗試解鎖音效（iOS / Safari 需要使用者手勢）
document.addEventListener('pointerdown', () => initAudio(), { once: true });
el('btn-pause-resume').addEventListener('click', () => setPaused(false));
el('btn-pause-menu').addEventListener('click', backToMenu);

function setPaused(v) {
  if (!running) return;
  paused = v;
  el('pause').classList.toggle('hidden', !v);
  el('pause-info').innerHTML = `波次 <b>${wave}</b> · 已擊飛 <b>${kills}</b> 位對手 · 版本 v${VERSION}`;
}
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') { setPaused(!paused); }
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= BALLS.length) { balls.select(n - 1); controls.setActiveWeapon(balls.index); refreshHandBall(); updateHud(); }
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ----------------------------- loop --------------------------------------
let last = performance.now();
let prevFiring = false;

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (running && !paused) {
    const input = controls.poll();

    // 換球種（平板右上角按鈕／電腦 1~3）
    const sw = controls.consumeSwitch();
    if (sw >= 0 && sw < BALLS.length) { balls.select(sw); controls.setActiveWeapon(balls.index); refreshHandBall(); }

    player.update(dt, input);
    player.applyCamera(camera, 0, 0);

    // 射門
    const firing = !!input.firing;
    if (firing) {
      const cp = Math.cos(player.pitch), sp = Math.sin(player.pitch);
      const dir = new THREE.Vector3(-Math.sin(player.yaw) * cp, sp, -Math.cos(player.yaw) * cp);
      const origin = new THREE.Vector3(
        camera.position.x + dir.x * 0.55,
        camera.position.y + dir.y * 0.55,
        camera.position.z + dir.z * 0.55
      );
      balls.fire(origin, dir, player.vel);
      kickSound(1);                                   // 踢球音效
    }
    prevFiring = firing;

    balls.update(dt, world, enemyMgr.list, player, (cfg, e) => {
      lastHead = e.name;
      if (!e.alive) kills++;
    });
    enemyMgr.update(dt, world, player, onPlayerHit, balls);

    if (!player.alive && !respawning) {
      respawning = true;
      showMsg('你被撞倒了… 起身中', 2);
      setTimeout(() => {
        player.respawn(spawnX, 1.2, spawnZ);
        respawning = false;
        showMsg('🛡 起身！5 秒內不會受傷', 2.2);
      }, 2000);
    }

    // 一波清空 → 下一波
    if (!betweenWaves && enemyMgr.list.length === 0 && enemyMgr.aliveCount() === 0) {
      betweenWaves = true;
      waveClearSound();                                   // 清空一波的歡呼音
      setTimeout(() => { if (running && !paused) startWave(wave + 1); }, 2200);
    }

    updateHud();
  }

  renderer.render(scene, camera);
}

el('ver-line').textContent = 'v' + VERSION;
requestAnimationFrame(loop);

// 給自動化測試用
window.__game = {
  player, enemyMgr, balls, controls, camera, scene, renderer, world,
  startGame, startWave, setPaused, backToMenu,
  debug: () => ({
    running, paused, wave, kills, version: VERSION,
    hp: Math.round(player.health), alive: player.alive,
    enemies: enemyMgr.list.length, aliveEnemies: enemyMgr.aliveCount(),
    ballsInAir: balls.balls.length, ballIndex: balls.index, ballName: balls.current.name,
    enemiesSample: enemyMgr.list.slice(0, 8).map((e) => e.name),
  }),
  // 測試用：直接踢一顆球出去
  kick: (dirX = 0, dirZ = -1, power = 1) => {
    const dir = new THREE.Vector3(dirX, 0.05, dirZ).normalize().multiplyScalar(power);
    return balls.fire(new THREE.Vector3(player.pos.x, player.pos.y + 1.4, player.pos.z), dir, player.vel);
  },
};
