"use strict";
/* 택배 포장 — 블록 맞추기 — 꺅두기 하우스 */

/* ===============================================================
   택배 포장 — 블록 블라스트 식 상자 채우기

   8×8 상자에 블록 세 개가 차례로 주어집니다. 끌어다 넣고,
   가로나 세로 한 줄이 꽉 차면 그 줄이 비워지면서 점수가 됩니다.
   세 개 중 어느 것도 들어갈 자리가 없으면 끝.

   시간이 가지 않는 게 핵심입니다 — 급할 이유가 없으니
   반사신경이 아니라 머리로 하는 알바가 됩니다.
   =============================================================== */
const PackGame = (function(){
"use strict";

const N = 8;                 /* 상자 칸 수 */
const TRAY = 3;              /* 한 번에 주어지는 블록 수 */

/* 블록 모양 — 기본형을 돌려서 종류를 만듭니다 */
const BASE = [
  [[0,0]],
  [[0,0],[0,1]],
  [[0,0],[0,1],[0,2]],
  [[0,0],[0,1],[0,2],[0,3]],
  [[0,0],[0,1],[0,2],[0,3],[0,4]],
  [[0,0],[0,1],[1,0],[1,1]],                                  /* 2x2 */
  [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2]],    /* 3x3 */
  [[0,0],[1,0],[1,1]],                                        /* 작은 ㄱ */
  [[0,0],[1,0],[2,0],[2,1],[2,2]],                            /* 큰 ㄱ */
  [[0,0],[0,1],[0,2],[1,1]],                                  /* T */
  [[0,1],[0,2],[1,0],[1,1]],                                  /* S */
  [[0,0],[0,1],[1,1],[1,2]]                                   /* Z */
];
function rot(cells){                       /* 시계 방향 90도 */
  const h = Math.max(...cells.map(c => c[0])) + 1;
  return norm(cells.map(([r, c]) => [c, h - 1 - r]));
}
function norm(cells){
  const mr = Math.min(...cells.map(c => c[0])), mc = Math.min(...cells.map(c => c[1]));
  return cells.map(([r, c]) => [r - mr, c - mc])
              .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}
const SHAPES = (function(){
  const out = [], seen = new Set();
  for(const b of BASE){
    let cur = norm(b);
    for(let i = 0; i < 4; i++){
      const key = JSON.stringify(cur);
      if(!seen.has(key)){ seen.add(key); out.push(cur); }
      cur = rot(cur);
    }
  }
  return out;
})();
const COLORS = ['#EFA6B8','#8FC0D8','#8FBF92','#E7B075','#AD9ED4','#E0B84E','#7FC9C4'];

let grid = [], tray = [], score = 0, lines = 0, combo = 0, placed = 0, bestBurst = 0;
let drag = null, over = null, state = 'play';
let clearFx = [], t = 0, onEnd = null, ended = false, hit = [];

/* ===== 시작 ===== */
function start(o){
  onEnd = o && o.onEnd;
  grid = []; for(let r = 0; r < N; r++) grid.push(new Array(N).fill(null));
  tray = []; refill();
  score = 0; lines = 0; combo = 0; placed = 0; bestBurst = 0;
  drag = null; over = null; state = 'play'; clearFx = []; t = 0; ended = false;
}
function refill(){
  for(let i = 0; i < TRAY; i++) tray[i] = newPiece();
}
function newPiece(){
  const cells = SHAPES[Math.floor(Math.random() * SHAPES.length)];
  return { cells, color: COLORS[Math.floor(Math.random() * COLORS.length)],
           h: Math.max(...cells.map(c => c[0])) + 1,
           w: Math.max(...cells.map(c => c[1])) + 1 };
}

/* ===== 놓을 수 있나 ===== */
function fits(p, r0, c0){
  for(const [r, c] of p.cells){
    const r2 = r0 + r, c2 = c0 + c;
    if(r2 < 0 || c2 < 0 || r2 >= N || c2 >= N) return false;
    if(grid[r2][c2]) return false;
  }
  return true;
}
function anyFit(p){
  for(let r = 0; r <= N - p.h; r++)
    for(let c = 0; c <= N - p.w; c++)
      if(fits(p, r, c)) return true;
  return false;
}
function stuck(){
  return tray.every(p => !p || !anyFit(p));
}

/* ===== 놓기 ===== */
function place(i, r0, c0){
  const p = tray[i];
  if(!p || !fits(p, r0, c0)) return false;
  for(const [r, c] of p.cells) grid[r0 + r][c0 + c] = p.color;
  placed += p.cells.length;
  score += p.cells.length;
  tray[i] = null;
  clearLines();
  if(tray.every(x => !x)) refill();
  if(stuck()) finish();
  else sfxCoin(1);
  return true;
}
function clearLines(){
  const rows = [], cols = [];
  for(let r = 0; r < N; r++) if(grid[r].every(v => v)) rows.push(r);
  for(let c = 0; c < N; c++){
    let full = true;
    for(let r = 0; r < N; r++) if(!grid[r][c]){ full = false; break; }
    if(full) cols.push(c);
  }
  const n = rows.length + cols.length;
  if(!n){ combo = 0; return; }
  rows.forEach(r => { for(let c = 0; c < N; c++){ clearFx.push({ r, c, t:0, color: grid[r][c] }); grid[r][c] = null; } });
  cols.forEach(c => { for(let r = 0; r < N; r++){ if(grid[r][c]) clearFx.push({ r, c, t:0, color: grid[r][c] }); grid[r][c] = null; } });
  combo++;
  lines += n;
  if(n > bestBurst) bestBurst = n;
  /* 한 번에 여러 줄을 지울수록 훨씬 크게, 연달아 지워도 보너스 */
  score += n * n * 18 + (combo - 1) * 25;
  if(n >= 2) arp([660, 880, 1175], 0.06, 0.16);
  else sfxCoin(3);
}
function finish(){
  if(ended) return;
  ended = true; state = 'over';
  sfxNo();
  if(onEnd) setTimeout(() => onEnd({ score: Math.round(score), lines, placed,
                                     burst: bestBurst, best: S.packBest || 0 }), 900);
}
function quit(){ if(!ended) finish(); }

/* ===== 자리 계산 ===== */
function boardRect(){
  const s = Math.min(H * 0.80, W * 0.42);
  return { x: W * 0.5 - s * 0.5, y: H * 0.5 - s * 0.5 + H * 0.02, w: s, h: s, cell: s / N };
}
function trayRect(i){
  const b = boardRect();
  const w = Math.min(W * 0.2, (W - (b.x + b.w)) * 0.8);
  const h = Math.min(b.h / 3.4, H * 0.22);
  const x = Math.min(W - w - 14 * uiK(), b.x + b.w + 20 * uiK());
  const gap = (b.h - h * 3) / 2;
  return { x, y: b.y + i * (h + gap), w, h };
}
function cellAt(px, py){
  const b = boardRect();
  const c = Math.floor((px - b.x) / b.cell), r = Math.floor((py - b.y) / b.cell);
  return (r >= 0 && c >= 0 && r < N && c < N) ? { r, c } : null;
}

/* ===== 끌기 ===== */
function down(px, py){
  if(state !== 'play') return;
  for(const h of hit) if(px > h.x && px < h.x + h.w && py > h.y && py < h.y + h.h){ h.go(); return; }
  for(let i = 0; i < TRAY; i++){
    const p = tray[i]; if(!p) continue;
    const r = trayRect(i);
    if(px < r.x - 8 || px > r.x + r.w + 8 || py < r.y - 8 || py > r.y + r.h + 8) continue;
    drag = { i, px, py, dx: 0, dy: 0 };
    move(px, py, true);
    return;
  }
}
function move(px, py, isDown){
  if(!drag || !isDown) return;
  drag.px = px; drag.py = py;
  const p = tray[drag.i];
  const b = boardRect();
  /* 손가락 위쪽에 블록을 띄워서 가려지지 않게 */
  const gx = px - p.w * b.cell * 0.5;
  const gy = py - p.h * b.cell * 0.5 - b.cell * 0.9;
  const c0 = Math.round((gx - b.x) / b.cell), r0 = Math.round((gy - b.y) / b.cell);
  over = (r0 >= 0 && c0 >= 0 && r0 <= N - p.h && c0 <= N - p.w && fits(p, r0, c0))
       ? { r: r0, c: c0 } : null;
}
function up(){
  if(!drag) return;
  if(over) place(drag.i, over.r, over.c);
  drag = null; over = null;
}

/* ===== 매 프레임 ===== */
function frame(dt, active){ if(active) update(dt); draw(); }
function update(dt){
  t += dt;
  for(let i = clearFx.length - 1; i >= 0; i--){
    clearFx[i].t += dt; if(clearFx[i].t > 0.5) clearFx.splice(i, 1);
  }
}

/* ===== 그리기 ===== */
function draw(){
  const k = uiK();
  hit = [];
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#F6EEE3'); bg.addColorStop(1, '#EADFCE');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);

  const b = boardRect();
  /* 상자 */
  g.save(); ink(LW() * 1.2);
  g.fillStyle = '#E4CDA8';
  rrect(b.x - 10 * k, b.y - 10 * k, b.w + 20 * k, b.h + 20 * k, 16 * k); g.fill(); g.stroke();
  g.fillStyle = '#FBF4E9';
  rrect(b.x, b.y, b.w, b.h, 8 * k); g.fill();
  g.restore();

  /* 칸 */
  for(let r = 0; r < N; r++) for(let c = 0; c < N; c++){
    const x = b.x + c * b.cell, y = b.y + r * b.cell;
    g.fillStyle = (r + c) % 2 ? '#F3E9DA' : '#EFE3D1';
    g.fillRect(x + 1, y + 1, b.cell - 2, b.cell - 2);
    if(grid[r][c]) block(x, y, b.cell, grid[r][c], k);
  }

  /* 놓을 자리 미리보기 */
  if(drag && over){
    const p = tray[drag.i];
    const full = previewLines(p, over.r, over.c);
    g.save();
    for(const [r, c] of p.cells){
      const x = b.x + (over.c + c) * b.cell, y = b.y + (over.r + r) * b.cell;
      g.globalAlpha = 0.45; block(x, y, b.cell, p.color, k);
    }
    g.restore();
    /* 지워질 줄을 미리 빛나게 — "여기 넣으면 터진다" 가 보여야 재밌습니다 */
    if(full.rows.length || full.cols.length){
      g.save(); g.globalCompositeOperation = 'lighter';
      g.fillStyle = 'rgba(255,230,150,.45)';
      full.rows.forEach(r => g.fillRect(b.x, b.y + r * b.cell, b.w, b.cell));
      full.cols.forEach(c => g.fillRect(b.x + c * b.cell, b.y, b.cell, b.h));
      g.restore();
    }
  }

  /* 지워지는 중 — 상자 밖으로는 번지지 않게 잘라낸다 */
  g.save();
  g.beginPath(); rrect(b.x, b.y, b.w, b.h, 8 * k); g.clip();
  clearFx.forEach(f => {
    const x = b.x + f.c * b.cell, y = b.y + f.r * b.cell;
    const a = Math.max(0, 1 - f.t / 0.5), sc = 1 + f.t * 1.1;
    g.save(); g.globalAlpha = a;
    g.translate(x + b.cell / 2, y + b.cell / 2); g.scale(sc, sc);
    block(-b.cell / 2, -b.cell / 2, b.cell, f.color || '#EFA6B8', k);
    g.restore();
  });
  g.restore();

  /* 블록 세 개 */
  for(let i = 0; i < TRAY; i++){
    const r = trayRect(i), p = tray[i];
    g.save(); ink(LW() * 0.8); g.fillStyle = '#FFFCF8';
    rrect(r.x, r.y, r.w, r.h, 14 * k); g.fill(); g.stroke();
    g.restore();
    if(!p) continue;
    const dim = !anyFit(p);
    const cs = Math.min(r.w / (p.w + 1), r.h / (p.h + 1));
    const ox = r.x + r.w / 2 - p.w * cs / 2, oy = r.y + r.h / 2 - p.h * cs / 2;
    if(!(drag && drag.i === i)){
      g.save(); if(dim) g.globalAlpha = 0.32;
      for(const [rr, cc] of p.cells) block(ox + cc * cs, oy + rr * cs, cs, p.color, k);
      g.restore();
    }
    if(dim){
      g.save(); g.fillStyle = '#C2A8A4'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '700 ' + (13 * k) + 'px Gaegu, sans-serif';
      g.fillText('안 들어감', r.x + r.w / 2, r.y + r.h - 12 * k);
      g.restore();
    }
  }

  /* 끌고 있는 블록 */
  if(drag){
    const p = tray[drag.i];
    const ox = drag.px - p.w * b.cell * 0.5;
    const oy = drag.py - p.h * b.cell * 0.5 - b.cell * 0.9;
    g.save(); g.globalAlpha = 0.95;
    for(const [rr, cc] of p.cells) block(ox + cc * b.cell, oy + rr * b.cell, b.cell, p.color, k);
    g.restore();
  }

  drawSide(k, b);
  if(state === 'over') drawOver(k);
  FX.bloom(0.16, 2.5);
}

function block(x, y, s, color, k){
  const pad = Math.max(1, s * 0.055);
  g.save();
  g.fillStyle = color;
  rrect(x + pad, y + pad, s - pad * 2, s - pad * 2, s * 0.22); g.fill();
  /* 위쪽 하이라이트 — 작은 입체감 */
  g.globalAlpha = 0.35; g.fillStyle = '#FFFFFF';
  rrect(x + pad * 1.8, y + pad * 1.8, s - pad * 3.6, (s - pad * 2) * 0.34, s * 0.16); g.fill();
  g.globalAlpha = 1;
  g.strokeStyle = 'rgba(90,74,64,.35)'; g.lineWidth = Math.max(1, s * 0.05);
  rrect(x + pad, y + pad, s - pad * 2, s - pad * 2, s * 0.22); g.stroke();
  g.restore();
}

/* 넣으면 어떤 줄이 터지나 미리 계산 */
function previewLines(p, r0, c0){
  const mark = {};
  for(const [r, c] of p.cells) mark[(r0 + r) + ',' + (c0 + c)] = true;
  const has = (r, c) => grid[r][c] || mark[r + ',' + c];
  const rows = [], cols = [];
  for(let r = 0; r < N; r++){
    let full = true;
    for(let c = 0; c < N; c++) if(!has(r, c)){ full = false; break; }
    if(full) rows.push(r);
  }
  for(let c = 0; c < N; c++){
    let full = true;
    for(let r = 0; r < N; r++) if(!has(r, c)){ full = false; break; }
    if(full) cols.push(c);
  }
  return { rows, cols };
}

function drawSide(k, b){
  const f = (s, w) => (w || 700) + ' ' + (s * k) + 'px Gaegu, sans-serif';
  const x = 16 * k, w = Math.max(120 * k, b.x - 32 * k);
  g.save(); g.textBaseline = 'middle';
  g.fillStyle = 'rgba(255,252,248,.92)';
  rrect(x, b.y, w, 150 * k, 18 * k); g.fill();
  g.strokeStyle = '#EFE4D8'; g.lineWidth = 2; g.stroke();
  g.textAlign = 'left';
  g.fillStyle = '#8A7264'; g.font = f(13, 400);
  g.fillText('점수', x + 18 * k, b.y + 26 * k);
  g.fillStyle = '#4E4038'; g.font = f(34);
  g.fillText(Math.round(score).toLocaleString('ko-KR'), x + 18 * k, b.y + 56 * k);
  g.fillStyle = '#8A7264'; g.font = f(13, 400);
  g.fillText('지운 줄 ' + lines, x + 18 * k, b.y + 90 * k);
  g.fillText('최고 ' + (S.packBest || 0).toLocaleString('ko-KR'), x + 18 * k, b.y + 112 * k);
  if(combo > 1){
    g.fillStyle = '#D4708A'; g.font = f(19);
    g.fillText(combo + '연속!', x + 18 * k, b.y + 134 * k);
  }
  g.fillStyle = '#A8947F'; g.font = '400 ' + (12 * k) + 'px Gowun Dodum, sans-serif';
  g.fillText('블록을 끌어다', x + 18 * k, b.y + 180 * k);
  g.fillText('상자에 넣으세요', x + 18 * k, b.y + 200 * k);
  g.fillText('한 줄이 차면 비워져요', x + 18 * k, b.y + 220 * k);
  g.restore();
}

function drawOver(k){
  g.save();
  g.fillStyle = 'rgba(40,32,28,.6)'; g.fillRect(0, 0, W, H);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#FFF8F0'; g.font = '700 ' + (44 * k) + 'px Gaegu, sans-serif';
  g.fillText('상자가 꽉 찼어요!', W / 2, H * 0.44);
  g.font = '400 ' + (17 * k) + 'px Gowun Dodum, sans-serif';
  g.fillText('더 넣을 자리가 없네요 · ' + Math.round(score).toLocaleString('ko-KR') + '점',
             W / 2, H * 0.53);
  g.restore();
}

function key(code){ if(code === 'Escape') quit(); }

return { start, frame, down, move, up, key, quit,
         peek: () => ({ state, score, lines, combo, placed, burst: bestBurst, ended,
                        tray: tray.map(p => p && p.cells.length),
                        filled: grid.flat().filter(Boolean).length }),
         /* 시험용 */
         tryPlace: (i, r, c) => place(i, r, c),
         canPlace: (i, r, c) => !!(tray[i] && fits(tray[i], r, c)),
         fillRowExcept: (r, keep) => { for(let c = 0; c < N; c++) if(c !== keep) grid[r][c] = '#8FBF92'; },
         setTray: shapes => { tray = shapes.map(cells => ({ cells: norm(cells),
                                color: COLORS[0],
                                h: Math.max(...cells.map(x => x[0])) + 1,
                                w: Math.max(...cells.map(x => x[1])) + 1 })); },
         N, SHAPES };
})();
