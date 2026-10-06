"use strict";
/* 광장 — 여럿이 모이는 곳 — 꺅두기 하우스 */

/* ===============================================================
   광장 — 접속 중인 사람들의 두기가 같이 걸어다니는 곳

   정원은 혼자 쓰는 앞마당, 광장은 동네 놀이터입니다.

   지키는 것
   · 자유 채팅이 없습니다. 인사는 정해진 6개 중 고르는 번호만 오갑니다
     → 욕설·개인정보·스크립트가 끼어들 틈이 아예 없습니다.
   · 남에게 보내는 건 위치(x,y)와 바라보는 쪽, 그리고 인사 번호뿐입니다.
     이름·모습·레벨·도감 수는 presence 로 올라가고 net.js 에서 모양을 검사합니다.
   · 받은 좌표는 전부 0~1 로 잘라서 씁니다 — 남이 화면 밖으로 가거나
     말도 안 되는 값을 보내도 광장이 깨지지 않습니다.
   · 한 방 20명. 넘으면 다음 광장으로 — 사람이 많을수록 통신량이
     인원의 제곱으로 늘어나기 때문입니다.
   =============================================================== */
const Plaza = (function(){
"use strict";

/* 방 코드는 헷갈리는 글자를 뺀 32글자만 쓸 수 있어서 '마당' 으로 지었습니다 */
const ROOMS   = ['MADANG', 'MADAN4', 'MADAN6', 'MADAN7'];
const CAP     = 20;          /* 한 광장 정원 */
const MOVE_MS = 180;         /* 내 위치를 보내는 간격 */
const GONE_MS = 15000;       /* 이만큼 소식이 없으면 안 보이게 */
const EMOTES  = ['꺅!', '반가워', '♥', '?', '축하해', '잘 가'];

let on = false, roomIx = 0, joining = false;
let others = Object.create(null);     /* key -> {x,y,tx,ty,f,em,emT,t} */
let lastMove = 0, lastSent = { x:-9, y:-9, f:1 };
let onCount = null;

const alive = () => on;
const room  = () => ROOMS[roomIx];
const emoteList = () => EMOTES.slice();

/* 내가 지금 어떤 사람인지 — presence 로 올라가는 값 */
function meta(){
  const rk = jobRank(Math.max(...JOBS.map(j => (S.career && S.career[j.id]) || 0)));
  return { name: S.dugi.name, look: S.look, lv: S.dugi.lv || 1,
           dex: S.own.length, rk: rk.name,
           best: Math.max(S.runBest || 0, S.lostBest || 0, S.packBest || 0, S.drawBest || 0),
           rm: myRoom };
}
let myRoom = '';                       /* 내가 연 캐치마인드 방 코드 */
function setMyRoom(code){
  myRoom = Net.okCode(code) ? code : '';
  if(on) Net.setMeta(meta());
}

/* ===== 들어가기 · 나가기 ===== */
function enter(cb){
  if(!Net.enabled()){ cb && cb(new Error('서버가 설정되지 않았어요')); return; }
  if(joining) return;
  joining = true; roomIx = 0;
  tryRoom(cb);
}
function tryRoom(cb){
  Net.join(ROOMS[roomIx], meta(), err => {
    if(err){ joining = false; cb && cb(err); return; }
    /* 꽉 찼으면 다음 광장으로 — 들어가 보고 세는 수밖에 없습니다 */
    if(Net.list().length > CAP && roomIx < ROOMS.length - 1){
      roomIx++; Net.leave(true); tryRoom(cb); return;
    }
    joining = false; on = true;
    others = Object.create(null);
    lastSent = { x:-9, y:-9, f:1 };
    wire();
    cb && cb(null);
  });
}
function leave(){
  on = false; joining = false;
  others = Object.create(null);
  Net.off();
  try{ Net.leave(); }catch(e){}
}

function wire(){
  Net.off();
  Net.on('m', d => {                       /* 움직임 */
    if(!d || d.k === Net.key()) return;
    const k = String(d.k || '');
    if(!/^[a-z0-9]{1,24}$/i.test(k)) return;
    const x = clamp01(d.x), y = clamp01(d.y);
    const o = others[k] || (others[k] = { x, y, tx:x, ty:y, f:1, em:-1, emT:0 });
    o.tx = x; o.ty = y;
    o.f = d.f < 0 ? -1 : 1;
    o.t = Date.now();
  });
  Net.on('e', d => {                       /* 인사 — 번호만 옵니다 */
    if(!d || d.k === Net.key()) return;
    const k = String(d.k || '');
    const o = others[k]; if(!o) return;
    const i = Math.floor(Number(d.i));
    if(!(i >= 0 && i < EMOTES.length)) return;
    o.em = i; o.emT = 2.4; o.t = Date.now();
  });
  Net.onPeers = () => { if(onCount) onCount(count()); };
}
const clamp01 = v => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.5;
};

/* ===== 매 프레임 ===== */
function tick(dt){
  if(!on) return;
  const now = Date.now();

  /* 내 위치 — 움직였을 때만, 그리고 너무 자주는 안 보냅니다 */
  if(now - lastMove >= MOVE_MS){
    const moved = Math.abs(home.x - lastSent.x) > 0.004 ||
                  Math.abs(home.y - lastSent.y) > 0.004 ||
                  home.face !== lastSent.f;
    if(moved){
      lastMove = now;
      lastSent = { x: home.x, y: home.y, f: home.face };
      Net.send('m', { k: Net.key(), x: +home.x.toFixed(3), y: +home.y.toFixed(3), f: home.face });
    }
  }

  /* 남의 두기 — 받은 점 사이를 이어서 부드럽게.
     그냥 순간이동시키면 뚝뚝 끊겨 보입니다. */
  const known = new Set(Net.list().map(p => p.key));
  for(const k of Object.keys(others)){
    const o = others[k];
    if(!known.has(k) || (o.t && now - o.t > GONE_MS)){ delete others[k]; continue; }
    const s = Math.min(1, dt * 9);
    o.x += (o.tx - o.x) * s;
    o.y += (o.ty - o.y) * s;
    o.moving = Math.hypot(o.tx - o.x, o.ty - o.y) > 0.004;
    if(o.emT > 0) o.emT -= dt;
  }
}

/* ===== 그리기 — 두기들은 앞뒤 순서대로 ===== */
function peerList(){
  const info = Object.create(null);
  Net.list().forEach(p => { info[p.key] = p; });
  return Object.keys(others)
    .filter(k => info[k])
    .map(k => Object.assign({ key:k }, info[k], others[k]))
    .sort((a, b) => a.y - b.y);
}
function drawPeer(p){
  const cx = rx(p.x), cy = yAt(p.y), h = dugiH() * 0.94 * depthAt(cy);
  const c = CHARS.find(q => q.id === p.look) || CHARS[0];
  const im = IMG[c.run];
  const t = home.t + (p.key.charCodeAt(0) % 7);
  const bob = p.moving ? Math.abs(Math.sin(t * 9)) * h * 0.07 : Math.sin(t * 2) * h * 0.015;
  const rot = p.moving ? Math.sin(t * 9) * 0.06 : Math.sin(t * 2) * 0.02;
  shadow(cx, cy, h * 0.32);
  g.save();
  g.globalAlpha = 0.95;
  g.translate(cx, cy - bob);
  g.rotate(rot);
  g.scale((c.flip === false ? 1 : -1) * p.f, 1);
  if(im && im.complete && im.naturalWidth) g.drawImage(im, -h * 0.5, -h, h, h);
  g.restore();
  /* 이름표 */
  const k2 = uiK();
  g.save();
  g.font = '700 ' + (13 * k2) + 'px Gaegu, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const tw = g.measureText(p.name).width + 16 * k2, th = 20 * k2;
  g.fillStyle = 'rgba(255,252,248,.88)';
  rrect(cx - tw / 2, cy + 4 * k2, tw, th, th / 2); g.fill();
  g.fillStyle = '#7A6250';
  g.fillText(p.name, cx, cy + 4 * k2 + th / 2 + 1);
  g.restore();
  if(p.emT > 0 && EMOTES[p.em]) speech(cx, cy - h - 10 * k2, EMOTES[p.em]);
}
function draw(){
  if(!on) return;
  const list = peerList();
  let drew = false;
  for(const p of list){
    if(!drew && p.y > home.y){ drawDugi(); drew = true; }
    drawPeer(p);
  }
  if(!drew) drawDugi();
}

/* ===== 누르기 — 남의 두기를 누르면 명함 ===== */
function pick(px, py){
  if(!on) return null;
  const list = peerList();
  for(let i = list.length - 1; i >= 0; i--){        /* 앞에 있는 쪽부터 */
    const p = list[i];
    const cx = rx(p.x), cy = yAt(p.y), h = dugiH() * 0.94 * depthAt(cy);
    if(px > cx - h * 0.45 && px < cx + h * 0.45 && py > cy - h && py < cy + h * 0.12) return p;
  }
  return null;
}

function emote(i){
  if(!on) return;
  i = Math.floor(Number(i));
  if(!(i >= 0 && i < EMOTES.length)) return;
  home.say = EMOTES[i]; home.sayT = 2.4;
  Net.send('e', { k: Net.key(), i });
}

const count = () => Net.list().length;
/* 지금 캐치마인드 방을 열어둔 사람들 */
const hosts = () => Net.list().filter(p => p.rm && p.key !== Net.key());

return { enter, leave, tick, draw, pick, emote, alive, count, hosts, peers: peerList,
         room, emoteList, setMyRoom, CAP,
         set onCount(f){ onCount = f; } };
})();
