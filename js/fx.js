"use strict";
/* 빛 — 번짐·빛기둥·그림자 — 꺅두기 하우스 */

/* ===============================================================
   빛 — 마인크래프트 셰이더에서 가져온 생각들을 2D 로 옮긴 것

   셰이더가 하는 일을 뜯어보면 대체로 네 가지입니다.
     1. 밝은 데가 번진다        → bloom()
     2. 빛이 기둥처럼 쏟아진다   → shafts()
     3. 물건 밑이 어둡다        → contact()
     4. 빛 쪽 모서리가 밝다      → rim()
   전부 캔버스 기본 기능(합성 모드 · 그라데이션 · blur 필터)으로 흉내 냅니다.

   비용을 아끼려고 번짐은 1/6 크기 캔버스에서 계산합니다.
   느린 기기를 위해 설정에서 끌 수 있고, 프레임이 떨어지면 저절로 꺼집니다.
   =============================================================== */
const FX = (function(){
"use strict";

let lo = null, lo2 = null;          /* 작게 줄여 쓰는 작업용 캔버스 */
let loW = 0, loH = 0;
const SCALE = 6;                    /* 1/6 크기에서 번짐을 계산 */

/* 느린 기기 자동 감지 — 최근 프레임 시간이 길면 스스로 끈다 */
let slow = 0, auto = true;
function watch(dt){
  if(dt > 0.042) slow = Math.min(60, slow + 1);
  else           slow = Math.max(0, slow - 1);
  if(slow >= 45) auto = false;
  if(slow === 0 && !auto) auto = true;
}
const on = () => auto && (settings.fx !== false) && !REDUCED;

function ensure(){
  const w = Math.max(32, Math.floor(W / SCALE)), h = Math.max(24, Math.floor(H / SCALE));
  if(lo && loW === w && loH === h) return true;
  try{
    lo  = document.createElement('canvas'); lo.width  = w; lo.height  = h;
    lo2 = document.createElement('canvas'); lo2.width = w; lo2.height = h;
    loW = w; loH = h;
    return true;
  }catch(e){ lo = null; return false; }
}

/* ===== 1. 번짐 (bloom) =====
   밝은 부분만 남겨서 흐린 뒤 원래 그림에 더합니다.
   "밝은 부분만" 을 고르는 제일 싼 방법은 자기 자신을 곱하기로 두 번 겹치는 것 —
   0.9 는 0.73 이 되고 0.3 은 0.03 이 되니, 어두운 데는 알아서 사라집니다. */
function bloom(amount, blurPx){
  if(!on() || !ensure()) return;
  const a = amount == null ? 0.3 : amount;
  try{
    const c1 = lo.getContext('2d'), c2 = lo2.getContext('2d');
    c1.setTransform(1, 0, 0, 1, 0, 0);
    c1.globalCompositeOperation = 'source-over';
    c1.clearRect(0, 0, loW, loH);
    c1.drawImage(cv, 0, 0, loW, loH);
    /* 어두운 데 지우기 (곱하기 두 번 = 네제곱) */
    c1.globalCompositeOperation = 'multiply';
    c1.drawImage(lo, 0, 0);
    c1.drawImage(lo, 0, 0);
    c1.globalCompositeOperation = 'source-over';
    /* 흐리기 */
    c2.setTransform(1, 0, 0, 1, 0, 0);
    c2.clearRect(0, 0, loW, loH);
    c2.filter = 'blur(' + (blurPx == null ? 3 : blurPx) + 'px)';
    c2.drawImage(lo, 0, 0);
    c2.filter = 'none';
    /* 더하기 */
    g.save();
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = a;
    g.imageSmoothingEnabled = true;
    g.drawImage(lo2, 0, 0, W, H);
    g.restore();
  }catch(e){ auto = false; }        /* 어느 브라우저가 거부하면 그냥 끈다 */
}

/* ===== 2. 빛기둥 (god rays) =====
   창문이나 해에서 바닥으로 쏟아지는 빛. 사다리꼴 몇 장을 더하기로 겹칩니다. */
function shafts(o){
  if(!on()) return;
  const sx = o.x, sy = o.y, len = o.len || H * 0.9;
  const n = o.n || 4, spread = o.spread || 0.42, a = o.a == null ? 0.1 : o.a;
  const col = o.color || '255,230,170';
  const tilt = o.tilt == null ? 0.45 : o.tilt;
  const t = o.t || 0;
  g.save();
  g.globalCompositeOperation = 'lighter';
  for(let i = 0; i < n; i++){
    const f = n === 1 ? 0 : i / (n - 1) - 0.5;
    const sway = Math.sin(t * 0.35 + i * 1.7) * 0.035;
    const w0 = (o.w || W * 0.07) * (0.6 + 0.8 * Math.abs(0.6 - Math.abs(f)));
    const dx = (f * spread + tilt + sway) * len;
    const gr = g.createLinearGradient(sx, sy, sx + dx, sy + len);
    gr.addColorStop(0,    'rgba(' + col + ',' + (a * 0.9).toFixed(3) + ')');
    gr.addColorStop(0.55, 'rgba(' + col + ',' + (a * 0.35).toFixed(3) + ')');
    gr.addColorStop(1,    'rgba(' + col + ',0)');
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(sx - w0 * 0.3, sy);
    g.lineTo(sx + w0 * 0.3, sy);
    g.lineTo(sx + dx + w0 * 1.5, sy + len);
    g.lineTo(sx + dx - w0 * 1.1, sy + len);
    g.closePath(); g.fill();
  }
  g.restore();
}

/* ===== 3. 접지 그림자 =====
   물건이 바닥에 닿는 자리를 어둡게. 이것만 있어도 "떠 있는" 느낌이 사라집니다. */
function contact(cx, baseY, w, a){
  const r = Math.max(4, w * 0.5);
  const gr = g.createRadialGradient(cx, baseY, 0, cx, baseY, r);
  gr.addColorStop(0,   'rgba(72,54,40,' + (a == null ? 0.34 : a) + ')');
  gr.addColorStop(0.6, 'rgba(72,54,40,' + (a == null ? 0.14 : a * 0.4) + ')');
  gr.addColorStop(1,   'rgba(72,54,40,0)');
  g.save();
  g.translate(cx, baseY); g.scale(1, 0.3); g.translate(-cx, -baseY);
  g.fillStyle = gr;
  g.beginPath(); g.arc(cx, baseY, r, 0, 7); g.fill();
  g.restore();
}

/* ===== 4. 빛 쪽 모서리 밝히기 =====
   패스를 하나 받아서, 빛이 오는 쪽으로 살짝 밀어 밝은 선을 겹칩니다. */
function rim(pathFn, dx, dy, color, a){
  if(!on()) return;
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = a == null ? 0.5 : a;
  g.strokeStyle = color || 'rgba(255,236,190,0.9)';
  g.lineWidth = LW() * 0.8;
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.translate(dx || -1.5, dy || -1.5);
  g.beginPath(); pathFn(); g.stroke();
  g.restore();
}

/* ===== 빛 덩어리 하나 ===== */
function glow(x, y, r, color, a){
  if(!on()) return;
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, 'rgba(' + (color || '255,226,152') + ',' + (a == null ? 0.5 : a) + ')');
  gr.addColorStop(1, 'rgba(' + (color || '255,226,152') + ',0)');
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = gr;
  g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  g.restore();
}

/* ===== 공중의 먼지 — 빛 속에서만 보입니다 ===== */
let motes = [];
function seedMotes(n){
  motes = [];
  for(let i = 0; i < (n || 26); i++)
    motes.push({ x: Math.random(), y: Math.random(),
                 r: 0.6 + Math.random() * 1.6, sp: 0.004 + Math.random() * 0.012,
                 ph: Math.random() * 6.3 });
}
function motesStep(dt, t){
  if(!motes.length) seedMotes();
  for(const m of motes){
    m.y -= m.sp * dt * 6;
    m.x += Math.sin(t * 0.5 + m.ph) * 0.0004;
    if(m.y < -0.05){ m.y = 1.05; m.x = Math.random(); }
  }
}
function drawMotes(box, a, t){
  if(!on() || !motes.length) return;
  g.save();
  g.globalCompositeOperation = 'lighter';
  for(const m of motes){
    const x = box.x + m.x * box.w, y = box.y + m.y * box.h;
    g.globalAlpha = (a == null ? 0.42 : a) * (0.4 + 0.6 * Math.abs(Math.sin(t * 1.2 + m.ph)));
    g.fillStyle = 'rgba(255,240,205,1)';
    g.beginPath(); g.arc(x, y, m.r * uiK(), 0, 7); g.fill();
  }
  g.restore();
}

/* 색 유리 같은 전체 보정 — 시간대마다 아주 살짝 */
function grade(color, a, mode){
  if(!on() || !a) return;
  g.save();
  g.globalCompositeOperation = mode || 'overlay';
  g.globalAlpha = a;
  g.fillStyle = color;
  g.fillRect(0, 0, W, H);
  g.restore();
}

return { bloom, shafts, contact, rim, glow, grade,
         seedMotes, motesStep, drawMotes, watch,
         get on(){ return on(); }, get auto(){ return auto; } };
})();
