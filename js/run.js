"use strict";
/* 꺅두기런 — 꺅두기 하우스 */

/* ===============================================================
   꺅두기런 — 외출해서 하는 미니게임 ②
   집 화면과 같은 캔버스를 쓰되, 안쪽 이름은 이 모듈 안에만 있습니다.
   좌표: 월드 단위(설계 높이 540), y는 위가 +, 땅이 0
   =============================================================== */
const DugiRun = (function(){
"use strict";

/* 배경 테마 — 매 판 하나를 뽑는다 */
const THEMES = [
  { id:'town',   name:'동네 골목', sky:['#BFE3F5','#E9F6FC'], hill:'#CFE7C6', bush:'#B7DBAE',
    dirt:'#E6D5B4', grass:'#8FBF92', prop:'house', house:['#F4E3C8','#EBD9F0','#DCEFF7'] },
  { id:'park',   name:'공원 길',   sky:['#CFEEDC','#EFF9F2'], hill:'#BFE0B8', bush:'#A6D39D',
    dirt:'#DFCFA8', grass:'#82BE86', prop:'tree' },
  { id:'beach',  name:'바닷가',    sky:['#CDEAFA','#EFF8FD'], hill:'#BFE3DC', bush:'#A8DCD2',
    dirt:'#F0E0B6', grass:'#A6D8C6', prop:'palm' },
  { id:'sunset', name:'노을 길',   sky:['#FFC28E','#FFE6C8'], hill:'#E8BE9E', bush:'#D8AE93',
    dirt:'#DDB88C', grass:'#C2B481', prop:'house', house:['#F6D6B4','#EFC9C0','#E8DCC0'] },
  { id:'night',  name:'밤 골목',   sky:['#3E4668','#727AA0'], hill:'#5A6480', bush:'#4E5A72',
    dirt:'#9A8B74', grass:'#6E8C72', prop:'lamp', house:['#7C7C96','#6E7690','#86809A'], dark:true }
];
function rollRun(){
  const th = THEMES[Math.floor(Math.random() * THEMES.length)];
  return { theme:th, sky:th.sky, dark:!!th.dark,
           hp: 3,
           v0:   395 + Math.round(Math.random() * 70),
           vmax: 610 + Math.round(Math.random() * 110),
           dense: 0.9 + Math.random() * 0.85,
           slippery: Math.random() < 0.18 };
}
let SC = 1, GYs = 0, me = CHARS[0], stScale = 1, onEnd = null, CO = rollRun();
function sync(){ SC = H / 540; GYs = H * 0.80; }

const clamp = (v,a,b) => v<a?a : v>b?b : v;
const sx = wx => (wx - camX) * SC;
const sy = wy => GYs - (wy - camY) * SC;

/* ===============================================================
   맵 — 덩어리(chunk)를 정해진 순서로 이어 붙인 한 판짜리 코스
   =============================================================== */
let segs = [], ents = [], MAPEND = 0, GOALX = 0;

const seg   = (x,len,y=0) => segs.push({ x0:x, x1:x+len, y });
const ent   = (kind,x,y,o) => ents.push(Object.assign({ kind, x, y, gone:false, bx:x, by:y }, o));
const spike = (x,y=0)  => ent('spike', x, y,      { w:48, h:54 });
const bar   = (x,y=0)  => ent('bar',   x, y+56,   { w:58, h:4000 }); // 슬라이드로만 통과 (넘어갈 수 없음)
const jelly = (x,y)    => ent('jelly', x, y,      { w:30, h:30 });
const big   = (x,y)    => ent('big',   x, y,      { w:52, h:52 });
const jline = (x,y,n,gap=70) => { for(let i=0;i<n;i++) jelly(x+i*gap, y); };
/* 점프 궤적(최고 200, 거리 약 320)에 맞춘 포물선 */
const jarc  = (x,n,base=0,spread=320,peak=172) => {
  for(let i=0;i<n;i++){ const t = n===1?0.5:i/(n-1);
    jelly(x + t*spread, base + 28 + 4*peak*t*(1-t)); }
};

const CHUNK = {
  warm(x){   seg(x,1200);                       jline(x+480,56,5);                                      return 1200; },
  hop(x){    seg(x,1150);  spike(x+430);        jarc(x+340,7,0,320,172); jline(x+830,56,3);             return 1150; },
  duck(x){   seg(x,1150);  bar(x+450);          jline(x+370,30,6,58);    big(x+950,74);                 return 1150; },
  gap1(x){   seg(x,560);   seg(x+840,520);      jarc(x+560,6,0,300,172);                                return 1360; },
  twin(x){   seg(x,1250);  spike(x+400); spike(x+800);
             jarc(x+310,5,0,300,172); jarc(x+710,5,0,300,172);                                          return 1250; },
  rest(x){   seg(x,950);                        jline(x+320,56,6,70);    big(x+840,62);                 return 950;  },
  stair(x){  seg(x,600);   seg(x+700,460,150);  seg(x+1260,560);
             jarc(x+600,5,0,300,172); jline(x+740,212,5,62);                                            return 1820; },
  mix(x){    seg(x,1700);  spike(x+360); bar(x+940); spike(x+1440);
             jarc(x+270,5,0,300,172); jline(x+860,30,4,60);                                             return 1700; },
  gap2(x){   seg(x,540);   seg(x+820,340,80);  seg(x+1400,620);
             jarc(x+500,5,0,300,172); jline(x+860,140,3,70); jarc(x+1120,5,0,300,172);                  return 2020; },
  zig(x){    seg(x,1700);  spike(x+320); spike(x+720); spike(x+1120);
             jarc(x+240,4,0,300,172); jarc(x+640,4,0,300,172); jarc(x+1040,4,0,300,172); big(x+1500,66); return 1700; },
  shelf(x){  seg(x,1350);  seg(x+520,400,170);  jline(x+560,232,5,70);   bar(x+1120); jline(x+1040,30,4,58); return 1350; },
  rush(x){   seg(x,2150);  bar(x+340); spike(x+900); bar(x+1450); spike(x+1980);
             jline(x+270,30,5,55); jarc(x+810,5,0,300,172); jline(x+1380,30,5,55);                      return 2150; },
  finale(x){ seg(x,900);   seg(x+1200,400,150); seg(x+1800,760);
             spike(x+320); bar(x+680); jarc(x+960,6,0,360,172); jline(x+1240,212,4,70);
             jarc(x+1600,5,0,300,172); spike(x+2280); big(x+2420,78);                                   return 2560; },
  goal(x){   seg(x,1000);  jline(x+180,56,5,62); ent('goal', x+520, 0, { w:70, h:230 });                return 1000; }
};
const MIDDLE = ['hop','duck','gap1','twin','rest','stair','mix','gap2','zig','shelf','rush'];
/* 같은 맵을 매번 다르게 — 순서를 섞고 길이도 조금씩 달라진다 */
function rollMap(){
  const pool = MIDDLE.slice();
  for(let i = pool.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const n = 8 + Math.floor(Math.random() * 3);          // 8~10 덩어리
  const mid = pool.slice(0, n);
  /* 숨 돌릴 구간을 중간에 하나 끼워 넣는다 */
  mid.splice(Math.floor(mid.length / 2), 0, 'rest');
  return ['warm', ...mid, 'finale', 'goal'];
}
let MAP = rollMap();

function buildMap(){
  MAP = rollMap();
  segs = []; ents = [];
  let x = 0;
  for(const k of MAP) x += CHUNK[k](x);
  MAPEND = x;
  segs.sort((a,b) => a.y - b.y || a.x0 - b.x0);
  const merged = [];
  for(const sg of segs){
    const last = merged[merged.length-1];
    if(last && last.y === sg.y && Math.abs(last.x1 - sg.x0) < 1) last.x1 = sg.x1;
    else merged.push(sg);
  }
  segs = merged.sort((a,b) => a.x0 - b.x0);
  /* 코스가 어려우면 장애물을 더 깔아둔다 (최소 간격은 지킨다) */
  if(CO.dense > 1){
    const ob = () => ents.filter(e => e.kind==='spike' || e.kind==='bar').sort((a,b)=>a.x-b.x);
    const extra = Math.round((CO.dense - 1) * 14);
    for(let i=0;i<extra;i++){
      const sg = segs[Math.floor(Math.random()*segs.length)];
      if(sg.x1 - sg.x0 < 700) continue;
      const x = sg.x0 + 250 + Math.random()*(sg.x1 - sg.x0 - 500);
      if(x > MAPEND - 1400) continue;
      const list = ob();
      if(list.some(e => Math.abs(e.x - x) < 380)) continue;
      if(Math.random() < 0.55) spike(x, sg.y); else bar(x, sg.y);
      ents.sort((a,b)=>a.x-b.x);
    }
  }
  ents.sort((a,b) => a.x - b.x);
  const flag = ents.find(e => e.kind === 'goal');
  GOALX = flag ? flag.x : MAPEND - 400;
}

/* 어떤 x에서 발밑에 있을 수 있는 땅들 */
function segsAt(x){ return segs.filter(s => x >= s.x0 - 2 && x <= s.x1 + 2); }
function groundAt(x, y){            // y 이하(같거나 낮은) 발판 중 가장 높은 것
  let b = null;
  for(const s of segsAt(x)) if(s.y <= y + 0.5 && (!b || s.y > b.y)) b = s;
  return b;
}

/* ===============================================================
   소리 — Web Audio로 직접 연주
   =============================================================== */
let bgmOn = true, bgmT = 0, bgmStep = 0, bgmTimer = null;
function A(){
  initAudio();
  if(ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function tone(freq, dur, type, vol, slideTo, at){
  const c = A(); if(!c) return;
  const t = at || c.currentTime;
  const o = c.createOscillator(), gn = c.createGain();
  o.type = type || 'triangle';
  o.frequency.setValueAtTime(freq, t);
  if(slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t + dur);
  gn.gain.setValueAtTime(0.0001, t);
  gn.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.012);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(gn); gn.connect(sfxGain); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, vol, hp){
  const c = A(); if(!c) return;
  const n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
  for(let i=0;i<n;i++) d[i] = (Math.random()*2-1) * (1 - i/n);
  const s = c.createBufferSource(); s.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = hp || 900;
  const gn = c.createGain(); gn.gain.value = vol || 0.18;
  s.connect(f); f.connect(gn); gn.connect(sfxGain); s.start();
}
const SFX = {
  jump(){ tone(520, 0.16, 'triangle', 0.18, 880); },
  jump2(){ tone(700, 0.16, 'triangle', 0.16, 1100); },
  slide(){ noise(0.22, 0.12, 1400); },
  jelly(n){ tone(660 * Math.pow(1.06, Math.min(12, n||0)), 0.11, 'sine', 0.2, 990); },
  big(){ [0,0.07,0.14].forEach((d,i)=>tone([660,880,1320][i], 0.2, 'sine', 0.2, null, (A()?A().currentTime:0)+d)); },
  hit(){ noise(0.3, 0.3, 300); tone(180, 0.3, 'sawtooth', 0.2, 60); },
  skill(){ [0,0.06,0.12,0.18].forEach((d,i)=>tone([523,659,784,1047][i], 0.3, 'triangle', 0.18, null, (A()?A().currentTime:0)+d)); },
  goal(){ [0,0.12,0.24,0.36].forEach((d,i)=>tone([523,659,784,1047][i], 0.5, 'triangle', 0.22, null, (A()?A().currentTime:0)+d)); },
  over(){ [0,0.14,0.28].forEach((d,i)=>tone([440,349,262][i], 0.4, 'triangle', 0.2, null, (A()?A().currentTime:0)+d)); },
  click(){ tone(880, 0.06, 'square', 0.08, 660); }
};
/* 배경음 — 통통 튀는 4마디 루프 */
const BASS = [131,165,110,147], MEL = [0,4,7,12,7,4,7,9, 0,4,7,12,11,9,7,4, 0,3,7,10,7,3,7,5, 0,4,7,11,9,7,4,2];
function bgmTick(){
  const c = A(); if(!c || !bgmOn || state !== 'play') return;
  const step = 0.15;
  if(bgmT < c.currentTime) bgmT = c.currentTime + 0.05;
  while(bgmT < c.currentTime + 0.35){
    const i = bgmStep % 32, chord = Math.floor(i/8);
    if(i % 8 === 0) tone(BASS[chord], 0.28, 'sine', 0.1, null, bgmT);
    if(i % 2 === 0) tone(262 * Math.pow(2, MEL[i]/12), 0.13, 'triangle', 0.045, null, bgmT);
    bgmStep++; bgmT += step;
  }
}
function runBgmStart(){ if(!bgmTimer) bgmTimer = setInterval(bgmTick, 110); bgmStep = 0; bgmT = 0; }
function runBgmStop(){ if(bgmTimer){ clearInterval(bgmTimer); bgmTimer = null; } }

/* ===============================================================
   상태
   =============================================================== */
let state = 'title';                // title · play · pause · over
let camX = 0, camY = 0, speed = 0, dist = 0, score = 0, jellyN = 0, combo = 0, maxCombo = 0;
let energy = 0, skill = null, skillT = 0, shake = 0, tick = 0, cleared = false;
const fx = [];
const player = { x:0, y:0, vy:0, onGround:true, jumps:0, sliding:false, slideT:0, hp:3, inv:0, dead:false, coyote:0, buf:0 };

const HP_MAX = 3;
const GRAV = 2600, JUMP1 = 1020, JUMP2 = 940, V0 = 400, VMAX = 600, VACC = 7;
const PW = 44, PH = 74, PH_SLIDE = 38;

function reset(){
  buildMap();
  camX = 0; camY = 0; speed = CO.v0; dist = 0; score = 0; jellyN = 0; combo = 0; maxCombo = 0;
  energy = 0; skill = null; skillT = 0; shake = 0; tick = 0; cleared = false;
  speed = CO.v0;
  fx.length = 0;
  Object.assign(player, { x:120, y:0, vy:0, onGround:true, jumps:0, sliding:false, slideT:0,
                          hp: CO.hp, inv:0, dead:false, coyote:0, buf:0 });
}

/* ===== 입력 ===== */
const held = { jump:false, slide:false };
function doJump(){
  if(state !== 'play') return;
  const max = (skill === 'hop' ? 3 : 2);
  if(player.onGround || player.coyote > 0){
    player.vy = JUMP1; player.onGround = false; player.coyote = 0; player.jumps = 1;
    player.sliding = false; SFX.jump(); puff(player.x, player.y, 6);
  }else if(player.jumps < max){
    player.vy = JUMP2; player.jumps++; SFX.jump2(); ring(player.x, player.y + 36);
  }else{
    player.buf = 0.14;
  }
}
function setSlide(on){
  if(state !== 'play') return;
  held.slide = on;
  if(on && !player.onGround) player.vy = Math.min(player.vy, -900);   // 공중에서 누르면 쿵 내려찍기
  if(on && player.onGround && !player.sliding){ player.sliding = true; player.slideT = 0; SFX.slide(); }
}
function useSkill(){
  if(state !== 'play' || energy < 100) return;
  const id = skillIdOf(me); energy = 0; SFX.skill();
  skill = id; skillT = SKILLS[id].dur; toastFx(SKILLS[id].name);
  for(let i=0;i<18;i++) fx.push({ kind:'star', x:player.x, y:player.y+40,
    vx:(Math.random()-.5)*420, vy:Math.random()*420, life:0.7, t:0, c:skillOf(me).color });
}

/* ===== 효과 ===== */
function puff(x, y, n){ for(let i=0;i<n;i++) fx.push({ kind:'dust', x: x+(Math.random()-.5)*26, y:y+4, vx:(Math.random()-.5)*230-60,
  vy:Math.random()*55+10, life:0.4, t:0 }); }
function ring(x, y){ fx.push({ kind:'ring', x, y, life:0.42, t:0, c:'#FFF8F0' }); }
function pop(x, y, c){ for(let i=0;i<10;i++) fx.push({ kind:'star', x, y, c,
  vx:(Math.random()-.5)*300, vy:Math.random()*300+60, life:0.5, t:0 }); }
let toastT = 0, toastTx = '';
function toastFx(t){ toastTx = t; toastT = 1.2; }

/* ===============================================================
   진행
   =============================================================== */
function update(dt){
  tick += dt;
  if(toastT > 0) toastT -= dt;
  for(let i=fx.length-1;i>=0;i--){ const p = fx[i]; p.t += dt;
    if(p.t >= p.life){ fx.splice(i,1); continue; }
    if(p.kind !== 'ring'){ p.x += (p.vx||0)*dt; p.y += (p.vy||0)*dt; p.vy = (p.vy||0) - 700*dt; } }
  if(shake > 0) shake = Math.max(0, shake - dt*2.6);
  if(state !== 'play') return;

  /* 스킬 시간 */
  if(skillT > 0){ skillT -= dt; if(skillT <= 0){ skillT = 0; skill = null; } }
  energy = Math.min(100, energy + dt*4.5);

  /* 속도 */
  speed = Math.min(CO.vmax, speed + VACC*dt);
  let v = speed * (skill === 'slow' ? 0.72 : 1) * (skill === 'dash' ? 1.55 : 1);
  player.x += v*dt; dist += v*dt;
  score += v*dt*0.06;

  /* 슬라이드 */
  if(player.sliding){
    player.slideT += dt;
    if((!held.slide && !(CO.slippery && player.slideT < 0.55)) || player.slideT > 1.6 || !player.onGround) player.sliding = false;
    else if(Math.random() < dt*22) puff(player.x - 14, player.y, 1);
  }else if(held.slide && player.onGround) { player.sliding = true; player.slideT = 0; }

  /* 중력·점프 */
  const prevY = player.y, prevX = player.x - v*dt;
  let gr = GRAV;
  if(skill === 'glide' && player.vy < 0) gr = held.jump ? 520 : 900;
  player.vy -= gr*dt;
  if(skill === 'glide' && player.vy < -260) player.vy = -260;
  player.y += player.vy*dt;

  if(player.buf > 0){ player.buf -= dt; }
  if(player.onGround) player.coyote = 0.11; else player.coyote = Math.max(0, player.coyote - dt);

  /* 착지 판정 */
  let landed = false;
  if(player.vy <= 0){
    for(const s of segsAt(player.x)){
      if(prevY >= s.y - 1 && player.y <= s.y){
        player.y = s.y; player.vy = 0;
        if(!player.onGround){ puff(player.x, s.y, 5); }
        player.onGround = true; player.jumps = 0; landed = true;
        if(player.buf > 0){ player.buf = 0; doJump(); }
        break;
      }
    }
  }
  if(!landed){
    const under = groundAt(player.x, player.y);
    if(player.onGround && (!under || Math.abs(under.y - player.y) > 2)) player.onGround = false;
    else if(under && player.y < under.y && player.vy <= 0){ player.y = under.y; player.vy = 0; player.onGround = true; player.jumps = 0; }
  }

  /* 구덩이에 빠짐 */
  if(player.y < -300) fell();

  /* 부딪힘 · 젤리 — 한 프레임에 지나쳐버리지 않도록 이동 구간 전체를 본다 */
  const ph = player.sliding ? PH_SLIDE : PH;
  const px0 = Math.min(prevX, player.x) - PW/2, px1 = Math.max(prevX, player.x) + PW/2;
  const py0 = Math.min(prevY, player.y), py1 = Math.max(prevY, player.y) + ph;
  for(const e of ents){
    if(e.gone) continue;
    if(e.x < player.x - 500) continue;
    if(e.x > player.x + 900) break;

    if(e.kind === 'jelly' || e.kind === 'big'){
      if(skill === 'magnet'){
        const d = Math.hypot(e.x - player.x, e.y - (player.y+40));
        if(d < 300){ e.x += (player.x - e.x)*Math.min(1, dt*7); e.y += ((player.y+40) - e.y)*Math.min(1, dt*7); }
      }
      const r = e.kind === 'big' ? 52 : 40;
      if(Math.abs(e.x - player.x) < r && Math.abs(e.y - (player.y + ph*0.5)) < r + 14){
        e.gone = true; combo++; maxCombo = Math.max(maxCombo, combo);
        const mult = skill === 'slow' ? 2 : 1;
        if(e.kind === 'big'){ jellyN += 5; score += 250*mult; energy = Math.min(100, energy + 28); SFX.big(); pop(e.x, e.y, '#FFD36E'); }
        else { jellyN++; score += (10 + Math.min(20, combo))*mult; energy = Math.min(100, energy + 6); SFX.jelly(combo); pop(e.x, e.y, '#8FBF92'); }
      }
      continue;
    }
    if(e.kind === 'goal'){
      if(player.x >= e.x){ finish(true); }
      continue;
    }
    /* 장애물 */
    const ex0 = e.x - e.w/2, ex1 = e.x + e.w/2, ey0 = e.y, ey1 = e.y + e.h;
    if(px1 > ex0 && px0 < ex1 && py1 > ey0 && py0 < ey1){
      if(skill === 'dash'){ e.gone = true; score += 60; pop(e.x, e.y + e.h/2, '#EFA6B8'); SFX.hit(); shake = 0.5; }
      else if(player.inv > 0){ /* 무적 중 */ }
      else hurt(e);
    }
  }
  if(player.inv > 0) player.inv -= dt;

  /* 카메라 */
  const want = player.x - Math.max(170, (W/SC)*0.26);
  camX += (want - camX) * Math.min(1, dt*12);
  const wantY = clamp(player.y - 300, 0, 260);      // 높이 올라가면 화면도 같이 따라간다
  camY += (wantY - camY) * Math.min(1, dt*(wantY > camY ? 10 : 3.5));
}

const hits = [];
function hurt(e){
  hits.push({ x:Math.round(player.x), kind:e.kind, sliding:player.sliding, y:Math.round(player.y) });
  player.hp--; player.inv = 1.5; combo = 0; e.gone = true;
  SFX.hit(); shake = 1; pop(e.x, e.y + e.h/2, '#C9A9A9');
  speed = Math.max(V0, speed - 60);
  if(player.hp <= 0) finish(false);
}
function fell(){
  hits.push({ x:Math.round(player.x), kind:'구덩이', y:Math.round(player.y) });
  player.hp--; combo = 0; SFX.hit(); shake = 1;
  if(player.hp <= 0){ finish(false); return; }
  const next = segs.find(s => s.x1 > player.x + 40) || segs[segs.length-1];
  player.x = Math.max(player.x, next.x0 + 70); player.y = next.y + 120;
  player.vy = 0; player.inv = 1.8; player.onGround = false; player.jumps = 1;
  speed = Math.max(CO.v0*0.8, speed - 80);
  toastFx('앗!');
}

/* ===============================================================
   그리기
   =============================================================== */
function drawSky(){
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, CO.sky[0]); gr.addColorStop(0.62, CO.sky[1]); gr.addColorStop(1, '#FFF8F0');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);

  /* 구름 */
  g.fillStyle = 'rgba(255,255,255,.92)';
  const cw = 760, off = (camX*0.18) % cw;
  for(let i=-1;i<W/(cw*SC)+2;i++){
    const bx = i*cw*SC - off*SC;
    [[0,96,44],[190,132,32],[420,80,38]].forEach(([dx,dy,r],k)=>{
      const x = bx + dx*SC, y = H*0.10 + dy*SC*0.5 + camY*SC*0.25 + Math.sin(tick*0.4+k+i)*3;
      g.beginPath();
      g.arc(x, y, r*SC, 0, 7); g.arc(x+r*0.8*SC, y+6*SC, r*0.75*SC, 0, 7); g.arc(x-r*0.8*SC, y+7*SC, r*0.66*SC, 0, 7);
      g.fill();
    });
  }
  /* 먼 언덕 */
  const hillY = GYs + camY*SC*0.55, bushY = GYs + camY*SC*0.82;
  const hw = 620;
  g.fillStyle = CO.theme.hill;
  const ho = (camX*0.42) % hw;
  for(let i=-1;i<W/(hw*SC)+2;i++){
    const x = i*hw*SC - ho*SC;
    g.beginPath(); g.moveTo(x-40*SC, GYs);
    g.quadraticCurveTo(x+150*SC, GYs-210*SC, x+340*SC, GYs);
    g.quadraticCurveTo(x+460*SC, GYs-120*SC, x+660*SC, GYs);
    g.closePath(); g.fill();
  }
  /* 동네 집들 */
  const tw2 = 520, ho2 = (camX*0.58) % tw2;
  for(let i=-1;i<W/(tw2*SC)+2;i++){
    const x = i*tw2*SC - ho2*SC + 40*SC;
    const hh = (120 + ((i*37)%3)*34)*SC, wwid = 150*SC;
    const top = bushY - hh;
    g.fillStyle = (CO.theme.house || ['#F4E3C8','#EBD9F0','#DCEFF7'])[Math.abs(i)%3];
    g.beginPath(); g.rect(x, top, wwid, hh); g.fill();
    g.strokeStyle = 'rgba(120,95,75,.45)'; g.lineWidth = LW()*0.7; g.stroke();
    g.fillStyle = '#C9A06A';
    g.beginPath(); g.moveTo(x-12*SC, top); g.lineTo(x+wwid/2, top-34*SC);
    g.lineTo(x+wwid+12*SC, top); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#CDEBFA';
    g.fillRect(x+22*SC, top+26*SC, 34*SC, 30*SC); g.strokeRect(x+22*SC, top+26*SC, 34*SC, 30*SC);
    g.fillRect(x+92*SC, top+26*SC, 34*SC, 30*SC); g.strokeRect(x+92*SC, top+26*SC, 34*SC, 30*SC);
  }
  /* 가까운 덤불 */
  const bw = 380;
  g.fillStyle = CO.theme.bush;
  const bo = (camX*0.72) % bw;
  for(let i=-1;i<W/(bw*SC)+2;i++){
    const x = i*bw*SC - bo*SC;
    g.beginPath(); g.arc(x, bushY-6*SC, 56*SC, Math.PI, 0); g.arc(x+64*SC, bushY-6*SC, 40*SC, Math.PI, 0);
    g.rect(x-56*SC, bushY-8*SC, 164*SC, 12*SC); g.fill();
  }
}

function drawGround(){
  /* 땅 아래 — 구덩이가 깊어 보이도록 */
  const base = sy(0);
  if(base < H){
    const gr = g.createLinearGradient(0, base, 0, H);
    gr.addColorStop(0, CO.theme.dirt); gr.addColorStop(1, CO.dark ? '#6B6350' : '#F6F1E4');
    g.fillStyle = gr; g.fillRect(0, base, W, H - base);
  }
  for(const s of segs){
    const x0 = sx(s.x0), x1 = sx(s.x1);
    if(x1 < -40 || x0 > W + 40) continue;
    const y = sy(s.y), h = H - y + 40;
    /* 흙 */
    g.fillStyle = CO.theme.dirt;
    g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.lineTo(x1, y+h); g.lineTo(x0, y+h); g.closePath(); g.fill();
    /* 풀 */
    g.fillStyle = CO.theme.grass;
    g.fillRect(x0, y, x1-x0, 13*SC);
    g.strokeStyle = '#5A4A40'; g.lineWidth = LW(); g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(x0, y+h); g.lineTo(x0, y);
    const stepPx = 26*SC;
    for(let x = x0; x < x1; x += stepPx) g.lineTo(Math.min(x1, x+stepPx), y + Math.sin((x/SC + s.x0)*0.05)*2.2*SC);
    g.lineTo(x1, y+h);
    g.stroke();
    /* 흙 점 */
    g.fillStyle = 'rgba(160,130,90,.32)';
    for(let x = Math.max(x0, -20); x < Math.min(x1, W+20); x += 60*SC){
      const k = Math.abs(Math.sin((x/SC+s.x0)*0.13));
      g.beginPath(); g.arc(x + 20*SC, y + (26 + k*40)*SC, 4.5*SC, 0, 7); g.fill();
    }
  }
}

/* 동전 — 배달하며 줍는 것 */
function coin(cx, cy, r, big){
  g.save(); g.translate(cx, cy);
  if(CO && CO.dark){ g.shadowColor = 'rgba(255,224,138,.9)'; g.shadowBlur = r * 1.6; }
  g.strokeStyle = '#5A4A40'; g.lineWidth = Math.min(r*0.34, LW()); g.lineJoin = 'round';
  g.fillStyle = big ? '#FFCB4F' : '#FFDD73';
  g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill(); g.stroke();
  g.shadowBlur = 0;
  g.fillStyle = big ? '#FFF0BE' : '#FFF6DA';
  g.beginPath(); g.arc(0, 0, r*0.68, 0, 7); g.fill(); g.stroke();
  g.fillStyle = '#8FBF92';
  for(let i=0;i<4;i++){
    g.save(); g.rotate(i*Math.PI/2 + Math.PI/4);
    g.beginPath(); g.arc(0, -r*0.26, r*0.2, 0, 7); g.fill();
    g.restore();
  }
  g.restore();
}

/* 네잎클로버 — 체력 아이콘으로 씀 */
function clover(cx, cy, r, fill, line){
  g.save();
  g.translate(cx, cy);
  g.strokeStyle = line || '#5A4A40'; g.lineWidth = Math.max(1.4, r*0.16); g.lineJoin = 'round';
  g.fillStyle = fill || '#8FBF92';
  for(let i=0;i<4;i++){
    g.save(); g.rotate(i*Math.PI/2 + Math.PI/4);
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(-r*0.85, -r*0.30, -r*0.62, -r*1.06, 0, -r*0.72);
    g.bezierCurveTo( r*0.62, -r*1.06,  r*0.85, -r*0.30, 0, 0);
    g.closePath(); g.fill(); g.stroke();
    g.restore();
  }
  g.beginPath(); g.moveTo(0, r*0.1); g.quadraticCurveTo(r*0.22, r*0.7, r*0.05, r*1.05);
  g.stroke();
  g.restore();
}

function drawEnt(e){
  const x = sx(e.x), yb = sy(e.y);
  if(x < -120 || x > W + 120) return;
  g.save();
  g.strokeStyle = '#5A4A40'; g.lineWidth = LW(); g.lineJoin = 'round';

  if(e.kind === 'spike'){                       // 가시 통나무
    const w = e.w*SC, h = e.h*SC;
    g.fillStyle = '#C89B6A';
    g.beginPath(); g.roundRect(x-w/2, yb-h, w, h, 9*SC); g.fill(); g.stroke();
    g.fillStyle = '#8B6242';
    for(let i=0;i<3;i++){
      const px = x - w/2 + w*(i+0.5)/3;
      g.beginPath(); g.moveTo(px-7*SC, yb-h); g.lineTo(px, yb-h-16*SC); g.lineTo(px+7*SC, yb-h);
      g.closePath(); g.fill(); g.stroke();
    }
    g.fillStyle = '#5A4A40';
    g.beginPath(); g.arc(x-8*SC, yb-h*0.5, 2.6*SC, 0, 7); g.arc(x+8*SC, yb-h*0.5, 2.6*SC, 0, 7); g.fill();
    g.beginPath(); g.arc(x, yb-h*0.26, 5.5*SC, Math.PI+0.2, -0.2); g.stroke();
  }
  else if(e.kind === 'bar'){                    // 위에서 내려온 덩굴 — 슬라이드로만 통과
    const w = 56*SC, y1 = sy(e.y), top = Math.min(sy(e.y + e.h), -20);
    g.fillStyle = '#A9805A';
    g.beginPath(); g.roundRect(x - w/2, top, w, y1 - top, [0, 0, w/2, w/2]); g.fill(); g.stroke();
    /* 잎 — 아래쪽부터 위로 번갈아 */
    g.fillStyle = '#8FBF92';
    for(let i=0;i<5;i++){
      const ly = y1 - (28 + i*52)*SC, sd = i%2 ? 1 : -1;
      if(ly < top) break;
      g.beginPath(); g.ellipse(x + sd*w*0.62, ly, 24*SC, 12*SC, sd*0.45, 0, 7); g.fill(); g.stroke();
    }
    /* 표정 */
    g.fillStyle = '#5A4A40';
    g.beginPath(); g.arc(x - 9*SC, y1 - 30*SC, 2.8*SC, 0, 7); g.arc(x + 9*SC, y1 - 30*SC, 2.8*SC, 0, 7); g.fill();
    g.beginPath(); g.arc(x, y1 - 24*SC, 5*SC, 0.2, Math.PI - 0.2); g.stroke();
    /* 지나갈 틈 표시 */
    g.save(); g.setLineDash([6*SC, 6*SC]); g.strokeStyle = 'rgba(120,95,75,.35)'; g.lineWidth = LW();
    g.beginPath(); g.moveTo(x - w*0.9, y1 + 2*SC); g.lineTo(x + w*0.9, y1 + 2*SC); g.stroke(); g.restore();
  }
  else if(e.kind === 'jelly' || e.kind === 'big'){
    const r = (e.kind === 'big' ? 27 : 16) * SC, bob = Math.sin(tick*3 + e.bx*0.02)*3*SC;
    const cy = yb + bob, spin = Math.abs(Math.cos(tick*2.2 + e.bx*0.01));
    g.fillStyle = e.kind === 'big' ? 'rgba(255,211,110,.45)' : 'rgba(255,224,138,.3)';
    g.beginPath(); g.arc(x, cy, r*(e.kind === 'big' ? 1.6 : 1.3), 0, 7); g.fill();
    g.save(); g.translate(x, cy); g.scale(0.35 + 0.65*spin, 1);
    coin(0, 0, r, e.kind === 'big'); g.restore();
  }
  else if(e.kind === 'goal'){
    const s2 = 120*SC, bx = x - s2*0.5, by = yb - s2;
    g.fillStyle = '#FFF3D6';                                  // 배달할 집
    g.beginPath(); g.rect(bx, by, s2, s2); g.fill(); g.stroke();
    g.fillStyle = '#D98E6A';
    g.beginPath(); g.moveTo(bx - s2*0.14, by); g.lineTo(x, by - s2*0.42);
    g.lineTo(bx + s2*1.14, by); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#C87A58';
    g.beginPath(); g.rect(x - s2*0.16, yb - s2*0.55, s2*0.32, s2*0.55); g.fill(); g.stroke();
    g.fillStyle = '#CDEBFA';
    g.beginPath(); g.rect(bx + s2*0.12, by + s2*0.16, s2*0.22, s2*0.22); g.fill(); g.stroke();
    g.beginPath(); g.rect(bx + s2*0.66, by + s2*0.16, s2*0.22, s2*0.22); g.fill(); g.stroke();
    g.fillStyle = '#5A4A40'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `700 ${20*SC}px Gaegu, sans-serif`;
    g.fillText('배달 도착', x, by - s2*0.58);
  }
  g.restore();
}

function drawPlayer(){
  const ph = player.sliding ? PH_SLIDE : PH;
  const x = sx(player.x), yb = sy(player.y);
  const air = !player.onGround;
  const im = IMG[me.run];                       // 입은 모습 그대로
  const baseH = 104 * (me.scale || 1) * stScale * SC;
  const bob = air ? 0 : Math.abs(Math.sin(tick * (8 + speed/90))) * 7 * SC;
  let rot = 0, sqx = 1, sqy = 1;

  if(player.sliding){ sqx = 1.28; sqy = 0.56; rot = 0.06; }        // 납작하게
  else if(air){
    if(player.vy > 0){ sqx = 0.90; sqy = 1.16; rot = -0.05; }      // 솟을 땐 길쭉
    else { sqx = 1.06; sqy = 0.94; rot = 0.04; }                   // 내려올 땐 살짝 납작
  }else{
    rot = Math.sin(tick*(8 + speed/90)) * 0.06;
    const k2 = Math.abs(Math.sin(tick*(8 + speed/90)));
    sqx = 1 + k2*0.03; sqy = 1 - k2*0.03;
  }

  g.save();
  const baseAlpha = (player.inv > 0 && Math.floor(player.inv*14) % 2 === 0) ? 0.35 : 1;
  g.globalAlpha = baseAlpha;

  if(skill === 'dash'){
    g.globalAlpha = baseAlpha * 0.35;
    for(let i=1;i<=3;i++){
      g.save(); g.translate(x - i*26*SC, yb - bob - (me.float||0)*SC*0.4);
      g.rotate(rot); g.scale((me.flip === false ? 1 : -1)*sqx, sqy);
      if(im && im.complete) g.drawImage(im, -baseH*0.5, -baseH, baseH, baseH);
      g.restore();
    }
    g.globalAlpha = baseAlpha;
  }

  g.translate(x, yb - bob - (me.float || 0) * SC * 0.4);
  g.rotate(rot); g.scale((me.flip === false ? 1 : -1) * sqx, sqy);
  /* 등에 멘 배달 가방 (몸 뒤쪽) */
  g.fillStyle = '#D98E6A'; g.strokeStyle = '#5A4A40'; g.lineWidth = LW();
  const bw2 = baseH*0.36;
  g.beginPath(); g.rect(baseH*0.30, -baseH*0.86, bw2, bw2*0.9); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(baseH*0.30, -baseH*0.86+bw2*0.34);
  g.lineTo(baseH*0.30+bw2, -baseH*0.86+bw2*0.34); g.stroke();
  if(im && im.complete && im.naturalWidth) g.drawImage(im, -baseH*0.5, -baseH, baseH, baseH);
  else { g.fillStyle = '#F3EAE1'; g.strokeStyle = '#5A4A40'; g.lineWidth = LW();
         g.beginPath(); g.ellipse(0, -baseH*0.4, baseH*0.3, baseH*0.36, 0, 0, 7); g.fill(); g.stroke(); }
  g.restore();

  /* 스킬 남은 시간 */
  if(skillT > 0){
    const sk = SKILLS[skill];
    g.save(); g.strokeStyle = sk.color; g.lineWidth = LW(); g.lineCap = 'round';
    g.beginPath(); g.arc(x, yb - ph*SC*0.5, PW*1.15*SC, -Math.PI/2, -Math.PI/2 + 6.283*(skillT/sk.dur));
    g.stroke(); g.restore();
  }
}
function drawFx(){
  for(const p of fx){
    const k = 1 - p.t/p.life, x = sx(p.x), y = sy(p.y);
    g.save(); g.globalAlpha = Math.max(0, k);
    if(p.kind === 'dust'){ g.fillStyle = '#D9C4A0'; g.beginPath(); g.arc(x, y, 7*SC*k, 0, 7); g.fill(); }
    else if(p.kind === 'ring'){ g.strokeStyle = p.c; g.lineWidth = LW();
      g.beginPath(); g.arc(x, y, (10 + 46*(1-k))*SC, 0, 7); g.stroke(); }
    else { g.fillStyle = p.c || '#FFD36E'; g.strokeStyle = '#5A4A40'; g.lineWidth = LW();
      g.beginPath(); g.arc(x, y, 6*SC*k + 2, 0, 7); g.fill(); g.stroke(); }
    g.restore();
  }
}

function drawHud(){
  const k = Math.max(0.85, Math.min(1.6, Math.min(W/960, H/540)));
  const TXT = CO.dark ? '#FFF6E2' : '#5A4A40';      /* 밤에는 글씨를 밝게 */
  g.save(); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  /* 점수 */
  g.fillStyle = TXT;
  g.font = `700 ${34*k}px Gaegu, sans-serif`;
  g.fillText(Math.floor(score).toLocaleString(), 16*k, 40*k);
  /* 동전 */
  coin(26*k, 58*k, 11*k, false);
  g.fillStyle = TXT; g.font = `700 ${20*k}px Gaegu, sans-serif`;
  g.fillText('× ' + jellyN + (combo > 2 ? '   ' + combo + ' 연속!' : ''), 41*k, 65*k);
  /* 체력 */
  for(let i=0;i<Math.max(CO.hp, player.hp);i++){
    g.globalAlpha = i < player.hp ? 1 : 0.2;
    clover(26*k + i*26*k, 92*k, 11*k, i < player.hp ? '#EFA6B8' : '#FFF8F0');
  }
  g.globalAlpha = 1;
  /* 스킬 게이지 */
  const gw = 150*k, gx = 16*k, gy = 112*k, sk = skillOf(me);
  g.fillStyle = '#FFF8F0'; g.strokeStyle = '#5A4A40'; g.lineWidth = LW();
  g.beginPath(); g.roundRect(gx, gy, gw, 16*k, 8*k); g.fill(); g.stroke();
  g.fillStyle = energy >= 100 ? sk.color : '#CFE0CB';
  g.beginPath(); g.roundRect(gx+2.5*k, gy+2.5*k, (gw-5*k)*(energy/100), 11*k, 6*k); g.fill();
  g.fillStyle = TXT; g.font = `700 ${14*k}px Gaegu, sans-serif`;
  g.fillText(energy >= 100 ? (sk.name + '  [E]') : sk.name, gx, gy + 32*k);
  if(energy >= 100){
    g.globalAlpha = 0.5 + Math.sin(tick*6)*0.4; g.strokeStyle = sk.color; g.lineWidth = LW();
    g.beginPath(); g.roundRect(gx-3*k, gy-3*k, gw+6*k, 22*k, 11*k); g.stroke(); g.globalAlpha = 1;
  }
  /* 진행 막대 */
  const pw = Math.min(360*k, Math.max(120*k, W*0.34)), px = (W - pw)/2, py = (W < 620 ? 52*k : 22*k);
  g.fillStyle = '#FFF8F0'; g.strokeStyle = '#5A4A40'; g.lineWidth = LW();
  g.beginPath(); g.roundRect(px, py, pw, 12*k, 6*k); g.fill(); g.stroke();
  const pr = clamp(player.x / GOALX, 0, 1);
  g.fillStyle = '#EFA6B8';
  g.beginPath(); g.roundRect(px+2*k, py+2*k, Math.max(0,(pw-4*k)*pr), 8*k, 4*k); g.fill();
  const hi = IMG[me.run];
  if(hi && hi.complete && hi.naturalWidth) g.drawImage(hi, px + (pw-4*k)*pr - 14*k, py - 22*k, 30*k, 30*k);
  g.fillStyle = '#8A7264'; g.font = `${12*k}px Gowun Dodum, sans-serif`; g.textAlign = 'center';
  g.fillText(Math.floor(dist/10) + ' m', px + pw/2, py + 30*k);

  /* 알림 */
  if(toastT > 0){
    g.globalAlpha = Math.min(1, toastT*2.2);
    g.textAlign = 'center'; g.fillStyle = '#5A4A40';
    g.font = `700 ${34*k}px Gaegu, sans-serif`;
    g.fillText(toastTx, W/2, H*0.34);
    g.globalAlpha = 1;
  }
  g.restore();
}

function draw(){
  g.clearRect(0, 0, W, H);
  g.save();
  if(shake > 0) g.translate((Math.random()-.5)*10*shake*SC, (Math.random()-.5)*10*shake*SC);
  drawSky();
  drawGround();
  for(const e of ents){ if(!e.gone) drawEnt(e); }
  drawPlayer();
  drawFx();
  g.restore();
  if(CO.dark){                                   // 야간 — 두기 주변만 밝게
    const px = sx(player.x), py = sy(player.y + 40);
    const gr2 = g.createRadialGradient(px, py, H*0.10, px, py, H*0.62);
    gr2.addColorStop(0, 'rgba(20,22,40,0)'); gr2.addColorStop(1, 'rgba(20,22,40,.62)');
    g.fillStyle = gr2; g.fillRect(0, 0, W, H);
  }
  if(state === 'play' || state === 'pause') drawHud();
}

/* ===== 바깥에서 쓰는 창구 ===== */
function start(o){
  me = o.look || CHARS[0];
  stScale = 1;
  CO = rollRun();
  onEnd = o.onEnd;
  sync(); reset(); hits.length = 0; state = 'play';
  held.jump = held.slide = false;
  runBgmStart();
}
function finish(ok){
  if(state === 'over') return;
  state = 'over'; runBgmStop();
  ok ? SFX.goal() : SFX.over();
  const total = ents.filter(e => e.kind === 'jelly' || e.kind === 'big').length;
  if(ok) score += 500 + player.hp * 300;
  if(onEnd) onEnd({ score: Math.round(score), jelly: jellyN, dist, cleared: ok,
                    hp: player.hp, combo: maxCombo, total });
}
function frame(dt, active){
  sync();
  if(active) update(dt);
  draw();
}
function key(code, down){
  if(down){
    if(code === 'Space' || code === 'ArrowUp' || code === 'KeyW'){ held.jump = true; doJump(); }
    else if(code === 'ArrowDown' || code === 'KeyS') setSlide(true);
    else if(code === 'KeyE' || code === 'ShiftLeft') useSkill();
  }else{
    if(code === 'Space' || code === 'ArrowUp' || code === 'KeyW') held.jump = false;
    if(code === 'ArrowDown' || code === 'KeyS') setSlide(false);
  }
}
function pad(k, down){
  if(k === 'jump'){ held.jump = down; if(down) doJump(); }
  else if(k === 'slide') setSlide(down);
  else if(k === 'skill' && down) useSkill();
}
function pointer(yFrac, down){
  if(!down){ setSlide(false); return; }
  if(yFrac < 0.6) doJump(); else setSlide(true);
}
function quit(){ state = 'over'; runBgmStop(); goHome(); }
return { start, frame, key, pad, pointer, quit, resize: sync,
         state: () => state, peek: () => ({ state, player, ents, segs, speed, energy, skill, hits,
           theme: CO.theme.id, mapend: MAPEND, chunks: MAP.length,
                                            score, jellyN, dist, maxCombo, MAPEND, GOALX }),
         debug: { doJump, setSlide, useSkill } };
})();
