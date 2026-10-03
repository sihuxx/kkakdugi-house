"use strict";
/* 실시간 연결 — 꺅두기 하우스 */

/* ===============================================================
   실시간 연결 — 같은 방에 있는 사람끼리 메시지를 주고받습니다.
   Supabase Realtime 에 WebSocket 으로 직접 붙습니다.
   (라이브러리를 안 가져다 쓰면 공급망 공격도 없습니다 — auth.js 와 같은 방침)

   지키는 것
   · 방 코드는 헷갈리는 글자(0 O 1 I …)를 뺀 32글자에서 6자리 → 약 10억 가지.
   · 받은 메시지는 전부 '남이 보낸 남의 데이터' 로 보고 모양을 검사합니다.
   · 보내는 양에 상한을 둡니다 (초당 횟수 · 한 번에 보내는 크기).
   · 방에서는 이름과 모습만 오갑니다. 이메일·토큰·세이브는 올리지 않습니다.
   =============================================================== */
const Net = (function(){
"use strict";

const CFG  = window.DUGI_CONFIG || {};
const URL_ = (CFG.SUPABASE_URL || '').replace(/\/+$/, '');
const ANON = CFG.SUPABASE_ANON_KEY || '';
/* https 인 Supabase 주소만. (개발·시험용으로 localhost 는 예외 — auth.js 와 같은 규칙) */
const OK_URL = u => /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(u)
                 || /^http:\/\/localhost:\d+$/.test(u);
const ON = !!(URL_ && ANON && OK_URL(URL_));

/* 헷갈리는 글자는 뺐습니다 — 0/O, 1/I/L, 2/Z, 5/S, 8/B */
const ALPHA = 'ACDEFGHJKMNPQRTUVWXY34679';
const CODE_LEN = 6;
const SEND_MIN_MS = 55;              /* 메시지 사이 최소 간격 */
const SEND_MAX    = 12000;           /* 한 번에 보낼 수 있는 글자 수 */
const HB_MS       = 25000;

let ws = null, code = null, refN = 0, joinRef = null;
let hbTimer = null, retryTimer = null, retry = 0;
let live = false, leaving = false;
let myKey = null, myMeta = null;
let lastSend = 0, queue = [];
let flushTimer = null;
const subs = Object.create(null);
let peers = Object.create(null);     /* key -> {name, look, at} */
let onPeers = null, onStatus = null;

const enabled = () => ON;
const status  = () => (live ? 'on' : ws ? 'connecting' : 'off');
const key     = () => myKey;
const roomCode = () => code;
const list = () => Object.keys(peers).sort().map(k => Object.assign({ key:k }, peers[k]));

/* ===== 방 코드 ===== */
function makeCode(){
  const a = new Uint32Array(CODE_LEN);
  crypto.getRandomValues(a);
  let s = '';
  for(let i = 0; i < CODE_LEN; i++) s += ALPHA[a[i] % ALPHA.length];
  return s;
}
/* 사람이 적은 코드 다듬기 — 소문자·공백·붙임표를 받아주고 나머지는 버립니다 */
function tidyCode(v){
  return String(v == null ? '' : v).toUpperCase()
    .replace(/[^ACDEFGHJKMNPQRTUVWXY34679]/g, '')
    .slice(0, CODE_LEN);
}
const okCode = v => typeof v === 'string' && v.length === CODE_LEN &&
                    [...v].every(c => ALPHA.includes(c));

/* ===== 연결 ===== */
function topic(){ return 'realtime:dugi-draw-' + code; }
function nextRef(){ return String(++refN); }

function rawSend(obj){
  if(!ws || ws.readyState !== 1) return false;
  try{ ws.send(JSON.stringify(obj)); return true; }catch(e){ return false; }
}

function join(roomCodeIn, meta, cb){
  if(!ON) { cb && cb(new Error('서버가 설정되지 않았어요')); return; }
  if(!okCode(roomCodeIn)){ cb && cb(new Error('방 코드를 확인해주세요')); return; }
  leave(true);
  leaving = false;
  code = roomCodeIn;
  myKey = makeKey();
  myMeta = { name: cleanName(meta && meta.name, 8) || '두기',
             look: String(meta && meta.look || 'wool').slice(0, 20) };
  connect(cb);
}
function makeKey(){
  const a = new Uint32Array(2); crypto.getRandomValues(a);
  return a[0].toString(36) + a[1].toString(36);
}

function connect(cb){
  const wsUrl = URL_.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:') +
                '/realtime/v1/websocket?apikey=' + encodeURIComponent(ANON) + '&vsn=1.0.0';
  let done = false;
  try{ ws = new WebSocket(wsUrl); }
  catch(e){ cb && cb(new Error('연결할 수 없어요')); return; }

  const giveUp = setTimeout(() => {
    if(done) return; done = true;
    try{ ws.close(); }catch(e){}
    cb && cb(new Error('연결이 너무 오래 걸려요'));
  }, 12000);

  ws.onopen = () => {
    /* presence 는 enabled:true 를 켜야 다른 사람 목록이 내려옵니다 */
    const payload = { config: { broadcast:{ self:false, ack:false },
                                presence:{ key: myKey, enabled: true },
                                postgres_changes: [],
                                private: false } };
    joinRef = nextRef();
    rawSend({ topic: topic(), event:'phx_join', payload, ref: joinRef, join_ref: joinRef });
  };

  ws.onmessage = ev => {
    let m = null;
    try{ m = JSON.parse(ev.data); }catch(e){ return; }
    if(!m || typeof m !== 'object') return;
    if(m.event === 'phx_reply' && m.topic === topic()){
      const ok = m.payload && m.payload.status === 'ok';
      if(!done){
        done = true; clearTimeout(giveUp);
        if(!ok){ try{ ws.close(); }catch(e){} cb && cb(new Error('방에 들어가지 못했어요')); return; }
        live = true; retry = 0;
        track();
        beat();
        if(onStatus) onStatus('on');
        cb && cb(null);
      }
      return;
    }
    if(m.topic !== topic()) return;
    if(m.event === 'presence_state'){ peers = Object.create(null); mergePresence(m.payload); return; }
    if(m.event === 'presence_diff'){
      const p = m.payload || {};
      for(const k of Object.keys(p.leaves || {})) delete peers[k];
      mergePresence(p.joins);
      return;
    }
    if(m.event === 'broadcast'){
      const b = m.payload || {};
      const name = String(b.event || '');
      const data = b.payload;
      const fns = subs[name];
      if(fns) fns.forEach(fn => { try{ fn(data); }catch(e){ console.error('net', name, e); } });
      return;
    }
  };

  ws.onclose = () => {
    live = false;
    clearInterval(hbTimer); hbTimer = null;
    if(!done){ done = true; clearTimeout(giveUp); cb && cb(new Error('연결이 끊어졌어요')); return; }
    if(leaving || !code) return;
    if(onStatus) onStatus('connecting');
    const wait = Math.min(8000, 700 * Math.pow(2, retry++));
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => { if(!leaving && code) connect(() => {}); }, wait);
  };
  ws.onerror = () => {};
}

function mergePresence(joins){
  if(!joins || typeof joins !== 'object') return;
  for(const k of Object.keys(joins)){
    if(!/^[a-z0-9]{1,24}$/i.test(k)) continue;
    const metas = joins[k] && joins[k].metas;
    const m = Array.isArray(metas) && metas.length ? metas[0] : null;
    peers[k] = { name: cleanName(m && m.name, 8) || '두기',
                 look: /^[a-z0-9_]{1,20}$/i.test(m && m.look) ? m.look : 'wool' };
  }
  if(onPeers) onPeers(list());
}

function track(){
  rawSend({ topic: topic(), event:'presence',
            payload:{ type:'presence', event:'track', payload: myMeta },
            ref: nextRef(), join_ref: joinRef });
}
function beat(){
  clearInterval(hbTimer);
  hbTimer = setInterval(() => {
    rawSend({ topic:'phoenix', event:'heartbeat', payload:{}, ref: nextRef() });
  }, HB_MS);
}

/* ===== 보내기 — 너무 자주·너무 크게 못 보내게 ===== */
function send(name, data){
  if(!live) return false;
  const body = { topic: topic(), event:'broadcast',
                 payload:{ type:'broadcast', event:String(name).slice(0, 20), payload:data },
                 ref: nextRef(), join_ref: joinRef };
  let txt;
  try{ txt = JSON.stringify(body); }catch(e){ return false; }
  if(txt.length > SEND_MAX) return false;
  const now = Date.now();
  if(now - lastSend >= SEND_MIN_MS && !queue.length){ lastSend = now; return rawSend(body); }
  if(queue.length > 40) return false;                    /* 밀리면 버린다 */
  queue.push(body);
  if(!flushTimer) flushTimer = setTimeout(flush, SEND_MIN_MS);
  return true;
}
function flush(){
  flushTimer = null;
  const b = queue.shift();
  if(b){ lastSend = Date.now(); rawSend(b); }
  if(queue.length) flushTimer = setTimeout(flush, SEND_MIN_MS);
}

function on(name, fn){
  (subs[name] || (subs[name] = [])).push(fn);
  return () => { subs[name] = (subs[name] || []).filter(f => f !== fn); };
}
function off(){ for(const k in subs) delete subs[k]; }

function leave(quiet){
  leaving = true;
  clearTimeout(retryTimer); clearInterval(hbTimer);
  retryTimer = hbTimer = null; retry = 0;
  queue = []; clearTimeout(flushTimer); flushTimer = null;
  if(ws){
    try{ if(ws.readyState === 1) rawSend({ topic: topic(), event:'phx_leave', payload:{}, ref: nextRef() }); }catch(e){}
    try{ ws.onclose = null; ws.close(); }catch(e){}
  }
  ws = null; live = false; peers = Object.create(null);
  if(!quiet){ code = null; myKey = null; off(); }
  if(onStatus && !quiet) onStatus('off');
}

addEventListener('beforeunload', () => { try{ leave(); }catch(e){} });

return { enabled, status, join, leave, send, on, off, list, key, roomCode,
         makeCode, tidyCode, okCode, CODE_LEN,
         set onPeers(f){ onPeers = f; }, set onStatus(f){ onStatus = f; } };
})();
