"use strict";
/* 세이브·경제·성장 — 꺅두기 하우스 */

/* ===============================================================
   세이브 v3 — 두기 한 마리 · 마음 · 클로버 · 집
   =============================================================== */
const SAVE_KEY = 'ggakdugi.v3';
const START_LOOKS = ['proud', 'wool', 'baby'];

const DEFAULT_KEYS = ['KeyA', 'KeyS', 'KeyK', 'KeyL'];
const SKINS = {
  basic:     { name:'기본',      col:['#8FBF92', '#8FC0D8', '#EFA6B8', '#D9C4A0'] },
  strawberry:{ name:'딸기우유',  col:['#EFA6B8', '#FFD6E0', '#FF9DB1', '#FFE3EC'] },
  mint:      { name:'민트소다',  col:['#7BD8C4', '#A9E6DC', '#5FC9B2', '#CFF2EA'] }
};

function freshSave(){
  return {
    v: 3,
    clover: 500,
    look: 'proud',
    own: [...START_LOOKS],
    pity: 0,
    house: 0,
    wall: 'w0', floor: 'f0',
    walls: ['w0'], floors: ['f0'],
    dugi: { name:'두기', love:0, full:70, clean:70, fun:70, energy:70,
            fav: FOODS[Math.floor(Math.random() * FOODS.length)].id, plant:0 },
    furn: [...BASE_FURN],
    pos: {},                       // 꾸미기 모드에서 옮긴 자리
    bag: {},                       // 소모품
    career: { dish:0, deliver:0, cafe:0 },
    best: {}, runBest: 0, cafeBest: 0,
    course: 'town',
    stat: { pet:0, job:0, earn:0 },
    daily: null,
    done: [],                      // 받은 업적
    claimed: [], skins: ['basic'],
    named: false,
    settings: { keys:[...DEFAULT_KEYS], speed:1.0, offset:0, skin:'basic',
                volMusic:0.8, volBgm:0.6, volSfx:0.9 }
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
      S.career = Object.assign({ dish:0, deliver:0, cafe:0 }, raw.career || {});
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
function save(){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(S)); }catch(e){} }

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
  return (0.62 + 0.38 * condition()) * (1 + loveBonus(S.dugi.love)) * (1 + boost('pay')) * career;
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
    checkAchieve();
  }
}
const canFollow = () => loveLv(S.dugi.love) >= 3;
const petMul = () => (loveLv(S.dugi.love) >= 6 ? 1.5 : 1);

/* ===== 알바 다녀온 뒤 ===== */
function afterOuting(jobId){
  addStat('full', -16); addStat('energy', -20); addStat('clean', -14); addStat('fun', 6);
  if(jobId){ S.career[jobId] = (S.career[jobId] || 0) + 1; }
  S.stat.job = (S.stat.job || 0) + 1;
  bumpDaily('job', 1); checkAchieve();
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
  toast(nxt.name + '으로 이사!', nxt.note); sfxGrow(); checkAchieve();
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

/* ===== 업적 ===== */
function achieveVal(kind){
  if(kind === 'pet')   return S.stat.pet || 0;
  if(kind === 'job')   return S.stat.job || 0;
  if(kind === 'love')  return loveLv(S.dugi.love);
  if(kind === 'dex')   return S.own.length;
  if(kind === 'furn')  return S.furn.length;
  if(kind === 'house') return S.house || 0;
  return 0;
}
function checkAchieve(){
  ACHIEVES.forEach(a => {
    if(S.done.includes(a.id)) return;
    if(achieveVal(a.kind) >= a.need){
      S.done.push(a.id); S.clover += a.pay;
      toast('업적 달성!', a.txt + ' · 클로버 +' + a.pay);
      sfxCoin(5); save();
    }
  });
}

/* ===== 알림 ===== */
let toastTimer = null;
function toast(title, line){
  const el = $('toast');
  el.innerHTML = '<b>' + title + '</b>' + (line ? '<span>' + line + '</span>' : '');
  el.hidden = false; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

/* ===== 도감 보상 ===== */
const DEX_REWARDS = [
  { id:'d5',  n:5,  clover:300,  txt:'클로버 300' },
  { id:'d9',  n:9,  skin:'strawberry', txt:'노트 스킨 · 딸기우유' },
  { id:'d13', n:13, clover:500, skin:'mint', txt:'민트소다 스킨 + 클로버 500' },
  { id:'d17', n:17, clover:1500, txt:'클로버 1500' }
];
function unlockSkin(id){ if(!S.skins.includes(id)) S.skins.push(id); }
function checkRewards(){
  DEX_REWARDS.forEach(r => {
    if(S.own.length >= r.n && !S.claimed.includes(r.id)){
      S.claimed.push(r.id);
      if(r.clover) addClover(r.clover);
      if(r.skin) unlockSkin(r.skin);
      toast('도감 ' + r.n + '종 달성!', r.txt + ' 받았어요');
    }
  });
  checkAchieve(); save();
}
function nextReward(){ return DEX_REWARDS.find(r => !S.claimed.includes(r.id)); }
