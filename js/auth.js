"use strict";
/* 계정·클라우드 세이브 — 꺅두기 하우스 */

/* ===============================================================
   계정 — 회원가입 · 로그인 · 클라우드 세이브
   외부 라이브러리를 쓰지 않고 Supabase 의 HTTPS API 를 직접 부릅니다.
   (가져다 쓰는 스크립트가 없으면 공급망 공격도 없습니다)

   지키는 것
   · 비밀번호는 이 코드 어디에도 저장하지 않습니다. 변수에 담았다가 바로 버립니다.
   · 접근 토큰(access token)은 메모리에만 둡니다. 새로고침하면 사라집니다.
   · 재발급 토큰(refresh token)은 기본이 sessionStorage — 탭을 닫으면 사라집니다.
     "이 기기에서 로그인 유지" 를 켠 사람만 localStorage 에 남습니다.
   · 로그인 실패 메시지는 늘 같습니다 (계정이 있는지 없는지 알려주지 않음).
   · 서버에서 내려온 세이브는 믿지 않고 한 겹 검사해서 받습니다.
   =============================================================== */
const Auth = (function(){
"use strict";

const CFG = window.DUGI_CONFIG || {};
const URL_  = (CFG.SUPABASE_URL || '').replace(/\/+$/, '');
const ANON  = CFG.SUPABASE_ANON_KEY || '';
/* https 인 Supabase 주소만 받는다. (개발용으로 localhost 는 예외) */
const OK_URL = u => /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(u)
                 || /^http:\/\/localhost:\d+$/.test(u);
const ON    = !!(URL_ && ANON && OK_URL(URL_));

const RT_KEY = 'ggakdugi.rt';                 /* 재발급 토큰 보관 자리 */
let access = null;                            /* 메모리에만 */
let expAt  = 0;
let user   = null;
let busy   = false;
let lastPush = 0, pushTimer = null;
const listeners = [];

const enabled = () => ON;
const current = () => user;
const onChange = fn => { listeners.push(fn); fn(user); };
const fire = () => listeners.forEach(fn => { try{ fn(user); }catch(e){} });

/* ===== 토큰 보관 ===== */
function store(){ return localStorage.getItem(RT_KEY) ? localStorage : sessionStorage; }
function keepRT(tok, remember){
  try{
    sessionStorage.removeItem(RT_KEY); localStorage.removeItem(RT_KEY);
    if(tok) (remember ? localStorage : sessionStorage).setItem(RT_KEY, tok);
  }catch(e){}
}
function readRT(){
  try{ return localStorage.getItem(RT_KEY) || sessionStorage.getItem(RT_KEY) || null; }catch(e){ return null; }
}
function clearTokens(){ access = null; expAt = 0; user = null; keepRT(null, false); }

/* ===== 공통 호출 ===== */
async function api(path, opt){
  opt = opt || {};
  const headers = Object.assign({
    'apikey': ANON,
    'Content-Type': 'application/json'
  }, opt.headers || {});
  headers['Authorization'] = 'Bearer ' + ((opt.auth !== false && access) ? access : ANON);
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 15000);
  let res;
  try{
    res = await fetch(URL_ + path, {
      method: opt.method || 'GET',
      headers,
      body: opt.body ? JSON.stringify(opt.body) : undefined,
      signal: ctl.signal,
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer'
    });
  }finally{ clearTimeout(t); }
  if(opt.raw) return res;                    /* 헤더까지 봐야 할 때 (순위 세기) */
  const txt = await res.text();
  let data = null;
  if(txt){ try{ data = JSON.parse(txt); }catch(e){ data = null; } }
  if(!res.ok){
    const err = new Error((data && (data.msg || data.message || data.error_description)) || ('HTTP ' + res.status));
    err.status = res.status; err.body = data;
    throw err;
  }
  return data;
}

/* ===== 비밀번호 검사 — 서버도 보지만 먼저 거른다 ===== */
const WEAK = ['password','12345678','qwerty123','11111111','dugi1234','asdf1234',
              '1q2w3e4r','iloveyou','abcd1234','00000000','87654321','password1'];
function checkPw(pw){
  if(typeof pw !== 'string' || pw.length < 10) return '비밀번호는 10자 이상이어야 해요';
  if(pw.length > 200) return '비밀번호가 너무 길어요';
  if(WEAK.includes(pw.toLowerCase())) return '너무 흔한 비밀번호예요';
  let kinds = 0;
  if(/[a-z]/.test(pw)) kinds++;
  if(/[A-Z]/.test(pw)) kinds++;
  if(/[0-9]/.test(pw)) kinds++;
  if(/[^A-Za-z0-9]/.test(pw)) kinds++;
  if(kinds < 3) return '영문 대문자 · 소문자 · 숫자 · 기호 중 3가지 이상 섞어주세요';
  if(/^(.)\1+$/.test(pw)) return '같은 글자만으로는 안 돼요';
  return null;
}
function checkEmail(em){
  if(typeof em !== 'string') return '이메일을 확인해주세요';
  const v = em.trim();
  if(v.length < 5 || v.length > 254) return '이메일을 확인해주세요';
  if(!/^[^\s@<>"'`]+@[^\s@<>"'`.]+(\.[^\s@<>"'`.]+)+$/.test(v)) return '이메일을 확인해주세요';
  return null;
}

/* ===== 가입 · 로그인 ===== */
async function signUp(email, pw){
  if(!ON) throw new Error('서버가 설정되지 않았어요');
  const e1 = checkEmail(email); if(e1) throw new Error(e1);
  const e2 = checkPw(pw);       if(e2) throw new Error(e2);
  await api('/auth/v1/signup', { method:'POST', auth:false,
    body:{ email: email.trim().toLowerCase(), password: pw } });
  /* 이메일 인증을 켜두면 여기서 세션이 안 옵니다 — 그게 정상이고 더 안전합니다 */
  return { needVerify: true };
}

async function signIn(email, pw, remember){
  if(!ON) throw new Error('서버가 설정되지 않았어요');
  if(checkEmail(email) || typeof pw !== 'string' || !pw)
    throw new Error('이메일 또는 비밀번호가 맞지 않아요');
  let d;
  try{
    d = await api('/auth/v1/token?grant_type=password', { method:'POST', auth:false,
      body:{ email: email.trim().toLowerCase(), password: pw } });
  }catch(err){
    /* 계정이 있는지 없는지 구분되지 않게 늘 같은 문구 */
    if(err.status === 400 || err.status === 401)
      throw new Error('이메일 또는 비밀번호가 맞지 않아요');
    if(err.status === 429) throw new Error('잠시 후 다시 시도해주세요');
    throw new Error('지금은 연결이 안 돼요');
  }
  applySession(d, remember);
  return user;
}

function applySession(d, remember){
  if(!d || !d.access_token) throw new Error('로그인에 실패했어요');
  access = d.access_token;
  expAt  = Date.now() + (Math.max(60, d.expires_in || 3600) - 60) * 1000;
  keepRT(d.refresh_token || null, !!remember);
  const u = d.user || {};
  user = { id: u.id, email: u.email, verified: !!(u.email_confirmed_at || u.confirmed_at) };
  fire();
}

async function refresh(){
  const rt = readRT();
  if(!ON || !rt) return null;
  try{
    const remember = !!localStorage.getItem(RT_KEY);
    const d = await api('/auth/v1/token?grant_type=refresh_token',
      { method:'POST', auth:false, body:{ refresh_token: rt } });
    applySession(d, remember);
    return user;
  }catch(err){ clearTokens(); fire(); return null; }
}

async function ready(){                        /* 페이지가 열릴 때 한 번 */
  if(!ON) return null;
  if(!readRT()) return null;
  return refresh();
}

async function token(){                        /* 만료 전에 갱신 */
  if(access && Date.now() < expAt) return access;
  await refresh();
  return access;
}

async function signOut(){
  const rt = readRT();
  try{ if(ON && access) await api('/auth/v1/logout', { method:'POST' }); }catch(e){}
  clearTokens(); fire();
}

async function resetPassword(email){
  if(!ON) throw new Error('서버가 설정되지 않았어요');
  if(checkEmail(email)) throw new Error('이메일을 확인해주세요');
  try{
    await api('/auth/v1/recover', { method:'POST', auth:false,
      body:{ email: email.trim().toLowerCase() } });
  }catch(e){}
  /* 가입된 메일인지 알려주지 않기 위해 결과와 무관하게 같은 안내 */
  return true;
}

/* 조건에 맞는 줄이 몇 개인지만 센다 — 순위표에서 내 등수를 구할 때 씁니다.
   PostgREST 는 Content-Range 헤더에 전체 개수를 적어줍니다. */
async function count(path){
  if(!ON || !user) return null;
  const t = await token(); if(!t) return null;
  const res = await api(path, { raw: true,
    headers: { 'Prefer': 'count=exact', 'Range': '0-0' } });
  if(!res || (!res.ok && res.status !== 206)) return null;
  const cr = res.headers.get('content-range') || '';
  const n = Number(String(cr).split('/')[1]);
  return Number.isFinite(n) ? n : null;
}

/* ===============================================================
   클라우드 세이브
   =============================================================== */
const MAX_BYTES = 400 * 1024;                  /* 세이브 한 개 상한 */

/* 서버에서 온 것도 남의 것일 수 있다고 보고 한 겹 거른다 */
function sanitizeSave(raw){
  if(!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out = {};
  const num = (v, lo, hi, d) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
  };
  const ids = new Set(CHARS.map(c => c.id));
  const fids = new Set(FURNITURE.map(f => f.id));

  out.v       = 3;
  out.clover  = num(raw.clover, 0, 99999999, 500);
  out.pity    = num(raw.pity, 0, 100000, 0);
  out.pityU   = num(raw.pityU, 0, 100000, 0);
  out.house   = num(raw.house, 0, HOUSES.length - 1, 0);
  out.look    = ids.has(raw.look) ? raw.look : 'wool';
  out.own     = Array.isArray(raw.own) ? [...new Set(raw.own.filter(x => ids.has(x)))].slice(0, 200) : ['wool'];
  out.furn    = Array.isArray(raw.furn) ? [...new Set(raw.furn.filter(x => fids.has(x)))].slice(0, 200) : [];
  out.wall    = WALLS.some(w => w.id === raw.wall)   ? raw.wall  : 'w0';
  out.floor   = FLOORS.some(f => f.id === raw.floor) ? raw.floor : 'f0';
  out.walls   = Array.isArray(raw.walls)  ? raw.walls.filter(x => WALLS.some(w => w.id === x)).slice(0, 50)  : ['w0'];
  out.floors  = Array.isArray(raw.floors) ? raw.floors.filter(x => FLOORS.some(f => f.id === x)).slice(0, 50) : ['f0'];
  out.named   = !!raw.named;
  out.runBest  = num(raw.runBest, 0, 99999999, 0);
  out.mineBest = num(raw.mineBest, 0, 999, 0);
  out.lostBest = num(raw.lostBest, 0, 9999999, 0);
  out.packBest = num(raw.packBest, 0, 9999999, 0);
  out.drawBest = num(raw.drawBest, 0, 99999999, 0);
  out.seen     = num(raw.seen, 0, 4102444800000, 0);
  out.guestDay = num(raw.guestDay, 0, 99999999, 0);
  out.freeDay  = String(raw.freeDay || '').replace(/[^0-9-]/g, '').slice(0, 12);
  out.upkeepDay= num(raw.upkeepDay, 0, 99999999, 0);

  const d = (raw.dugi && typeof raw.dugi === 'object') ? raw.dugi : {};
  out.dugi = {
    name:   cleanName(d.name, 8) || '두기',
    lv:     num(d.lv, 1, LV_MAX, 1),
    exp:    num(d.exp, 0, 9999999, 0),
    love:   num(d.love, 0, 99999999, 0),
    full:   num(d.full, 0, 100, 70),
    clean:  num(d.clean, 0, 100, 70),
    fun:    num(d.fun, 0, 100, 70),
    energy: num(d.energy, 0, 100, 70),
    fav:    FOODS.some(f => f.id === d.fav) ? d.fav : FOODS[0].id,
    plant:  num(d.plant, 0, 10, 0)
  };
  const c = (raw.career && typeof raw.career === 'object') ? raw.career : {};
  out.career = { deliver: num(c.deliver, 0, 999999, 0), mine: num(c.mine, 0, 999999, 0),
                 lost: num(c.lost, 0, 999999, 0), pack: num(c.pack, 0, 999999, 0),
                 draw: num(c.draw, 0, 999999, 0) };
  const st = (raw.stat && typeof raw.stat === 'object') ? raw.stat : {};
  out.stat = { pet: num(st.pet, 0, 99999999, 0), job: num(st.job, 0, 999999, 0),
               earn: num(st.earn, 0, 99999999, 0) };

  out.pos = Object.create(null);
  const BANNED = new Set(['__proto__', 'prototype', 'constructor']);
  if(raw.pos && typeof raw.pos === 'object'){
    let n = 0;
    for(const k of Object.keys(raw.pos)){        /* 상속된 키는 보지 않는다 */
      if(n++ > 60) break;
      if(BANNED.has(k)) continue;                /* 프로토타입 오염 차단 */
      if(!/^[a-z0-9_]{1,20}$/i.test(k)) continue;
      const v = raw.pos[k];
      if(!v || typeof v !== 'object') continue;
      const o = {};
      if('x' in v) o.x = num(v.x, 0, 1, 0.5);
      if('y' in v) o.y = num(v.y, 0, 1, 0.5);
      Object.defineProperty(out.pos, k, { value:o, enumerable:true, writable:true, configurable:true });
    }
  }
  out.pos = Object.assign({}, out.pos);

  out.bag = {};
  if(raw.bag && typeof raw.bag === 'object')
    ITEMS.forEach(it => { const n = num(raw.bag[it.id], 0, 999, 0); if(n) out.bag[it.id] = Math.round(n); });

  out.claimed = Array.isArray(raw.claimed)
    ? raw.claimed.filter(x => typeof x === 'string' && /^[a-z0-9]{1,8}$/i.test(x)).slice(0, 40) : [];

  /* 사진 — data: 이미지만, 개수·크기 제한 */
  out.album = [];
  if(Array.isArray(raw.album)){
    for(const ph of raw.album.slice(0, 12)){
      if(!ph || typeof ph !== 'object') continue;
      if(typeof ph.img !== 'string') continue;
      if(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]{16,}$/.test(ph.img)) continue;
      if(ph.img.length > 60000) continue;
      out.album.push({ t: num(ph.t, 0, 4102444800000, Date.now()),
                       img: ph.img,
                       note: String(ph.note || '').replace(/[<>&"'`]/g, '').slice(0, 60) });
    }
  }
  out.guest = null;
  if(raw.guest && typeof raw.guest === 'object' && ids.has(raw.guest.look))
    out.guest = { look: raw.guest.look,
                  line: String(raw.guest.line || '').replace(/[<>&"'`]/g, '').slice(0, 30),
                  fed: !!raw.guest.fed };
  out.daily = (raw.daily && typeof raw.daily === 'object' && Array.isArray(raw.daily.list))
    ? { date: String(raw.daily.date || '').slice(0, 12),
        list: raw.daily.list.slice(0, 6).map(r => ({
          id: String((r && r.id) || '').replace(/[^a-z_]/g, '').slice(0, 20),
          n: num(r && r.n, 0, 999999, 0), got: !!(r && r.got) })) }
    : null;
  out.settings = { volBgm: num(raw.settings && raw.settings.volBgm, 0, 1, 0.6),
                   volSfx: num(raw.settings && raw.settings.volSfx, 0, 1, 0.9),
                   fx: (raw.settings && raw.settings.fx) !== false };
  return out;
}

async function pull(){
  if(!ON || !user) return null;
  const t = await token(); if(!t) return null;
  const rows = await api('/rest/v1/saves?select=data,updated_at&limit=1', {
    headers: { 'Accept': 'application/json' } });
  if(!Array.isArray(rows) || !rows.length) return null;
  const clean = sanitizeSave(rows[0].data);
  return clean ? { data: clean, at: Date.parse(rows[0].updated_at) || 0 } : null;
}

async function push(state){
  if(!ON || !user) return false;
  const t = await token(); if(!t) return false;
  const clean = sanitizeSave(state);
  if(!clean) return false;
  const body = JSON.stringify(clean);
  if(body.length > MAX_BYTES) { clean.album = []; }       /* 사진을 빼고 다시 */
  await api('/rest/v1/saves', {
    method: 'POST',
    headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
    body: { user_id: user.id, data: clean, updated_at: new Date().toISOString() }
  });
  lastPush = Date.now();
  return true;
}

/* 너무 자주 올리지 않게 — 15초에 한 번까지 */
function pushLater(state){
  if(!ON || !user) return;
  clearTimeout(pushTimer);
  const wait = Math.max(1500, 15000 - (Date.now() - lastPush));
  pushTimer = setTimeout(() => { push(state).catch(() => {}); }, wait);
}

return { enabled, current, onChange, ready, signUp, signIn, signOut, resetPassword,
         checkPw, checkEmail, pull, push, pushLater, sanitizeSave, token, api, count,
         get busy(){ return busy; } };
})();
