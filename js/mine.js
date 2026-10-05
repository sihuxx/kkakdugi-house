"use strict";
/* 광산 알바 — 어디서 멈출까 — 꺅두기 하우스 */

/* ===============================================================
   두기 광산 — 한 칸씩 파 내려가다 언제 올라올지 정하는 알바

   규칙은 두 개뿐입니다.
   · 깊이 갈수록 나오는 게 커진다
   · 깊이 갈수록 무너질 확률이 올라간다
   무너지면 들고 있던 걸 전부 잃습니다. 그래서 "한 번만 더" 를 참는 게 게임.

   위험도를 숨기지 않고 화면에 띄웁니다 — 몰라서 지는 건 재미가 없고,
   알면서도 욕심내다 지는 게 재미있기 때문입니다.
   =============================================================== */
const MineGame = (function(){
"use strict";

const MAX_DEPTH = 30;          /* 여기까지 내려가면 대광맥 */
const RISK_FREE = 5;           /* 처음 다섯 칸은 안전 */
const RISK_STEP = 0.023;       /* 한 칸마다 오르는 위험 */
const RISK_CAP  = 0.40;
const CRACK_ADD = 0.11;        /* 금이 갔을 때 다음 한 칸만 더 위험 */

/* 깊이에 따라 땅이 바뀐다 — 눈으로도 얼마나 왔는지 보이게 */
const BANDS = [
  { to:6,  name:'흙',       c1:'#C9A06A', c2:'#AC8450', fleck:'#8A6637' },
  { to:13, name:'돌',       c1:'#9AA0A6', c2:'#7E858C', fleck:'#646A70' },
  { to:21, name:'푸른 암반', c1:'#6E7D92', c2:'#56647A', fleck:'#8FA3BC' },
  { to:99, name:'수정층',   c1:'#7E6CA8', c2:'#64548C', fleck:'#B9A6E6' }
];
const bandOf = d => BANDS.find(b => d <= b.to) || BANDS[BANDS.length - 1];

let phase = 'ready';           /* ready · dig · show · prop · boom · out */
let depth = 0, purse = 0, props = 0, cracked = 0;
let haul = [], cells = [], found = null;
let t = 0, shake = 0, camY = 0, camTo = 0, dust = [];
let onEnd = null, hit = [], best = 0, ended = false;

/* 처음 몇 칸은 무슨 일이 있어도 안전 — 금이 갔어도 마찬가지.
   "처음 5칸은 안전" 이라고 써 붙여 놓고 2m 에서 무너지면 속은 기분이 든다. */
const risk = () => (depth + 1 <= RISK_FREE) ? 0
  : Math.min(RISK_CAP, Math.max(0, (depth + 1 - RISK_FREE) * RISK_STEP))
    + (cracked ? CRACK_ADD : 0);

function start(o){
  onEnd = o && o.onEnd;
  phase = 'ready'; depth = 0; purse = 0; props = 0; cracked = 0;
  haul = []; cells = []; found = null;
  t = 0; shake = 0; camY = 0; camTo = 0; dust = [];
  hit = []; ended = false;
  best = S.mineBest || 0;
}

/* ===== 한 칸에서 나오는 것 ===== */
function rollCell(d){
  let r = Math.random();
  const pChest = d >= 8 ? 0.045 : 0;
  const pGem   = d >= 5 ? 0.075 : 0;
  if((r -= pChest) < 0) return { kind:'chest', n: Math.round(100 + d * 21),
                                 item: ITEMS[Math.floor(Math.random() * ITEMS.length)].id };
  if((r -= pGem)   < 0) return { kind:'gem',   n: Math.round((34 + d * 11) * (2 + Math.random())) };
  if((r -= 0.12)   < 0) return { kind:'prop' };
  if((r -= 0.12)   < 0) return { kind:'crack' };
  if((r -= 0.13)   < 0) return { kind:'empty' };
  return { kind:'ore', n: Math.round(17 + d * 6.5 + Math.random() * d * 4.2) };
}

/* ===== 파기 ===== */
function dig(){
  if(phase !== 'ready' || ended) return;
  phase = 'dig'; t = 0; shake = 1;
  puff(10);
  blip(190 + Math.random() * 40, 0.08);
}
function resolveDig(){
  const p = risk();
  cracked = 0;
  if(Math.random() < p){                      /* 무너진다 */
    if(props > 0){
      props--; phase = 'prop'; t = 0; shake = 1.2; puff(22);
      arp([520, 392], 0.07, 0.14);
      return;
    }
    depth++; phase = 'boom'; t = 0; shake = 2.2; puff(60);
    arp([200, 150, 110, 80], 0.09, 0.26, 'sawtooth');
    return;
  }
  depth++;
  found = rollCell(depth);
  cells.push({ d: depth, kind: found.kind, n: found.n || 0 });
  camTo = depth;
  if(found.kind === 'ore'){   purse += found.n; sfxCoin(2); }
  if(found.kind === 'gem'){   purse += found.n; arp([660, 880, 1175], 0.07, 0.16); shimmer(); }
  if(found.kind === 'chest'){ purse += found.n; haul.push(found.item);
                              arp([523, 784, 1047, 1319], 0.07, 0.18); shimmer(); }
  if(found.kind === 'prop'){  props++; blip(880, 0.1); }
  if(found.kind === 'crack'){ cracked = 1; sfxNo(); shake = 1.4; puff(18); }
  if(found.kind === 'empty'){ blip(260, 0.06); }
  phase = 'show'; t = 0;
  if(depth >= MAX_DEPTH){ purse = Math.round(purse * 1.5); setTimeout(() => leave(true), 900); }
}

/* ===== 올라가기 ===== */
function leave(bottom){
  if(ended || phase === 'boom' || phase === 'out') return;
  phase = 'out'; t = 0;
  sfxGrow();
  finish({ clover: purse, depth, haul: haul.slice(), collapsed: false, bottom: !!bottom });
}
function finish(r){
  if(ended) return;
  ended = true;
  if(depth > (S.mineBest || 0)) S.mineBest = depth;
  setTimeout(() => { if(onEnd) onEnd(r); }, 700);
}
function quit(){                               /* 창을 닫듯 그냥 나가기 — 번 건 챙겨준다 */
  if(ended) return;
  if(phase === 'boom') return;
  leave(false);
}

/* ===== 먼지 ===== */
function puff(n){
  for(let i = 0; i < n; i++)
    dust.push({ x:(Math.random() - 0.5) * 0.5, y:(Math.random() - 0.5) * 0.3,
                vx:(Math.random() - 0.5) * 1.6, vy:-Math.random() * 1.2 - 0.2,
                life:0.5 + Math.random() * 0.7, age:0, r:2 + Math.random() * 5 });
}

/* ===== 매 프레임 ===== */
function frame(dt, active){
  if(active) update(dt);
  draw();
}
function update(dt){
  t += dt;
  shake = Math.max(0, shake - dt * 3.2);
  camY += (camTo - camY) * Math.min(1, dt * 7);
  for(let i = dust.length - 1; i >= 0; i--){
    const p = dust[i];
    p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += dt * 1.1;
    if(p.age > p.life) dust.splice(i, 1);
  }
  if(phase === 'dig'  && t > 0.42) resolveDig();
  if(phase === 'show' && t > 0.75 && depth < MAX_DEPTH) phase = 'ready';
  if(phase === 'prop' && t > 1.15) phase = 'ready';
  if(phase === 'boom' && t > 1.7 && !ended)
    finish({ clover: Math.round(depth * 5), depth, haul: [], collapsed: true, lost: purse });
}

/* ===== 그리기 ===== */
function bandH(){ return Math.min(H * 0.145, 92 * uiK()); }
function yOf(d){ return H * 0.56 + (d - camY) * bandH(); }

function draw(){
  const k = uiK(), bh = bandH();
  hit = [];
  g.save();
  if(shake > 0.01){
    g.translate((Math.random() - 0.5) * shake * 9 * k, (Math.random() - 0.5) * shake * 9 * k);
  }

  /* 하늘과 지면 위 */
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#2E2A3A'); sky.addColorStop(1, '#1C1926');
  g.fillStyle = sky; g.fillRect(-20, -20, W + 40, H + 40);

  /* 땅 단면 */
  for(let d = Math.floor(camY) - 4; d <= Math.floor(camY) + 6; d++){
    if(d < 0) continue;
    const y = yOf(d) - bh, b = bandOf(Math.max(1, d));
    const dug = d <= depth;
    const gr = g.createLinearGradient(0, y, 0, y + bh);
    gr.addColorStop(0, dug ? b.c2 : b.c1); gr.addColorStop(1, dug ? b.c1 : b.c2);
    g.fillStyle = gr; g.fillRect(0, y, W, bh + 1);
    if(!dug){ g.fillStyle = 'rgba(14,11,18,.30)'; g.fillRect(0, y, W, bh + 1); }
    /* 결 */
    g.save(); g.globalAlpha = 0.35; g.fillStyle = b.fleck;
    for(let i = 0; i < 7; i++){
      const fx = ((d * 97 + i * 53) % 100) / 100 * W;
      const fy = y + ((d * 31 + i * 17) % 80) / 100 * bh;
      g.beginPath(); g.ellipse(fx, fy, 3.2 * k, 2 * k, (i % 3), 0, 7); g.fill();
    }
    g.restore();
    g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();

    /* 판 자리는 뚫려 있다 */
    if(dug && d >= 1){
      const sw = W * 0.34, sx = W / 2 - sw / 2;
      const sg = g.createLinearGradient(0, y, 0, y + bh);
      sg.addColorStop(0, 'rgba(18,15,24,.94)'); sg.addColorStop(1, 'rgba(30,26,38,.94)');
      g.fillStyle = sg; g.fillRect(sx, y, sw, bh + 1);
      /* 갱도 양쪽 벽 — 안쪽이 파인 느낌이 나게 */
      const eg = g.createLinearGradient(sx, 0, sx + sw, 0);
      eg.addColorStop(0,    'rgba(0,0,0,.45)');
      eg.addColorStop(0.18, 'rgba(0,0,0,0)');
      eg.addColorStop(0.82, 'rgba(0,0,0,0)');
      eg.addColorStop(1,    'rgba(0,0,0,.45)');
      g.fillStyle = eg; g.fillRect(sx, y, sw, bh + 1);
      /* 버팀목 — 몇 칸마다 하나씩 */
      if(d % 3 === 0){
        g.save(); g.fillStyle = '#6B5537'; g.globalAlpha = 0.85;
        g.fillRect(sx + 2 * k, y, 6 * k, bh);
        g.fillRect(sx + sw - 8 * k, y, 6 * k, bh);
        g.fillRect(sx, y, sw, 6 * k);
        g.restore();
      }
      const c = cells.find(x => x.d === d);
      if(c){
        drawFind(c, W / 2 - W * 0.065, y + bh / 2, k);
        /* 광물은 랜턴 불빛을 받아 반짝인다 */
        if(c.kind === 'gem' || c.kind === 'chest'){
          const tw = 0.5 + 0.5 * Math.sin(t * 3 + d);
          FX.glow(W / 2 - W * 0.065, y + bh / 2, 34 * k,
                  c.kind === 'chest' ? '240,200,110' : '190,150,240', 0.22 + tw * 0.16);
        }
      }
    }
    if(!dug && d === depth + 1){
      g.save(); g.globalAlpha = 0.5; g.fillStyle = '#FFF8F0';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '700 ' + (26 * k) + 'px Gaegu, sans-serif';
      g.fillText('?', W / 2, y + bh / 2);
      g.restore();
    }
  }

  /* 랜턴 불빛 — 두기 주변만 환하다 */
  const dy = yOf(depth);
  const lampX = W / 2 + W * 0.012, lampY = dy - bandH() * 0.46;
  if(phase !== 'boom'){
    const flick = 0.9 + Math.sin(t * 9) * 0.05 + Math.sin(t * 23) * 0.03;
    const r = Math.min(W, H) * 0.34 * flick;
    const rg = g.createRadialGradient(lampX, lampY, 4, lampX, lampY, r);
    rg.addColorStop(0,    'rgba(255,220,150,.40)');
    rg.addColorStop(0.45, 'rgba(255,200,120,.14)');
    rg.addColorStop(1,    'rgba(255,200,120,0)');
    g.save(); g.globalCompositeOperation = 'lighter';
    g.fillStyle = rg; g.fillRect(0, 0, W, H); g.restore();
  }

  /* 두기 */
  const im = IMG[look().run], ds = Math.min(bandH() * 0.82, W * 0.11);
  if(im && im.complete){
    g.save();
    g.globalAlpha = phase === 'boom' ? Math.max(0, 1 - t / 1.3) : 1;
    FX.contact(W / 2 + W * 0.055, dy, ds * 1.1, 0.42);
    g.translate(W / 2 + W * 0.055, dy - 4);
    if(phase === 'dig') g.rotate(Math.sin(t * 34) * 0.14);
    g.scale(-1, 1);
    g.drawImage(im, -ds * 0.5, -ds, ds, ds);
    g.restore();
    /* 들고 있는 랜턴 — 두기 쪽에서 끈이 내려온다 */
    g.save(); ink(LW() * 0.8);
    g.strokeStyle = '#8A7264';
    g.beginPath();
    g.moveTo(W / 2 + W * 0.042, dy - ds * 0.62);
    g.quadraticCurveTo(lampX + ds * 0.1, lampY - ds * 0.34, lampX, lampY - ds * 0.12);
    g.stroke();
    g.fillStyle = '#F3D79A';
    rrect(lampX - ds * 0.11, lampY - ds * 0.12, ds * 0.22, ds * 0.26, ds * 0.06);
    g.fill(); g.stroke();
    g.fillStyle = '#FFF2C8';
    g.beginPath(); g.arc(lampX, lampY + ds * 0.01, ds * 0.06, 0, 7); g.fill();
    g.restore();
  }

  /* 먼지 */
  g.save();
  dust.forEach(p => {
    g.globalAlpha = Math.max(0, 1 - p.age / p.life) * 0.5;
    g.fillStyle = '#D8C7AE';
    g.beginPath(); g.arc(W / 2 + p.x * W * 0.3, dy + p.y * H * 0.2, p.r * k, 0, 7); g.fill();
  });
  g.restore();

  /* 아래로 갈수록 어둠에 잠긴다 */
  const fog = g.createLinearGradient(0, H * 0.62, 0, H);
  fog.addColorStop(0, 'rgba(14,11,20,0)');
  fog.addColorStop(1, 'rgba(14,11,20,.75)');
  g.fillStyle = fog; g.fillRect(0, H * 0.62, W, H * 0.38);
  /* 위쪽도 — 지나온 길은 멀어진다 */
  const fog2 = g.createLinearGradient(0, 0, 0, H * 0.3);
  fog2.addColorStop(0, 'rgba(14,11,20,.6)');
  fog2.addColorStop(1, 'rgba(14,11,20,0)');
  g.fillStyle = fog2; g.fillRect(0, 0, W, H * 0.3);

  g.restore();                                 /* 흔들림 끝 */

  FX.bloom(0.24, 3);
  drawHud(k);
  if(phase === 'boom') drawBoom(k);
  else if(phase === 'prop') drawBanner('지지대가 버텨줬어요!', '#8FBF92', k);
  else if(phase === 'show' && found) drawFindText(k);
  else if(depth >= MAX_DEPTH) drawBanner('바닥의 대광맥!', '#E0B84E', k);
  if(phase !== 'boom') drawButtons(k);
}

/* 칸 안에 그려지는 것 */
function drawFind(c, cx, cy, k){
  const s = 13 * k;
  g.save(); ink(LW() * 0.8);
  if(c.kind === 'ore' || c.kind === 'gem'){
    const big = c.kind === 'gem';
    g.fillStyle = big ? '#A98FE0' : '#8FBF92';
    for(let i = 0; i < (big ? 3 : 2); i++){
      const ox = (i - (big ? 1 : 0.5)) * s * 1.5;
      g.beginPath();
      g.moveTo(cx + ox, cy - s * (big ? 1.1 : 0.8));
      g.lineTo(cx + ox + s * 0.8, cy);
      g.lineTo(cx + ox, cy + s * (big ? 1.1 : 0.8));
      g.lineTo(cx + ox - s * 0.8, cy);
      g.closePath(); g.fill(); g.stroke();
    }
  }else if(c.kind === 'chest'){
    g.fillStyle = '#C98A5E'; rrect(cx - s * 1.5, cy - s * 0.9, s * 3, s * 1.8, s * 0.3); g.fill(); g.stroke();
    g.fillStyle = '#E0B84E'; g.fillRect(cx - s * 1.5, cy - s * 0.2, s * 3, s * 0.5);
    g.strokeRect(cx - s * 1.5, cy - s * 0.2, s * 3, s * 0.5);
  }else if(c.kind === 'prop'){
    g.fillStyle = '#C9A06A';
    rrect(cx - s * 1.6, cy - s, s * 0.6, s * 2, 3); g.fill(); g.stroke();
    rrect(cx + s, cy - s, s * 0.6, s * 2, 3); g.fill(); g.stroke();
    rrect(cx - s * 1.8, cy - s * 1.3, s * 3.6, s * 0.55, 3); g.fill(); g.stroke();
  }else if(c.kind === 'crack'){
    g.strokeStyle = '#E5D3B3'; g.lineWidth = LW();
    g.beginPath();
    g.moveTo(cx - s * 1.6, cy - s); g.lineTo(cx - s * 0.3, cy - s * 0.1);
    g.lineTo(cx - s * 0.9, cy + s * 0.3); g.lineTo(cx + s * 0.6, cy + s * 1.1);
    g.stroke();
  }
  g.restore();
}

function drawHud(k){
  const f = (s, w) => (w || 700) + ' ' + (s * k) + 'px Gaegu, sans-serif';
  g.save(); g.textBaseline = 'middle';

  /* 왼쪽 — 깊이 · 가진 것 */
  g.fillStyle = 'rgba(20,17,26,.55)';
  rrect(12 * k, 12 * k, 226 * k, 84 * k, 16 * k); g.fill();
  g.textAlign = 'left'; g.fillStyle = '#FFF8F0';
  g.font = f(15, 400); g.fillText('깊이', 26 * k, 32 * k);
  g.font = f(30); g.fillText(depth + ' m', 70 * k, 33 * k);
  g.font = f(14, 400); g.fillStyle = '#C9BBA8';
  g.fillText(bandOf(Math.max(1, depth)).name + ' · 최고 ' + Math.max(best, depth) + 'm', 26 * k, 56 * k);
  g.fillStyle = '#9FE0A6'; g.font = f(22);
  g.fillText('클로버 ' + purse.toLocaleString('ko-KR'), 26 * k, 80 * k);

  /* 지지대 */
  if(props > 0){
    g.fillStyle = 'rgba(20,17,26,.55)';
    rrect(248 * k, 12 * k, 112 * k, 38 * k, 14 * k); g.fill();
    g.fillStyle = '#E7C98A'; g.font = f(17);
    g.fillText('지지대 x' + props, 262 * k, 32 * k);
  }

  /* 오른쪽 — 위험도 */
  const rw = 186 * k, rx2 = W - rw - 12 * k;
  g.fillStyle = 'rgba(20,17,26,.55)';
  rrect(rx2, 12 * k, rw, 58 * k, 16 * k); g.fill();
  const p = risk();
  g.textAlign = 'left'; g.fillStyle = '#C9BBA8'; g.font = f(14, 400);
  g.fillText('다음 칸 무너질 확률', rx2 + 14 * k, 30 * k);
  g.fillStyle = '#2A2634';
  rrect(rx2 + 14 * k, 44 * k, rw - 84 * k, 10 * k, 5 * k); g.fill();
  g.fillStyle = p < 0.15 ? '#8FBF92' : p < 0.3 ? '#E7B075' : '#E0788A';
  rrect(rx2 + 14 * k, 44 * k, Math.max(4, (rw - 84 * k) * Math.min(1, p / RISK_CAP)), 10 * k, 5 * k); g.fill();
  g.fillStyle = '#FFF8F0'; g.font = f(19);
  g.fillText(Math.round(p * 100) + '%', rx2 + rw - 58 * k, 49 * k);
  if(cracked){
    g.fillStyle = '#E0788A'; g.font = f(13, 400);
    g.textAlign = 'right'; g.fillText('금이 갔어요 — 이번 한 번이 특히 위험', W - 14 * k, 84 * k);
  }
  g.restore();
}

function drawFindText(k){
  if(!found) return;
  const txt = found.kind === 'ore'   ? '클로버 +' + found.n
            : found.kind === 'gem'   ? '큰 원석! +' + found.n
            : found.kind === 'chest' ? '보물상자! +' + found.n + ' · ' + (ITEM(found.item) || {}).name
            : found.kind === 'prop'  ? '지지대를 주웠어요'
            : found.kind === 'crack' ? '천장에 금이 갔어요'
            : '빈 흙이네요';
  const col = found.kind === 'gem' || found.kind === 'chest' ? '#E0B84E'
            : found.kind === 'crack' ? '#E0788A'
            : found.kind === 'empty' ? '#C9BBA8' : '#9FE0A6';
  drawBanner(txt, col, k);
}
function drawBanner(txt, col, k){
  g.save(); g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '700 ' + (27 * k) + 'px Gaegu, sans-serif';
  const w = g.measureText(txt).width + 46 * k;
  g.fillStyle = 'rgba(20,17,26,.72)';
  rrect(W / 2 - w / 2, H * 0.14, w, 46 * k, 16 * k); g.fill();
  g.fillStyle = col; g.fillText(txt, W / 2, H * 0.14 + 24 * k);
  g.restore();
}
function drawBoom(k){
  g.save();
  g.fillStyle = 'rgba(16,12,20,' + Math.min(0.72, t * 0.7) + ')';
  g.fillRect(0, 0, W, H);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#E0788A'; g.font = '700 ' + (46 * k) + 'px Gaegu, sans-serif';
  g.fillText('무너졌어요!', W / 2, H * 0.42);
  g.fillStyle = '#C9BBA8'; g.font = '400 ' + (18 * k) + 'px Gowun Dodum, sans-serif';
  g.fillText('들고 있던 클로버 ' + purse.toLocaleString('ko-KR') + '을 두고 나왔습니다',
             W / 2, H * 0.52);
  g.restore();
}

function drawButtons(k){
  const bw = Math.min(W * 0.33, 260 * k), bh = Math.min(H * 0.13, 62 * k);
  const y = H - bh - 18 * k, gap = 16 * k;
  const x1 = W / 2 - bw - gap / 2, x2 = W / 2 + gap / 2;
  const on = phase === 'ready' && !ended;

  g.save(); g.textAlign = 'center'; g.textBaseline = 'middle';
  g.globalAlpha = on ? 1 : 0.45;
  ink(); g.fillStyle = '#C9A06A';
  rrect(x1, y, bw, bh, 20 * k); g.fill(); g.stroke();
  g.fillStyle = '#3A2E22'; g.font = '700 ' + (26 * k) + 'px Gaegu, sans-serif';
  g.fillText('더 파기', x1 + bw / 2, y + bh / 2 - 7 * k);
  g.font = '400 ' + (13 * k) + 'px Gowun Dodum, sans-serif';
  g.fillText('스페이스', x1 + bw / 2, y + bh / 2 + 15 * k);

  ink(); g.fillStyle = '#8FBF92';
  rrect(x2, y, bw, bh, 20 * k); g.fill(); g.stroke();
  g.fillStyle = '#23301F'; g.font = '700 ' + (26 * k) + 'px Gaegu, sans-serif';
  g.fillText('올라가기', x2 + bw / 2, y + bh / 2 - 7 * k);
  g.font = '400 ' + (13 * k) + 'px Gowun Dodum, sans-serif';
  g.fillText(purse > 0 ? purse.toLocaleString('ko-KR') + ' 챙기기' : '빈손으로', x2 + bw / 2, y + bh / 2 + 15 * k);
  g.restore();

  if(on){
    hit.push({ x:x1, y, w:bw, h:bh, go: dig });
    hit.push({ x:x2, y, w:bw, h:bh, go: () => leave(false) });
  }
}

/* ===== 입력 ===== */
function pointer(px, py){
  for(const b of hit)
    if(px > b.x && px < b.x + b.w && py > b.y && py < b.y + b.h){ b.go(); return; }
}
function key(code){
  if(code === 'Space' || code === 'Enter' || code === 'ArrowDown') dig();
  if(code === 'Escape' || code === 'ArrowUp' || code === 'KeyQ') leave(false);
}

return { start, frame, pointer, key, quit,
         peek: () => ({ phase, depth, purse, props, cracked, haul: haul.slice(),
                        risk: risk(), cells: cells.length, ended }),
         MAX_DEPTH, RISK_FREE };
})();
