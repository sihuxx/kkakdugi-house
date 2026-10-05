"use strict";
/* 미아 찾기 — 눈으로 — 꺅두기 하우스 */

/* ===============================================================
   미아 찾기 — 광장에 모인 두기들 중에서 찾는 사람 고르기

   반사신경이 아니라 눈으로 하는 알바입니다. 제한시간은 넉넉하고
   틀리면 시간이 깎이니, 급하게 찍는 것보다 차분히 보는 게 이깁니다.

   그림을 새로 만들지 않습니다 — 이미 있는 두기 31종을 그대로 깔아요.
   그래서 도감을 많이 모을수록 "저건 누구" 가 빨리 보이고,
   아는 두기를 찾으면 점수도 더 줍니다.
   =============================================================== */
const LostGame = (function(){
"use strict";

const TIME_START = 70;      /* 시작 시간(초) */
const TIME_HIT   = 3.2;     /* 맞히면 더 주는 시간 */
const TIME_MISS  = 4.5;     /* 틀리면 깎는 시간 */
const CROWD0     = 9;       /* 1라운드 인원 */
const CROWD_UP   = 3;       /* 라운드마다 늘어나는 인원 */
const CROWD_MAX  = 54;

let on = false, phase = 'play';     /* play · hit · over */
let left = 0, round = 0, score = 0, miss = 0, streak = 0;
let crowd = [], target = null, t = 0, flash = 0, wrongAt = null;
let onEnd = null, ended = false, hitFx = [];

const sizeOf = () => Math.min(H * 0.145, W * 0.095);

function start(o){
  onEnd = o && o.onEnd;
  on = true; phase = 'play'; ended = false;
  left = TIME_START; round = 0; score = 0; miss = 0; streak = 0;
  t = 0; flash = 0; wrongAt = null; hitFx = [];
  nextRound();
}

/* ===== 라운드 하나 =====
   자리를 격자로 잡고 조금씩 흔듭니다. 완전 랜덤으로 뿌리면
   서로 겹쳐서 "못 찾는" 게 아니라 "안 보이는" 게 되어버립니다. */
function nextRound(){
  round++;
  const n = Math.min(CROWD_MAX, CROWD0 + (round - 1) * CROWD_UP);
  const s = sizeOf();
  const top = H * 0.21, bot = H * 0.97;
  const cols = Math.max(3, Math.round(Math.sqrt(n * (W / (bot - top)))));
  const rows = Math.ceil(n / cols);
  const cw = W / cols, ch = (bot - top) / rows;

  const cells = [];
  for(let r = 0; r < rows; r++)
    for(let c = 0; c < cols; c++) cells.push({ r, c });
  for(let i = cells.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = cells[i]; cells[i] = cells[j]; cells[j] = tmp;
  }

  /* 찾을 두기 하나 + 나머지는 다른 종류로 (같은 게 둘 있으면 안 됨) */
  const pool = CHARS.slice();
  target = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
  for(let i = pool.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
  }

  crowd = [];
  const tIdx = Math.floor(Math.random() * n);
  for(let i = 0; i < n && i < cells.length; i++){
    const cell = cells[i];
    const jig = 0.30;
    const x = cell.c * cw + cw * (0.5 + (Math.random() - 0.5) * jig);
    const y = top + cell.r * ch + ch * (0.5 + (Math.random() - 0.5) * jig);
    const c = (i === tIdx) ? target : pool[i % pool.length];
    crowd.push({ c, x, y,
      s: s * (0.86 + Math.random() * 0.26),
      flip: Math.random() < 0.5,
      ph: Math.random() * 6.3,
      sway: round >= 4 ? 0.5 + Math.random() : 0,
      isT: i === tIdx });
  }
  /* 찾을 두기는 맨 나중에 그려서 남의 뒤에 숨지 않게 */
  const ti = crowd.findIndex(p => p.isT);
  if(ti >= 0) crowd.push(crowd.splice(ti, 1)[0]);
  phase = 'play';
}

/* ===== 클릭 ===== */
function pointer(px, py){
  if(!on || phase !== 'play') return;
  /* 위에 그려진 것부터 검사 — 눈에 보이는 대로 집힌다 */
  for(let i = crowd.length - 1; i >= 0; i--){
    const p = crowd[i], r = p.s * 0.42;
    const dx = px - p.x, dy = py - (p.y - p.s * 0.3);
    if(dx * dx + dy * dy > r * r * 1.55) continue;
    if(p.isT) good(p); else bad(px, py);
    return;
  }
  bad(px, py);                            /* 빈 곳도 오답 */
}
function good(p){
  streak++;
  const mine = owns(target.id);
  const base = 70 + round * 22;
  const fast = Math.round(Math.max(0, left) * 1.1);
  const bonus = (mine ? Math.round(base * 0.3) : 0) + Math.min(120, (streak - 1) * 20);
  score += base + fast * 0 + bonus;        /* 남은 시간은 마지막에 한 번에 */
  left = Math.min(TIME_START, left + TIME_HIT);
  flash = 0.5;
  hitFx.push({ x: p.x, y: p.y - p.s * 0.6, t: 0,
               txt: '+' + (base + bonus) + (mine ? ' (도감!)' : '') });
  sfxCoin(3);
  phase = 'hit'; t = 0;
}
function bad(px, py){
  miss++; streak = 0;
  left -= TIME_MISS;
  wrongAt = { x: px, y: py, t: 0 };
  sfxNo();
  if(left <= 0) finish();
}
function finish(){
  if(ended) return;
  ended = true; on = false; phase = 'over';
  score += Math.round(Math.max(0, left) * 6);     /* 남은 시간은 점수로 */
  if(onEnd) setTimeout(() => onEnd({ score: Math.round(score),
                                     round: Math.max(0, round - 1),
                                     miss, best: S.lostBest || 0 }), 500);
}
function quit(){ if(!ended) finish(); }

/* ===== 매 프레임 ===== */
function frame(dt, active){ if(active) update(dt); draw(); }
function update(dt){
  t += dt;
  flash = Math.max(0, flash - dt * 2);
  if(wrongAt){ wrongAt.t += dt; if(wrongAt.t > 0.6) wrongAt = null; }
  for(let i = hitFx.length - 1; i >= 0; i--){
    hitFx[i].t += dt; if(hitFx[i].t > 1.1) hitFx.splice(i, 1);
  }
  if(!on) return;
  if(phase === 'play'){
    left -= dt;
    if(left <= 0){ left = 0; finish(); }
  }else if(phase === 'hit'){
    if(t > 0.45) nextRound();
  }
}

/* ===== 그리기 ===== */
function draw(){
  const k = uiK();
  /* 광장 바닥 */
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#F6EEE2'); sky.addColorStop(1, '#E9DCC8');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  g.save(); g.globalAlpha = 0.5; g.strokeStyle = '#D9C8AE'; g.lineWidth = 1.5;
  for(let y = H * 0.22; y < H; y += H * 0.1){
    g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
  }
  g.restore();

  /* 사람들 */
  for(const p of crowd){
    const bob = p.sway ? Math.sin(t * 1.6 * p.sway + p.ph) * p.s * 0.05 : 0;
    const im = IMG[p.c.run];
    FX.contact(p.x, p.y + bob, p.s * 0.8, 0.16);
    if(im && im.complete && im.naturalHeight){
      /* 그림마다 가로세로가 달라서, 높이를 맞추고 가로는 비율대로 */
      const h = p.s, w = h * (im.naturalWidth / im.naturalHeight);
      g.save();
      g.translate(p.x, p.y + bob);
      g.scale(p.flip ? -1 : 1, 1);
      g.drawImage(im, -w * 0.5, -h, w, h);
      g.restore();
    }
  }

  /* 맞혔을 때 동그라미 */
  if(phase === 'hit'){
    const p = crowd[crowd.length - 1];
    if(p){
      g.save();
      g.strokeStyle = '#5E9B63'; g.lineWidth = LW() * 1.6;
      g.globalAlpha = Math.max(0, 1 - t / 0.45);
      g.beginPath();
      g.arc(p.x, p.y - p.s * 0.45, p.s * (0.55 + t * 0.7), 0, 7);
      g.stroke(); g.restore();
      FX.glow(p.x, p.y - p.s * 0.45, p.s * 1.4, '150,220,160', 0.4);
    }
  }
  /* 틀렸을 때 X */
  if(wrongAt){
    g.save();
    g.globalAlpha = Math.max(0, 1 - wrongAt.t / 0.6);
    g.strokeStyle = '#D4708A'; g.lineWidth = LW() * 1.5; g.lineCap = 'round';
    const r = 13 * k;
    g.beginPath();
    g.moveTo(wrongAt.x - r, wrongAt.y - r); g.lineTo(wrongAt.x + r, wrongAt.y + r);
    g.moveTo(wrongAt.x + r, wrongAt.y - r); g.lineTo(wrongAt.x - r, wrongAt.y + r);
    g.stroke(); g.restore();
  }
  /* 점수 튀기 */
  hitFx.forEach(f => {
    g.save();
    g.globalAlpha = Math.max(0, 1 - f.t / 1.1);
    g.fillStyle = '#3E6B44'; g.textAlign = 'center';
    g.font = '700 ' + (20 * k) + 'px Gaegu, sans-serif';
    g.fillText(f.txt, f.x, f.y - f.t * 40 * k);
    g.restore();
  });

  if(flash > 0){
    g.save(); g.globalAlpha = flash * 0.3; g.fillStyle = '#B8E5BE';
    g.fillRect(0, 0, W, H); g.restore();
  }
  drawHud(k);
  FX.bloom(0.14, 2.5);
}

function drawHud(k){
  const f = (s, w) => (w || 700) + ' ' + (s * k) + 'px Gaegu, sans-serif';
  const bh = H * 0.155;
  g.save();
  g.fillStyle = 'rgba(255,252,248,.94)';
  rrect(10 * k, 10 * k, W - 20 * k, bh, 18 * k); g.fill();
  g.strokeStyle = '#EFE4D8'; g.lineWidth = 2; g.stroke();

  /* 찾을 두기 */
  const px = 20 * k + bh * 0.42, py = 10 * k + bh * 0.52;
  if(target){
    const im = IMG[target.run];
    g.fillStyle = '#F7F0E6';
    rrect(px - bh * 0.44, py - bh * 0.44, bh * 0.88, bh * 0.88, bh * 0.22); g.fill();
    if(im && im.complete && im.naturalHeight){
      /* 잘리지 않게 통째로 넣는다 — 이걸 보고 찾아야 하니까 */
      const box = bh * 0.78;
      const sc = Math.min(box / im.naturalWidth, box / im.naturalHeight);
      const w = im.naturalWidth * sc, h = im.naturalHeight * sc;
      g.drawImage(im, px - w / 2, py - h / 2, w, h);
    }
  }
  g.textBaseline = 'middle'; g.textAlign = 'left';
  const tx = px + bh * 0.52;
  g.fillStyle = '#8A7264'; g.font = (400) + ' ' + (13 * k) + 'px Gowun Dodum, sans-serif';
  g.fillText('이 두기를 찾아주세요', tx, 10 * k + bh * 0.3);
  g.fillStyle = '#4E4038'; g.font = f(24);
  const known = target && owns(target.id);
  g.fillText(known ? target.name : '???', tx, 10 * k + bh * 0.68);
  if(known){
    g.fillStyle = '#5E9B63'; g.font = f(12, 400);
    g.fillText('도감에 있어요 · 점수 +30%',
               tx + g.measureText(target.name).width + 46 * k, 10 * k + bh * 0.70);
  }

  /* 가운데 — 라운드 */
  g.textAlign = 'center'; g.fillStyle = '#8A7264'; g.font = f(14, 400);
  g.fillText(round + '번째 손님', W * 0.56, 10 * k + bh * 0.33);
  g.fillStyle = '#4E4038'; g.font = f(26);
  g.fillText(Math.round(score).toLocaleString('ko-KR') + '점', W * 0.56, 10 * k + bh * 0.68);

  /* 오른쪽 — 남은 시간 */
  const bw = W * 0.2, bx = W - bw - 22 * k, by = 10 * k + bh * 0.56;
  g.textAlign = 'right'; g.fillStyle = '#8A7264'; g.font = f(13, 400);
  g.fillText('남은 시간', W - 22 * k, 10 * k + bh * 0.3);
  g.fillStyle = '#EFE4D8'; rrect(bx, by, bw, 11 * k, 6 * k); g.fill();
  const fr = Math.max(0, Math.min(1, left / TIME_START));
  g.fillStyle = left < 12 ? '#D4708A' : '#8FBF92';
  rrect(bx, by, Math.max(4, bw * fr), 11 * k, 6 * k); g.fill();
  g.fillStyle = '#4E4038'; g.font = f(19); g.textAlign = 'right';
  g.fillText(Math.ceil(Math.max(0, left)) + '초', W - 22 * k, by + 30 * k);
  g.restore();
}

function key(code){ if(code === 'Escape') quit(); }

return { start, frame, pointer, key, quit,
         peek: () => ({ on, phase, round, score, left: Math.round(left * 10) / 10,
                        miss, streak, crowd: crowd.length,
                        target: target && target.id, ended }),
         /* 시험용 — 화면을 안 거치고 지금 정답을 집는다 */
         pickTarget: () => { const p = crowd.find(x => x.isT);
                             if(p && phase === 'play') good(p); return !!p; },
         pickWrong: () => { const p = crowd.find(x => !x.isT);
                            if(p && phase === 'play') bad(p.x, p.y); return !!p; },
         TIME_START };
})();
