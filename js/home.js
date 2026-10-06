"use strict";
/* 집 — 방과 가구 — 꺅두기 하우스 */

/* ===============================================================
   집 — 방 그리기와 가구 자리
   =============================================================== */

/* 어디에 있나 — 'room'(집 안) · 'yard'(정원) */
let place = 'room';

/* 방 좌표 — 정원은 화면 전체를 쓴다 */
const roomW   = () => W * (place === 'yard' ? 1 : HOUSE().wide);
const roomL   = () => (W - roomW()) / 2;
const roomR   = () => roomL() + roomW();
const rx      = t => roomL() + roomW() * t;
const wallBot = () => H * (place === 'yard' ? 0.44 : HOUSE().tall);
const walkTop = () => wallBot() + (H - wallBot()) * 0.06;     // 벽 바로 앞까지 갈 수 있다
const walkBot = () => H - (H - wallBot()) * 0.06;
const yAt     = t => walkTop() + t * (walkBot() - walkTop());
const depthAt = y => 0.72 + 0.38 * ((y - walkTop()) / (walkBot() - walkTop()));
const zoneOf  = t => t < 0.34 ? 'kitchen' : t < 0.67 ? 'living' : 'bed';
const ZONE_X  = { kitchen:[0.02, 0.32], living:[0.35, 0.65], bed:[0.68, 0.98] };

/* 공용 그리기 도구 */
function ink(w){ g.strokeStyle = '#5A4A40'; g.lineWidth = w || LW(); g.lineJoin = 'round'; g.lineCap = 'round'; }
function rrect(x, y, w, h, r){
  r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  g.beginPath(); g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function box(x, y, w, h, r, fill){ g.fillStyle = fill; rrect(x, y, w, h, r); g.fill(); g.stroke(); }
/* 바닥에 닿는 그림자 — 가운데는 진하고 가장자리는 사라진다.
   납작한 타원 하나보다 이게 훨씬 '놓여 있는' 느낌이 납니다. */
function shadow(cx, base, w){
  const D = (typeof DAY === 'function') ? DAY() : null;
  const dark = D && D.star ? 0.30 : 0.22;
  FX.contact(cx, base + 1, w * 2.0, dark);
}

/* ===============================================================
   자리 배치 — 구역(주방·거실·침실)마다 앞뒤 줄로 나눠 놓는다
   꾸미기 모드에서 옮긴 자리는 S.pos 에 저장되어 그게 우선
   =============================================================== */
/* 슬롯을 하나씩 잡아 나간다 — 제 자리가 차 있으면 같은 구역의 다음 빈 자리로 */
function layoutHome(){
  const out = { floor: [], wall: [] };
  const taken = {}, wtaken = {};
  const items = [];
  for(const id of S.furn){ const f = FURN(id); if(f) items.push([id, f]); }
  PLACES.forEach(p => { if(p.id !== 'door') items.push([p.id, p]); });
  /* 큰 가구(벽쪽)부터 자리를 잡아야 앞자리에 밀리지 않는다 */
  items.sort((a, b) => (b[1].sz || 1) - (a[1].sz || 1));

  const grab = (zone, want, pool, used) => {
    const list = pool[zone] || [];
    let s2 = want && list.find(q => q.id === want && !used[q.id]);
    if(!s2) s2 = list.find(q => !used[q.id]);
    if(!s2){                                   /* 이 구역이 꽉 차면 옆 구역 */
      for(const z of ZONES){ s2 = (pool[z] || []).find(q => !used[q.id]); if(s2) break; }
    }
    if(s2) used[s2.id] = 1;
    return s2;
  };
  for(const [id, f] of items){
    const zone = f.zone || 'living';
    if(f.on === 'wall'){
      const s2 = grab(zone, f.slot, WALL_SLOTS, wtaken);
      out.wall.push({ id, zone, x: s2 ? s2.x : 0.5, slot: s2 && s2.id });
    }else{
      const s2 = grab(zone, f.slot, SLOTS, taken);
      out.floor.push({ id, zone, x: s2 ? s2.x : 0.5, y: s2 ? s2.y : 0.5,
                       row: s2 ? s2.row : 0, slot: s2 && s2.id,
                       sz: f.sz || 1, floorLayer: !!f.floorLayer });
    }
  }
  /* 옮겨둔 자리 반영 */
  out.floor.forEach(o => { const p = S.pos[o.id]; if(p){ o.x = p.x; o.y = p.y; } });
  out.wall.forEach(o => { const p = S.pos[o.id]; if(p){ o.x = p.x; } });
  out.door = { id:'door', x: S.pos.door ? S.pos.door.x : 0.5 };
  return out;
}
let LAY = layoutHome();
function relayout(){ LAY = layoutHome(); }
function spotOf(id){ return LAY.floor.find(o => o.id === id) || LAY.wall.find(o => o.id === id); }


/* ===============================================================
   시간대 — 실제 시각에 따라 방 분위기가 바뀐다
   =============================================================== */
const DAYPARTS = {
  /* sky  : 바깥 하늘색 (위→아래)   mul  : 화면 전체에 곱할 색
     glow : 불빛 번짐 세기          lamp : 바깥 해·달 색 (null 이면 안 그림)
     shaft: 빛기둥 세기             tilt : 빛이 기우는 방향   ray : 빛 색
     bloom: 밝은 데가 번지는 정도 */
  morn:  { name:'아침', sky:['#CFE6FB','#FDF0E2'], mul:'#E7EFF9', pool:0.16, glow:0.10,
           lamp:'#FFE9B0', star:0, shaft:0.075, tilt:0.62, ray:'255,235,195', bloom:0.16 },
  day:   { name:'낮',   sky:['#CDEBFA','#EAF6FB'], mul:null,      pool:0.14, glow:0,
           lamp:'#FFF3C4', star:0, shaft:0.045, tilt:0.30, ray:'255,246,220', bloom:0.12 },
  eve:   { name:'저녁', sky:['#FFC58C','#FFAE85'], mul:'#FAD6B4', pool:0.26, glow:0.20,
           lamp:'#FFB778', star:0, shaft:0.095, tilt:0.95, ray:'255,198,140', bloom:0.21 },
  night: { name:'밤',   sky:['#3F4876','#6A6E97'], mul:'#5B60A2', pool:0.34, glow:0.52,
           lamp:'#EAF0FF', star:1, shaft:0.038, tilt:0.20, ray:'190,205,255', bloom:0.26 }
};
function dayPart(){
  const h = new Date().getHours();
  return h < 6 ? 'night' : h < 10 ? 'morn' : h < 17 ? 'day' : h < 20 ? 'eve' : 'night';
}
const DAY = () => DAYPARTS[dayPart()];

/* 조명 자리 — 빛 웅덩이가 여기서 퍼진다 */
function lampSpot(){
  return S.house === 0 ? { x: rx(0.18), y: wallBot() * 0.3 }
       : S.house === 2 ? { x: rx(0.5),  y: wallBot() * 0.2 }
                       : { x: rx(0.90), y: wallBot() * 0.26 };
}
/* 바닥 빛 웅덩이 */
function lightPool(a){
  const L = lampSpot(), r = Math.max(roomW() * 0.42, (H - wallBot()) * 1.5);
  const rg = g.createRadialGradient(L.x, wallBot() + (H - wallBot()) * 0.45, r * 0.06,
                                    L.x, wallBot() + (H - wallBot()) * 0.45, r);
  rg.addColorStop(0, 'rgba(255,226,152,' + a + ')');
  rg.addColorStop(1, 'rgba(255,226,152,0)');
  g.save(); g.fillStyle = rg; g.fillRect(0, 0, W, H); g.restore();
}
/* 바깥에서 해·달이 뜨는 자리 — 위쪽 상태바에 가리지 않게 그 아래로 */
function skySpot(){ return { x: W * 0.80, y: wallBot() * 0.68 }; }

/* 화면 전체에 시간대 색 + 구석 어둠 — 바깥에서는 빛의 근원이 해·달이다 */
function drawDayTint(outdoor){
  const D = DAY();
  g.save();
  if(D.mul){                                   /* 곱하기 — 진짜로 어두워진다 */
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = D.mul; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
  }
  if(D.glow){                                  /* 조명(바깥이면 해·달) 주변만 다시 밝게 */
    const L = outdoor ? skySpot() : lampSpot();
    const cy = outdoor ? L.y : L.y + (H - L.y) * 0.45;
    const rg = g.createRadialGradient(L.x, cy, 8, L.x, cy, Math.min(W, H) * 0.78);
    rg.addColorStop(0,   'rgba(255,214,132,' + D.glow + ')');
    rg.addColorStop(0.45,'rgba(255,214,132,' + (D.glow * 0.3).toFixed(3) + ')');
    rg.addColorStop(1,   'rgba(255,214,132,0)');
    g.fillStyle = rg; g.fillRect(0, 0, W, H);
  }
  /* 구석 어둠 */
  const vg = g.createRadialGradient(W / 2, H * 0.46, Math.min(W, H) * 0.34,
                                    W / 2, H * 0.46, Math.max(W, H) * 0.72);
  vg.addColorStop(0, 'rgba(110,88,68,0)');
  vg.addColorStop(1, 'rgba(110,88,68,.26)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
  g.restore();
}

/* ===============================================================
   방
   =============================================================== */
function drawRoom(){
  const HS = HOUSE(), WA = WALLNOW(), FL = FLOORNOW();
  const wb = wallBot(), L = roomL(), R = roomR();
  g.fillStyle = '#E0D5C6'; g.fillRect(0, 0, W, H);

  const wg = g.createLinearGradient(0, 0, 0, wb);
  wg.addColorStop(0, WA.a); wg.addColorStop(1, WA.b);
  g.fillStyle = wg; g.fillRect(L, 0, R - L, wb);

  /* 벽지 무늬 */
  g.save(); g.beginPath(); g.rect(L, 0, R - L, wb); g.clip();
  if(S.house === 0 && S.wall === 'w0'){
    g.strokeStyle = 'rgba(150,125,90,.26)'; g.lineWidth = LW() * 0.5;
    for(let x = L; x < R; x += roomW() * 0.055){ g.beginPath(); g.moveTo(x, 0); g.lineTo(x, wb); g.stroke(); }
    g.fillStyle = 'rgba(120,100,70,.16)';
    g.beginPath(); g.moveTo(L + roomW() * 0.62, 0);
    g.lineTo(L + roomW() * 0.69, wb * 0.32); g.lineTo(L + roomW() * 0.59, wb * 0.28);
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(80,66,48,.4)';
    g.beginPath(); g.moveTo(L + roomW() * 0.22, 0);
    g.lineTo(L + roomW() * 0.25, wb * 0.2); g.lineTo(L + roomW() * 0.2, wb * 0.34); g.stroke();
  }else if(WA.pat === 'stripe'){
    g.strokeStyle = 'rgba(120,160,140,.3)'; g.lineWidth = LW() * 0.9;
    for(let x = L + 10; x < R; x += roomW() * 0.07){ g.beginPath(); g.moveTo(x, 0); g.lineTo(x, wb); g.stroke(); }
  }else if(WA.pat === 'grid'){
    g.strokeStyle = 'rgba(120,150,180,.26)'; g.lineWidth = LW() * 0.55;
    for(let x = L; x < R; x += roomW() * 0.07){ g.beginPath(); g.moveTo(x, 0); g.lineTo(x, wb); g.stroke(); }
    for(let y = wb * 0.1; y < wb; y += wb * 0.18){ g.beginPath(); g.moveTo(L, y); g.lineTo(R, y); g.stroke(); }
  }else{
    g.fillStyle = 'rgba(190,170,140,.35)';
    const gx = roomW() * 0.075, gy = wb * 0.17;
    for(let x = L + gx * 0.5; x < R; x += gx)
      for(let y = wb * 0.12; y < wb - 6; y += gy){
        const o = (Math.round(y / gy) % 2) * gx * 0.5;
        g.beginPath(); g.arc(x + o, y, Math.max(1.8, 2.4 * uiK() * 0.7), 0, 7); g.fill();
      }
  }
  g.restore();

  /* 바닥 */
  const fg = g.createLinearGradient(0, wb, 0, H);
  fg.addColorStop(0, FL.a); fg.addColorStop(1, FL.b);
  g.fillStyle = fg; g.fillRect(L, wb, R - L, H - wb);
  g.save(); g.beginPath(); g.rect(L, wb, R - L, H - wb); g.clip();
  g.strokeStyle = 'rgba(120,95,60,.18)'; g.lineWidth = LW() * 0.5;
  for(let i = 1; i < 6; i++){ const y = wb + (H - wb) * (i / 6);
    g.beginPath(); g.moveTo(L, y); g.lineTo(R, y); g.stroke(); }
  for(let i = 0; i <= 12; i++){ const t = i / 12;
    g.beginPath(); g.moveTo(rx(t), wb); g.lineTo(rx(0.5 + (t - 0.5) * 1.4), H); g.stroke(); }
  g.restore();

  /* 벽 아래 그늘 · 걸레받이 */
  const sh = g.createLinearGradient(0, wb - (H - wb) * 0.26, 0, wb);
  sh.addColorStop(0, 'rgba(120,100,70,0)'); sh.addColorStop(1, 'rgba(120,100,70,.14)');
  g.fillStyle = sh; g.fillRect(L, wb - (H - wb) * 0.26, R - L, (H - wb) * 0.26);
  const tw = (H - wb) * 0.075;
  g.fillStyle = S.house === 0 ? '#D9CDB4' : '#FFF8F0';
  g.fillRect(L, wb - tw, R - L, tw);
  ink(); g.beginPath(); g.moveTo(L, wb - tw); g.lineTo(R, wb - tw);
  g.moveTo(L, wb); g.lineTo(R, wb); g.stroke();
  if(S.house === 2){
    g.fillStyle = '#FFF8F0'; g.fillRect(L, H * 0.04, R - L, H * 0.018);
    g.beginPath(); g.moveTo(L, H * 0.058); g.lineTo(R, H * 0.058); g.stroke();
  }
  ink(); g.beginPath(); g.moveTo(L, 0); g.lineTo(L, H); g.moveTo(R, 0); g.lineTo(R, H); g.stroke();
  if(HOUSE().wide < 1){
    g.save(); g.globalAlpha = .35; g.fillStyle = '#8C8172';
    g.fillRect(0, 0, L, H); g.fillRect(R, 0, W - R, H); g.restore();
  }

  /* 천장 몰딩 — 벽이 허전하지 않게 */
  g.fillStyle = '#FFF8EF';
  g.fillRect(L, H * 0.028, R - L, H * 0.016);
  ink(LW() * 0.8);
  g.beginPath(); g.moveTo(L, H * 0.044); g.lineTo(R, H * 0.044); g.stroke();

  /* 바닥 빛 웅덩이 */
  lightPool(DAY().pool);

  /* 조명 · 창문 */
  const s = Math.min(roomW() * 0.09, wb * 0.32);
  if(S.house === 0){
    drawBulb(rx(0.18), 0, wb * 0.24);
    drawWindow(rx(0.86), wb * 0.44, s * 0.8, true);
  }else{
    drawWindow(rx(0.11), wb * 0.44, s, false);
    if(S.house === 2){ drawWindow(rx(0.90), wb * 0.44, s, false); drawLamp(rx(0.5), 0, wb * 0.15); }
    else drawBulb(rx(0.90), 0, wb * 0.2);
  }
}
function drawBulb(cx, top, len){
  ink(); g.beginPath(); g.moveTo(cx, top); g.lineTo(cx, top + len); g.stroke();
  const r = len * 0.22;
  g.save(); g.globalAlpha = .3; g.fillStyle = '#FFE08A';
  g.beginPath(); g.arc(cx, top + len + r, r * 2.6, 0, 7); g.fill(); g.restore();
  box(cx - r, top + len, r * 2, r * 2.1, r, '#FFE9A8');
}
function drawLamp(cx, top, len){
  ink(); g.beginPath(); g.moveTo(cx, top); g.lineTo(cx, top + len); g.stroke();
  const w = len * 1.2;
  g.save(); g.globalAlpha = .26; g.fillStyle = '#FFE08A';
  g.beginPath(); g.moveTo(cx - w, top + len * 3.4); g.lineTo(cx + w, top + len * 3.4);
  g.lineTo(cx + w * 0.42, top + len); g.lineTo(cx - w * 0.42, top + len); g.closePath(); g.fill(); g.restore();
  g.fillStyle = '#F3EAE1';
  g.beginPath(); g.moveTo(cx - w * 0.62, top + len + w * 0.4); g.lineTo(cx + w * 0.62, top + len + w * 0.4);
  g.lineTo(cx + w * 0.32, top + len); g.lineTo(cx - w * 0.32, top + len); g.closePath();
  g.fill(); ink(); g.stroke();
}
function drawWindow(cx, cy, s, old){
  g.save();
  let SKY = DAY().sky;
  const WX = WEATHER();
  if(WX.id === 'rain')  SKY = ['#9AA7B4', '#B6C1CA'];
  if(WX.id === 'cloud') SKY = ['#C2CFD9', '#DCE5EB'];
  if(WX.id === 'snow')  SKY = ['#C8D4E0', '#E4EBF1'];
  const sg = g.createLinearGradient(0, cy - s * 0.75, 0, cy + s * 0.75);
  sg.addColorStop(0, SKY[0]); sg.addColorStop(1, SKY[1]);
  g.fillStyle = sg; rrect(cx - s * 0.95, cy - s * 0.75, s * 1.9, s * 1.5, s * 0.14);
  g.fill(); ink(); g.stroke();
  g.save(); rrect(cx - s * 0.95, cy - s * 0.75, s * 1.9, s * 1.5, s * 0.14); g.clip();
  g.fillStyle = '#FFFFFF'; g.globalAlpha = .75;
  g.beginPath(); g.arc(cx - s * 0.32, cy - s * 0.2, s * 0.3, 0, 7);
  g.arc(cx + s * 0.02, cy - s * 0.3, s * 0.22, 0, 7); g.fill();
  g.globalAlpha = .5; g.fillStyle = '#8FBF92';
  g.beginPath(); g.ellipse(cx + s * 0.5, cy + s * 0.62, s * 0.5, s * 0.22, 0, 0, 7); g.fill();
  g.restore();
  drawWeatherIn(cx, cy, s, 0);
  ink();
  g.beginPath(); g.moveTo(cx, cy - s * 0.75); g.lineTo(cx, cy + s * 0.75);
  g.moveTo(cx - s * 0.95, cy); g.lineTo(cx + s * 0.95, cy); g.stroke();
  if(!old){
    g.fillStyle = '#EFA6B8';
    [-1, 1].forEach(d => {
      g.beginPath(); g.moveTo(cx + d * s * 0.95, cy - s * 0.9);
      g.quadraticCurveTo(cx + d * s * 0.72, cy - s * 0.1, cx + d * s * 0.95, cy + s * 0.75);
      g.lineTo(cx + d * s * 1.16, cy + s * 0.75); g.lineTo(cx + d * s * 1.16, cy - s * 0.9);
      g.closePath(); g.fill(); g.stroke(); });
    g.fillStyle = '#E39FB2';
    g.fillRect(cx - s * 1.2, cy - s * 0.95, s * 2.4, s * 0.1);
    g.strokeRect(cx - s * 1.2, cy - s * 0.95, s * 2.4, s * 0.1);
  }
  g.restore();
}

/* ===============================================================
   가구 하나
   =============================================================== */
function drawFurn(id, cx, base, s, glow){
  g.save();
  if(glow){
    g.save(); g.globalAlpha = 0.28 + Math.sin(home.t * 5) * 0.16;
    g.fillStyle = '#FFE08A';
    g.beginPath(); g.ellipse(cx, base - s * 0.4, s * 1.05, s * 0.8, 0, 0, 7); g.fill(); g.restore();
  }
  ink();
  switch(id){
    case 'bowl': {
      shadow(cx, base, s * 0.5);
      g.fillStyle = '#E4C48E'; g.beginPath();
      g.moveTo(cx - s * 0.46, base - s * 0.32); g.lineTo(cx + s * 0.46, base - s * 0.32);
      g.quadraticCurveTo(cx + s * 0.3, base, cx, base);
      g.quadraticCurveTo(cx - s * 0.3, base, cx - s * 0.46, base - s * 0.32);
      g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#C88B5A';
      g.beginPath(); g.ellipse(cx, base - s * 0.32, s * 0.46, s * 0.13, 0, 0, 7); g.fill(); g.stroke();
      if(S.dugi.full < 70){ g.fillStyle = '#E0A45C';
        g.beginPath(); g.ellipse(cx, base - s * 0.35, s * 0.3, s * 0.1, 0, 0, 7); g.fill(); g.stroke(); }
      break;
    }
    case 'tub': {
      shadow(cx, base, s * 0.55);
      g.fillStyle = '#8FC0D8'; g.beginPath();
      g.moveTo(cx - s * 0.5, base - s * 0.4); g.lineTo(cx + s * 0.5, base - s * 0.4);
      g.quadraticCurveTo(cx + s * 0.36, base, cx, base);
      g.quadraticCurveTo(cx - s * 0.36, base, cx - s * 0.5, base - s * 0.4);
      g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#7FC4E4';
      g.beginPath(); g.ellipse(cx, base - s * 0.4, s * 0.5, s * 0.13, 0, 0, 7); g.fill(); g.stroke();
      g.fillStyle = '#FFFFFF';
      [[-0.18, -0.48, 0.1], [0.08, -0.55, 0.075], [0.24, -0.46, 0.055]].forEach(([dx, dy, r]) => {
        g.beginPath(); g.arc(cx + dx * s, base + dy * s, r * s, 0, 7); g.fill(); g.stroke(); });
      break;
    }
    case 'plant': {                                     // 물 줄수록 자란다
      const st = Math.min(4, S.dugi.plant || 0);
      shadow(cx, base, s * 0.36);
      g.fillStyle = '#D98E6A'; g.beginPath();
      g.moveTo(cx - s * 0.33, base - s * 0.44); g.lineTo(cx + s * 0.33, base - s * 0.44);
      g.lineTo(cx + s * 0.24, base); g.lineTo(cx - s * 0.24, base); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#C67A58';
      g.fillRect(cx - s * 0.33, base - s * 0.44, s * 0.66, s * 0.1);
      g.strokeRect(cx - s * 0.33, base - s * 0.44, s * 0.66, s * 0.1);
      const hgt = (0.28 + st * 0.18) * s;
      ink(); g.beginPath(); g.moveTo(cx, base - s * 0.44); g.lineTo(cx, base - s * 0.44 - hgt); g.stroke();
      g.fillStyle = '#8FBF92';
      for(let i = 0; i <= st; i++){
        const y = base - s * 0.44 - hgt * (0.35 + i * 0.2), d = i % 2 ? 1 : -1;
        g.beginPath(); g.ellipse(cx + d * s * 0.22, y, s * 0.24, s * 0.13, d * 0.5, 0, 7);
        g.fill(); g.stroke();
      }
      if(st >= 4){
        g.fillStyle = '#EFA6B8';
        for(let i = 0; i < 5; i++){ const a = i / 5 * 6.283;
          g.beginPath(); g.ellipse(cx + Math.cos(a) * s * 0.13, base - s * 0.44 - hgt + Math.sin(a) * s * 0.13,
                                   s * 0.1, s * 0.08, a, 0, 7); g.fill(); g.stroke(); }
        g.fillStyle = '#FFE08A';
        g.beginPath(); g.arc(cx, base - s * 0.44 - hgt, s * 0.08, 0, 7); g.fill(); g.stroke();
      }
      break;
    }
    case 'ball': {
      shadow(cx, base, s * 0.3);
      const bx = home.ball.flying ? 0 : 0, bob = Math.abs(Math.sin(home.t * 1.4)) * s * 0.05;
      g.fillStyle = '#EFA6B8';
      g.beginPath(); g.arc(cx + bx, base - s * 0.28 - bob, s * 0.28, 0, 7); g.fill(); g.stroke();
      g.strokeStyle = '#E39FB2';
      g.beginPath(); g.arc(cx + bx, base - s * 0.28 - bob, s * 0.28, 2.4, 3.9); g.stroke();
      g.beginPath(); g.arc(cx + bx, base - s * 0.28 - bob, s * 0.28, -0.7, 0.8); g.stroke(); ink();
      break;
    }
    case 'bed': {
      shadow(cx, base, s * 0.95);
      box(cx - s * 0.92, base - s * 0.5, s * 1.84, s * 0.5, s * 0.1, '#C9A06A');
      box(cx - s * 0.88, base - s * 0.72, s * 1.2, s * 0.3, s * 0.12, '#FFF8F0');
      g.fillStyle = '#AD9ED4';
      rrect(cx - s * 0.2, base - s * 0.7, s * 1.1, s * 0.34, s * 0.12); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.35)';
      rrect(cx - s * 0.2, base - s * 0.7, s * 1.1, s * 0.12, s * 0.08); g.fill();
      box(cx + s * 0.78, base - s * 0.88, s * 0.14, s * 0.88, s * 0.06, '#C9A06A');
      break;
    }
    case 'fridge': {
      shadow(cx, base, s * 0.5);
      box(cx - s * 0.44, base - s * 1.3, s * 0.88, s * 1.3, s * 0.1, '#FFF8F0');
      g.beginPath(); g.moveTo(cx - s * 0.44, base - s * 0.85); g.lineTo(cx + s * 0.44, base - s * 0.85); g.stroke();
      g.fillStyle = '#D9C4A0';
      [[-0.78, 0.2], [-1.16, 0.2]].forEach(([y, h]) => {
        g.fillRect(cx + s * 0.26, base + s * y, s * 0.07, s * h);
        g.strokeRect(cx + s * 0.26, base + s * y, s * 0.07, s * h); });
      g.fillStyle = '#EFA6B8';
      g.beginPath(); g.arc(cx - s * 0.2, base - s * 1.1, s * 0.06, 0, 7); g.fill(); g.stroke();
      break;
    }
    case 'sink': {
      shadow(cx, base, s * 0.6);
      box(cx - s * 0.6, base - s * 0.62, s * 1.2, s * 0.62, s * 0.07, '#D9CDB4');
      box(cx - s * 0.52, base - s * 0.72, s * 1.04, s * 0.14, s * 0.05, '#C9DCE4');
      g.fillStyle = '#AFC9D4';
      g.beginPath(); g.ellipse(cx - s * 0.16, base - s * 0.65, s * 0.22, s * 0.06, 0, 0, 7); g.fill(); g.stroke();
      ink(LW() * 0.9);
      g.beginPath(); g.moveTo(cx + s * 0.3, base - s * 0.72);
      g.lineTo(cx + s * 0.3, base - s * 0.98);
      g.quadraticCurveTo(cx + s * 0.3, base - s * 1.08, cx + s * 0.12, base - s * 1.06); g.stroke(); ink();
      break;
    }
    case 'table': {
      shadow(cx, base, s * 0.6);
      box(cx - s * 0.62, base - s * 0.5, s * 1.24, s * 0.14, s * 0.06, '#D9B884');
      [-0.5, 0.5].forEach(d => { g.fillStyle = '#C9A06A';
        g.fillRect(cx + d * s - s * 0.05, base - s * 0.36, s * 0.1, s * 0.36);
        g.strokeRect(cx + d * s - s * 0.05, base - s * 0.36, s * 0.1, s * 0.36); });
      g.fillStyle = '#FFF8F0';
      g.beginPath(); g.ellipse(cx + s * 0.22, base - s * 0.56, s * 0.11, s * 0.09, 0, 0, 7);
      g.fill(); g.stroke();
      break;
    }
    case 'rug': {
      g.fillStyle = '#F6C8D4';
      g.beginPath(); g.ellipse(cx, base, s * 1.4, s * 0.42, 0, 0, 7); g.fill(); g.stroke();
      g.strokeStyle = '#E39FB2';
      g.beginPath(); g.ellipse(cx, base, s * 1.0, s * 0.3, 0, 0, 7); g.stroke();
      g.beginPath(); g.ellipse(cx, base, s * 0.58, s * 0.17, 0, 0, 7); g.stroke(); ink();
      break;
    }
    case 'sofa': {
      shadow(cx, base, s * 0.95);
      box(cx - s * 0.9, base - s * 0.6, s * 1.8, s * 0.46, s * 0.14, '#9DC9E8');
      box(cx - s * 0.98, base - s * 0.72, s * 0.3, s * 0.58, s * 0.12, '#8BBBDC');
      box(cx + s * 0.68, base - s * 0.72, s * 0.3, s * 0.58, s * 0.12, '#8BBBDC');
      box(cx - s * 0.66, base - s * 0.9, s * 1.32, s * 0.34, s * 0.12, '#B4D8F0');
      g.fillStyle = '#EFA6B8';
      rrect(cx + s * 0.1, base - s * 0.86, s * 0.34, s * 0.3, s * 0.08); g.fill(); g.stroke();
      break;
    }
    case 'tv': {
      shadow(cx, base, s * 0.62);
      box(cx - s * 0.32, base - s * 0.14, s * 0.64, s * 0.14, s * 0.04, '#B99A6E');
      box(cx - s * 0.66, base - s * 0.9, s * 1.32, s * 0.78, s * 0.09, '#8A7264');
      box(cx - s * 0.56, base - s * 0.82, s * 1.12, s * 0.6, s * 0.05, '#8FC0D8');
      g.save(); rrect(cx - s * 0.56, base - s * 0.82, s * 1.12, s * 0.6, s * 0.05); g.clip();
      g.fillStyle = 'rgba(255,255,255,.5)';
      g.beginPath(); g.moveTo(cx - s * 0.5, base - s * 0.22); g.lineTo(cx - s * 0.1, base - s * 0.86);
      g.lineTo(cx + s * 0.06, base - s * 0.86); g.lineTo(cx - s * 0.34, base - s * 0.22);
      g.closePath(); g.fill(); g.restore();
      break;
    }
    case 'shelf': {
      shadow(cx, base, s * 0.55);
      box(cx - s * 0.5, base - s * 1.1, s, s * 1.1, s * 0.07, '#C9A06A');
      [0.74, 0.39].forEach(t => { g.beginPath();
        g.moveTo(cx - s * 0.5, base - s * t); g.lineTo(cx + s * 0.5, base - s * t); g.stroke(); });
      [['#EFA6B8', 0], ['#8FC0D8', 1], ['#8FBF92', 2]].forEach(([c, i]) => {
        g.fillStyle = c; const bx = cx - s * 0.42 + i * s * 0.17;
        g.fillRect(bx, base - s * 0.72, s * 0.12, s * 0.3);
        g.strokeRect(bx, base - s * 0.72, s * 0.12, s * 0.3); });
      g.fillStyle = '#AD9ED4';
      g.fillRect(cx - s * 0.1, base - s * 0.37, s * 0.4, s * 0.3);
      g.strokeRect(cx - s * 0.1, base - s * 0.37, s * 0.4, s * 0.3);
      break;
    }
    case 'cake': {
      shadow(cx, base, s * 0.42);
      box(cx - s * 0.4, base - s * 0.5, s * 0.8, s * 0.5, s * 0.07, '#F7EEDC');
      g.fillStyle = '#EFA6B8';
      rrect(cx - s * 0.4, base - s * 0.62, s * 0.8, s * 0.18, s * 0.07); g.fill(); g.stroke();
      [-0.22, 0, 0.22].forEach(d => {
        g.fillStyle = '#FFF8F0';
        g.fillRect(cx + d * s - s * 0.02, base - s * 0.8, s * 0.04, s * 0.18);
        g.strokeRect(cx + d * s - s * 0.02, base - s * 0.8, s * 0.04, s * 0.18);
        g.fillStyle = '#FFE08A';
        g.beginPath(); g.ellipse(cx + d * s, base - s * 0.85, s * 0.05, s * 0.08, 0, 0, 7);
        g.fill(); g.stroke(); });
      break;
    }
    case 'piano': {
      shadow(cx, base, s * 0.6);
      box(cx - s * 0.56, base - s * 0.5, s * 1.12, s * 0.5, s * 0.07, '#AD9ED4');
      g.fillStyle = '#FFF8F0';
      g.fillRect(cx - s * 0.5, base - s * 0.52, s, s * 0.16);
      g.strokeRect(cx - s * 0.5, base - s * 0.52, s, s * 0.16);
      for(let i = 1; i < 7; i++){ const x = cx - s * 0.5 + s * (i / 7);
        g.beginPath(); g.moveTo(x, base - s * 0.52); g.lineTo(x, base - s * 0.36); g.stroke(); }
      break;
    }
    case 'lamp': {
      shadow(cx, base, s * 0.3);
      g.fillStyle = '#D9C4A0';
      g.beginPath(); g.moveTo(cx - s * 0.2, base); g.lineTo(cx + s * 0.2, base);
      g.lineTo(cx + s * 0.05, base - s * 0.8); g.lineTo(cx - s * 0.05, base - s * 0.8);
      g.closePath(); g.fill(); g.stroke();
      g.save(); g.globalAlpha = .28; g.fillStyle = '#FFE08A';
      g.beginPath(); g.arc(cx, base - s * 1.0, s * 0.8, 0, 7); g.fill(); g.restore();
      g.fillStyle = '#FFE9A8';
      g.beginPath(); g.moveTo(cx - s * 0.44, base - s * 0.8); g.lineTo(cx + s * 0.44, base - s * 0.8);
      g.lineTo(cx + s * 0.28, base - s * 1.2); g.lineTo(cx - s * 0.28, base - s * 1.2);
      g.closePath(); g.fill(); g.stroke();
      break;
    }
    case 'toybox': {
      shadow(cx, base, s * 0.5);
      box(cx - s * 0.5, base - s * 0.5, s, s * 0.5, s * 0.07, '#E0A45C');
      g.beginPath(); g.moveTo(cx - s * 0.5, base - s * 0.36); g.lineTo(cx + s * 0.5, base - s * 0.36); g.stroke();
      ['#EFA6B8', '#8FC0D8'].forEach((c, i) => {
        g.fillStyle = c;
        g.beginPath(); g.arc(cx - s * 0.2 + i * s * 0.4, base - s * 0.58, s * 0.13, 0, 7);
        g.fill(); g.stroke(); });
      break;
    }
    case 'cushion': {
      shadow(cx, base, s * 0.45);
      g.fillStyle = '#F6C8D4';
      rrect(cx - s * 0.42, base - s * 0.34, s * 0.84, s * 0.34, s * 0.16); g.fill(); g.stroke();
      g.strokeStyle = '#E39FB2';
      g.beginPath(); g.moveTo(cx - s * 0.3, base - s * 0.17); g.lineTo(cx + s * 0.3, base - s * 0.17);
      g.stroke(); ink();
      break;
    }
    case 'hammock': {
      shadow(cx, base, s * 0.7);
      ink(LW() * 0.9);
      [-1, 1].forEach(d => { g.beginPath();
        g.moveTo(cx + d * s * 0.8, base); g.lineTo(cx + d * s * 0.8, base - s * 0.9); g.stroke(); });
      g.fillStyle = '#EAD9B8';
      g.beginPath(); g.moveTo(cx - s * 0.8, base - s * 0.78);
      g.quadraticCurveTo(cx, base - s * 0.2, cx + s * 0.8, base - s * 0.78);
      g.quadraticCurveTo(cx, base - s * 0.42, cx - s * 0.8, base - s * 0.78);
      g.closePath(); g.fill(); g.stroke(); ink();
      break;
    }
    case 'trophy': {
      shadow(cx, base, s * 0.38);
      box(cx - s * 0.3, base - s * 0.16, s * 0.6, s * 0.16, s * 0.05, '#C9A06A');
      g.fillStyle = '#FFD36E';
      g.beginPath(); g.moveTo(cx - s * 0.3, base - s * 0.7); g.lineTo(cx + s * 0.3, base - s * 0.7);
      g.quadraticCurveTo(cx + s * 0.22, base - s * 0.2, cx, base - s * 0.16);
      g.quadraticCurveTo(cx - s * 0.22, base - s * 0.2, cx - s * 0.3, base - s * 0.7);
      g.closePath(); g.fill(); g.stroke();
      [-1, 1].forEach(d => { g.beginPath();
        g.ellipse(cx + d * s * 0.36, base - s * 0.56, s * 0.12, s * 0.16, 0, 0, 7); g.stroke(); });
      break;
    }
    /* 벽 */
    case 'frame': {
      box(cx - s * 0.44, base - s * 0.64, s * 0.88, s * 0.64, s * 0.05, '#C9A06A');
      box(cx - s * 0.34, base - s * 0.55, s * 0.68, s * 0.46, s * 0.03, '#FFF8F0');
      g.fillStyle = '#8FBF92';
      g.beginPath(); g.moveTo(cx - s * 0.26, base - s * 0.14); g.lineTo(cx - s * 0.04, base - s * 0.42);
      g.lineTo(cx + s * 0.14, base - s * 0.14); g.closePath(); g.fill(); g.stroke();
      break;
    }
    case 'clock': {
      g.fillStyle = '#FFF8F0';
      g.beginPath(); g.arc(cx, base - s * 0.36, s * 0.36, 0, 7); g.fill(); g.stroke();
      g.fillStyle = '#5A4A40';
      for(let i = 0; i < 12; i++){ const a = i / 12 * 6.283;
        g.beginPath(); g.arc(cx + Math.cos(a) * s * 0.28, base - s * 0.36 + Math.sin(a) * s * 0.28,
                             s * 0.018, 0, 7); g.fill(); }
      const a = home.t * 0.5; ink(LW() * 0.8);
      g.beginPath(); g.moveTo(cx, base - s * 0.36);
      g.lineTo(cx + Math.cos(a) * s * 0.17, base - s * 0.36 + Math.sin(a) * s * 0.17);
      g.moveTo(cx, base - s * 0.36);
      g.lineTo(cx + Math.cos(a * 6) * s * 0.25, base - s * 0.36 + Math.sin(a * 6) * s * 0.25);
      g.stroke(); ink();
      break;
    }
    case 'garland': {
      const w = s * 1.9;
      g.beginPath(); g.moveTo(cx - w / 2, base - s * 0.5);
      g.quadraticCurveTo(cx, base - s * 0.16, cx + w / 2, base - s * 0.5); g.stroke();
      ['#EFA6B8', '#8FC0D8', '#8FBF92', '#FFE08A', '#AD9ED4'].forEach((c, i) => {
        const t = (i + 0.5) / 5, x = cx - w / 2 + w * t;
        const y = base - s * 0.5 + Math.sin(t * Math.PI) * s * 0.34;
        g.fillStyle = c; g.beginPath(); g.moveTo(x - s * 0.11, y); g.lineTo(x + s * 0.11, y);
        g.lineTo(x, y + s * 0.28); g.closePath(); g.fill(); g.stroke(); });
      break;
    }
    case 'poster': {
      box(cx - s * 0.4, base - s * 0.7, s * 0.8, s * 0.7, s * 0.04, '#FFF3D6');
      g.fillStyle = '#EFA6B8';
      g.beginPath(); g.arc(cx, base - s * 0.45, s * 0.18, 0, 7); g.fill(); g.stroke();
      g.fillStyle = '#8A7264';
      g.fillRect(cx - s * 0.26, base - s * 0.2, s * 0.52, s * 0.05);
      g.fillRect(cx - s * 0.18, base - s * 0.12, s * 0.36, s * 0.04);
      break;
    }
    case 'window2': { drawWindow(cx, base - s * 0.5, s * 0.55, false); break; }
    /* 방 자체 */
    case 'wardrobe': {
      shadow(cx, base, s * 0.55);
      box(cx - s * 0.52, base - s * 1.4, s * 1.04, s * 1.4, s * 0.09, '#C9A06A');
      g.beginPath(); g.moveTo(cx, base - s * 1.34); g.lineTo(cx, base - s * 0.06); g.stroke();
      g.fillStyle = '#B98F58';
      g.fillRect(cx - s * 0.46, base - s * 1.34, s * 0.92, s * 0.1);
      g.strokeRect(cx - s * 0.46, base - s * 1.34, s * 0.92, s * 0.1);
      g.fillStyle = '#F3EAE1';
      [-0.11, 0.11].forEach(d => { g.beginPath();
        g.arc(cx + d * s, base - s * 0.7, s * 0.055, 0, 7); g.fill(); g.stroke(); });
      break;
    }
    case 'gacha': {
      shadow(cx, base, s * 0.5);
      box(cx - s * 0.46, base - s * 1.34, s * 0.92, s * 1.34, s * 0.11, '#EFA6B8');
      g.fillStyle = '#FFF8F0';
      g.beginPath(); g.arc(cx, base - s * 0.95, s * 0.33, 0, 7); g.fill(); g.stroke();
      ['#8FBF92', '#8FC0D8', '#FFE08A', '#AD9ED4'].forEach((c, i) => {
        g.fillStyle = c;
        g.beginPath(); g.arc(cx - s * 0.15 + (i % 2) * s * 0.3,
                             base - s * 1.04 + Math.floor(i / 2) * s * 0.18, s * 0.08, 0, 7);
        g.fill(); g.stroke(); });
      g.fillStyle = '#F3EAE1';
      rrect(cx - s * 0.2, base - s * 0.5, s * 0.4, s * 0.24, s * 0.05); g.fill(); g.stroke();
      break;
    }
    case 'door': {
      box(cx - s * 0.58, base - s * 1.62, s * 1.16, s * 1.62, s * 0.09, '#D98E6A');
      box(cx - s * 0.44, base - s * 1.48, s * 0.88, s * 0.54, s * 0.06, '#C87A58');
      box(cx - s * 0.44, base - s * 0.86, s * 0.88, s * 0.7, s * 0.06, '#C87A58');
      g.fillStyle = '#FFE08A';
      g.beginPath(); g.arc(cx + s * 0.36, base - s * 0.8, s * 0.08, 0, 7); g.fill(); g.stroke();
      g.fillStyle = '#F3EAE1';
      rrect(cx - s * 0.32, base - s * 1.8, s * 0.64, s * 0.2, s * 0.06); g.fill(); g.stroke();
      g.fillStyle = '#C9784F';
      g.beginPath(); g.arc(cx, base - s * 1.7, s * 0.05, 0, 7); g.fill(); g.stroke();
      break;
    }
  }
  g.restore();
}

/* ===============================================================
   정원 — 집 밖. 가게 · 뽑기 기계 · 알바 게시판이 있다
   =============================================================== */
const yardDeco = [];
function seedYard(){
  yardDeco.length = 0;
  for(let i = 0; i < 7; i++)
    yardDeco.push({ x: (i * 0.147 + 0.05) % 1, y: 0.1 + ((i * 0.31) % 0.75),
                    k: i % 3 === 0 ? 'flower' : 'tuft', c: ['#EFA6B8','#FFE08A','#FFFFFF'][i % 3] });
}
seedYard();

function drawYard(){
  const wb = wallBot();
  const D = DAY();
  /* 하늘 — 시간대에 따라 색이 바뀐다 */
  const sk = g.createLinearGradient(0, 0, 0, wb);
  sk.addColorStop(0, D.sky[0]); sk.addColorStop(1, D.sky[1]);
  g.fillStyle = sk; g.fillRect(0, 0, W, wb);

  /* 별 — 밤에만 */
  if(D.star){
    g.save(); g.fillStyle = '#FFFFFF';
    for(let i = 0; i < 34; i++){
      const sx = ((i * 97) % 100) / 100 * W;
      const sy = wb * (0.46 + ((i * 53) % 100) / 100 * 0.48);   /* 상태바 아래쪽에 */
      const tw = 0.35 + 0.45 * Math.abs(Math.sin(home.t * 0.8 + i));
      g.globalAlpha = tw;
      g.beginPath(); g.arc(sx, sy, (i % 3 === 0 ? 1.7 : 1.1) * uiK(), 0, 7); g.fill();
    }
    g.restore();
  }

  /* 해 · 달 */
  if(D.lamp){
    const L = skySpot();
    g.save();
    const hal = g.createRadialGradient(L.x, L.y, 2, L.x, L.y, wb * 0.34);
    hal.addColorStop(0, D.lamp); hal.addColorStop(1, 'rgba(255,255,255,0)');
    g.globalAlpha = 0.55; g.fillStyle = hal;
    g.beginPath(); g.arc(L.x, L.y, wb * 0.34, 0, 7); g.fill();
    g.globalAlpha = 1; g.fillStyle = D.lamp;
    g.beginPath(); g.arc(L.x, L.y, wb * 0.085, 0, 7); g.fill();
    if(D.star){                                  /* 달 — 한 입 베어 문 모양 */
      g.globalCompositeOperation = 'destination-out';
      g.beginPath(); g.arc(L.x - wb * 0.038, L.y - wb * 0.026, wb * 0.072, 0, 7); g.fill();
      g.globalCompositeOperation = 'source-over';
    }
    g.restore();
  }

  /* 구름 — 밤에는 흐릿하게 */
  g.save(); g.fillStyle = D.star ? '#8E93BE' : '#FFFFFF';
  g.globalAlpha = D.star ? .45 : .9;
  [[0.14, 0.22, 1], [0.52, 0.14, 0.75], [0.82, 0.26, 0.9]].forEach(([cx, cy, sc]) => {
    const x = W * cx, y = wb * cy, r = wb * 0.11 * sc;
    g.beginPath(); g.arc(x, y, r, 0, 7); g.arc(x + r * 0.9, y + r * 0.2, r * 0.75, 0, 7);
    g.arc(x - r * 0.9, y + r * 0.25, r * 0.65, 0, 7); g.fill();
  });
  g.restore();
  /* 먼 언덕 */
  g.fillStyle = '#C3E3C0';
  g.beginPath(); g.moveTo(0, wb);
  g.quadraticCurveTo(W * 0.22, wb - H * 0.12, W * 0.46, wb);
  g.quadraticCurveTo(W * 0.72, wb - H * 0.16, W, wb);
  g.closePath(); g.fill();
  /* 잔디 */
  const gr = g.createLinearGradient(0, wb, 0, H);
  gr.addColorStop(0, '#A9D9A2'); gr.addColorStop(1, '#8CC486');
  g.fillStyle = gr; g.fillRect(0, wb, W, H - wb);
  /* 울타리 */
  const fy = wb, fh = (H - wb) * 0.12;
  g.save(); ink(LW() * 0.8); g.fillStyle = '#E3D2B4';
  for(let x = 0; x < W; x += W * 0.045){
    rrect(x, fy - fh, W * 0.018, fh, W * 0.008); g.fill(); g.stroke();
  }
  g.beginPath(); g.moveTo(0, fy - fh * 0.58); g.lineTo(W, fy - fh * 0.58); g.stroke();
  g.restore();
  /* 흙길 */
  g.save(); g.fillStyle = '#E4D2AE';
  g.beginPath();
  g.moveTo(rx(0.09), wb); g.lineTo(rx(0.17), wb);
  g.lineTo(rx(0.62), H); g.lineTo(rx(0.30), H);
  g.closePath(); g.fill();
  g.globalAlpha = .35; g.fillStyle = '#CDB78F';
  for(let i = 1; i < 6; i++){
    const t = i / 6, y = wb + (H - wb) * t;
    g.beginPath(); g.ellipse(rx(0.13 + t * 0.33), y, W * 0.02, (H - wb) * 0.02, 0, 0, 7); g.fill();
  }
  g.restore();
  /* 풀·꽃 */
  yardDeco.forEach(d => {
    const x = rx(d.x), y = yAt(d.y), s = 9 * uiK() * depthAt(y);
    g.save(); ink(LW() * 0.6);
    if(d.k === 'flower'){
      g.strokeStyle = '#6FA86B';
      g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - s * 1.4); g.stroke();
      g.fillStyle = d.c; ink(LW() * 0.6);
      for(let i = 0; i < 5; i++){
        const a = i / 5 * 6.283;
        g.beginPath(); g.arc(x + Math.cos(a) * s * 0.42, y - s * 1.4 + Math.sin(a) * s * 0.42, s * 0.34, 0, 7);
        g.fill(); g.stroke();
      }
      g.fillStyle = '#FFE08A'; g.beginPath(); g.arc(x, y - s * 1.4, s * 0.26, 0, 7); g.fill(); g.stroke();
    }else{
      g.strokeStyle = '#6FA86B'; g.lineWidth = LW() * 0.8;
      [-0.5, 0, 0.5].forEach(o => {
        g.beginPath(); g.moveTo(x + o * s, y);
        g.quadraticCurveTo(x + o * s * 2, y - s * 0.9, x + o * s * 3.2, y - s * 1.3); g.stroke();
      });
    }
    g.restore();
  });
}

/* 정원에 있는 것 하나 */
function drawYardThing(id, cx, base, s, glow){
  g.save();
  if(glow){
    g.save(); g.globalAlpha = 0.28 + Math.sin(home.t * 5) * 0.16;
    g.fillStyle = '#FFE08A';
    g.beginPath(); g.ellipse(cx, base - s * 0.5, s * 1.2, s * 0.95, 0, 0, 7); g.fill(); g.restore();
  }
  ink();
  const label = (txt, y, col) => {
    g.fillStyle = col || '#5A4A40'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '700 ' + (14 * uiK()) + 'px Gaegu, sans-serif';
    g.fillText(txt, cx, y);
  };
  switch(id){
    case 'house': {                                   /* 우리 집 */
      shadow(cx, base, s * 0.9);
      const w = s * 1.7, h = s * 1.35;
      box(cx - w / 2, base - h, w, h, s * 0.1, '#FFF3E2');
      g.fillStyle = '#D98E72';                        /* 지붕 */
      g.beginPath(); g.moveTo(cx - w * 0.62, base - h);
      g.lineTo(cx, base - h - s * 0.62); g.lineTo(cx + w * 0.62, base - h);
      g.closePath(); g.fill(); g.stroke();
      box(cx - s * 0.28, base - s * 0.86, s * 0.56, s * 0.86, s * 0.09, '#C98A5E');   /* 문 */
      g.fillStyle = '#FFE08A';
      g.beginPath(); g.arc(cx + s * 0.16, base - s * 0.44, s * 0.05, 0, 7); g.fill(); g.stroke();
      box(cx + s * 0.44, base - h + s * 0.26, s * 0.38, s * 0.32, s * 0.06, '#CDEBFA'); /* 창 */
      label('우리 집', base - h - s * 0.82);
      break;
    }
    case 'shop': {                                    /* 가게 */
      shadow(cx, base, s * 1.0);
      const w = s * 1.9, h = s * 1.4;
      box(cx - w / 2, base - h, w, h, s * 0.1, '#FFFBF0');
      /* 줄무늬 차양 */
      const ay = base - h + s * 0.34, ah = s * 0.32;
      for(let i = 0; i < 6; i++){
        g.fillStyle = i % 2 ? '#FFFBF0' : '#EFA6B8';
        const x0 = cx - w * 0.56 + (w * 1.12 / 6) * i;
        g.beginPath(); g.moveTo(x0, ay); g.lineTo(x0 + w * 1.12 / 6, ay);
        g.lineTo(x0 + w * 1.12 / 6, ay + ah); g.lineTo(x0, ay + ah); g.closePath();
        g.fill(); g.stroke();
      }
      box(cx - w * 0.38, ay + ah + s * 0.12, w * 0.76, s * 0.6, s * 0.07, '#DFF0F8');   /* 진열창 */
      g.fillStyle = '#E7B075';
      [-0.2, 0.05, 0.28].forEach((o, i) => {
        g.beginPath(); g.arc(cx + o * w, ay + ah + s * 0.42, s * 0.11, 0, 7); g.fill(); g.stroke(); });
      /* 간판 */
      box(cx - s * 0.62, base - h - s * 0.46, s * 1.24, s * 0.42, s * 0.1, '#FFE08A');
      label('상점', base - h - s * 0.25);
      break;
    }
    case 'gmach': {                                   /* 뽑기 기계 */
      shadow(cx, base, s * 0.5);
      const w = s * 0.86, h = s * 1.25;
      box(cx - w / 2, base - h * 0.52, w, h * 0.52, s * 0.08, '#EFA6B8');   /* 아래 통 */
      g.fillStyle = '#CDEBFA';                                             /* 유리 돔 */
      g.beginPath(); g.arc(cx, base - h * 0.58, w * 0.52, Math.PI, 0); g.fill(); g.stroke();
      g.save(); g.beginPath(); g.arc(cx, base - h * 0.58, w * 0.52, Math.PI, 0); g.clip();
      ['#FFE08A','#8FC0D8','#8FBF92','#EFA6B8','#AD9ED4'].forEach((c, i) => {
        g.fillStyle = c;
        g.beginPath(); g.arc(cx - w * 0.3 + (i % 3) * w * 0.3, base - h * 0.62 + Math.floor(i / 3) * w * 0.26,
                             w * 0.14, 0, 7); g.fill();
      });
      g.restore();
      g.beginPath(); g.arc(cx, base - h * 0.58, w * 0.52, Math.PI, 0); g.stroke();
      g.fillStyle = '#FFF8F0';                                             /* 손잡이 */
      g.beginPath(); g.arc(cx, base - h * 0.3, w * 0.12, 0, 7); g.fill(); g.stroke();
      box(cx - w * 0.26, base - h * 0.16, w * 0.52, h * 0.13, s * 0.04, '#F3EAE1');   /* 배출구 */
      label('뽑기', base - h - s * 0.1);
      break;
    }
    case 'board': {                                   /* 알바 게시판 */
      shadow(cx, base, s * 0.55);
      ink(); g.strokeStyle = '#A3805A'; g.lineWidth = LW() * 1.6;
      g.beginPath(); g.moveTo(cx - s * 0.3, base); g.lineTo(cx - s * 0.3, base - s * 0.7);
      g.moveTo(cx + s * 0.3, base); g.lineTo(cx + s * 0.3, base - s * 0.7); g.stroke();
      ink();
      box(cx - s * 0.72, base - s * 1.4, s * 1.44, s * 0.78, s * 0.08, '#E3C79C');
      ['#FFF8F0','#FDF2DE','#FFFFFF'].forEach((c, i) => {
        g.fillStyle = c;
        const px = cx - s * 0.52 + i * s * 0.44;
        rrect(px, base - s * 1.3, s * 0.36, s * 0.42, s * 0.03); g.fill(); g.stroke();
        g.strokeStyle = '#C2A88A'; g.lineWidth = LW() * 0.5;
        for(let l = 0; l < 3; l++){
          g.beginPath(); g.moveTo(px + s * 0.06, base - s * 1.22 + l * s * 0.1);
          g.lineTo(px + s * 0.3, base - s * 1.22 + l * s * 0.1); g.stroke();
        }
        ink();
      });
      label('알바', base - s * 1.55);
      break;
    }
    case 'mail': {                                    /* 우체통 — 계정 */
      shadow(cx, base, s * 0.34);
      ink(); g.strokeStyle = '#A3805A'; g.lineWidth = LW() * 1.6;
      g.beginPath(); g.moveTo(cx, base); g.lineTo(cx, base - s * 0.62); g.stroke();
      ink();
      const mw = s * 0.62, mh = s * 0.46, my = base - s * 0.62 - mh;
      box(cx - mw / 2, my + mh * 0.3, mw, mh * 0.7, s * 0.05, '#8FC0D8');
      g.fillStyle = '#8FC0D8';                        /* 둥근 지붕 */
      g.beginPath(); g.arc(cx, my + mh * 0.3, mw / 2, Math.PI, 0); g.fill(); g.stroke();
      g.fillStyle = '#5A4A40';
      rrect(cx - mw * 0.22, my + mh * 0.46, mw * 0.44, mh * 0.12, mh * 0.06); g.fill();
      g.strokeStyle = '#E86A6A'; g.lineWidth = LW() * 1.4;  /* 깃발 */
      g.beginPath(); g.moveTo(cx + mw * 0.5, my + mh * 0.34);
      g.lineTo(cx + mw * 0.5, my - mh * 0.1); g.stroke();
      g.fillStyle = '#E86A6A';
      g.beginPath(); g.moveTo(cx + mw * 0.5, my - mh * 0.1);
      g.lineTo(cx + mw * 0.98, my + mh * 0.02);
      g.lineTo(cx + mw * 0.5, my + mh * 0.14); g.closePath(); g.fill(); ink(); g.stroke();
      label('계정', my - mh * 0.34);
      break;
    }
    case 'rank': {                                    /* 명예의 전당 — 랭킹 */
      shadow(cx, base, s * 0.95);
      const bw = s * 0.5;                             /* 단 하나의 너비 */
      const steps = [[-1, 0.46, '#DCE3EA', '2'], [1, 0.34, '#E8C3A0', '3'], [0, 0.66, '#FFE08A', '1']];
      steps.forEach(([ox, hh, col, no]) => {
        const x0 = cx + ox * bw - bw / 2;
        box(x0, base - s * hh, bw, s * hh, s * 0.03, col);
        g.fillStyle = 'rgba(90,74,64,.55)'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = '700 ' + (15 * uiK()) + 'px Gaegu, sans-serif';
        g.fillText(no, x0 + bw / 2, base - s * hh * 0.5);
      });
      /* 가운데 단 위의 트로피 */
      const ty = base - s * 0.66;
      g.fillStyle = '#E8B15E';
      box(cx - s * 0.17, ty - s * 0.1, s * 0.34, s * 0.1, s * 0.025, '#D99B46');   /* 받침 */
      g.fillStyle = '#E8B15E';
      g.fillRect(cx - s * 0.045, ty - s * 0.26, s * 0.09, s * 0.16);               /* 기둥 */
      g.strokeRect(cx - s * 0.045, ty - s * 0.26, s * 0.09, s * 0.16);
      g.fillStyle = '#F2C772';                                                     /* 컵 */
      g.beginPath();
      g.moveTo(cx - s * 0.19, ty - s * 0.56);
      g.lineTo(cx + s * 0.19, ty - s * 0.56);
      g.quadraticCurveTo(cx + s * 0.15, ty - s * 0.26, cx, ty - s * 0.26);
      g.quadraticCurveTo(cx - s * 0.15, ty - s * 0.26, cx - s * 0.19, ty - s * 0.56);
      g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = '#E8B15E'; g.lineWidth = LW() * 1.5;                         /* 손잡이 */
      g.beginPath(); g.arc(cx - s * 0.21, ty - s * 0.47, s * 0.09, 1.4, 4.6, true); g.stroke();
      g.beginPath(); g.arc(cx + s * 0.21, ty - s * 0.47, s * 0.09, 4.6, 1.4); g.stroke();
      ink();
      const tw = 0.5 + Math.sin(home.t * 2.4) * 0.5;                               /* 반짝 */
      g.fillStyle = 'rgba(255,255,255,.9)'; g.globalAlpha = 0.3 + tw * 0.55;
      g.beginPath(); g.arc(cx + s * 0.09, ty - s * 0.5, s * 0.045 * (0.7 + tw * 0.6), 0, 7); g.fill();
      g.globalAlpha = 1;
      label('랭킹', ty - s * 0.78);
      break;
    }
  }
  g.restore();
}

/* ===============================================================
   집 안 붙박이 — 사진첩 · 할 일판 · 공구함 · 라디오
   위쪽 버튼 줄을 없앤 대신, 누르면 두기가 걸어가서 열어줍니다.
   =============================================================== */
function drawFixed(id, cx, base, s, glow){
  g.save();
  if(glow){
    g.save(); g.globalAlpha = 0.26 + Math.sin(home.t * 5) * 0.15;
    g.fillStyle = '#FFE08A';
    g.beginPath(); g.ellipse(cx, base - s * 0.45, s * 1.25, s * 0.9, 0, 0, 7); g.fill(); g.restore();
  }
  ink();
  switch(id){
    case 'album': {                                   /* 사진첩 — 벽 선반 위 책 두 권 */
      box(cx - s * 0.5, base, s * 1.0, s * 0.1, s * 0.03, '#C9A06A');   /* 선반 */
      box(cx - s * 0.42, base - s * 0.26, s * 0.84, s * 0.26, s * 0.04, '#9CB8D8');
      box(cx - s * 0.38, base - s * 0.52, s * 0.76, s * 0.27, s * 0.04, '#EFA6B8');
      g.fillStyle = '#FFF8F0';                        /* 책등 종이 */
      rrect(cx - s * 0.3, base - s * 0.5, s * 0.6, s * 0.06, s * 0.02); g.fill();
      /* 끼워둔 사진 한 장 */
      g.save(); g.translate(cx + s * 0.12, base - s * 0.58); g.rotate(-0.16);
      box(-s * 0.19, -s * 0.22, s * 0.38, s * 0.3, s * 0.02, '#FFFDF8');
      g.fillStyle = '#C8DCC9';
      rrect(-s * 0.15, -s * 0.18, s * 0.3, s * 0.18, s * 0.015); g.fill();
      g.restore(); ink();
      break;
    }
    case 'calend': {                                  /* 할 일판 — 벽에 건 체크리스트 */
      ink(LW() * 0.9);
      g.beginPath(); g.moveTo(cx, base - s * 0.82); g.lineTo(cx, base - s * 0.96); g.stroke();
      g.fillStyle = '#8A7560';
      g.beginPath(); g.arc(cx, base - s * 0.98, s * 0.045, 0, 7); g.fill(); g.stroke();
      box(cx - s * 0.34, base - s * 0.82, s * 0.68, s * 0.82, s * 0.05, '#FFFBF0');
      box(cx - s * 0.34, base - s * 0.82, s * 0.68, s * 0.18, s * 0.05, '#E8907F');
      g.fillStyle = '#FFF8F0';
      for(let i = 0; i < 3; i++){
        const ly = base - s * 0.56 + i * s * 0.17;
        g.strokeStyle = '#C2A88A'; g.lineWidth = LW() * 0.7;
        g.beginPath(); g.moveTo(cx - s * 0.11, ly); g.lineTo(cx + s * 0.24, ly); g.stroke();
        ink(LW() * 0.8);
        g.strokeRect(cx - s * 0.25, ly - s * 0.06, s * 0.11, s * 0.11);
        if(i < 2){                                    /* 체크 */
          g.strokeStyle = '#6FA86F'; g.lineWidth = LW() * 1.3;
          g.beginPath(); g.moveTo(cx - s * 0.22, ly - s * 0.005);
          g.lineTo(cx - s * 0.19, ly + s * 0.035); g.lineTo(cx - s * 0.14, ly - s * 0.045);
          g.stroke();
        }
        ink();
      }
      /* 남은 할 일이 있으면 빨간 점 */
      if(typeof dailyLeft === 'function' && dailyLeft() > 0){
        g.fillStyle = '#E8564E';
        g.beginPath();
        g.arc(cx + s * 0.3, base - s * 0.84, s * 0.1 + Math.sin(home.t * 4) * s * 0.015, 0, 7);
        g.fill(); g.stroke();
      }
      break;
    }
    case 'tools': {                                   /* 공구 걸이 — 꾸미기 */
      box(cx - s * 0.44, base - s * 0.72, s * 0.88, s * 0.72, s * 0.05,
          deco ? '#9CCADF' : '#E0C49A');
      g.fillStyle = 'rgba(120,95,60,.22)';              /* 타공판 구멍 */
      for(let r2 = 0; r2 < 3; r2++) for(let c2 = 0; c2 < 4; c2++){
        g.beginPath();
        g.arc(cx - s * 0.3 + c2 * s * 0.2, base - s * 0.6 + r2 * s * 0.2, s * 0.022, 0, 7); g.fill();
      }
      /* 망치 */
      g.strokeStyle = '#A3805A'; g.lineWidth = LW() * 1.6;
      g.beginPath(); g.moveTo(cx - s * 0.2, base - s * 0.52); g.lineTo(cx - s * 0.2, base - s * 0.14);
      g.stroke(); ink();
      box(cx - s * 0.33, base - s * 0.62, s * 0.26, s * 0.12, s * 0.02, '#8A7560');
      /* 드라이버 */
      g.strokeStyle = '#8FC0D8'; g.lineWidth = LW() * 1.4;
      g.beginPath(); g.moveTo(cx + s * 0.16, base - s * 0.56); g.lineTo(cx + s * 0.16, base - s * 0.3);
      g.stroke(); ink();
      box(cx + s * 0.08, base - s * 0.3, s * 0.16, s * 0.18, s * 0.03, '#E8907F');
      break;
    }
    case 'radio': {                                   /* 선반 위 라디오 — 설정 */
      box(cx - s * 0.5, base, s * 1.0, s * 0.1, s * 0.03, '#C9A06A');   /* 선반 */
      box(cx - s * 0.4, base - s * 0.46, s * 0.8, s * 0.46, s * 0.06, '#C9A88B');
      box(cx - s * 0.32, base - s * 0.38, s * 0.4, s * 0.3, s * 0.04, '#5A4A40');
      g.fillStyle = '#8A7560';                         /* 스피커 구멍 */
      for(let r2 = 0; r2 < 3; r2++) for(let c2 = 0; c2 < 4; c2++){
        g.beginPath();
        g.arc(cx - s * 0.27 + c2 * s * 0.1, base - s * 0.33 + r2 * s * 0.09, s * 0.025, 0, 7);
        g.fill();
      }
      g.fillStyle = '#FFE08A';                         /* 손잡이 둘 */
      [0.0, 0.17].forEach((o, i) => {
        g.beginPath(); g.arc(cx + s * 0.2, base - s * 0.36 + o * 1.4, s * 0.07, 0, 7);
        g.fill(); g.stroke();
      });
      g.strokeStyle = '#8A7560'; g.lineWidth = LW() * 1.2;   /* 안테나 */
      g.beginPath(); g.moveTo(cx + s * 0.3, base - s * 0.46);
      g.lineTo(cx + s * 0.44, base - s * 0.78); g.stroke();
      ink();
      break;
    }
  }
  g.restore();
}


/* 구역 이름 — 꾸미기 모드에서, 시간대 색 위에 그린다 */
function drawZoneLabels(){
  const wb = wallBot();
  g.save(); g.textAlign = 'center';
  ZONES.forEach(z => {
    const [a, b] = ZONE_X[z];
    if(b < 0.99){
      g.setLineDash([6, 8]); ink(LW() * 0.6); g.globalAlpha = .45;
      g.beginPath(); g.moveTo(rx(b + 0.015), wb); g.lineTo(rx(b + 0.015), H); g.stroke();
      g.setLineDash([]);
    }
    g.globalAlpha = 1;
    const txt = ZONE_NAME[z], cx = rx((a + b) / 2), cy = wb + (H - wb) * 0.1;
    g.font = '700 ' + (16 * uiK()) + 'px Gaegu, sans-serif';
    const w = g.measureText(txt).width + 22 * uiK(), h = 26 * uiK();
    g.fillStyle = 'rgba(255,252,248,.88)';
    rrect(cx - w / 2, cy - h / 2, w, h, h / 2); g.fill();
    g.fillStyle = '#7A6250'; g.textBaseline = 'middle';
    g.fillText(txt, cx, cy + 1);
  });
  g.restore();
}


/* ===============================================================
   날씨 — 창밖과 방 안에 같이 나타난다
   =============================================================== */
let wxDrops = [];
function seedWeather(){
  wxDrops = [];
  const w = WEATHER();
  if(w.id !== 'rain' && w.id !== 'snow') return;
  const n = w.id === 'rain' ? 46 : 30;
  for(let i = 0; i < n; i++)
    wxDrops.push({ x: Math.random(), y: Math.random(), v: 0.5 + Math.random() * 0.7,
                   s: 0.6 + Math.random() * 0.8, w: Math.random() * 6.28 });
}
seedWeather();
/* 창문 안쪽에 그린다 — (cx,cy)는 창 중심, s는 창 크기 */
function drawWeatherIn(cx, cy, s, dt){
  const w = WEATHER();
  if(w.id === 'sun' || w.id === 'cloud') return;
  g.save();
  rrect(cx - s * 0.95, cy - s * 0.75, s * 1.9, s * 1.5, s * 0.14); g.clip();
  if(w.id === 'rain'){
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = Math.max(2, LW() * 0.7);
    g.lineCap = 'round';
    wxDrops.forEach(d => {
      const x = cx - s * 0.95 + ((d.x + home.t * 0.05) % 1) * s * 1.9;
      const y = cy - s * 0.75 + ((d.y + home.t * d.v * 0.5) % 1) * s * 1.5;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x - s * 0.07, y + s * 0.24); g.stroke();
    });
  }else{
    g.fillStyle = 'rgba(255,255,255,.92)';
    wxDrops.forEach(d => {
      const x = cx - s * 0.95 + ((d.x + Math.sin(home.t * 0.6 + d.w) * 0.03 + 1) % 1) * s * 1.9;
      const y = cy - s * 0.75 + ((d.y + home.t * d.v * 0.12) % 1) * s * 1.5;
      g.beginPath(); g.arc(x, y, s * 0.05 * d.s, 0, 7); g.fill();
    });
  }
  g.restore();
}
/* 오늘 날씨 알림 — 창 옆에 작게 */
function drawWeatherChip(){
  const w = WEATHER(), k = uiK();
  const txt = w.name;
  g.save();
  g.font = '700 ' + (14 * k) + 'px Gaegu, sans-serif';
  const tw = g.measureText(txt).width + 34 * k, th = 24 * k;
  const x = roomL() + 12 * k, y = 10 * k;
  g.fillStyle = 'rgba(255,252,248,.9)';
  rrect(x, y, tw, th, th / 2); g.fill();
  const ix = x + 13 * k, iy = y + th / 2;
  if(w.id === 'sun'){
    g.fillStyle = '#F5C34E'; g.beginPath(); g.arc(ix, iy, 6 * k, 0, 7); g.fill();
    g.strokeStyle = '#F5C34E'; g.lineWidth = 2 * k;
    for(let i = 0; i < 8; i++){ const a = i / 8 * 6.28;
      g.beginPath(); g.moveTo(ix + Math.cos(a) * 8 * k, iy + Math.sin(a) * 8 * k);
      g.lineTo(ix + Math.cos(a) * 10.5 * k, iy + Math.sin(a) * 10.5 * k); g.stroke(); }
  }else{
    g.fillStyle = w.id === 'snow' ? '#DCE8F2' : '#B9C7D4';
    g.beginPath(); g.arc(ix - 4 * k, iy - 1 * k, 5 * k, 0, 7);
    g.arc(ix + 2 * k, iy - 3 * k, 6.5 * k, 0, 7); g.arc(ix + 7 * k, iy, 5 * k, 0, 7); g.fill();
    if(w.id !== 'cloud'){
      g.strokeStyle = w.id === 'snow' ? '#FFFFFF' : '#8FC0D8'; g.lineWidth = 2.2 * k;
      [-4, 1, 6].forEach(o => { g.beginPath();
        g.moveTo(ix + o * k, iy + 6 * k); g.lineTo(ix + (o - 1.5) * k, iy + 10 * k); g.stroke(); });
    }
  }
  g.fillStyle = '#7A6250'; g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillText(txt, x + 26 * k, y + th / 2 + 1);
  g.restore();
}

/* ===============================================================
   손님 — 현관 옆에 서 있다
   =============================================================== */
const GUEST_POS = { x: 0.50, y: 0.46 };
function drawGuest(){
  if(!S.guest || place !== 'room') return;
  const c = guestLook(), im = c && IMG[c.run];
  const cx = rx(GUEST_POS.x), cy = yAt(GUEST_POS.y);
  const s = Math.min(H * 0.17, roomW() * 0.16) * depthAt(cy);
  shadow(cx, cy, s * 0.42);
  g.save(); g.translate(cx, cy);
  if(S.guest.fed){ g.globalAlpha = 0.96; }
  g.scale(c && c.flip === false ? -1 : 1, 1);
  if(im && im.complete && im.naturalWidth) g.drawImage(im, -s * 0.5, -s, s, s);
  g.restore();
  /* 말풍선 */
  const k = uiK(), txt = S.guest.fed ? '고마워요!' : S.guest.line;
  g.save();
  g.font = '700 ' + (16 * k) + 'px Gaegu, sans-serif';
  const tw = g.measureText(txt).width + 22 * k, th = 26 * k;
  const bx = cx - tw / 2, by = cy - s - th - 10 * k;
  g.fillStyle = '#FFFFFF'; g.strokeStyle = '#EFE4D8'; g.lineWidth = LW() * 0.7;
  rrect(bx, by, tw, th, th / 2); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(cx - 6 * k, by + th); g.lineTo(cx, by + th + 8 * k);
  g.lineTo(cx + 7 * k, by + th); g.closePath(); g.fillStyle = '#FFFFFF'; g.fill();
  g.fillStyle = '#5A4A40'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(txt, cx, by + th / 2 + 1);
  g.restore();
}


/* 자정을 넘기면 날씨·손님·할 일이 새로 정해진다 */
let watchKey = 0, watchPart = '';
function dayWatch(){
  const k = dayKey(), pt = dayPart();
  if(k !== watchKey){
    watchKey = k;
    if(typeof rollGuest === 'function') rollGuest();
    if(typeof payUpkeep === 'function'){
      const u = payUpkeep();
      if(u) toast('관리비 ' + u.cost + ' 클로버', u.short ? '모자라서 ' + u.paid + '만 냈어요' : HOUSE().name);
    }
    if(typeof checkDaily === 'function') checkDaily();
    seedWeather();
    if(typeof paintDaily === 'function') paintDaily();
    if(typeof refreshBar === 'function') refreshBar();
  }
  if(pt !== watchPart){ watchPart = pt; if(typeof refreshBar === 'function') refreshBar(); }
}
