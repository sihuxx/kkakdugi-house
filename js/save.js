"use strict";
/* 세이브·경제·성장 — 꺅두기 하우스 */

/* ===============================================================
   세이브 v3 — 두기 한 마리 · 마음 · 클로버 · 집
   =============================================================== */
const SAVE_KEY = 'ggakdugi.v3';
const START_LOOKS = ['proud', 'wool', 'baby'];


function freshSave(){
  return {
    v: 3,
    clover: 500,
    look: 'proud',
    own: [...START_LOOKS],
    pity: 0, pityU: 0,
    house: 0,
    wall: 'w0', floor: 'f0',
    walls: ['w0'], floors: ['f0'],
    dugi: { name:'두기', love:0, full:70, clean:70, fun:70, energy:70,
            fav: FOODS[Math.floor(Math.random() * FOODS.length)].id, plant:0 },
    furn: [...BASE_FURN],
    pos: {},                       // 꾸미기 모드에서 옮긴 자리
    bag: {},                       // 소모품
    career: { deliver:0, cafe:0 },
    runBest: 0, cafeBest: 0,
    stat: { pet:0, job:0, earn:0 },
    daily: null,
    seen: 0,                       // 마지막으로 논 시각
    album: [],                     // 사진첩
    guest: null,                   // 오늘 찾아온 손님
    guestDay: 0,
    upkeepDay: 0,
    claimed: [],
    named: false,
    settings: { volBgm:0.6, volSfx:0.9 }
  };
}

let S = freshSave();
(function loadSave(){
  try{
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if(raw && raw.v === 3){
      S = Object.assign(freshSave(), raw);
      S.dugi = Object.assign(freshSave().dugi, raw.dugi || {});
      S.settings = Object.assign(freshSave().settings, raw.settings || {});
      S.career = Object.assign({ deliver:0, cafe:0 }, raw.career || {});
      S.stat = Object.assign({ pet:0, job:0, earn:0 }, raw.stat || {});
      const ids = new Set(CHARS.map(c => c.id));
      S.own = (S.own || []).filter(id => ids.has(id));
      if(!S.own.length) S.own = [...START_LOOKS];
      if(!S.own.includes(S.look)) S.look = S.own[0];
      const fids = new Set(FURNITURE.map(f => f.id));
      S.furn = [...new Set((S.furn || []).filter(id => fids.has(id)).concat(BASE_FURN))];
    }
  }catch(e){}
})();
let save = function(){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(S)); }catch(e){} };

const settings = S.settings;
const look = () => CHARS.find(c => c.id === S.look) || CHARS[0];
const owns = id => S.own.includes(id);
const hasFurn = id => S.furn.includes(id);
const favFood = () => FOODS.find(f => f.id === S.dugi.fav) || FOODS[0];

/* 가구 보너스 */
function boost(kind){
  let v = 0;
  for(const id of S.furn){ const f = FURN(id); if(f && f.boost && f.boost[kind]) v += f.boost[kind]; }
  return v;
}
function condition(){
  const d = S.dugi;
  return (d.full + d.clean + d.fun + d.energy) / 400;
}
/* 알바 시급 = 컨디션 + 마음 레벨 + 가구 + 그 알바 경력 */
function payMult(jobId){
  const career = jobId ? careerPay(S.career[jobId] || 0) : 1;
  return (0.80 + 0.30 * condition()) * (1 + loveBonus(S.dugi.love)) * (1 + boost('pay')) * career * WEATHER().pay;
}

function addStat(k, v){
  const d = S.dugi;
  d[k] = Math.max(0, Math.min(100, (d[k] || 0) + v));
}
function addClover(n){
  S.clover = Math.max(0, Math.round(S.clover + n));
  if(n > 0){ S.stat.earn = (S.stat.earn || 0) + n; bumpDaily('earn', n); }
}

/* ===== 마음 ===== */
let leveledUp = 0;
function addLove(n){
  const before = loveLv(S.dugi.love);
  S.dugi.love = Math.max(0, Math.round((S.dugi.love + n * (1 + boost('love'))) * 10) / 10);
  const after = loveLv(S.dugi.love);
  if(after > before){
    leveledUp = 2.6;
    const u = LOVE_UNLOCK[after] || {};
    if(u.furn && !hasFurn(u.furn)) S.furn.push(u.furn);
    toast('마음 레벨 ' + after + '!', u.txt || '두기가 더 좋아해요');
    sfxGrow();
    
  }
}
const canFollow = () => loveLv(S.dugi.love) >= 3;
const petMul = () => (loveLv(S.dugi.love) >= 6 ? 1.5 : 1);

/* ===== 알바 다녀온 뒤 ===== */
function afterOuting(jobId){
  addStat('full', -16); addStat('energy', -20); addStat('clean', -14); addStat('fun', 6);
  if(jobId){ S.career[jobId] = (S.career[jobId] || 0) + 1; }
  S.stat.job = (S.stat.job || 0) + 1;
  bumpDaily('job', 1); 
  newRequest(true);
  save();
}
function careerUp(jobId, before){
  const a = careerLv(before), b = careerLv(S.career[jobId] || 0);
  if(b > a){ toast(JOB(jobId).name + ' 경력 ' + b + '!', '시급이 올랐어요 · 새 코스가 열릴지도?');
             sfxCoin(4); }
}

/* ===== 두기가 먼저 조르기 ===== */
const REQ_LINE = { feed:'배고파요…', wash:'꿉꿉해요', play:'심심해!', sleep:'졸려요…',
                   water:'화분이 목말라요', clean:'방이 지저분해요' };
function newRequest(force){
  if(S.req && !force) return;
  const d = S.dugi, want = [];
  if(d.full < 55) want.push('feed');
  if(d.clean < 55) want.push('wash', 'clean');
  if(d.energy < 55) want.push('sleep');
  if(d.fun < 60) want.push('play', 'water');
  if(!want.length){ S.req = Math.random() < 0.4
      ? { kind: CARE_ORDER[Math.floor(Math.random() * CARE_ORDER.length)] } : null; return; }
  S.req = { kind: want[Math.floor(Math.random() * want.length)] };
  save();
}
function clearRequest(kind){
  if(S.req && S.req.kind === kind){
    S.req = null;
    addClover(35); addLove(5);
    toast('원하던 걸 해줬어요!', '보너스 클로버 35 · 마음 +5');
    sfxCoin(3);
    return true;
  }
  return false;
}

/* ===== 집 ===== */
function upgradeHouse(){
  const nxt = HOUSES[(S.house || 0) + 1];
  if(!nxt) return false;
  if(S.clover < nxt.price){ sfxNo(); toast('클로버가 모자라요', nxt.name + '까지 ' +
      (nxt.price - S.clover).toLocaleString('ko-KR') + ' 더'); return false; }
  addClover(-nxt.price); S.house = (S.house || 0) + 1; S.pos = {}; save();
  toast(nxt.name + '으로 이사!', nxt.note); sfxGrow(); 
  return true;
}

/* ===== 오늘의 할 일 ===== */
function today(){ const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
function rollDaily(){
  const pool = DAILY_POOL.slice().sort(() => Math.random() - 0.5).slice(0, 3);
  S.daily = { date: today(), list: pool.map(d => ({ id:d.id, n:0, got:false })) };
  save();
}
function checkDaily(){ if(!S.daily || S.daily.date !== today()) rollDaily(); }
function dailyDef(id){ return DAILY_POOL.find(d => d.id === id); }
function bumpDaily(kind, n){
  if(!S.daily) return;
  let changed = false;
  S.daily.list.forEach(row => {
    const def = dailyDef(row.id);
    if(!def || row.got) return;
    if(def.kind !== kind) return;
    row.n += n;
    if(row.n >= def.need){
      row.got = true; changed = true;
      S.clover += def.pay; addLove(3);
      toast('오늘의 할 일 완료!', def.txt + ' · 클로버 +' + def.pay);
      sfxCoin(4);
    }
  });
  if(changed) save();
  if(typeof paintDaily === 'function') paintDaily();
}

/* ===== 알림 ===== */
let toastTimer = null;
function toast(title, line){
  const el = $('toast');
  el.innerHTML = '<b>' + esc(title) + '</b>' + (line ? '<span>' + esc(line) + '</span>' : '');
  el.hidden = false; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

/* ===== 도감 보상 ===== */
const DEX_REWARDS = [
  { id:'d5',  n:5,  clover:300,  txt:'클로버 300' },
  { id:'d9',  n:9,  clover:700, txt:'클로버 700' },
  { id:'d13', n:13, clover:1200, item:'snack', txt:'클로버 1200 + 간식 3개' },
  { id:'d17', n:17, clover:1500, txt:'클로버 1500' }
];
function checkRewards(){
  DEX_REWARDS.forEach(r => {
    if(S.own.length >= r.n && !S.claimed.includes(r.id)){
      S.claimed.push(r.id);
      if(r.clover) addClover(r.clover);
      if(r.item) S.bag[r.item] = (S.bag[r.item] || 0) + 3;
      toast('도감 ' + r.n + '종 달성!', r.txt + ' 받았어요');
    }
  });
  save();
}
function nextReward(){ return DEX_REWARDS.find(r => !S.claimed.includes(r.id)); }


/* ===============================================================
   자리를 비운 사이 — 시간이 흐른다
   =============================================================== */
const AWAY_CAP = 12 * 60;                    /* 아무리 오래 비워도 12시간치까지만 */
function awayReport(){
  const now = Date.now();
  const last = S.seen || 0;
  S.seen = now;
  if(!last || !S.named) return null;
  const mins = Math.floor((now - last) / 60000);
  if(mins < 12) return null;                 /* 잠깐 나갔다 온 건 넘어간다 */
  const m = Math.min(mins, AWAY_CAP), hrs = m / 60;
  const lines = [];

  const before = { ...S.dugi };
  addStat('full',  -Math.round(hrs * 4.5));
  addStat('clean', -Math.round(hrs * 3.2));
  addStat('fun',   -Math.round(hrs * 3.6));
  /* 자고 있었다고 치고 기운은 오히려 찬다 */
  addStat('energy', Math.round(hrs * 2.4));

  if(before.full - S.dugi.full >= 12) lines.push('배가 많이 고파졌어요');
  if(before.clean - S.dugi.clean >= 12) lines.push('먼지가 쌓였어요');
  if(S.dugi.energy - before.energy >= 8) lines.push('한숨 푹 자고 일어났어요');

  /* 화분은 목이 마르고 */
  if(hrs >= 4 && (S.dugi.plant || 0) > 0 && Math.random() < 0.5)
    lines.push('화분이 목말라 해요');
  /* 가끔 사고를 친다 */
  if(hrs >= 3 && Math.random() < 0.45){
    const mischief = ['냉장고를 몰래 털었어요', '휴지를 다 풀어놨어요',
                      '소파에서 자다 굴러떨어졌대요', '창밖만 한참 봤대요'];
    lines.push(mischief[Math.floor(Math.random() * mischief.length)]);
    if(Math.random() < 0.5) addStat('full', 8);
  }
  /* 오래 비우면 선물이 와 있다 */
  let gift = 0;
  if(hrs >= 6){ gift = 40 + Math.round(hrs * 12); addClover(gift);
                lines.push('우편함에 클로버 ' + gift + '이 와 있었어요'); }

  save();
  return { mins, hrs, lines, gift, capped: mins > AWAY_CAP };
}

/* ===== 관리비 — 집이 클수록 매일 조금씩 나간다 ===== */
const UPKEEP = [0, 70, 160];
function payUpkeep(){
  const key = dayKey();
  if(S.upkeepDay === key) return null;
  const first = !S.upkeepDay;
  S.upkeepDay = key;
  if(first){ save(); return null; }
  const cost = UPKEEP[Math.min(UPKEEP.length - 1, S.house || 0)] || 0;
  if(cost <= 0){ save(); return null; }
  const paid = Math.min(cost, S.clover);
  S.clover -= paid;
  save(); refreshBar();
  return { cost, paid, short: cost - paid };
}

/* ===== 손님 ===== */
function rollGuest(){
  const key = dayKey();
  if(S.guestDay === key) return;             /* 하루 한 번만 정한다 */
  S.guestDay = key;
  S.guest = Math.random() < 0.55
    ? { look: CHARS[Math.floor(Math.random() * CHARS.length)].id,
        line: GUEST_LINES[Math.floor(Math.random() * GUEST_LINES.length)],
        fed: false }
    : null;
  save();
}
function guestLook(){ return S.guest && (CHARS.find(c => c.id === S.guest.look) || CHARS[0]); }
function feedGuest(){
  if(!S.guest || S.guest.fed) return false;
  S.guest.fed = true;
  const gift = GUEST_GIFTS[Math.floor(Math.random() * GUEST_GIFTS.length)];
  if(gift.kind === 'clover') addClover(gift.n);
  else if(gift.kind === 'love') addLove(gift.n);
  else { S.bag[gift.id] = (S.bag[gift.id] || 0) + 1; }
  addLove(6);
  toast('고마워요!', gift.txt + ' 받았어요');
  sfxCoin(4); bumpDaily('guest', 1); save(); refreshBar();
  return true;
}

/* ===== 앨범 ===== */
const ALBUM_MAX = 12;
function takePhoto(){
  try{
    const w = 320, h = Math.max(120, Math.round(320 * H / W));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(cv, 0, 0, w, h);
    const D = DAY(), W2 = WEATHER();
    S.album.unshift({
      t: Date.now(),
      img: c.toDataURL('image/jpeg', 0.6),
      note: HOUSE().name + ' · ' + D.name + ' · ' + W2.name + ' · 마음 Lv' + loveLv(S.dugi.love)
    });
    while(S.album.length > ALBUM_MAX) S.album.pop();
    save();
    toast('찰칵!', '앨범에 담았어요');
    sfxCoin(2);
    return true;
  }catch(e){ toast('사진을 못 찍었어요', '자리가 부족해요'); return false; }
}
function dropPhoto(i){ S.album.splice(i, 1); save(); }
