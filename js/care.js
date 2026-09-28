"use strict";
/* 두기 — 행동과 돌봄 — 꺅두기 하우스 */

/* ===============================================================
   두기 — 행동 · 돌봄 조작 · 그리기
   =============================================================== */
const home = {
  x: 0.5, y: 0.75, vx: 0, vy: 0, face: 1, t: 0,
  near: null, target: null, autoAct: null,
  act: null,                 // 진행 중인 동작 {kind, t, ...}
  bubble: '', bubbleT: 0, say: '', sayT: 0,
  parts: [], dusts: [],
  ball: { x: 0.5, y: 0.6, vx: 0, vy: 0, fly: false, home: true },
  idle: 0, idleGoal: null, pet: { n: 0, dist: 0, t: 0 },
  drag: null, aim: null, sweep: false, hover: null
};
const keys = {};
let deco = false;                          // 꾸미기 모드
let mini = null;                           // 오버레이 미니게임 {kind,...}

/* ===== 먼지 ===== */
function seedDust(){
  home.dusts = [];
  const n = S.dugi.clean < 25 ? 5 : S.dugi.clean < 45 ? 4 : S.dugi.clean < 65 ? 2 : 0;
  for(let i = 0; i < n; i++)
    home.dusts.push({ x: 0.1 + ((i * 0.27 + 0.13) % 0.8), y: 0.3 + ((i * 0.37) % 0.6),
                      seed: Math.random() * 6, r: 1 });
}
seedDust();

/* ===== 다가갈 수 있는 것 ===== */
function homeSpots(){
  if(place === 'yard') return YARD.map(o => ({ ...o }));
  const list = [];
  for(const o of LAY.floor){
    const f = FURN(o.id);
    if(f && f.act) list.push({ id:o.id, name:f.name, x:o.x, y:o.y, act:f.act });
    const p = PLACES.find(q => q.id === o.id);
    if(p && p.act) list.push({ id:o.id, name:p.name, x:o.x, y:o.y, act:p.act });
  }
  list.push({ id:'door', name:'현관', x:LAY.door.x, y:0.02, act:'out' });
  return list;
}
const furnPos = id => { const o = spotOf(id); return o ? { x:o.x, y:o.y } : { x:0.5, y:0.5 }; };

/* ===============================================================
   돌봄
   =============================================================== */
function careGain(kind, mult){
  const c = CARE[kind]; mult = mult || 1;
  const add = { feed:{ full:24 }, wash:{ clean:30 }, play:{ fun:22, energy:-8 },
                sleep:{ energy:34, fun:3 }, water:{ fun:12 }, clean:{ clean:14, fun:3 } }[kind] || {};
  for(const k in add){
    let v = add[k] * (v0 => v0)(1);
    if(kind === 'feed'  && k === 'full')   v += boost('full');
    if(kind === 'sleep' && k === 'energy') v += boost('energy');
    if(kind === 'wash'  && k === 'clean')  v += boost('clean');
    if((kind === 'play' || kind === 'water') && k === 'fun') v += boost('fun');
    addStat(k, v * (k === 'energy' && v < 0 ? 1 : mult));
  }
  addLove((CARE[kind].love || 3) * mult);
  clearRequest(kind);
  bumpDaily('care:' + kind, 1);
  home.bubble = CARE[kind].verb; home.bubbleT = 1.8;
  save(); refreshBar(); paintCareBar();
}
function canCare(kind){
  const d = S.dugi;
  if(kind === 'feed'  && d.full   >= 98) return { no:'배가 아주 불러요' };
  if(kind === 'sleep' && d.energy >= 98) return { no:'지금은 안 졸려요' };
  if(kind === 'wash'  && d.clean  >= 98) return { no:'이미 뽀송뽀송해요' };
  if(kind === 'clean' && !home.dusts.length) return { no:'방이 깨끗해요' };
  if(kind === 'play'  && d.energy <= 8)  return { no:'기운이 없어요. 재워주세요' };
  return true;
}
/* 버튼이나 가구에서 시작 */
function doCare(kind){
  if(deco) return false;
  if(place !== 'room'){ toast('집 안에서만 할 수 있어요', ''); sfxNo(); return false; }
  const ok = canCare(kind);
  if(ok !== true){ toast(ok.no, ''); sfxNo(); return false; }
  if(kind === 'feed' || kind === 'wash'){ openMini(kind); return true; }
  if(kind === 'clean'){ home.sweep = true; toast('먼지를 문질러 치워요', ''); return true; }
  if(kind === 'play'){ armBall(); return true; }
  if(kind === 'sleep'){ goAct('bed', 'sleep'); return true; }
  if(kind === 'water'){ goAct('plant', 'water'); return true; }
  return false;
}
/* 가구까지 걸어가서 하는 동작 */
function goAct(furnId, kind){
  const p = furnPos(furnId);
  home.target = { x: p.x + (kind === 'sleep' ? 0.0 : 0.045), y: Math.min(0.95, p.y + 0.16) };
  home.autoAct = { act:'__do', kind };
}
function beginAct(kind){
  home.act = { kind, t: 0 };
  if(kind === 'sleep') sfxCare('sleep');
  if(kind === 'water') sfxCare('water');
}
function finishAct(kind){
  if(kind === 'sleep'){ careGain('sleep'); puffs('z', 10); }
  if(kind === 'water'){
    const st = (S.dugi.plant || 0) + 1;
    if(st > 4){ S.dugi.plant = 0; addClover(120); addLove(8);
                toast('꽃이 피었어요!', '클로버 +120'); sfxCoin(5); }
    else S.dugi.plant = st;
    careGain('water'); puffs('drop', 12);
  }
}
function puffs(shape, n){
  const cx = rx(home.x), cy = yAt(home.y);
  const col = { z:'#AD9ED4', drop:'#8FC0D8', heart:'#EFA6B8', dot:'#E0A45C', bub:'#8FC0D8' }[shape];
  for(let i = 0; i < n; i++)
    home.parts.push({ x: cx + (Math.random() - 0.5) * 70, y: cy - 40 - Math.random() * 40,
                      vx: (Math.random() - 0.5) * 60, vy: -30 - Math.random() * 70,
                      life: 1 + Math.random() * 0.6, t: 0, c: col, s: shape });
}

/* ===== 공놀이 ===== */
function armBall(){
  const p = furnPos('ball');
  home.ball.home = false; home.ball.fly = false;
  home.ball.x = p.x; home.ball.y = Math.min(0.9, p.y + 0.12);
  home.ball.vx = home.ball.vy = 0;
  toast('공을 끌었다 놓으면 던져요', '두기가 물어와요');
}
function throwBall(vx, vy){
  home.ball.fly = true; home.ball.vx = vx; home.ball.vy = vy;
  sfxCare('play');
}
function updateBall(dt){
  const b = home.ball;
  if(b.home || !b.fly) return;
  b.x += b.vx * dt; b.y += b.vy * dt;
  b.vx *= 0.955; b.vy = b.vy * 0.955 + 0.25 * dt;
  if(b.x < 0.04){ b.x = 0.04; b.vx *= -0.5; }
  if(b.x > 0.96){ b.x = 0.96; b.vx *= -0.5; }
  if(b.y < 0.06){ b.y = 0.06; b.vy *= -0.5; }
  if(b.y > 0.96){ b.y = 0.96; b.vy *= -0.5; }
  if(Math.abs(b.vx) + Math.abs(b.vy) < 0.08){
    b.fly = false;
    home.target = { x: b.x, y: b.y };          // 두기가 물어오러 간다
    home.autoAct = { act:'__fetch' };
  }
}
function fetchBall(){
  const d = Math.hypot(home.ball.x - home.x, home.ball.y - home.y);
  home.ball.home = true;
  const far = Math.min(1.6, 0.8 + d * 2);
  careGain('play', far);
  home.bubble = '꺅! 재밌다'; home.bubbleT = 1.8;
  for(let i = 0; i < 8; i++) puffs('heart', 1);
}

/* ===============================================================
   오버레이 미니 — 밥 주기 · 씻기기
   =============================================================== */
function openMini(kind){
  if(kind === 'feed'){
    const pool = FOODS.slice().sort(() => Math.random() - 0.5).slice(0, 4);
    if(S.bag.snack) pool.push({ id:'snack', name:'간식', color:'#F6C88B', full:18, item:true });
    mini = { kind:'feed', t:0, foods:pool, picked:null, chew:0 };
  }else{
    const spots = [];
    const n = 7;
    for(let i = 0; i < n; i++)
      spots.push({ x:(Math.random() - 0.5) * 0.52, y:0.22 + Math.random() * 0.52,
                   r:0.055 + Math.random() * 0.045, hp:2, seed:Math.random() * 6 });
    mini = { kind:'wash', t:0, spots, total:n, bubbles:[], soap:!!S.bag.soap };
  }
  $('careBar').hidden = true;
}
function closeMini(done){
  if(mini && mini.kind === 'wash'){
    const left = mini.spots.filter(s => s.hp > 0).length;
    const ratio = 1 - left / mini.total;
    if(ratio > 0.1){
      careGain('wash', 0.4 + ratio * 0.6);
      if(ratio >= 0.999){ addLove(4); toast('반짝반짝!', '완벽하게 씻었어요'); }
      if(mini.soap){ S.bag.soap--; if(!S.bag.soap) delete S.bag.soap; }
    }
  }
  mini = null;
  $('careBar').hidden = !(mode === 'home' && place === 'room');
  save(); refreshBar(); paintCareBar();
}
function feedPick(f){
  if(!mini || mini.picked) return;
  mini.picked = f; mini.t = 0;
  const fav = f.id === S.dugi.fav;
  const mul = fav ? 2 : 1;
  addStat('full', (f.full || 20) + boost('full'));
  addStat('fun', fav ? 10 : 4);
  addLove((CARE.feed.love || 6) * mul);
  clearRequest('feed'); bumpDaily('care:feed', 1);
  if(f.item){ S.bag.snack--; if(!S.bag.snack) delete S.bag.snack; }
  if(fav){ toast('제일 좋아하는 ' + f.name + '!', '마음 두 배'); }
  else if(!S.favFound && Math.random() < 0.5) home.say = '음… 그냥 그래', home.sayT = 1.6;
  sfxCare('feed');
  save(); refreshBar();
}
function updateMini(dt){
  if(!mini) return;
  mini.t += dt;
  if(mini.kind === 'feed'){
    if(mini.picked && mini.t > 1.5) closeMini(true);
    return;
  }
  if(mini.kind === 'wash'){
    for(let i = mini.bubbles.length - 1; i >= 0; i--){
      const b = mini.bubbles[i]; b.t += dt; b.y -= b.v * dt;
      if(b.t > b.life) mini.bubbles.splice(i, 1);
    }
    if(!mini.spots.some(s => s.hp > 0)) closeMini(true);
  }
}
/* 미니 안에서 문지르기 */
function miniScrub(px, py, moved){
  if(!mini || mini.kind !== 'wash') return;
  const cx = W * 0.5, cy = H * 0.56, sz = Math.min(W * 0.42, H * 0.6);
  mini.spots.forEach(s => {
    if(s.hp <= 0) return;
    const sxp = cx + s.x * sz, syp = cy - sz * 0.5 + s.y * sz;
    if(Math.hypot(px - sxp, py - syp) < sz * (s.r + 0.05)){
      s.hp -= (mini.soap ? 2 : 1) * (moved ? 1 : 0.2);
      if(s.hp <= 0){
        sfxCare('wash');
        for(let i = 0; i < 6; i++) mini.bubbles.push({ x:sxp + (Math.random() - .5) * 30,
          y:syp, v:40 + Math.random() * 50, r:5 + Math.random() * 9, t:0, life:1 });
      }
    }
  });
}

/* ===============================================================
   진행
   =============================================================== */
function updateHome(dt){
  home.t += dt;
  if(home.bubbleT > 0) home.bubbleT -= dt;
  if(home.sayT > 0) home.sayT -= dt;
  if(leveledUp > 0) leveledUp -= dt;
  if(home.pet.t > 0) home.pet.t -= dt;
  updateBall(dt);
  if(mini){ updateMini(dt); return; }

  /* 진행 중인 동작 */
  if(home.act){
    home.act.t += dt;
    const dur = home.act.kind === 'sleep' ? 2.8 : 1.6;
    if(home.act.t > dur){ finishAct(home.act.kind); home.act = null; }
  }else if(!deco){
    let ax = 0, ay = 0;
    if(keys.a) ax -= 1; if(keys.d) ax += 1;
    if(keys.w) ay -= 1; if(keys.s) ay += 1;
    if(ax || ay){ home.target = null; home.idle = 0; home.idleGoal = null; }
    if(home.target){
      const dx = home.target.x - home.x, dy = home.target.y - home.y;
      if(Math.hypot(dx * 1.7, dy) < 0.03){
        home.target = null;
        const a = home.autoAct; home.autoAct = null;
        if(a){
          if(a.act === '__do') beginAct(a.kind);
          else if(a.act === '__fetch') fetchBall();
          else act(a);
        }
      }else{ ax = Math.sign(dx) * Math.min(1, Math.abs(dx) * 12);
             ay = Math.sign(dy) * Math.min(1, Math.abs(dy) * 7); }
    }
    /* 혼자 놀기 */
    if(!home.target && !ax && !ay){
      home.idle += dt;
      if(home.idle > 5 && !home.idleGoal) pickIdle();
    }
    const sp = 0.78;
    home.vx += (ax * sp - home.vx) * Math.min(1, dt * 13);
    home.vy += (ay * sp * 0.85 - home.vy) * Math.min(1, dt * 13);
    home.x = Math.max(0.03, Math.min(0.97, home.x + home.vx * dt));
    home.y = Math.max(0.02, Math.min(0.98, home.y + home.vy * dt));
    if(Math.abs(home.vx) > 0.02) home.face = home.vx > 0 ? 1 : -1;
  }

  /* 가까운 것 — 문 앞에 서면 문이 먼저 */
  let near = null, bd = (place === 'yard' ? 0.17 : 0.075);
  for(const s of homeSpots()){
    const d = Math.hypot((s.x - home.x) * 1.4, ((s.y || 0) - home.y) * 0.8);
    if(d < bd){ bd = d; near = s; }
  }
  if(place === 'room' && home.y < 0.12 && Math.abs(home.x - LAY.door.x) < 0.10)
    near = { id:'door', name:'현관', x:LAY.door.x, y:0.02, act:'out' };
  home.near = near;

  for(let i = home.parts.length - 1; i >= 0; i--){
    const p = home.parts[i]; p.t += dt;
    if(p.t >= p.life){ home.parts.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 26 * dt;
  }
}

/* 혼자 하는 행동 */
const YARD_SAY = ['바깥 공기 좋다', '가게 구경할까?', '뽑기 한 번…', '오늘도 알바?', '꺅!'];
const IDLE_SAY = ['심심해~', '오늘 뭐 하지?', '배고픈가?', '낮잠 잘까', '꺅', '집이 좋아',
                  '알바 가야 하나', '두기두기'];
function pickIdle(){
  home.idle = 0;
  const d = S.dugi;
  if(place === 'yard'){
    home.target = { x:0.08 + Math.random() * 0.84, y:0.25 + Math.random() * 0.68 };
    home.idleGoal = 'walk';
    if(Math.random() < 0.45){
      home.say = YARD_SAY[Math.floor(Math.random() * YARD_SAY.length)]; home.sayT = 2.2;
    }
    return;
  }
  /* 조르는 게 있으면 그 앞에서 기다린다 */
  if(S.req){
    const f = FURNITURE.find(x => x.act === S.req.kind);
    if(f && hasFurn(f.id)){
      const p = furnPos(f.id);
      home.target = { x:p.x, y:Math.min(0.95, p.y + 0.15) };
      home.say = REQ_LINE[S.req.kind]; home.sayT = 2.4;
      home.idleGoal = 'wait';
      return;
    }
  }
  const picks = [];
  if(hasFurn('tv')) picks.push('tv');
  if(hasFurn('bed') && d.energy < 60) picks.push('bed');
  if(hasFurn('sofa')) picks.push('sofa');
  picks.push('walk', 'walk');
  const p = picks[Math.floor(Math.random() * picks.length)];
  if(p === 'walk'){
    home.target = { x:0.08 + Math.random() * 0.84, y:0.2 + Math.random() * 0.7 };
  }else{
    const q = furnPos(p);
    home.target = { x:q.x + (Math.random() - 0.5) * 0.05, y:Math.min(0.95, q.y + 0.16) };
  }
  if(Math.random() < 0.5 && loveLv(S.dugi.love) >= 4){
    home.say = IDLE_SAY[Math.floor(Math.random() * IDLE_SAY.length)]; home.sayT = 2.2;
  }
  home.idleGoal = p;
}

function act(spot){
  if(!spot) return;
  if(spot.act === 'wardrobe') return openModal('wardrobe');
  if(spot.act === 'gacha')    return openModal('gacha');
  if(spot.act === 'shop')     return openModal('shop');
  if(spot.act === 'job')      return openModal('job');
  if(spot.act === 'out')      return goYard();
  if(spot.act === 'in')       return goHome();
  doCare(spot.act);
}

/* ===============================================================
   포인터 — 쓰다듬기 · 청소 · 공 던지기 · 꾸미기
   =============================================================== */
function toRoom(px, py){
  return { x:(px - roomL()) / roomW(), y:(py - walkTop()) / (walkBot() - walkTop()) };
}
function onDugi(px, py){
  const cx = rx(home.x), cy = yAt(home.y), s = dugiH();
  return px > cx - s * 0.4 && px < cx + s * 0.4 && py > cy - s && py < cy + s * 0.1;
}
function homeDown(px, py){
  if(mini){
    if(mini.kind === 'wash') miniScrub(px, py, false);
    return;
  }
  const r = toRoom(px, py);
  if(deco){
    let best = null, bd = 0.08;
    LAY.floor.concat(LAY.wall).forEach(o => {
      const oy = o.y === undefined ? -0.1 : o.y;
      const d = Math.hypot((o.x - r.x) * 1.2, (oy - r.y) * 0.7);
      if(d < bd){ bd = d; best = o; }
    });
    if(best) home.drag = { id:best.id, wall:best.y === undefined };
    return;
  }
  if(!home.ball.home && !home.ball.fly){
    const b = home.ball;
    if(Math.hypot((b.x - r.x) * 1.4, (b.y - r.y) * 0.8) < 0.07){
      home.aim = { x:r.x, y:r.y, bx:b.x, by:b.y }; return;
    }
  }
  if(home.sweep){
    sweepAt(r); return;
  }
  if(onDugi(px, py)){ home.pet.dist = 0; home.pet.on = true; petOnce(); return; }
  /* 가까운 가구를 누르면 걸어가서 실행 */
  let spot = null, bd = (place === 'yard' ? 0.2 : 0.09);
  for(const s of homeSpots()){
    const d = Math.hypot((s.x - r.x) * 1.3, ((s.y || 0) - r.y) * 0.7);
    if(d < bd){ bd = d; spot = s; }
  }
  if(spot){
    home.target = place === 'yard'
      ? { x:spot.x, y:Math.min(0.95, (spot.y || 0.05) + 0.13) }
      : { x:spot.x + (spot.act === 'job' ? 0 : 0.04),
          y:Math.min(0.95, (spot.y || 0.05) + 0.16) };
    home.autoAct = spot;
  }else{
    home.target = { x:Math.max(0.03, Math.min(0.97, r.x)),
                    y:Math.max(0.02, Math.min(0.98, r.y)) };
    home.autoAct = null;
  }
  home.idle = 0;
}
function homeMove(px, py, down){
  home.hover = { x:px, y:py };
  if(mini){ if(down && mini.kind === 'wash') miniScrub(px, py, true); return; }
  const r = toRoom(px, py);
  if(!down) return;
  if(deco && home.drag){
    const id = home.drag.id;
    S.pos[id] = home.drag.wall
      ? { x:Math.max(0.05, Math.min(0.95, r.x)) }
      : { x:Math.max(0.04, Math.min(0.96, r.x)), y:Math.max(0.08, Math.min(0.78, r.y)) };
    relayout();
    return;
  }
  if(home.aim){ home.aim.x = r.x; home.aim.y = r.y; return; }
  if(home.sweep){ sweepAt(r); return; }
  if(home.pet.on){
    const d = Math.hypot(px - (home.pet.px || px), py - (home.pet.py || py));
    home.pet.dist += d;
    home.pet.px = px; home.pet.py = py;
    if(home.pet.dist > 42){ home.pet.dist = 0; petOnce(); }
  }
}
function homeUp(){
  if(home.drag){ home.drag = null; save(); return; }
  if(home.aim){
    const b = home.ball;
    const vx = (b.x - home.aim.x) * 2.6, vy = (b.y - home.aim.y) * 2.6;
    if(Math.hypot(vx, vy) > 0.15) throwBall(vx, vy);
    home.aim = null; return;
  }
  home.pet.on = false; home.pet.px = home.pet.py = null;
}
function petOnce(){
  if(home.pet.t > 0) return;
  home.pet.t = 0.12;
  S.stat.pet = (S.stat.pet || 0) + 1;
  addLove(0.8 * petMul()); addStat('fun', 0.6);
  bumpDaily('pet', 1);
  home.pet.n++;
  const cx = rx(home.x), cy = yAt(home.y) - dugiH() * 0.7;
  home.parts.push({ x:cx + (Math.random() - .5) * 40, y:cy, vx:(Math.random() - .5) * 40,
                    vy:-50 - Math.random() * 40, life:0.9, t:0, c:'#EFA6B8', s:'heart' });
  if(home.pet.n % 12 === 0){ home.bubble = '헤헤'; home.bubbleT = 1.2; blip(880, 0.05); }
  if(S.stat.pet % 25 === 0) checkAchieve();
  refreshBar();
}
function sweepAt(r){
  for(let i = home.dusts.length - 1; i >= 0; i--){
    const d = home.dusts[i];
    if(Math.hypot((d.x - r.x) * 1.4, (d.y - r.y) * 0.8) < 0.07){
      home.dusts.splice(i, 1);
      home.parts.push({ x:rx(d.x), y:yAt(d.y), vx:0, vy:-30, life:0.6, t:0, c:'#D9C4A0', s:'dot' });
      sfxCare('clean');
      if(!home.dusts.length){ home.sweep = false; careGain('clean'); }
    }
  }
}

/* ===============================================================
   그리기
   =============================================================== */
const dugiH = () => Math.min(H * 0.215, roomW() * 0.2) * (look().scale || 1) * depthAt(yAt(home.y));

function drawDugi(){
  const c = look();
  const cx = rx(home.x), cy = yAt(home.y);
  const baseH = dugiH();
  const moving = Math.abs(home.vx) > 0.03 || Math.abs(home.vy) > 0.03;
  let bob = moving ? Math.abs(Math.sin(home.t * 9)) * baseH * 0.07 : Math.sin(home.t * 2) * baseH * 0.015;
  let rot = moving ? Math.sin(home.t * 9) * 0.07 : Math.sin(home.t * 2) * 0.02;
  let sy = 1, sx = 1;

  const a = home.act;
  if(a){
    if(a.kind === 'sleep'){ rot = -1.45; bob = -baseH * 0.12; sy = 0.95; }
    if(a.kind === 'water'){ rot = 0.1; bob = Math.abs(Math.sin(a.t * 7)) * baseH * 0.05; }
  }
  if(home.pet.t > 0){ sy = 1 + 0.05 * Math.sin(home.t * 30); sx = 1 - 0.03 * Math.sin(home.t * 30); }
  if(leveledUp > 0){ const k = Math.max(0, leveledUp / 2.6); sy = 1 + Math.sin(leveledUp * 14) * 0.12 * k; }

  shadow(cx, cy, baseH * 0.32);
  const im = IMG[c.run];
  g.save();
  g.translate(cx, cy - bob - (c.float || 0) * 0.3);
  g.rotate(rot); g.scale((c.flip === false ? 1 : -1) * home.face * sx, sy);
  if(im && im.complete && im.naturalWidth) g.drawImage(im, -baseH * 0.5, -baseH, baseH, baseH);
  g.restore();

  if(a && a.kind === 'sleep'){
    g.save(); g.globalAlpha = 0.2 * Math.min(1, a.t * 1.6); g.fillStyle = '#5A4A40';
    g.fillRect(0, 0, W, H); g.restore();
    for(let i = 0; i < 3; i++){
      const p = ((a.t * 0.5 + i * 0.33) % 1);
      g.save(); g.globalAlpha = 1 - p; g.fillStyle = '#AD9ED4';
      g.font = '700 ' + ((16 + p * 14) * uiK()) + 'px Gaegu, sans-serif';
      g.fillText('z', cx + baseH * 0.4 + p * 26, cy - baseH * 0.7 - p * 46);
      g.restore();
    }
  }
  const topY = cy - baseH - 10 * uiK();
  if(home.bubbleT > 0) speech(cx, topY, home.bubble);
  else if(home.sayT > 0) speech(cx, topY, home.say);
  else if(S.req && CARE[S.req.kind]) speech(cx, topY, REQ_LINE[S.req.kind], true);
  else {
    const low = STATS.find(s => S.dugi[s.id] < 30);
    if(low) moodIcon(cx, topY, low.color);
  }
}
function speech(tx, ty, text, want){
  g.save();
  g.font = '700 ' + (19 * uiK()) + 'px Gaegu, sans-serif';
  const w = g.measureText(text).width + 28 * uiK(), h = 32 * uiK();
  const x = Math.max(6, Math.min(W - w - 6, tx - w / 2));
  const y = ty - h + (want ? Math.sin(home.t * 3) * 2 * uiK() : 0);
  g.fillStyle = want ? '#FFF3D6' : '#FFF8F0'; ink();
  rrect(x, y, w, h, 13 * uiK()); g.fill(); g.stroke();
  g.fillStyle = want ? '#FFF3D6' : '#FFF8F0';
  g.beginPath(); g.moveTo(tx - 7 * uiK(), y + h - 1); g.lineTo(tx, y + h + 9 * uiK());
  g.lineTo(tx + 7 * uiK(), y + h - 1); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(tx - 7 * uiK(), y + h - 1); g.lineTo(tx, y + h + 9 * uiK());
  g.lineTo(tx + 7 * uiK(), y + h - 1); g.stroke();
  g.fillStyle = '#5A4A40'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, x + w / 2, y + h / 2 + 1);
  g.restore();
}
function moodIcon(cx, ty, col){
  const s = 14 * uiK();
  g.save(); g.translate(cx, ty - s * 0.4 + Math.sin(home.t * 3) * 2);
  g.fillStyle = col || '#C9A9A9'; ink();
  g.beginPath(); g.arc(0, 0, s, 0, 7); g.fill(); g.stroke();
  g.fillStyle = '#5A4A40'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '700 ' + (s * 1.3) + 'px Gaegu, sans-serif'; g.fillText('!', 0, 1);
  g.restore();
}
function drawParts(){
  for(const p of home.parts){
    const k = 1 - p.t / p.life, s = 9 * uiK();
    g.save(); g.globalAlpha = Math.max(0, k); g.fillStyle = p.c; ink(LW() * 0.7);
    if(p.s === 'heart'){
      g.beginPath(); g.moveTo(p.x, p.y + s * 0.5);
      g.bezierCurveTo(p.x - s, p.y - s * 0.3, p.x - s * 0.4, p.y - s, p.x, p.y - s * 0.35);
      g.bezierCurveTo(p.x + s * 0.4, p.y - s, p.x + s, p.y - s * 0.3, p.x, p.y + s * 0.5);
      g.fill(); g.stroke();
    }else if(p.s === 'drop'){
      g.beginPath(); g.moveTo(p.x, p.y - s);
      g.quadraticCurveTo(p.x + s * 0.7, p.y + s * 0.2, p.x, p.y + s * 0.6);
      g.quadraticCurveTo(p.x - s * 0.7, p.y + s * 0.2, p.x, p.y - s);
      g.fill(); g.stroke();
    }else if(p.s === 'z'){
      g.fillStyle = '#AD9ED4'; g.font = '700 ' + (s * 2.2) + 'px Gaegu, sans-serif';
      g.textAlign = 'center'; g.fillText('z', p.x, p.y);
    }else{
      g.beginPath(); g.arc(p.x, p.y, s * 0.55, 0, 7); g.fill(); g.stroke();
    }
    g.restore();
  }
}
function drawDust(d){
  const cx = rx(d.x), cy = yAt(d.y), s = 22 * uiK() * depthAt(cy);
  g.save(); ink(LW() * 0.8); g.fillStyle = '#CFC3AA';
  if(home.sweep){ g.shadowColor = '#FFE08A'; g.shadowBlur = 14; }
  g.beginPath();
  for(let k = 0; k < 7; k++){
    const a = k / 7 * 6.283, r = s * (0.42 + 0.2 * Math.sin(k * 2.1 + d.seed));
    g[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.5);
  }
  g.closePath(); g.fill(); g.stroke();
  g.restore();
}
function drawBall(){
  const b = home.ball;
  if(b.home) return;
  const cx = rx(b.x), cy = yAt(b.y), s = 26 * uiK() * depthAt(cy);
  shadow(cx, cy, s * 0.5);
  g.save(); ink(); g.fillStyle = '#EFA6B8';
  g.beginPath(); g.arc(cx, cy - s * 0.5, s * 0.5, 0, 7); g.fill(); g.stroke();
  g.strokeStyle = '#E39FB2';
  g.beginPath(); g.arc(cx, cy - s * 0.5, s * 0.5, 2.4, 3.9); g.stroke();
  g.restore();
  if(home.aim){
    const ax = rx(home.aim.x), ay = yAt(home.aim.y);
    g.save(); ink(LW() * 0.8); g.setLineDash([7, 7]); g.globalAlpha = .7;
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(cx, cy - s * 0.5); g.stroke();
    g.setLineDash([]);
    g.fillStyle = '#5A4A40'; g.textAlign = 'center';
    g.font = '700 ' + (15 * uiK()) + 'px Gaegu, sans-serif';
    g.fillText('놓으면 던져요', cx, cy - s * 1.4);
    g.restore();
  }
}
function drawPrompt(){
  const n = home.near;
  if(!n || home.act || deco || mini) return;
  const k = uiK();
  const LABEL = { wardrobe:'옷장 열기', gacha:'뽑기', shop:'상점 들어가기',
                  job:'알바하러 가기', out:'밖으로 나가기', in:'집으로 들어가기' };
  const label = LABEL[n.act] || CARE[n.act].name;
  g.save();
  g.font = '700 ' + (19 * k) + 'px Gaegu, sans-serif';
  const w = g.measureText('E  ' + label).width + 30 * k, h = 30 * k;
  const cx = rx(home.x), cy = yAt(home.y) - dugiH() - 46 * k;
  const x = Math.max(6 * k, Math.min(W - w - 6 * k, cx - w / 2));
  const y = Math.max(wallBot() * 0.2, cy) + Math.sin(home.t * 4) * 2 * k;
  g.fillStyle = '#5A4A40'; g.globalAlpha = .92;
  rrect(x, y, w, h, h / 2); g.fill();
  g.globalAlpha = 1; g.fillStyle = '#FFF8F0'; g.textAlign = 'left'; g.textBaseline = 'middle';
  g.font = '700 ' + (15 * k) + 'px Gaegu, sans-serif';
  g.fillText('E', x + 12 * k, y + h / 2 + 1);
  g.font = '700 ' + (19 * k) + 'px Gaegu, sans-serif';
  g.fillText(label, x + 28 * k, y + h / 2 + 1);
  g.restore();
}

/* 정원 전체 */
function drawYardScene(){
  drawYard();
  const wb = wallBot();
  const fs = Math.min(roomW() * 0.115, (H - wb) * 0.52);
  const near = id => home.near && home.near.id === id;
  const items = YARD.slice().sort((a, b) => a.y - b.y);
  let drew = false;
  for(const o of items){
    if(!drew && o.y > home.y){ drawDugi(); drew = true; }
    const by = yAt(o.y);
    drawYardThing(o.id, rx(o.x), by, fs * depthAt(by), near(o.id));
  }
  if(!drew) drawDugi();
  drawParts();
  drawPrompt();
}

/* 방 전체 */
function drawHome(dt){
  if(place === 'yard'){ drawYardScene(); return; }
  drawRoom();
  const wb = wallBot();
  const fs = Math.min(roomW() * 0.125, (H - wb) * 0.48);
  const near = id => home.near && home.near.id === id;

  for(const o of LAY.wall) drawFurn(o.id, rx(o.x), wb - (H - wb) * 0.26, fs * 0.9, near(o.id));
  drawFurn('door', rx(LAY.door.x), wb + (H - wb) * 0.02, fs * 1.0, near('door'));

  const items = LAY.floor.slice().sort((a, b) => a.y - b.y);
  let drew = false;
  for(const o of items){
    if(!drew && o.y > home.y){ drawDugi(); drawBall(); drew = true; }
    const by = yAt(o.y);
    const hi = deco && home.drag && home.drag.id === o.id;
    if(hi){ g.save(); g.globalAlpha = .75; }
    drawFurn(o.id, rx(o.x), by, fs * depthAt(by), near(o.id));
    if(hi) g.restore();
  }
  home.dusts.forEach(drawDust);
  if(!drew){ drawDugi(); drawBall(); }
  drawParts();
  drawPrompt();
  if(deco) drawDecoHint();
  if(mini) drawMini();
}
function drawDecoHint(){
  const k = uiK();
  g.save();
  g.fillStyle = 'rgba(120,95,75,.9)';
  const txt = '가구를 끌어서 옮기세요';
  g.font = '700 ' + (18 * k) + 'px Gaegu, sans-serif';
  const w = g.measureText(txt).width + 30 * k;
  rrect(W / 2 - w / 2, H * 0.12, w, 30 * k, 15 * k); g.fill();
  g.fillStyle = '#FFF8F0'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(txt, W / 2, H * 0.12 + 15 * k);
  g.restore();
}

/* ===== 미니 오버레이 그리기 ===== */
function drawMini(){
  const k = uiK();
  g.save();
  g.fillStyle = 'rgba(250,245,238,.86)'; g.fillRect(0, 0, W, H);
  const cx = W * 0.5, cy = H * 0.56, sz = Math.min(W * 0.42, H * 0.6);
  const c = look(), im = IMG[c.run];

  if(mini.kind === 'feed'){
    /* 두기 + 음식 카드 */
    const chew = mini.picked ? Math.sin(mini.t * 18) * 0.05 : 0;
    g.save(); g.translate(cx, cy + sz * 0.42);
    g.scale((c.flip === false ? 1 : -1) * (1 + chew), 1 - chew);
    if(im && im.complete) g.drawImage(im, -sz * 0.5, -sz, sz, sz);
    g.restore();
    g.fillStyle = '#4E4038'; g.textAlign = 'center';
    g.font = '700 ' + (26 * k) + 'px Gaegu, sans-serif';
    g.fillText(mini.picked ? '냠냠!' : '뭘 줄까요?', cx, H * 0.16);
    if(!mini.picked){
      g.font = '400 ' + (14 * k) + 'px Gowun Dodum, sans-serif';
      g.fillStyle = '#8A7264';
      g.fillText('좋아하는 음식을 찾으면 마음이 두 배로 올라요', cx, H * 0.21);
    }
    const n = mini.foods.length, cw = Math.min(W * 0.16, 110 * k), gap = cw * 0.24;
    const total = n * cw + (n - 1) * gap, x0 = cx - total / 2;
    mini.foods.forEach((f, i) => {
      const x = x0 + i * (cw + gap), y = H * 0.76;
      if(mini.picked === f){
        const p = Math.min(1, mini.t * 2.4);
        const fx2 = x + cw / 2 + (cx - (x + cw / 2)) * p, fy2 = y + cw / 2 + (cy - (y + cw / 2)) * p;
        drawFood(f, fx2, fy2, cw * 0.42 * (1 - p * 0.5));
        return;
      }
      if(mini.picked) return;
      g.fillStyle = '#FFFFFF'; g.strokeStyle = '#EFE4D8'; g.lineWidth = LW() * 0.7;
      rrect(x, y, cw, cw * 0.86, 18 * k); g.fill(); g.stroke(); ink();
      drawFood(f, x + cw / 2, y + cw * 0.36, cw * 0.26);
      g.fillStyle = '#5A4A40'; g.textAlign = 'center';
      g.font = '700 ' + (15 * k) + 'px Gaegu, sans-serif';
      g.fillText(f.name, x + cw / 2, y + cw * 0.74);
      f._hit = { x, y, w:cw, h:cw * 0.86 };
    });
  }else{
    /* 씻기기 */
    g.save(); g.translate(cx, cy + sz * 0.42);
    g.scale(c.flip === false ? 1 : -1, 1);
    if(im && im.complete) g.drawImage(im, -sz * 0.5, -sz, sz, sz);
    g.restore();
    mini.spots.forEach(s => {
      if(s.hp <= 0) return;
      const x = cx + s.x * sz, y = cy - sz * 0.5 + s.y * sz, r = sz * s.r;
      g.save(); ink(LW() * 0.8); g.fillStyle = s.hp > 1 ? '#B59B72' : '#CBB89A';
      g.beginPath();
      for(let i = 0; i < 8; i++){ const a = i / 8 * 6.283;
        const rr = r * (0.8 + 0.3 * Math.sin(i * 2.3 + s.seed));
        g[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
      g.closePath(); g.fill(); g.stroke(); g.restore();
    });
    mini.bubbles.forEach(b => {
      g.save(); g.globalAlpha = Math.max(0, 1 - b.t / b.life) * 0.9;
      g.fillStyle = '#FFFFFF'; ink(LW() * 0.5);
      g.beginPath(); g.arc(b.x, b.y, b.r, 0, 7); g.fill(); g.stroke(); g.restore();
    });
    const done = mini.spots.filter(s => s.hp <= 0).length;
    g.fillStyle = '#4E4038'; g.textAlign = 'center';
    g.font = '700 ' + (26 * k) + 'px Gaegu, sans-serif';
    g.fillText('문질러서 씻겨요', cx, H * 0.14);
    const bw = Math.min(W * 0.5, 320 * k), bx = cx - bw / 2, by = H * 0.19;
    g.fillStyle = '#FFFFFF'; g.strokeStyle = '#EFE4D8'; g.lineWidth = LW() * 0.7;
    rrect(bx, by, bw, 16 * k, 8 * k); g.fill(); g.stroke();
    g.fillStyle = '#8FBF92';
    rrect(bx + 2, by + 2, (bw - 4) * (done / mini.total), 12 * k, 6 * k); g.fill();
    if(mini.soap){
      g.fillStyle = '#8A7264'; g.font = '400 ' + (13 * k) + 'px Gowun Dodum, sans-serif';
      g.fillText('거품비누를 쓰는 중 — 한 번에 지워져요', cx, H * 0.24);
    }
  }
  g.restore();
}
function drawFood(f, x, y, r){
  g.save(); ink(); g.fillStyle = f.color;
  if(f.id === 'carrot'){
    g.beginPath(); g.moveTo(x, y + r); g.lineTo(x - r * 0.5, y - r * 0.5);
    g.lineTo(x + r * 0.5, y - r * 0.5); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#8FBF92';
    g.beginPath(); g.ellipse(x, y - r * 0.6, r * 0.45, r * 0.22, 0, 0, 7); g.fill(); g.stroke();
  }else if(f.id === 'bread'){
    rrect(x - r * 0.7, y - r * 0.55, r * 1.4, r * 1.1, r * 0.35); g.fill(); g.stroke();
    g.strokeStyle = '#C9A06A';
    g.beginPath(); g.moveTo(x - r * 0.4, y - r * 0.2); g.lineTo(x + r * 0.4, y - r * 0.2); g.stroke();
  }else if(f.id === 'berry'){
    g.beginPath(); g.moveTo(x, y + r * 0.9);
    g.quadraticCurveTo(x - r * 0.8, y - r * 0.2, x, y - r * 0.7);
    g.quadraticCurveTo(x + r * 0.8, y - r * 0.2, x, y + r * 0.9);
    g.fill(); g.stroke();
    g.fillStyle = '#8FBF92';
    g.beginPath(); g.ellipse(x, y - r * 0.7, r * 0.4, r * 0.18, 0, 0, 7); g.fill(); g.stroke();
  }else if(f.id === 'fish'){
    g.beginPath(); g.ellipse(x, y, r * 0.85, r * 0.5, 0, 0, 7); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(x + r * 0.7, y); g.lineTo(x + r * 1.2, y - r * 0.4);
    g.lineTo(x + r * 1.2, y + r * 0.4); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#5A4A40';
    g.beginPath(); g.arc(x - r * 0.4, y - r * 0.1, r * 0.08, 0, 7); g.fill();
  }else if(f.id === 'icecre'){
    g.beginPath(); g.arc(x, y - r * 0.2, r * 0.6, 0, 7); g.fill(); g.stroke();
    g.fillStyle = '#D9B884';
    g.beginPath(); g.moveTo(x - r * 0.45, y + r * 0.1); g.lineTo(x + r * 0.45, y + r * 0.1);
    g.lineTo(x, y + r * 1.1); g.closePath(); g.fill(); g.stroke();
  }else{
    rrect(x - r * 0.7, y - r * 0.5, r * 1.4, r, r * 0.25); g.fill(); g.stroke();
  }
  g.restore();
}
/* 밥 카드 클릭 */
function miniClick(px, py){
  if(!mini || mini.kind !== 'feed' || mini.picked) return false;
  for(const f of mini.foods){
    const h = f._hit;
    if(h && px > h.x && px < h.x + h.w && py > h.y && py < h.y + h.h){ feedPick(f); return true; }
  }
  return false;
}
