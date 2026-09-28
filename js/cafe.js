"use strict";
/* 카페 알바 — 기억력 — 꺅두기 하우스 */

/* ===============================================================
   카페 알바 — 손님 주문을 외워서 순서대로 담기
   =============================================================== */
const CafeGame = (function(){
"use strict";

const MENU = [
  { id:'coffee', name:'커피',   color:'#B98F58' },
  { id:'milk',   name:'우유',   color:'#FFF8F0' },
  { id:'juice',  name:'주스',   color:'#E0A45C' },
  { id:'cake',   name:'케이크', color:'#EFA6B8' },
  { id:'cookie', name:'쿠키',   color:'#D9B884' },
  { id:'tea',    name:'차',     color:'#8FBF92' }
];
let state = 'idle';          // show · input · good · bad · over
let order = [], input = [], round = 0, miss = 0, score = 0, tip = 0;
let t = 0, showI = 0, onEnd = null, guest = null, best = 0, hitBox = [];
const MISS_MAX = 3;

function start(o){
  onEnd = o.onEnd;
  round = 0; miss = 0; score = 0; tip = 0; state = 'show'; t = 0;
  best = S.cafeBest || 0;
  nextRound();
}
function nextRound(){
  round++;
  const len = Math.min(8, 2 + round);
  order = []; input = []; showI = 0; t = 0; state = 'show';
  for(let i = 0; i < len; i++) order.push(MENU[Math.floor(Math.random() * MENU.length)].id);
  guest = CHARS[Math.floor(Math.random() * CHARS.length)];
}
function tapMenu(id){
  if(state !== 'input') return;
  const want = order[input.length];
  input.push(id);
  if(id !== want){
    miss++; state = 'bad'; t = 0; sfxNo();
    if(miss >= MISS_MAX) setTimeout(() => finish(), 900);
    return;
  }
  blip(660 + input.length * 70, 0.06);
  if(input.length === order.length){
    const gain = 60 * order.length + Math.max(0, Math.round(80 - t * 12));
    score += gain; tip += order.length;
    state = 'good'; t = 0; sfxCoin(3);
  }
}
function finish(){
  if(state === 'over') return;
  state = 'over';
  if(onEnd) onEnd({ score: Math.round(score), rounds: round - 1, tip, miss });
}
function update(dt){
  t += dt;
  if(state === 'show'){
    const step = Math.max(0.42, 0.72 - round * 0.03);
    if(t > step){ t = 0; showI++; if(showI > order.length){ state = 'input'; t = 0; } }
  }else if(state === 'input'){
    if(t > order.length * 2.2 + 2){ miss++; state = 'bad'; t = 0; sfxNo();
      if(miss >= MISS_MAX) setTimeout(() => finish(), 900); }
  }else if(state === 'good'){
    if(t > 1.1) nextRound();
  }else if(state === 'bad'){
    if(t > 1.1){ if(miss >= MISS_MAX) finish(); else { input = []; state = 'show'; showI = 0; t = 0; } }
  }
}

/* ===== 그리기 ===== */
function cup(x, y, r, m){
  g.save(); ink();
  if(m.id === 'cake'){
    g.fillStyle = '#F7EEDC'; rrect(x - r, y - r * 0.4, r * 2, r * 1.1, r * 0.2); g.fill(); g.stroke();
    g.fillStyle = m.color; rrect(x - r, y - r * 0.72, r * 2, r * 0.4, r * 0.16); g.fill(); g.stroke();
    g.fillStyle = '#FF8FA6';
    g.beginPath(); g.arc(x, y - r * 0.9, r * 0.18, 0, 7); g.fill(); g.stroke();
  }else if(m.id === 'cookie'){
    g.fillStyle = m.color; g.beginPath(); g.arc(x, y, r * 0.9, 0, 7); g.fill(); g.stroke();
    g.fillStyle = '#7A5230';
    [[-0.3, -0.2], [0.25, 0.1], [0, 0.35], [0.35, -0.35]].forEach(([a, b2]) => {
      g.beginPath(); g.arc(x + a * r, y + b2 * r, r * 0.12, 0, 7); g.fill(); });
  }else{
    g.fillStyle = m.color;
    g.beginPath(); g.moveTo(x - r * 0.62, y - r * 0.7); g.lineTo(x + r * 0.62, y - r * 0.7);
    g.lineTo(x + r * 0.45, y + r * 0.8); g.lineTo(x - r * 0.45, y + r * 0.8);
    g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#FFF8F0';
    g.beginPath(); g.ellipse(x, y - r * 0.7, r * 0.62, r * 0.16, 0, 0, 7); g.fill(); g.stroke();
    if(m.id === 'coffee' || m.id === 'tea'){
      g.save(); g.globalAlpha = .55; g.strokeStyle = '#FFFFFF'; g.lineWidth = LW() * 0.7;
      for(let i = -1; i <= 1; i++){
        g.beginPath(); g.moveTo(x + i * r * 0.3, y - r * 0.95);
        g.quadraticCurveTo(x + i * r * 0.3 + r * 0.2, y - r * 1.25, x + i * r * 0.3, y - r * 1.5);
        g.stroke(); }
      g.restore();
    }
  }
  g.restore();
}
function draw(){
  const k = uiK();
  /* 카페 벽 */
  const wg = g.createLinearGradient(0, 0, 0, H);
  wg.addColorStop(0, '#F6EADB'); wg.addColorStop(1, '#EADBC6');
  g.fillStyle = wg; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(160,130,90,.18)'; g.lineWidth = LW() * 0.5;
  for(let y = H * 0.1; y < H * 0.62; y += H * 0.09){ g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  /* 메뉴판 */
  g.save(); ink(); g.fillStyle = '#C9A06A';
  rrect(W * 0.62, H * 0.06, W * 0.32, H * 0.2, 12 * k); g.fill(); g.stroke();
  g.fillStyle = '#3E3428'; g.textAlign = 'center';
  g.font = '700 ' + (20 * k) + 'px Gaegu, sans-serif';
  g.fillText('MENU', W * 0.78, H * 0.12);
  g.font = '400 ' + (12 * k) + 'px Gowun Dodum, sans-serif'; g.fillStyle = '#F3EAE1';
  g.fillText('커피 · 우유 · 주스', W * 0.78, H * 0.17);
  g.fillText('케이크 · 쿠키 · 차', W * 0.78, H * 0.21);
  g.restore();
  /* 카운터 */
  const cy = H * 0.62;
  g.fillStyle = '#D9B884'; g.fillRect(0, cy, W, H - cy);
  ink(); g.beginPath(); g.moveTo(0, cy); g.lineTo(W, cy); g.stroke();
  g.fillStyle = '#C9A06A'; g.fillRect(0, cy + (H - cy) * 0.3, W, (H - cy) * 0.7);
  g.beginPath(); g.moveTo(0, cy + (H - cy) * 0.3); g.lineTo(W, cy + (H - cy) * 0.3); g.stroke();

  /* 손님 */
  if(guest){
    const im = IMG[guest.run], gh = Math.min(H * 0.3, W * 0.2);
    if(im && im.complete){
      g.save(); g.translate(W * 0.16, cy + 6); g.scale(guest.flip === false ? 1 : -1, 1);
      g.drawImage(im, -gh * 0.5, -gh, gh, gh); g.restore();
    }
    /* 주문 말풍선 */
    const bw = Math.min(W * 0.52, 70 * k * Math.max(3, order.length)), bh = H * 0.19;
    const bx = W * 0.3, by = H * 0.26;
    g.save(); ink(); g.fillStyle = '#FFF8F0';
    rrect(bx, by, bw, bh, 18 * k); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(bx + 18 * k, by + bh); g.lineTo(bx + 6 * k, by + bh + 16 * k);
    g.lineTo(bx + 40 * k, by + bh); g.closePath(); g.fillStyle = '#FFF8F0'; g.fill(); g.stroke();
    const n = order.length, r = Math.min(bh * 0.3, bw / (n + 1) * 0.42);
    order.forEach((id, i) => {
      const m = MENU.find(x => x.id === id);
      const x = bx + bw * (i + 0.5) / n, y = by + bh * 0.5;
      const shown = state === 'show' ? i < showI
                  : state === 'input' ? i < input.length
                  : true;
      if(shown){
        cup(x, y, r, m);
        if(state === 'input' && i < input.length){
          g.fillStyle = '#8FBF92'; g.beginPath();
          g.arc(x + r * 0.8, y - r * 0.9, r * 0.28, 0, 7); g.fill(); ink(); g.stroke();
        }
      }else{
        g.fillStyle = '#E7DFCF'; ink(LW() * 0.8);
        rrect(x - r * 0.7, y - r * 0.8, r * 1.4, r * 1.7, r * 0.3); g.fill(); g.stroke();
        g.fillStyle = '#B3A894'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = '700 ' + (r * 1.2) + 'px Gaegu, sans-serif'; g.fillText('?', x, y);
      }
    });
    g.restore();
  }

  /* 메뉴 버튼 */
  hitBox = [];
  const bw2 = Math.min(W * 0.14, 120 * k), bh2 = bw2 * 0.82, gap = bw2 * 0.12;
  const total = MENU.length * bw2 + (MENU.length - 1) * gap, x0 = W / 2 - total / 2;
  MENU.forEach((m, i) => {
    const x = x0 + i * (bw2 + gap), y = H - bh2 - 16 * k;
    const on = state === 'input';
    g.save(); g.globalAlpha = on ? 1 : 0.45;
    ink(); g.fillStyle = '#FFF8F0';
    rrect(x, y, bw2, bh2, 14 * k); g.fill(); g.stroke();
    cup(x + bw2 / 2, y + bh2 * 0.4, bw2 * 0.2, m);
    g.fillStyle = '#5A4A40'; g.textAlign = 'center';
    g.font = '700 ' + (15 * k) + 'px Gaegu, sans-serif';
    g.fillText(m.name, x + bw2 / 2, y + bh2 * 0.88);
    g.restore();
    hitBox.push({ id:m.id, x, y, w:bw2, h:bh2 });
  });

  /* HUD */
  g.save(); g.textAlign = 'left'; g.fillStyle = '#5A4A40';
  g.font = '700 ' + (30 * k) + 'px Gaegu, sans-serif';
  g.fillText(Math.round(score).toLocaleString('ko-KR'), 16 * k, 40 * k);
  g.font = '700 ' + (17 * k) + 'px Gaegu, sans-serif';
  g.fillText(round + '번째 손님 · 주문 ' + order.length + '개', 16 * k, 64 * k);
  for(let i = 0; i < MISS_MAX; i++){
    g.globalAlpha = i < MISS_MAX - miss ? 1 : 0.2;
    g.fillStyle = '#EFA6B8'; ink(LW() * 0.8);
    g.beginPath(); g.arc(24 * k + i * 26 * k, 84 * k, 9 * k, 0, 7); g.fill(); g.stroke();
  }
  g.globalAlpha = 1;
  g.textAlign = 'center'; g.fillStyle = '#5A4A40';
  g.font = '700 ' + (26 * k) + 'px Gaegu, sans-serif';
  if(state === 'show') g.fillText('잘 외워두세요!', W / 2, H * 0.13);
  if(state === 'input') g.fillText('순서대로 담아요', W / 2, H * 0.13);
  if(state === 'good'){ g.fillStyle = '#8FBF92'; g.fillText('주문 완료! +' + order.length + ' 팁', W / 2, H * 0.13); }
  if(state === 'bad'){ g.fillStyle = '#C9A9A9'; g.fillText('앗, 틀렸어요', W / 2, H * 0.13); }
  g.restore();
}

function frame(dt, active){ if(active) update(dt); draw(); }
function pointer(px, py){
  if(state !== 'input') return;
  for(const b of hitBox)
    if(px > b.x && px < b.x + b.w && py > b.y && py < b.y + b.h){ tapMenu(b.id); return; }
}
function key(code){
  if(state !== 'input') return;
  const i = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'].indexOf(code);
  if(i >= 0) tapMenu(MENU[i].id);
}
function quit(){ state = 'over'; goHome(); }
return { start, frame, pointer, key, quit, peek: () => ({ state, round, miss, score, order, input }),
         tap: tapMenu, MENU };
})();
