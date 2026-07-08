"use strict";
/* =========================================================================
   길냥이 붕어빵 런  (Street Cat's Bungeoppang Run)
   -------------------------------------------------------------------------
   Vanilla HTML5 Canvas 2D · No build · No external image/audio files.
   모든 그래픽은 Canvas로 그리고, 효과음은 Web Audio로 생성한다.

   재사용(Reused) — 이 저장소의 이전 Three.js 게임(꼬마 도깨비의 모험)에서:
     • Web Audio 기반 SoundFX 클래스 (파일 없는 효과음)         → §16
     • localStorage 안전 래퍼 LS (try/catch 폴백)               → §15
     • tap/swipe 입력, camera=max(auto,follow), 강물 뗏목 타기,
       난이도 램프, 피버 모드 등 게임플레이 로직 패턴            → §7,10,12,13,14
     • 파스텔 한국풍 UI 감성 / 한글 문자열
   ========================================================================= */


/* =========================================================================
   §22. CONFIG — 모든 튜닝 상수를 여기에 모아둔다.
   ========================================================================= */
const CONFIG = {
  TILE: 40,                 // 한 칸 = 40px
  COLS: 9,                  // 열 0..8
  LOGIC_W: 360,             // 9 * 40 (내부 논리 해상도)
  LOGIC_H: 640,             // 16행
  ROWS_VISIBLE: 16,
  DPR_MAX: 3,               // High-DPI 상한

  HOP_MS: 110,              // 한 칸 점프 보간 시간(§8: 90~120ms)
  FOLLOW_OFFSET: 5,         // 고양이는 화면 하단에서 이만큼 위 유지(§12)

  // 카메라 / 오토스크롤 (§12, §13) — 단위: lane/sec
  AUTO_BASE: 0.85,
  AUTO_PER_SCORE: 0.02,
  AUTO_MAX: 3.2,

  // 이동 장애물 속도 (§13) — px/sec
  ENTITY_SPEED_BASE: 58,
  ENTITY_SPEED_PER_SCORE: 0.75,
  ENTITY_SPEED_MAX: 155,
  RAIL_SPEED_MUL: 2.0,      // 지하철은 매우 빠름

  START_SAFE_ROWS: 4,       // 시작 온보딩 안전 구간
  MAX_DANGER_STREAK: 3,     // §11.1 콤보 사망 방지

  // 점수/아이템 (§14)
  BUNGEO_POINTS: 5,         // 붕어빵
  FISH_POINTS: 10,          // 한강 물고기
  FEVER_MS: 5000,           // 츄르 → 피버 5초
  FEVER_SLOW: 0.6,          // 피버 중 장애물 슬로우

  // 최소 간격 (§11.2) — TILE 단위, 모서리-모서리
  ROAD_GAP: [2.0, 3.0],
  RIVER_GAP: [0.6, 1.2],    // DECISION: 강은 뗏목이 촘촘해야 착지 가능 → 룰 완화
  RAIL_GAP: [6.0, 10.0],    // 기차는 드문드문(경고 후 통과)
};

const REGIONS = ['홍대', '한강', '명동', '강남', '북촌', '이태원', '연남동', '성수'];

// 색상 (§9)
const COL = {
  safeGrass: '#A8D5A2', safeCream: '#F5E6C8',
  road: '#4A4A4A', roadLine: '#F2D06B',
  rail: '#6B6B6B', railTie: '#5a5a5a', railMetal: '#c9ccd4',
  river: '#5AA9E6', riverDark: '#4890cf',
  ink: '#4b3b57',
};


/* =========================================================================
   §16. Web Audio SoundFX — 이전 게임에서 재사용(효과음을 코드로 생성).
   AudioContext는 첫 사용자 제스처 이후에만 init (autoplay 정책).
   모든 것을 try/catch로 감싸 오디오 실패가 게임을 죽이지 않게 한다.
   ========================================================================= */
class SoundFX {
  constructor() { this.ctx = null; this.master = null; this.enabled = true; }
  init() {
    try {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { this.enabled = false; return; }
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.45;
      this.master.connect(this.ctx.destination);
    } catch (e) { this.enabled = false; }
  }
  tone(freq, dur, type = 'square', vol = 0.15, slideTo = null, delay = 0) {
    if (!this.enabled || !this.ctx) return;
    try {
      const t = this.ctx.currentTime + delay;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.02);
    } catch (e) {}
  }
  noise(dur, vol = 0.2, delay = 0) {
    if (!this.enabled || !this.ctx) return;
    try {
      const t = this.ctx.currentTime + delay, n = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const s = this.ctx.createBufferSource(); s.buffer = buf;
      const g = this.ctx.createGain(); g.gain.value = vol;
      s.connect(g).connect(this.master); s.start(t);
    } catch (e) {}
  }
  jump()   { this.tone(420, 0.10, 'square', 0.10, 720); }              // 점프 blip
  score()  { this.tone(880, 0.08, 'triangle', 0.12, 1320);            // 붕어빵/물고기
             this.tone(1320, 0.06, 'triangle', 0.08, 1760, 0.05); }
  coin()   { this.tone(1046, 0.06, 'square', 0.11, 1568);             // 코인 ting
             this.tone(1568, 0.10, 'square', 0.09, null, 0.05); }
  fever()  { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.12, 'square', 0.13, null, i * 0.08)); }
  gameover(){ [440, 349, 262, 196].forEach((f, i) => this.tone(f, 0.22, 'square', 0.14, null, i * 0.14));
             this.noise(0.3, 0.12, 0.5); }
}
const sfx = new SoundFX();


/* =========================================================================
   §15. localStorage 안전 래퍼 — 이전 게임에서 재사용.
   iframe 샌드박스에서 막혀도 crash 없이 폴백.
   ========================================================================= */
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
};


/* =========================================================================
   Canvas & High-DPI (§2)
   ========================================================================= */
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
let DPR = 1;
function setupCanvas() {
  DPR = Math.min(window.devicePixelRatio || 1, CONFIG.DPR_MAX);
  canvas.width = CONFIG.LOGIC_W * DPR;
  canvas.height = CONFIG.LOGIC_H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);   // 이후 360x640 논리 좌표로 그린다
  ctx.imageSmoothingEnabled = true;
}
window.addEventListener('resize', setupCanvas);


/* =========================================================================
   §5. 데이터 모델 (Data Model)
   ========================================================================= */
const game = {
  lanes: {},                 // index -> Lane (dict)
  cameraLane: 0,             // 화면 하단 mép에 보이는 lane (실수)
  state: 'ready',            // 'ready' | 'playing' | 'gameover'
  maxLane: 0, bonus: 0, coins: 0, fish: 0, score: 0,
  fever: { active: false, timeLeft: 0 },
  best: [0, 0, 0],
  newRecord: false,
  // map-gen 상태
  genCursor: 0,
  dangerStreak: 0,
  prevFreeCols: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  // 입력 큐 & 이펙트
  queued: null,
  pops: [],
};

const cat = {
  col: 4, lane: 0,           // 논리 격자 위치(정수)
  fcol: 4, flane: 0,         // 부드러운 렌더/물리용 실수 좌표
  moving: false, jumpT: 0,
  fromCol: 4, fromLane: 0, toCol: 4, toLane: 0,
  onLog: null,               // 강물에서 타고 있는 뗏목
  dir: 1,                    // 바라보는 방향(-1 왼쪽 / 1 오른쪽)
  hop: 0,                    // 점프 시 시각적 상승량
};


/* =========================================================================
   §11. 제약 기반 맵 생성 (Constraint-Based Generation)
   ========================================================================= */
function difficulty01() { return Math.min(1, game.maxLane / 60); }   // 0..1

function pickLaneType() {
  const d = difficulty01();
  // 초반: safe 위주 / 후반: 위험 lane 비중 ↑ (§13)
  const wSafe = 0.50 - 0.24 * d;
  const wRoad = 0.22 + 0.06 * d;
  const wRail = 0.10 + 0.10 * d;
  const wRiver = 0.18 + 0.08 * d;
  let r = Math.random() * (wSafe + wRoad + wRail + wRiver);
  if (r < wSafe) return 'safe';
  if (r < wSafe + wRoad) return 'road';
  if (r < wSafe + wRoad + wRail) return 'rail';
  return 'river';
}

function entitySpeed() {
  return Math.min(CONFIG.ENTITY_SPEED_MAX,
    CONFIG.ENTITY_SPEED_BASE + game.maxLane * CONFIG.ENTITY_SPEED_PER_SCORE);
}

// 이동 lane에 균등 간격으로 entity를 배치 → wrap해도 간격이 영구 유지(§11.2)
function seedMovers(lane, wTiles, gapTilesRange, marginTiles) {
  const T = CONFIG.TILE;
  const w = wTiles * T;
  const gap = (gapTilesRange[0] + Math.random() * (gapTilesRange[1] - gapTilesRange[0])) * T;
  const spacing = w + gap;                         // 중심-중심 간격
  const margin = marginTiles * T;
  const minX = -margin;
  const span = CONFIG.LOGIC_W + margin * 2;
  const count = Math.max(1, Math.ceil(span / spacing));
  const period = count * spacing;                  // wrap 주기
  const phase = Math.random() * spacing;
  lane.minX = minX;
  lane.period = period;
  lane.entW = w;
  for (let k = 0; k < count; k++) {
    lane.entities.push({ x: minX + phase + k * spacing, w: w, kind: lane.kind });
  }
}

function buildSafeLane(lane) {
  const isStart = lane.index < CONFIG.START_SAFE_ROWS;
  // §11.3 Gatekeeper: prevFreeCols 중 하나를 반드시 비워 통로 연결
  const corridor = game.prevFreeCols[(Math.random() * game.prevFreeCols.length) | 0];
  const blocked = new Set();
  const count = isStart ? 0 : (Math.random() * 5) | 0;   // 0..4 (§11.3: 최대 4)
  let guard = 0;
  while (blocked.size < count && guard++ < 60) {
    const c = (Math.random() * 9) | 0;
    if (c === corridor) continue;
    blocked.add(c);
  }
  const freeCols = [];
  for (let c = 0; c < 9; c++) {
    if (blocked.has(c)) lane.decos[c] = Math.random() < 0.5 ? 'tree' : 'trash';
    else freeCols.push(c);
  }
  lane.freeCols = freeCols;
  // 아이템: 붕어빵 (빈 칸 위)
  if (!isStart && Math.random() < 0.42) {
    const fc = freeCols[(Math.random() * freeCols.length) | 0];
    lane.items[fc] = { kind: 'bungeoppang', taken: false };
  }
}

function buildRoadLane(lane) {
  lane.dir = Math.random() < 0.5 ? 1 : -1;
  lane.speed = entitySpeed();
  const isBus = Math.random() < 0.35;
  lane.kind = isBus ? 'bus' : 'scooter';
  seedMovers(lane, isBus ? 2.0 : 0.95, CONFIG.ROAD_GAP, 2);
  lane.freeCols = [0, 1, 2, 3, 4, 5, 6, 7, 8];   // 정적 차단물 없음
  if (Math.random() < 0.5) {                     // 500원 코인
    const c = (Math.random() * 9) | 0;
    lane.items[c] = { kind: 'coin', taken: false };
  }
}

function buildRailLane(lane) {
  lane.dir = Math.random() < 0.5 ? 1 : -1;
  lane.speed = entitySpeed() * CONFIG.RAIL_SPEED_MUL;
  lane.kind = 'train';
  seedMovers(lane, 2.8, CONFIG.RAIL_GAP, 3);
  lane.freeCols = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  if (Math.random() < 0.3) {                     // 츄르 → 피버
    const c = (Math.random() * 9) | 0;
    lane.items[c] = { kind: 'churu', taken: false };
  }
}

function buildRiverLane(lane) {
  // §11.4 인접 강은 반대 방향 + 같은 속도
  const below = game.lanes[lane.index - 1];
  if (below && below.type === 'river') {
    lane.dir = -below.dir;
    lane.speed = below.speed;
  } else {
    lane.dir = Math.random() < 0.5 ? 1 : -1;
    lane.speed = 40 + Math.random() * 25;        // 강은 완만
  }
  lane.kind = 'log';
  seedMovers(lane, 2.0 + Math.random(), CONFIG.RIVER_GAP, 2);
  lane.freeCols = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  if (Math.random() < 0.4) {                     // 한강 물고기
    const c = (Math.random() * 9) | 0;
    lane.items[c] = { kind: 'fish', taken: false };
  }
}

function makeLane(index) {
  const lane = {
    index, type: 'safe', entities: [], items: {}, decos: {},
    dir: 1, speed: 0, kind: '', freeCols: [],
    minX: 0, period: 0, entW: 0,
  };
  // lane 종류 결정
  let type;
  if (index < CONFIG.START_SAFE_ROWS) type = 'safe';
  else if (game.dangerStreak >= CONFIG.MAX_DANGER_STREAK) type = 'safe'; // §11.1
  else type = pickLaneType();
  lane.type = type;

  const dangerous = (type === 'road' || type === 'rail' || type === 'river');
  game.dangerStreak = dangerous ? game.dangerStreak + 1 : 0;

  if (type === 'safe') buildSafeLane(lane);
  else if (type === 'road') buildRoadLane(lane);
  else if (type === 'rail') buildRailLane(lane);
  else buildRiverLane(lane);

  // 통로 연결용: 다음 lane 생성 시 참조할 "지나갈 수 있는 열"
  game.prevFreeCols = lane.freeCols.length ? lane.freeCols : [0, 1, 2, 3, 4, 5, 6, 7, 8];
  return lane;
}

// 화면을 덮을 만큼 앞쪽 lane을 생성하고, 뒤로 사라진 lane은 제거(cull)
function ensureLanes() {
  const top = Math.floor(game.cameraLane) + CONFIG.ROWS_VISIBLE + 4;
  while (game.genCursor < top) {
    game.genCursor++;
    game.lanes[game.genCursor] = makeLane(game.genCursor);
  }
  const bottom = Math.floor(game.cameraLane) - 4;
  for (const k in game.lanes) if (+k < bottom) delete game.lanes[k];
}


/* =========================================================================
   §7~8. 입력 & 이동 / 보간
   ========================================================================= */
function requestMove(dCol, dLane) {
  if (game.state !== 'playing') return;
  if (cat.moving) { game.queued = { dCol, dLane }; return; }   // 점프 중이면 1스텝 큐잉
  doMove(dCol, dLane);
}

function doMove(dCol, dLane) {
  const baseCol = cat.onLog ? Math.round(cat.fcol) : cat.col;
  const tc = baseCol + dCol;
  const tl = cat.lane + dLane;
  if (tc < 0 || tc > 8) return;          // 벽(열 밖) — 이동 무시 (clamp 0~8)
  if (tl < 0) return;                    // 시작 아래로는 못 감(뒤로 금지) — §7 DECISION
  const target = game.lanes[tl];
  // safe lane의 나무/쓰레기통 칸은 진입 불가(크로시로드처럼 제자리)
  if (target && target.type === 'safe' && target.decos[tc] !== undefined) return;

  cat.fromCol = cat.fcol; cat.fromLane = cat.flane;
  cat.toCol = tc; cat.toLane = tl;
  cat.moving = true; cat.jumpT = 0;
  cat.onLog = null;                      // 칸을 떠나면 뗏목 놓음
  if (dCol > 0) cat.dir = 1; else if (dCol < 0) cat.dir = -1;
  sfx.jump();
}

function updateCat(dt) {
  if (cat.moving) {
    cat.jumpT += dt * 1000;
    const k = Math.min(1, cat.jumpT / CONFIG.HOP_MS);
    const e = 1 - (1 - k) * (1 - k);     // easeOutQuad
    cat.fcol = cat.fromCol + (cat.toCol - cat.fromCol) * e;
    cat.flane = cat.fromLane + (cat.toLane - cat.fromLane) * e;
    cat.hop = Math.sin(k * Math.PI) * 12;
    if (k >= 1) landHop();
  } else if (cat.onLog) {
    // 강물 뗏목 타기: 뗏목과 같은 변위로 흘러감 (§10 river)
    const lane = game.lanes[cat.lane];
    if (lane) {
      const v = lane.speed * lane.dir * (game.fever.active ? CONFIG.FEVER_SLOW : 1);
      cat.fcol += v * dt / CONFIG.TILE;
      cat.col = Math.round(cat.fcol);
      // 화면 밖으로 떠내려가면 사망 (§10)
      if ((cat.fcol < -0.45 || cat.fcol > 8.45) && !game.fever.active) { gameOver('river'); return; }
    }
    cat.hop = 0;
  } else {
    cat.hop = 0;
  }
}

function landHop() {
  cat.moving = false;
  cat.col = cat.toCol; cat.lane = cat.toLane;
  cat.fcol = cat.col; cat.flane = cat.lane;
  cat.hop = 0;
  if (cat.lane > game.maxLane) game.maxLane = cat.lane;
  resolveLanding();
  // 큐에 쌓인 다음 입력 실행 (반응성 §7)
  if (game.state === 'playing' && game.queued) {
    const q = game.queued; game.queued = null; doMove(q.dCol, q.dLane);
  }
}

// 착지 처리: 아이템 수집 + 강/도로/철도 판정
function resolveLanding() {
  const lane = game.lanes[cat.lane];
  if (!lane) return;
  const it = lane.items[cat.col];
  if (it && !it.taken) collect(lane, it);

  if (lane.type === 'river') {
    const log = logUnder(lane, cat.col);
    if (log) { cat.onLog = log; cat.fcol = cat.col; }      // 뗏목 위 → 탑승
    else if (!game.fever.active) { gameOver('river'); return; }  // 물 → 익사
  }
  if (lane.type === 'road' || lane.type === 'rail') checkVehicle(lane);
}

function logUnder(lane, col) {
  const cx = col * CONFIG.TILE + CONFIG.TILE / 2;
  for (const e of lane.entities) {
    if (Math.abs(e.x - cx) < e.w / 2 + CONFIG.TILE * 0.3) return e;
  }
  return null;
}

// §10: road/rail — 고양이 AABB(≈36)와 entity AABB가 겹치면 GAME OVER (매 프레임)
function checkVehicle(lane) {
  if (game.fever.active) return;         // 피버 중 무적
  const catCx = cat.fcol * CONFIG.TILE + CONFIG.TILE / 2;
  for (const e of lane.entities) {
    if (Math.abs(e.x - catCx) < e.w / 2 + 18) { gameOver('crash'); return; }
  }
}


/* =========================================================================
   §14. 아이템 / 점수 / 피버
   ========================================================================= */
function collect(lane, it) {
  it.taken = true;
  const mult = game.fever.active ? 2 : 1;             // 피버 중 점수 x2
  const T = CONFIG.TILE;
  const px = cat.col * T + T / 2, py = 320;           // 팝업 표시는 화면 중앙쯤
  if (it.kind === 'bungeoppang') {
    game.bonus += CONFIG.BUNGEO_POINTS * mult; sfx.score();
    addPop('+' + CONFIG.BUNGEO_POINTS * mult, '#ff8f88');
  } else if (it.kind === 'coin') {
    game.coins++; sfx.coin(); addPop('🪙', '#f2d06b');
  } else if (it.kind === 'churu') {
    startFever(); addPop('피버!', '#ff7ea8');
  } else if (it.kind === 'fish') {
    game.fish++; game.bonus += CONFIG.FISH_POINTS * mult; sfx.score();
    addPop('🐟 +' + CONFIG.FISH_POINTS * mult, '#5AA9E6');
  }
  updateScore();
}

function updateScore() { game.score = game.maxLane + game.bonus; }

function startFever() {
  game.fever.active = true;
  game.fever.timeLeft = CONFIG.FEVER_MS;
  sfx.fever();
}
function updateFever(dt) {
  if (game.fever.active) {
    game.fever.timeLeft -= dt * 1000;
    if (game.fever.timeLeft <= 0) { game.fever.active = false; game.fever.timeLeft = 0; }
  }
}

function addPop(text, color) {
  const T = CONFIG.TILE;
  const x = cat.fcol * T + T / 2;
  const y = screenY(cat.flane) + T / 2 - 14;
  game.pops.push({ text, color, x, y, life: 900 });
}
function updatePops(dt) {
  for (let i = game.pops.length - 1; i >= 0; i--) {
    const p = game.pops[i]; p.life -= dt * 1000; p.y -= dt * 26;
    if (p.life <= 0) game.pops.splice(i, 1);
  }
}


/* =========================================================================
   §12. 카메라 & 오토스크롤 (두 힘을 max로 합침)
   ========================================================================= */
function updateCamera(dt) {
  const auto = Math.min(CONFIG.AUTO_MAX,
    CONFIG.AUTO_BASE + game.maxLane * CONFIG.AUTO_PER_SCORE) * (game.fever.active ? 0.7 : 1);
  const autoTarget = game.cameraLane + auto * dt;             // 뒤에서 밀어붙이는 압박
  const followTarget = cat.flane - CONFIG.FOLLOW_OFFSET;      // 고양이 따라가기
  game.cameraLane = Math.max(autoTarget, followTarget);       // 둘 중 큰 값
}

// §10: 화면 하단 밖으로 밀려나면 사망
function updateLose() {
  if (game.state !== 'playing') return;
  if (cat.flane < game.cameraLane - 0.5) gameOver('behind');
}


/* =========================================================================
   장애물 이동 & 충돌 (매 프레임)
   ========================================================================= */
function updateEntities(dt) {
  const slow = game.fever.active ? CONFIG.FEVER_SLOW : 1;
  for (const k in game.lanes) {
    const lane = game.lanes[k];
    if (!lane.entities.length) continue;
    const v = lane.speed * lane.dir * slow;
    const maxX = lane.minX + lane.period;
    for (const e of lane.entities) {
      e.x += v * dt;
      if (e.x >= maxX) e.x -= lane.period;
      else if (e.x < lane.minX) e.x += lane.period;
    }
  }
}

function updateCollisions() {
  if (game.state !== 'playing') return;
  const lane = game.lanes[cat.lane];
  if (lane && (lane.type === 'road' || lane.type === 'rail')) checkVehicle(lane);
}

// §10 rail: 기차가 재생구역(0~360)에 들어오기 ~1초 전 경고 깜빡임 여부
function railApproaching(lane) {
  const WARN = 1.0, L = 0, R = CONFIG.LOGIC_W;
  for (const e of lane.entities) {
    const l = e.x - e.w / 2, r = e.x + e.w / 2;
    if (r > L && l < R) return true;                          // 이미 지나가는 중
    if (lane.dir > 0 && r < L) { if ((L - r) / lane.speed < WARN) return true; }
    if (lane.dir < 0 && l > R) { if ((l - R) / lane.speed < WARN) return true; }
  }
  return false;
}


/* =========================================================================
   게임 오버 / 최고 점수 (§15)
   ========================================================================= */
function gameOver() {
  if (game.state !== 'playing') return;
  updateScore();                     // 사망 직전 최신 점수로 확정(도착 lane 포함)
  game.state = 'gameover';
  game.newRecord = game.score > (game.best[0] || 0);
  saveBest();
  sfx.gameover();
}
function loadBest() {
  let b = LS.get('catrun_best', [0, 0, 0]);
  if (!Array.isArray(b)) b = [0, 0, 0];
  b = b.slice(0, 3); while (b.length < 3) b.push(0);
  game.best = b;
}
function saveBest() {
  game.best.push(game.score);
  game.best.sort((a, b) => b - a);
  game.best = game.best.slice(0, 3);
  LS.set('catrun_best', game.best);
}


/* =========================================================================
   §6. 게임 루프 & 업데이트
   ========================================================================= */
let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05);   // 초, 상한으로 튐 방지
  last = now;
  if (game.state === 'playing') update(dt);
  else updatePops(dt);
  render();
  requestAnimationFrame(loop);
}
function update(dt) {
  updateCat(dt);          // 보간/뗏목 흐름 (maxLane, 착지 판정 포함)
  updateEntities(dt);     // 차/기차/뗏목 이동
  updateCamera(dt);       // 카메라 = max(auto, follow)
  ensureLanes();          // 앞쪽 lane 생성 / 뒤쪽 제거
  updateCollisions();     // road/rail 연속 충돌
  updateFever(dt);
  updateLose();           // 하단 밀림 사망
  updatePops(dt);
  updateScore();
}


/* =========================================================================
   렌더링 (§9) — drawSprite에 그리기를 집중 (나중에 PNG 교체 시 한 곳만 수정)
   ========================================================================= */
function screenY(laneIndex) {
  return CONFIG.LOGIC_H - CONFIG.TILE - (laneIndex - game.cameraLane) * CONFIG.TILE;
}
function rrect(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function render() {
  ctx.clearRect(0, 0, CONFIG.LOGIC_W, CONFIG.LOGIC_H);
  if (game.state === 'ready') { drawMenu(); return; }

  // --- lane 배경 (위→아래로 그려 원근감; 사실 순서 무관) ---
  const top = Math.floor(game.cameraLane) + CONFIG.ROWS_VISIBLE + 1;
  const bot = Math.floor(game.cameraLane) - 1;
  for (let i = top; i >= bot; i--) drawLaneBg(game.lanes[i], i);
  for (let i = top; i >= bot; i--) { const l = game.lanes[i]; if (l) drawLaneContent(l); }

  drawCat();
  drawPops();
  drawHUD();
  if (game.fever.active) drawFeverOverlay();
  drawToast();

  if (game.state === 'gameover') drawGameOver();
}

function drawLaneBg(lane, i) {
  const y = screenY(i), T = CONFIG.TILE, W = CONFIG.LOGIC_W;
  if (y > CONFIG.LOGIC_H || y < -T) return;
  if (!lane) { ctx.fillStyle = COL.safeGrass; ctx.fillRect(0, y, W, T); return; }

  if (lane.type === 'safe') {
    ctx.fillStyle = (i % 2 === 0) ? COL.safeGrass : COL.safeCream;
    ctx.fillRect(0, y, W, T);
  } else if (lane.type === 'road') {
    ctx.fillStyle = COL.road; ctx.fillRect(0, y, W, T);
    // 중앙 점선
    ctx.fillStyle = COL.roadLine;
    for (let x = 6; x < W; x += 30) ctx.fillRect(x, y + T / 2 - 2, 16, 4);
    ctx.fillStyle = 'rgba(255,255,255,.10)'; ctx.fillRect(0, y, W, 3);
  } else if (lane.type === 'rail') {
    ctx.fillStyle = COL.rail; ctx.fillRect(0, y, W, T);
    // 침목 + 두 레일
    ctx.fillStyle = COL.railTie;
    for (let x = 4; x < W; x += 20) ctx.fillRect(x, y + 4, 8, T - 8);
    ctx.fillStyle = COL.railMetal;
    ctx.fillRect(0, y + 10, W, 3); ctx.fillRect(0, y + T - 13, W, 3);
    // 기차 접근 경고 (§10)
    if (railApproaching(lane) && (Math.floor(performance.now() / 180) % 2 === 0)) {
      ctx.fillStyle = 'rgba(229,72,77,.42)'; ctx.fillRect(0, y, W, T);
    }
  } else if (lane.type === 'river') {
    ctx.fillStyle = COL.river; ctx.fillRect(0, y, W, T);
    ctx.fillStyle = COL.riverDark;
    const t = performance.now() / 600;
    for (let x = 0; x < W; x += 24) {
      const wy = y + T / 2 + Math.sin(x * 0.25 + t) * 3;
      ctx.fillRect(x + 4, wy, 12, 2);
    }
  }
}

function drawLaneContent(lane) {
  const T = CONFIG.TILE, y = screenY(lane.index);
  if (y > CONFIG.LOGIC_H || y < -T) return;
  const cy = y + T / 2;

  // 정적 장식 (safe)
  for (const c in lane.decos) {
    const x = (+c) * T + T / 2;
    drawSprite(lane.decos[c], x, cy);
  }
  // 이동 장애물 / 뗏목
  for (const e of lane.entities) drawSprite(lane.kind, e.x, cy, e.w);
  // 아이템
  for (const c in lane.items) {
    const it = lane.items[c];
    if (it.taken) continue;
    const x = (+c) * T + T / 2;
    const bob = Math.sin(performance.now() / 300 + (+c)) * 2;
    drawSprite(it.kind, x, cy + bob);
  }
}

/* -------------------------------------------------------------------------
   drawSprite(kind, cx, cy, w?) — 모든 스프라이트를 여기 한 곳에서 그린다.
   (§9: 나중에 PNG로 교체하려면 이 함수만 바꾸면 된다)
   ------------------------------------------------------------------------- */
function drawSprite(kind, cx, cy, w) {
  const T = CONFIG.TILE;
  switch (kind) {
    case 'tree': {
      ctx.fillStyle = '#8a5a34'; ctx.fillRect(cx - 3, cy - 2, 6, 14);
      ctx.fillStyle = '#4e9c5b'; circle(cx, cy - 6, 13);
      ctx.fillStyle = '#5fb56d'; circle(cx - 5, cy - 4, 9);
      ctx.fillStyle = '#6fc47c'; circle(cx + 5, cy - 9, 8);
      break;
    }
    case 'trash': {
      ctx.fillStyle = '#7d8794'; rrect(cx - 10, cy - 8, 20, 20, 3); ctx.fill();
      ctx.fillStyle = '#9aa5b2'; ctx.fillRect(cx - 12, cy - 12, 24, 5);
      ctx.fillStyle = '#5f6874'; ctx.fillRect(cx - 6, cy - 4, 3, 12); ctx.fillRect(cx + 3, cy - 4, 3, 12);
      break;
    }
    case 'scooter': {   // 배달 스쿠터 (작고 빠름)
      const ww = w || T * 0.95;
      ctx.fillStyle = '#e5545a'; rrect(cx - ww / 2, cy - 8, ww, 15, 5); ctx.fill();
      ctx.fillStyle = '#ffd36e'; rrect(cx - ww / 2 + 2, cy - 14, 12, 10, 2); ctx.fill(); // 배달통
      ctx.fillStyle = '#2a2540'; circle(cx - ww / 2 + 6, cy + 8, 5); circle(cx + ww / 2 - 6, cy + 8, 5);
      ctx.fillStyle = '#cfd6e0'; circle(cx - ww / 2 + 6, cy + 8, 2); circle(cx + ww / 2 - 6, cy + 8, 2);
      break;
    }
    case 'bus': {       // 시내버스 (길고 느림, 2칸)
      const ww = w || T * 2;
      ctx.fillStyle = '#5cc0a8'; rrect(cx - ww / 2, cy - 12, ww, 22, 6); ctx.fill();
      ctx.fillStyle = '#dff6ef';
      for (let i = 0; i < 4; i++) ctx.fillRect(cx - ww / 2 + 8 + i * (ww - 16) / 4, cy - 8, (ww - 24) / 4, 8);
      ctx.fillStyle = '#2a2540'; circle(cx - ww / 2 + 12, cy + 10, 5); circle(cx + ww / 2 - 12, cy + 10, 5);
      break;
    }
    case 'train': {     // 지하철 (매우 빠르고 긺)
      const ww = w || T * 2.8;
      ctx.fillStyle = '#4a6fa5'; rrect(cx - ww / 2, cy - 14, ww, 26, 7); ctx.fill();
      ctx.fillStyle = '#eaf1fb'; ctx.fillRect(cx - ww / 2 + 6, cy - 9, ww - 12, 8);
      ctx.fillStyle = '#ffd36e'; circle(cx - ww / 2 + 6, cy + 6, 3); circle(cx + ww / 2 - 6, cy + 6, 3);
      ctx.strokeStyle = '#33507c'; ctx.lineWidth = 1;
      for (let i = 1; i < 4; i++) { const lx = cx - ww / 2 + i * ww / 4; ctx.beginPath(); ctx.moveTo(lx, cy - 9); ctx.lineTo(lx, cy - 1); ctx.stroke(); }
      break;
    }
    case 'log': {       // 통나무 뗏목
      const ww = w || T * 2;
      ctx.fillStyle = '#a9743e'; rrect(cx - ww / 2, cy - 9, ww, 18, 6); ctx.fill();
      ctx.fillStyle = '#8a5a2e';
      for (let x = cx - ww / 2 + 6; x < cx + ww / 2 - 3; x += 10) ctx.fillRect(x, cy - 8, 2, 16);
      ctx.fillStyle = '#c68a4e'; ctx.fillRect(cx - ww / 2, cy - 9, ww, 3);
      break;
    }
    case 'bungeoppang': {  // 붕어빵 (물고기 모양 빵)
      ctx.save(); ctx.translate(cx, cy);
      ctx.fillStyle = '#c98a3f';
      ctx.beginPath(); ctx.ellipse(0, 0, 11, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(16, -6); ctx.lineTo(16, 6); ctx.closePath(); ctx.fill(); // 꼬리
      ctx.fillStyle = '#a86e2c';
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 4, -6); ctx.lineTo(i * 4, 6); ctx.lineWidth = 1; ctx.strokeStyle = '#a86e2c'; ctx.stroke(); }
      ctx.fillStyle = '#4b3b57'; circle(-5, -2, 1.6);   // 눈
      ctx.restore();
      break;
    }
    case 'coin': {       // 500원 코인
      ctx.fillStyle = '#e0a92b'; circle(cx, cy, 10);
      ctx.fillStyle = '#ffd36e'; circle(cx, cy, 8);
      ctx.fillStyle = '#b9861f'; ctx.font = "bold 10px " + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('₩', cx, cy + 1);
      break;
    }
    case 'churu': {      // 츄르 (고양이 간식)
      ctx.fillStyle = '#7fcbb0'; rrect(cx - 5, cy - 11, 10, 22, 4); ctx.fill();
      ctx.fillStyle = '#e8f7f0'; rrect(cx - 3, cy - 9, 6, 8, 2); ctx.fill();
      ctx.fillStyle = '#4e9c8a'; ctx.fillRect(cx - 5, cy + 8, 10, 3);
      break;
    }
    case 'fish': {       // 한강 물고기
      ctx.save(); ctx.translate(cx, cy);
      ctx.fillStyle = '#5AA9E6';
      ctx.beginPath(); ctx.ellipse(0, 0, 10, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-14, -5); ctx.lineTo(-14, 5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; circle(5, -1, 2); ctx.fillStyle = '#2a2540'; circle(5.5, -1, 1);
      ctx.restore();
      break;
    }
  }
  ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
}

function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }

// 고양이 나비(Nabi) — 파스텔 삼색 (§9)
function drawCat() {
  const T = CONFIG.TILE;
  const cx = cat.fcol * T + T / 2;
  const cy = screenY(cat.flane) + T / 2 - cat.hop;
  const dir = cat.dir;

  // 그림자
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.beginPath(); ctx.ellipse(cx, screenY(cat.flane) + T / 2 + 8, 12, 4, 0, 0, Math.PI * 2); ctx.fill();

  // 피버 무적 오라
  if (game.fever.active) {
    ctx.fillStyle = 'rgba(255,211,110,' + (0.25 + 0.15 * Math.sin(performance.now() / 90)) + ')';
    circle(cx, cy, 20);
  }

  ctx.save(); ctx.translate(cx, cy); ctx.scale(dir, 1);

  // 꼬리
  ctx.strokeStyle = '#f2a65a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-8, 6); ctx.quadraticCurveTo(-16, 2, -14, -8); ctx.stroke();

  // 몸통 (흰색)
  ctx.fillStyle = '#fbf3ec'; rrect(-11, -6, 22, 18, 7); ctx.fill();
  // 주황 등무늬
  ctx.fillStyle = '#f2a65a'; rrect(-11, -6, 22, 7, 6); ctx.fill();

  // 머리
  ctx.fillStyle = '#fbf3ec'; circle(0, -10, 10);
  // 귀
  ctx.fillStyle = '#f2a65a';
  ctx.beginPath(); ctx.moveTo(-9, -16); ctx.lineTo(-4, -20); ctx.lineTo(-2, -14); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(9, -16); ctx.lineTo(4, -20); ctx.lineTo(2, -14); ctx.closePath(); ctx.fill();
  // 주황 이마 무늬
  ctx.fillStyle = '#f2a65a'; circle(2, -13, 4);
  // 눈 / 코
  ctx.fillStyle = '#3a2f4a'; circle(-3, -10, 1.8); circle(4, -10, 1.8);
  ctx.fillStyle = '#ff9aa2'; circle(0.5, -7, 1.4);
  // 수염
  ctx.strokeStyle = 'rgba(120,110,130,.7)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(3, -8); ctx.lineTo(11, -9); ctx.moveTo(3, -6); ctx.lineTo(11, -6); ctx.stroke();

  ctx.restore();
  ctx.lineCap = 'butt';
}

function drawPops() {
  ctx.textAlign = 'center'; ctx.font = "bold 14px " + FONT;
  for (const p of game.pops) {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 500));
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, p.y);
  }
  ctx.globalAlpha = 1; ctx.textAlign = 'start';
}


/* =========================================================================
   §18. HUD & 화면 (전부 캔버스에 그림)
   ========================================================================= */
const FONT = "'Galmuri11','Galmuri',monospace";

// 버튼/토글 사각형 (논리 좌표) — 입력 히트테스트에 사용
const muteBtn = { x: 318, y: 10, w: 32, h: 32 };
const btnStart = { x: 60, y: 470, w: 240, h: 56 };
const btnRetry = { x: 40, y: 486, w: 130, h: 50 };
const btnCopy = { x: 190, y: 486, w: 130, h: 50 };
function hit(b, x, y) { return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h; }

function drawHUD() {
  const T = CONFIG.TILE;
  // 좌상단 점수 박스
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  rrect(10, 10, 150, 52, 8); ctx.fill();
  ctx.fillStyle = COL.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.font = "16px " + FONT;
  ctx.fillText('점수: ' + game.score, 20, 32);
  ctx.font = "13px " + FONT;
  ctx.fillText('🪙 ' + game.coins + '   최고: ' + (game.best[0] || 0), 20, 52);

  // 우상단 음소거 토글
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  rrect(muteBtn.x, muteBtn.y, muteBtn.w, muteBtn.h, 8); ctx.fill();
  ctx.font = "18px " + FONT; ctx.textAlign = 'center';
  ctx.fillText(sfx.enabled ? '🔊' : '🔇', muteBtn.x + muteBtn.w / 2, muteBtn.y + 23);

  // 피버 게이지 바
  const fw = 120, fx = CONFIG.LOGIC_W / 2 - fw / 2, fy = 16;
  ctx.textAlign = 'center'; ctx.font = "11px " + FONT; ctx.fillStyle = '#fff';
  if (game.fever.active) {
    ctx.fillStyle = 'rgba(255,255,255,.7)'; rrect(fx, fy, fw, 12, 6); ctx.fill();
    const p = game.fever.timeLeft / CONFIG.FEVER_MS;
    ctx.fillStyle = '#ff7ea8'; rrect(fx, fy, fw * p, 12, 6); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = "bold 12px " + FONT;
    ctx.fillText('피버 타임!', CONFIG.LOGIC_W / 2, fy + 26);
  }
  ctx.textAlign = 'start';
}

function drawFeverOverlay() {
  const t = performance.now() / 400;
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = 'hsl(' + ((t * 60) % 360) + ',80%,60%)';
  ctx.fillRect(0, 0, CONFIG.LOGIC_W, CONFIG.LOGIC_H);
  ctx.restore();
}

function drawMenu() {
  // 배경
  const g = ctx.createLinearGradient(0, 0, 0, CONFIG.LOGIC_H);
  g.addColorStop(0, '#ffe3ec'); g.addColorStop(0.5, '#e7f6ef'); g.addColorStop(1, '#fff8d6');
  ctx.fillStyle = g; ctx.fillRect(0, 0, CONFIG.LOGIC_W, CONFIG.LOGIC_H);

  // 미리보기 lane 몇 개
  for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? COL.road : COL.safeGrass; ctx.fillRect(0, 150 + i * 40, CONFIG.LOGIC_W, 40); }
  ctx.fillStyle = 'rgba(255,248,214,.55)'; ctx.fillRect(0, 150, CONFIG.LOGIC_W, 160);

  // 마스코트 고양이
  const save = { fcol: cat.fcol, flane: cat.flane, hop: cat.hop, dir: cat.dir };
  ctx.save(); ctx.translate(180 - (4 * 40 + 20), 0);
  cat.fcol = 4; cat.hop = 10 + Math.sin(performance.now() / 300) * 4;
  game.cameraLane = 0; cat.flane = 5.9; cat.dir = 1;   // 미리보기 lane과 버튼 사이 빈 공간
  drawCat();
  ctx.restore();
  cat.fcol = save.fcol; cat.flane = save.flane; cat.hop = save.hop; cat.dir = save.dir;

  // 타이틀
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff8f88'; ctx.font = "bold 34px " + FONT;
  ctx.fillText('길냥이 붕어빵 런', CONFIG.LOGIC_W / 2, 90);
  ctx.fillStyle = '#7fcbb0'; ctx.font = "15px " + FONT;
  ctx.fillText('한 손으로 즐기는 무한 길 건너기', CONFIG.LOGIC_W / 2, 120);

  // 시작 버튼
  ctx.fillStyle = '#ffb7b2'; rrect(btnStart.x, btnStart.y, btnStart.w, btnStart.h, 12); ctx.fill();
  ctx.strokeStyle = COL.ink; ctx.lineWidth = 3; rrect(btnStart.x, btnStart.y, btnStart.w, btnStart.h, 12); ctx.stroke();
  ctx.fillStyle = COL.ink; ctx.font = "bold 22px " + FONT;
  ctx.fillText('게임 시작', CONFIG.LOGIC_W / 2, btnStart.y + 37);

  // 조작 안내
  ctx.fillStyle = COL.ink; ctx.font = "13px " + FONT;
  ctx.fillText('탭 = 앞으로 · 좌우 스와이프 = 이동', CONFIG.LOGIC_W / 2, 560);
  ctx.font = "11px " + FONT; ctx.fillStyle = 'rgba(75,59,87,.7)';
  ctx.fillText('PC: 방향키 / WASD / Space', CONFIG.LOGIC_W / 2, 582);
  ctx.textAlign = 'start';
  drawToast();
}

function drawGameOver() {
  ctx.fillStyle = 'rgba(30,24,44,.72)'; ctx.fillRect(0, 0, CONFIG.LOGIC_W, CONFIG.LOGIC_H);
  const bx = 40, bw = 280, by = 120, bh = 400;
  ctx.fillStyle = '#fff6f0'; rrect(bx, by, bw, bh, 12); ctx.fill();
  ctx.strokeStyle = COL.ink; ctx.lineWidth = 4; rrect(bx, by, bw, bh, 12); ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff8f88'; ctx.font = "bold 30px " + FONT;
  ctx.fillText('게임 오버', CONFIG.LOGIC_W / 2, by + 46);

  ctx.fillStyle = COL.ink; ctx.font = "17px " + FONT;
  ctx.fillText('이번 점수: ' + game.score, CONFIG.LOGIC_W / 2, by + 84);
  ctx.font = "14px " + FONT;
  ctx.fillText('🐟 x' + game.fish + '   🪙 x' + game.coins, CONFIG.LOGIC_W / 2, by + 108);
  ctx.fillText('최고 기록: ' + (game.best[0] || 0), CONFIG.LOGIC_W / 2, by + 132);

  if (game.newRecord) {
    ctx.fillStyle = '#7fcbb0'; ctx.font = "bold 16px " + FONT;
    ctx.fillText('🎉 신기록 달성!', CONFIG.LOGIC_W / 2, by + 160);
  }

  // 랭킹 TOP 3
  ctx.fillStyle = COL.ink; ctx.font = "bold 14px " + FONT;
  ctx.fillText('랭킹 (TOP 3)', CONFIG.LOGIC_W / 2, by + 196);
  ctx.font = "14px " + FONT;
  const medal = ['🥇', '🥈', '🥉'];
  for (let i = 0; i < 3; i++) {
    ctx.fillText(medal[i] + '  ' + (game.best[i] || 0), CONFIG.LOGIC_W / 2, by + 222 + i * 24);
  }

  // 버튼
  ctx.fillStyle = '#b5ead7'; rrect(btnRetry.x, btnRetry.y, btnRetry.w, btnRetry.h, 10); ctx.fill();
  ctx.strokeStyle = COL.ink; ctx.lineWidth = 3; rrect(btnRetry.x, btnRetry.y, btnRetry.w, btnRetry.h, 10); ctx.stroke();
  ctx.fillStyle = COL.ink; ctx.font = "bold 16px " + FONT;
  ctx.fillText('다시 하기', btnRetry.x + btnRetry.w / 2, btnRetry.y + 32);

  ctx.fillStyle = '#ffb7b2'; rrect(btnCopy.x, btnCopy.y, btnCopy.w, btnCopy.h, 10); ctx.fill();
  ctx.strokeStyle = COL.ink; rrect(btnCopy.x, btnCopy.y, btnCopy.w, btnCopy.h, 10); ctx.stroke();
  ctx.fillStyle = COL.ink;
  ctx.fillText('결과 복사', btnCopy.x + btnCopy.w / 2, btnCopy.y + 32);

  ctx.textAlign = 'start';
  drawToast();
}


/* =========================================================================
   §19. 결과 복사 (share) + 토스트
   ========================================================================= */
let toast = { text: '', until: 0 };
function showToast(t) { toast.text = t; toast.until = performance.now() + 1800; }
function drawToast() {
  if (performance.now() > toast.until) return;
  ctx.textAlign = 'center'; ctx.font = "13px " + FONT;
  const w = ctx.measureText(toast.text).width + 28;
  const x = CONFIG.LOGIC_W / 2 - w / 2, y = 300;
  ctx.fillStyle = 'rgba(75,59,87,.92)'; rrect(x, y, w, 30, 10); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillText(toast.text, CONFIG.LOGIC_W / 2, y + 20);
  ctx.textAlign = 'start';
}

function copyResult() {
  const region = REGIONS[(Math.random() * REGIONS.length) | 0];
  const url = location.href;
  const text = '🐱 길냥이 붕어빵 런\n점수 ' + game.score + '  🐟x' + game.fish +
    '\n' + region + ' 에서 신기록!\n👉 지금 도전: ' + url;
  const done = () => showToast('복사됨! 카톡에 붙여넣기 하세요 📋');
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else fallbackCopy(text, done);
  } catch (e) { fallbackCopy(text, done); }
}
function fallbackCopy(text, done) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.focus(); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta); done();
  } catch (e) { showToast('복사 실패 😢'); }
}


/* =========================================================================
   시작 / 리셋
   ========================================================================= */
function startGame() {
  sfx.init();
  game.lanes = {};
  game.cameraLane = -CONFIG.FOLLOW_OFFSET;
  game.state = 'playing';
  game.maxLane = 0; game.bonus = 0; game.coins = 0; game.fish = 0; game.score = 0;
  game.fever = { active: false, timeLeft: 0 };
  game.dangerStreak = 0; game.prevFreeCols = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  game.genCursor = Math.floor(game.cameraLane) - 2;
  game.queued = null; game.pops = [];
  game.newRecord = false;

  cat.col = 4; cat.lane = 0; cat.fcol = 4; cat.flane = 0;
  cat.moving = false; cat.onLog = null; cat.dir = 1; cat.jumpT = 0; cat.hop = 0;

  ensureLanes();
}


/* =========================================================================
   §7. 입력 바인딩 (touch / mouse / keyboard)
   ========================================================================= */
function toLogic(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (clientX - r.left) / r.width * CONFIG.LOGIC_W,
    y: (clientY - r.top) / r.height * CONFIG.LOGIC_H,
  };
}

let pStart = null;
function onDown(x, y) { sfx.init(); pStart = { x, y }; }
function onUp(x, y) {
  if (!pStart) return;
  const dx = x - pStart.x, dy = y - pStart.y;
  const adx = Math.abs(dx), ady = Math.abs(dy);
  pStart = null;

  // 어느 화면이든 음소거 토글 먼저
  if ((game.state === 'playing') && hit(muteBtn, x, y)) { toggleMute(); return; }

  if (game.state === 'ready') {
    // 버튼 or 아무 곳이나 탭 = 시작
    if (adx < 30 && ady < 30) startGame();
    return;
  }
  if (game.state === 'gameover') {
    if (hit(btnRetry, x, y)) startGame();
    else if (hit(btnCopy, x, y)) copyResult();
    return;
  }
  // playing: tap vs swipe (§7, 임계값 30px)
  if (adx < 30 && ady < 30) { requestMove(0, 1); return; }   // 탭 = 앞으로
  if (adx >= ady) { requestMove(dx > 0 ? 1 : -1, 0); }        // 좌우 스와이프
  else if (dy < 0) { requestMove(0, 1); }                    // 위로 스와이프 = 앞으로 (아래=무시)
}

function bindInput() {
  // touch
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    const t = e.changedTouches[0]; const p = toLogic(t.clientX, t.clientY); onDown(p.x, p.y);
  }, { passive: false });
  canvas.addEventListener('touchend', e => {
    e.preventDefault();
    const t = e.changedTouches[0]; const p = toLogic(t.clientX, t.clientY); onUp(p.x, p.y);
  }, { passive: false });
  // mouse (PC에서도 탭/스와이프 가능)
  canvas.addEventListener('mousedown', e => { const p = toLogic(e.clientX, e.clientY); onDown(p.x, p.y); });
  canvas.addEventListener('mouseup', e => { const p = toLogic(e.clientX, e.clientY); onUp(p.x, p.y); });
  // keyboard
  window.addEventListener('keydown', e => {
    if (game.state === 'ready') {
      if (e.key === ' ' || e.key === 'Enter') { sfx.init(); startGame(); e.preventDefault(); }
      return;
    }
    if (game.state === 'gameover') {
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'r' || e.key === 'R') { startGame(); e.preventDefault(); }
      return;
    }
    switch (e.key) {
      case 'ArrowUp': case 'w': case 'W': case ' ': requestMove(0, 1); e.preventDefault(); break;
      case 'ArrowLeft': case 'a': case 'A': requestMove(-1, 0); e.preventDefault(); break;
      case 'ArrowRight': case 'd': case 'D': requestMove(1, 0); e.preventDefault(); break;
      case 'ArrowDown': case 's': case 'S': e.preventDefault(); break;  // 뒤로 금지
      case 'm': case 'M': toggleMute(); break;
    }
  });
}

function toggleMute() { sfx.enabled = !sfx.enabled; if (sfx.enabled) { sfx.init(); showToast('소리 켜짐 🔊'); } else showToast('소리 꺼짐 🔇'); }


/* =========================================================================
   부트
   ========================================================================= */
function boot() {
  setupCanvas();
  loadBest();
  bindInput();
  requestAnimationFrame(loop);
}
boot();
