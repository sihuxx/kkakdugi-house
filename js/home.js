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
function shadow(cx, base, w){
  g.save(); g.globalAlpha = 0.10; g.fillStyle = '#7A6250';
  g.beginPath(); g.ellipse(cx, base + 1, w, w * 0.22, 0, 0, 7); g.fill(); g.restore();
}

/* ===============================================================
   자리 배치 — 구역(주방·거실·침실)마다 앞뒤 줄로 나눠 놓는다
   꾸미기 모드에서 옮긴 자리는 S.pos 에 저장되어 그게 우선
   =============================================================== */
const ROW_Y = { 1:0.16, 0:0.58, 2:0.66 };
function layoutHome(){
  const zones = { kitchen:{ 0:[], 1:[], 2:[] }, living:{ 0:[], 1:[], 2:[] }, bed:{ 0:[], 1:[], 2:[] } };
  const wall = { kitchen:[], living:[], bed:[] };
  const add = (id, f) => {
    const z = f.zone || 'living';
    if(f.on === 'wall') wall[z].push(id);
    else zones[z][f.row || 0].push(id);
  };
  for(const id of S.furn){ const f = FURN(id); if(f) add(id, f); }
  PLACES.forEach(p => { if(p.id !== 'door') add(p.id, p); });

  const out = { floor: [], wall: [] };
  ZONES.forEach(z => {
    const [a, b] = ZONE_X[z];
    [1, 0, 2].forEach(row => {
      const list = zones[z][row];
      list.forEach((id, i) => {
        let t = list.length === 1 ? 0.5 : (i + 0.5) / list.length;
        let x = a + (b - a) * t;
        /* 거실 벽쪽 줄은 현관 자리를 비켜 간다 */
        if(z === 'living' && row === 1 && Math.abs(x - 0.5) < 0.09)
          x = x < 0.5 ? 0.5 - 0.11 : 0.5 + 0.11;
        out.floor.push({ id, zone:z, x, y: ROW_Y[row], row });
      });
    });
    wall[z].forEach((id, i) => {
      const t = wall[z].length === 1 ? 0.5 : (i + 0.5) / wall[z].length;
      out.wall.push({ id, zone:z, x: a + (b - a) * t });
    });
  });
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

  /* 구역 이름 (꾸미기 모드에서만) */
  if(deco){
    g.save(); g.globalAlpha = .5; g.textAlign = 'center';
    g.font = '700 ' + (16 * uiK()) + 'px Gaegu, sans-serif'; g.fillStyle = '#5A4A40';
    ZONES.forEach(z => {
      const [a, b] = ZONE_X[z];
      g.fillText(ZONE_NAME[z], rx((a + b) / 2), wb + (H - wb) * 0.12);
      if(b < 0.99){ g.setLineDash([6, 8]); ink(LW() * 0.6); g.globalAlpha = .3;
        g.beginPath(); g.moveTo(rx(b + 0.015), wb); g.lineTo(rx(b + 0.015), H); g.stroke();
        g.setLineDash([]); g.globalAlpha = .5; }
    });
    g.restore();
  }

  /* 조명 · 창문 */
  const s = Math.min(roomW() * 0.09, wb * 0.32);
  if(S.house === 0){
    drawBulb(rx(0.2), 0, wb * 0.24);
    drawWindow(rx(0.8), wb * 0.46, s * 0.8, true);
  }else{
    drawWindow(rx(0.16), wb * 0.48, s, false);
    if(S.house === 2){ drawWindow(rx(0.84), wb * 0.48, s, false); drawLamp(rx(0.5), 0, wb * 0.15); }
    else drawBulb(rx(0.84), 0, wb * 0.2);
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
  box(cx - s * 0.95, cy - s * 0.75, s * 1.9, s * 1.5, s * 0.14, old ? '#BFD9E4' : '#CDEBFA');
  g.save(); rrect(cx - s * 0.95, cy - s * 0.75, s * 1.9, s * 1.5, s * 0.14); g.clip();
  g.fillStyle = '#FFFFFF'; g.globalAlpha = .75;
  g.beginPath(); g.arc(cx - s * 0.32, cy - s * 0.2, s * 0.3, 0, 7);
  g.arc(cx + s * 0.02, cy - s * 0.3, s * 0.22, 0, 7); g.fill();
  g.globalAlpha = .5; g.fillStyle = '#8FBF92';
  g.beginPath(); g.ellipse(cx + s * 0.5, cy + s * 0.62, s * 0.5, s * 0.22, 0, 0, 7); g.fill();
  g.restore();
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
  /* 하늘 */
  const sk = g.createLinearGradient(0, 0, 0, wb);
  sk.addColorStop(0, '#CFEAF7'); sk.addColorStop(1, '#EAF6FB');
  g.fillStyle = sk; g.fillRect(0, 0, W, wb);
  /* 구름 */
  g.save(); g.fillStyle = '#FFFFFF'; g.globalAlpha = .9;
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
  }
  g.restore();
}
