"use strict";
/* 캐치마인드 — 여럿이 — 꺅두기 하우스 */

/* ===============================================================
   두기 캐치마인드 — 한 명이 그리고 나머지가 맞히기 (실시간 멀티)

   누가 무엇을 아는가
   · 정답 단어는 출제자 브라우저에만 있습니다. 방에 뿌리지 않습니다.
   · 맞혔는지 판정도 출제자가 합니다. 다른 사람은 '맞음/틀림' 만 받습니다.
   · 그래서 맞힌 글자가 채팅에 그대로 노출되지 않습니다.
   · 진행(순서·시간·점수)은 방장 한 명이 맡고 1초마다 현재 상태를 뿌립니다.
     방장이 나가면 남은 사람 중 키가 가장 작은 사람이 자동으로 이어받습니다.

   점수는 브라우저가 계산하므로 100% 믿을 수 없습니다.
   그래서 이 알바의 클로버 보상에는 상한을 둡니다 (REWARD_CAP).
   =============================================================== */
const CatchMind = (function(){
"use strict";

/* ===== 규칙 ===== */
const ROUNDS    = 2;        /* 한 사람이 몇 번씩 그리나 */
const PICK_SEC  = 12;       /* 단어 고르는 시간 */
const DRAW_SEC  = 75;       /* 그리는 시간 */
const END_SEC   = 6;        /* 정답 공개 시간 */
const MIN_P     = 2;        /* 최소 인원 */
const MAX_P     = 8;
const REWARD_CAP = 650;     /* 클로버 보상 상한 (점수를 못 믿으니 여기서 막는다) */
const ORDER_BONUS = [40, 25, 15, 10, 6, 4, 2];

/* ===== 그릴 단어 ===== */
const WORDS = [
  /* 게임 속 */
  '두기','클로버','소파','화분','케이크','쿠키','커피','우유','주스','침대',
  '창문','책장','러그','시계','액자','전등','냉장고','욕조','계단','지붕',
  '우체통','그네','울타리','꽃밭','나무','벤치','가로등','간판','상자','풍선',
  /* 동물 */
  '고양이','강아지','토끼','곰','사슴','달팽이','문어','펭귄','병아리','거북이',
  '여우','돼지','개구리','나비','벌','상어','고래','올빼미','햄스터','공룡',
  /* 먹을 것 */
  '피자','햄버거','아이스크림','수박','딸기','바나나','사과','계란','라면','김밥',
  '도넛','사탕','초콜릿','팝콘','빵','치즈','당근','포도','옥수수','떡볶이',
  /* 물건 */
  '우산','안경','모자','신발','가방','연필','가위','열쇠','자전거','버스',
  '로켓','비행기','배','기차','풍차','등대','카메라','기타','피아노','북',
  '칫솔','빗자루','망치','삽','사다리','의자','책상','거울','양말','장갑',
  /* 자연·그 밖 */
  '무지개','눈사람','번개','구름','별','달','해','섬','산','폭포',
  '선인장','버섯','해바라기','단풍','조개','모래성','화산','다리','성','유령'
];

/* ===== 색 ===== */
const COLORS = ['#5A4A40','#D4708A','#F0AABA','#E7B075','#E0B84E',
                '#8FBF92','#5FA3C9','#9CCADF','#AD9ED4','#A9765A','#FFFFFF'];
const ERASER = COLORS.length - 1;
const WIDTHS = [2.6, 6.5, 15];

/* ===== 상태 ===== */
let on = false;
let phase = 'wait';            /* wait · pick · draw · turnend · over */
let players = [];              /* [{key,name,look}] — Net.presence 에서 */
let scores = Object.create(null);
let order = [], turn = 0, round = 1;
let drawerKey = null, hostKey = null;
let left = 0;                  /* 남은 시간(초) — 방장이 뿌리고 각자 깎는다 */
let hintStr = '';
let hits = [];                 /* 이번 턴에 맞힌 순서 */
let strokes = [], cur = null, lastSent = 0;
let chat = [];                 /* {k:'sys'|'say'|'hit', name, text} */
let pending = [];              /* 판정 기다리는 추측 {id, key, name, text, at} */
let secret = null, choices = [], hintStage = -1;
let onEnd = null, lastTick = 0, hitBoxes = [];
let myName = '두기', myLook = 'wool';
let dirty = true;

const me = () => Net.key();
const isHost = () => me() && hostKey === me();
const isDrawer = () => me() && drawerKey === me();
const player = k => players.find(p => p.key === k) || null;
const pname = k => { const p = player(k); return p ? p.name : '…'; };
const guessers = () => players.filter(p => p.key !== drawerKey);

/* ===== 글자 다루기 ===== */
const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
function choOf(ch){
  const c = ch.charCodeAt(0) - 0xAC00;
  return (c >= 0 && c < 11172) ? CHO[Math.floor(c / 588)] : ch;
}
const norm = s => String(s == null ? '' : s).normalize('NFC').replace(/\s+/g, '').toLowerCase();
function makeHint(word, stage){
  const ch = [...word];
  if(stage <= 0) return ch.map(() => '_').join(' ');
  if(stage === 1) return ch.map(choOf).join(' ');
  return ch.map((c, i) => i === 0 ? c : choOf(c)).join(' ');
}

/* ===== 들어오기 · 나가기 ===== */
function enter(o){
  onEnd = o.onEnd;
  myName = o.name || '두기'; myLook = o.look || 'wool';
  on = true; phase = 'wait';
  players = []; scores = Object.create(null);
  order = []; turn = 0; round = 1; drawerKey = null; hostKey = null;
  left = 0; hintStr = ''; hits = []; strokes = []; cur = null;
  chat = []; pending = []; secret = null; choices = []; hintStage = -1;
  ended = false; guessN = 0;
  lastTick = performance.now();
  sys('방에 들어왔어요 · 코드 ' + Net.roomCode());
  Net.off();
  wire();
  paintPanel();
  /* 늦게 들어왔으면 지금까지 그린 그림을 달라고 한다 */
  setTimeout(() => { if(on) Net.send('ask', {}); }, 800);
}
function quit(){
  on = false;
  Net.leave();
  if(onEnd) onEnd(null);
}

/* ===== 메시지 받기 ===== */
function wire(){
  Net.onPeers = ps => {
    players = ps.slice(0, MAX_P);
    const keys = players.map(p => p.key).sort();
    const newHost = keys[0] || null;
    if(newHost !== hostKey){ hostKey = newHost; }
    players.forEach(p => { if(scores[p.key] == null) scores[p.key] = 0; });
    /* 그리던 사람이 나가면 턴을 넘긴다 */
    if(isHost() && phase !== 'wait' && phase !== 'over' && drawerKey && !player(drawerKey)){
      sys(pname(drawerKey) + '님이 나갔어요'); nextTurn();
    }
    if(isHost() && phase !== 'wait' && players.length < MIN_P){
      phase = 'wait'; sys('사람이 모자라서 잠깐 멈출게요');
    }
    paintPanel(); dirty = true;
  };
  Net.onStatus = st => { const el = $('cmNet'); if(el){
    el.textContent = st === 'on' ? '' : st === 'connecting' ? '다시 연결하는 중…' : '연결이 끊겼어요';
    el.hidden = st === 'on'; } };

  /* 방장이 뿌리는 현재 상태 */
  Net.on('st', d => {
    if(!d || typeof d !== 'object' || isHost()) return;
    phase  = ['wait','pick','draw','turnend','over'].includes(d.ph) ? d.ph : 'wait';
    round  = clampN(d.r, 1, 20, 1);
    turn   = clampN(d.tn, 0, 64, 0);
    drawerKey = typeof d.dk === 'string' ? d.dk : null;
    left   = clampN(d.t, 0, 600, 0);
    hintStr = typeof d.hs === 'string' ? d.hs.slice(0, 40) : '';
    hits   = Array.isArray(d.hit) ? d.hit.filter(x => typeof x === 'string').slice(0, 16) : [];
    order  = Array.isArray(d.ord) ? d.ord.filter(x => typeof x === 'string').slice(0, 32) : order;
    if(d.sc && typeof d.sc === 'object')
      for(const k of Object.keys(d.sc)) if(/^[a-z0-9]{1,24}$/i.test(k))
        scores[k] = clampN(d.sc[k], 0, 999999, 0);
    if(phase === 'over' && on) finish();
    dirty = true; paintPanel();
  });

  /* 새 턴이 시작되면 화면을 비운다 */
  Net.on('new', () => {
    strokes = []; cur = null; hits = []; pending = [];
    secret = null; choices = []; hintStage = -1; dirty = true;
  });

  /* 그림 — a: 앞 선에 이어붙이기 · e: 이 선은 여기서 끝 */
  Net.on('s', d => {
    if(!d || typeof d !== 'object') return;
    const p = Array.isArray(d.p) ? d.p : null;
    if(!p || p.length < 2 || p.length % 2 || p.length > 600) return;
    for(let i = 0; i < p.length; i++)
      if(typeof p[i] !== 'number' || !isFinite(p[i]) || p[i] < -10 || p[i] > 1010) return;
    const c = clampN(d.c, 0, COLORS.length - 1, 0), w = clampN(d.w, 0, WIDTHS.length - 1, 0);
    const last = strokes[strokes.length - 1];
    if(d.a && last && last.live) last.p.push(...p);
    else strokes.push({ c, w, p: p.slice(), live: true });
    if(d.e && strokes.length) strokes[strokes.length - 1].live = false;
    if(strokes.length > 900) strokes.splice(0, strokes.length - 900);
    dirty = true;
  });
  Net.on('clr',  () => { strokes = []; cur = null; dirty = true; });
  Net.on('undo', () => { strokes.pop(); dirty = true; });

  /* 늦게 들어온 사람에게 지금까지 그린 걸 보내준다 */
  Net.on('ask', () => { if(isDrawer() && strokes.length) Net.send('full', { s: packAll() }); });
  Net.on('full', d => {
    if(isDrawer() || !d || !Array.isArray(d.s)) return;
    strokes = d.s.filter(x => x && Array.isArray(x.p) && x.p.length >= 2)
                 .slice(0, 900)
                 .map(x => ({ c: clampN(x.c, 0, COLORS.length - 1, 0),
                              w: clampN(x.w, 0, WIDTHS.length - 1, 0),
                              p: x.p.filter(n => typeof n === 'number' && isFinite(n)) }));
    dirty = true;
  });

  /* 추측 — 출제자가 판정할 때까지 글자를 감춰둔다 */
  Net.on('g', d => {
    if(!d || typeof d !== 'object') return;
    const id = String(d.id || '').slice(0, 24);
    const from = String(d.k || '').slice(0, 24);
    const text = cleanSay(d.t);
    if(!id || !text || !player(from)) return;
    pending.push({ id, key: from, name: pname(from), text, at: Date.now() });
    if(isDrawer()) judge(id, from, text);
    paintPanel();
  });
  Net.on('v', d => {                       /* 출제자의 판정 */
    if(!d || typeof d !== 'object') return;
    const id = String(d.id || '').slice(0, 24);
    const i = pending.findIndex(x => x.id === id);
    if(i < 0) return;
    const q = pending.splice(i, 1)[0];
    if(d.ok){ chat.push({ k:'hit', name:q.name, text:'정답을 맞혔어요!' }); sfxCoin(2); }
    else     chat.push({ k:'say', name:q.name, text:q.text });
    trimChat(); paintPanel();
  });
  /* 맞힌 사람 — 방장이 점수를 올린다 */
  Net.on('hit', d => {
    if(!d || typeof d !== 'object') return;
    const k = String(d.k || '').slice(0, 24);
    if(!player(k) || hits.includes(k) || k === drawerKey) return;
    hits.push(k);
    if(isHost()){
      const rank = hits.length - 1;
      const sec = clampN(d.l, 0, DRAW_SEC, 0);
      scores[k] = (scores[k] || 0) + 50 + Math.round(90 * sec / DRAW_SEC) +
                  (ORDER_BONUS[rank] || 0);
      if(drawerKey) scores[drawerKey] = (scores[drawerKey] || 0) + 25;
      if(hits.length >= guessers().length) endTurn();
    }
    dirty = true; paintPanel();
  });
  /* 방장이 아닌 출제자가 단어를 고르면 알려온다 */
  Net.on('ready', () => {
    if(isHost() && phase === 'pick'){ phase = 'draw'; left = DRAW_SEC; pushState(); }
  });
  Net.on('hint', d => {
    if(!d || typeof d !== 'object') return;
    hintStr = String(d.s || '').slice(0, 40); dirty = true;
  });
  Net.on('rev', d => {                     /* 정답 공개 */
    if(!d) return;
    const w = cleanSay(d.w);
    if(w) chat.push({ k:'sys', text:'정답은 "' + w + '" 였어요' });
    trimChat(); paintPanel();
  });
  Net.on('sys', d => { const t = cleanSay(d && d.t); if(t){ chat.push({ k:'sys', text:t }); trimChat(); paintPanel(); } });
}

function clampN(v, lo, hi, d){
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
}
function cleanSay(v){
  return String(v == null ? '' : v)
    .normalize('NFC')
    .replace(/[\u0000-\u001F\u007F\u200B-\u200F\u2028\u2029\uFEFF]/g, '')
    .replace(/\s+/g, ' ').trim().slice(0, 30);
}
function sys(t){ chat.push({ k:'sys', text:t }); trimChat(); paintPanel(); }
function trimChat(){ if(chat.length > 80) chat.splice(0, chat.length - 80); }
function packAll(){ return strokes.slice(-220).map(s => ({ c:s.c, w:s.w, p:s.p })); }

/* ===== 방장: 진행 ===== */
function startGame(){
  if(!isHost() || players.length < MIN_P) return;
  order = players.map(p => p.key).sort(() => Math.random() - 0.5);
  players.forEach(p => scores[p.key] = 0);
  round = 1; turn = 0;
  beginTurn();
}
function beginTurn(){
  drawerKey = order[turn] || null;
  if(!player(drawerKey)){ nextTurn(); return; }
  strokes = []; cur = null; hits = []; pending = []; hintStr = '';
  secret = null; choices = []; hintStage = -1;
  phase = 'pick'; left = PICK_SEC;
  Net.send('new', {});
  Net.send('sys', { t: pname(drawerKey) + '님 차례예요' });
  chat.push({ k:'sys', text: pname(drawerKey) + '님 차례예요' });
  trimChat(); pushState(); dirty = true; paintPanel();
}
function nextTurn(){
  if(!isHost()) return;
  turn++;
  if(turn >= order.length){ turn = 0; round++; }
  if(round > ROUNDS){ phase = 'over'; pushState(); finish(); return; }
  beginTurn();
}
function endTurn(){
  if(!isHost() || phase === 'turnend') return;
  phase = 'turnend'; left = END_SEC;
  pushState();
}
function pushState(){
  if(!isHost()) return;
  const sc = {};
  players.forEach(p => sc[p.key] = Math.round(scores[p.key] || 0));
  Net.send('st', { ph:phase, r:round, tn:turn, dk:drawerKey,
                   t:Math.round(left), hs:hintStr, hit:hits, ord:order, sc });
}

/* ===== 출제자: 단어 고르기 · 판정 ===== */
function rollChoices(){
  const pool = WORDS.slice();
  const out = [];
  for(let i = 0; i < 3 && pool.length; i++)
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return out;
}
function pickWord(w){
  if(!isDrawer() || phase !== 'pick') return;
  secret = w; hintStage = 0;
  hintStr = makeHint(secret, 0);
  Net.send('hint', { s: hintStr });
  if(isHost()){ phase = 'draw'; left = DRAW_SEC; pushState(); }
  else Net.send('ready', {});
  dirty = true;
}
function judge(id, fromKey, text){
  if(!secret) return;
  const ok = norm(text) === norm(secret);
  Net.send('v', { id, ok });
  const i = pending.findIndex(x => x.id === id);
  if(i >= 0){
    const q = pending.splice(i, 1)[0];
    if(ok) chat.push({ k:'hit', name:q.name, text:'정답을 맞혔어요!' });
    else   chat.push({ k:'say', name:q.name, text:q.text });
    trimChat(); paintPanel();
  }
  if(ok){
    Net.send('hit', { k: fromKey, l: Math.round(left) });
    if(!hits.includes(fromKey)){
      hits.push(fromKey);
      if(isHost()){
        const rank = hits.length - 1;
        scores[fromKey] = (scores[fromKey] || 0) + 50 +
          Math.round(90 * left / DRAW_SEC) + (ORDER_BONUS[rank] || 0);
        scores[drawerKey] = (scores[drawerKey] || 0) + 25;
        if(hits.length >= guessers().length) endTurn();
      }
    }
    dirty = true;
  }
}

/* ===== 내 추측 보내기 ===== */
let guessN = 0;
function say(textRaw){
  const text = cleanSay(textRaw);
  if(!text || !on) return;
  if(isDrawer()){
    chat.push({ k:'sys', text:'그리는 사람은 말할 수 없어요' }); trimChat(); paintPanel(); return;
  }
  if(hits.includes(me())){
    chat.push({ k:'sys', text:'이미 맞혔어요 · 다음 문제를 기다려요' }); trimChat(); paintPanel(); return;
  }
  if(phase !== 'draw'){
    chat.push({ k:'sys', text:'아직 문제가 안 나왔어요' }); trimChat(); paintPanel(); return;
  }
  const id = (me() || 'x') + '-' + (++guessN);
  pending.push({ id, key: me(), name: myName, text, at: Date.now() });
  Net.send('g', { id, k: me(), t: text });
  paintPanel();
}

/* ===== 그리기 입력 ===== */
function board(){
  const k = uiK(), m = 12 * k;
  const pw = panelPx();
  return { x:m, y:H * 0.145, w: Math.max(120, W - pw - m * 2.4), h: H * 0.675 };
}
function panelPx(){
  return W <= 760 ? Math.min(252, W * 0.38) : Math.min(318, W * 0.28);
}
/* 캔버스가 재는 폭과 HTML 패널 폭을 똑같이 맞춘다 */
function layout(){
  const el = $('cmPanel');
  if(el) el.style.width = Math.round(panelPx()) + 'px';
  dirty = true;
}
function toBoard(px, py){
  const b = board();
  return { x: Math.max(0, Math.min(1000, (px - b.x) / b.w * 1000)),
           y: Math.max(0, Math.min(1000, (py - b.y) / b.h * 1000)) };
}
const inBoard = (px, py) => { const b = board();
  return px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h; };

let penC = 0, penW = 1;
function down(px, py){
  for(const h of hitBoxes)
    if(px > h.x && px < h.x + h.w && py > h.y && py < h.y + h.h){ h.go(); return; }
  if(!isDrawer() || phase !== 'draw' || !inBoard(px, py)) return;
  const p = toBoard(px, py);
  cur = { c:penC, w:penW, p:[Math.round(p.x), Math.round(p.y)], sent:0 };
  strokes.push({ c:penC, w:penW, p:cur.p, live:true });
  dirty = true;
}
function move(px, py, isDown){
  if(!cur || !isDown) return;
  const p = toBoard(px, py);
  const n = cur.p.length;
  const dx = p.x - cur.p[n - 2], dy = p.y - cur.p[n - 1];
  if(dx * dx + dy * dy < 9) return;              /* 너무 촘촘하면 건너뛴다 */
  cur.p.push(Math.round(p.x), Math.round(p.y));
  dirty = true;
  const now = performance.now();
  if(now - lastSent > 90) flushStroke(true);
}
function up(){
  if(!cur) return;
  flushStroke(false);
  const s = strokes[strokes.length - 1];
  if(s) s.live = false;
  cur = null;
}
function flushStroke(going){
  if(!cur) return;
  const first = cur.sent === 0;
  if(cur.sent >= cur.p.length && going) return;
  /* 이어 보낼 때는 직전 점 하나를 겹쳐서 선이 끊기지 않게 */
  const from = first ? 0 : Math.max(0, cur.sent - 2);
  const part = cur.p.slice(from);
  if(!part.length) return;
  Net.send('s', { c:cur.c, w:cur.w, p:part, a: !first, e: !going });
  cur.sent = cur.p.length;
  lastSent = performance.now();
}
function clearBoard(){ if(!isDrawer()) return; strokes = []; cur = null; Net.send('clr', {}); dirty = true; }
function undoStroke(){ if(!isDrawer()) return; strokes.pop(); Net.send('undo', {}); dirty = true; }

/* ===== 매 프레임 ===== */
function frame(dt, active){
  if(active) tick(dt);
  draw();
}
/* 오른쪽 패널은 '바뀌면 알아서 다시 그린다'.
   예전에는 메시지를 받은 쪽만 다시 그려서, 진행을 직접 하는 방장은
   pick → draw 로 넘어가도 채팅칸이 잠긴 채로 남아 있었다. */
let panelSig = '';
function panelWatch(){
  const sig = [phase, drawerKey, hits.join(','), chat.length,
               players.map(p => p.key + p.name).join(','),
               players.map(p => Math.round(scores[p.key] || 0)).join(','),
               me() || ''].join('|');
  if(sig !== panelSig){ panelSig = sig; paintPanel(); }
}

function tick(dt){
  if(!on) return;
  if(phase !== 'wait' && phase !== 'over') left = Math.max(0, left - dt);
  panelWatch();

  if(isHost()){
    if(phase === 'pick' && left <= 0){ phase = 'draw'; left = DRAW_SEC; pushState(); }
    else if(phase === 'draw' && left <= 0) endTurn();
    else if(phase === 'turnend' && left <= 0) nextTurn();
    const now = performance.now();
    if(now - lastTick > 1000){ lastTick = now; pushState(); }
  }
  /* 출제자: 시간이 흐르면 힌트를 한 칸씩 연다 */
  if(isDrawer() && secret && phase === 'draw'){
    const gone = 1 - left / DRAW_SEC;
    const want = gone > 0.72 ? 2 : gone > 0.42 ? 1 : 0;
    if(want !== hintStage){
      hintStage = want; hintStr = makeHint(secret, want);
      Net.send('hint', { s: hintStr });
      dirty = true;
    }
  }
  /* 출제자 차례가 끝나면 정답 공개 */
  if(isDrawer() && secret && phase === 'turnend'){
    Net.send('rev', { w: secret });
    chat.push({ k:'sys', text:'정답은 "' + secret + '" 였어요' }); trimChat(); paintPanel();
    secret = null; hintStage = -1;
  }
  if(phase === 'pick' && isDrawer() && !choices.length && !secret) choices = rollChoices();
  if(phase !== 'pick') choices = [];
  if(phase === 'pick' && isDrawer() && left <= 0.1 && !secret && choices.length) pickWord(choices[0]);

  /* 판정이 안 오면 2초 뒤 그냥 보여준다 */
  const now2 = Date.now();
  for(let i = pending.length - 1; i >= 0; i--){
    if(now2 - pending[i].at > 2200){
      const q = pending.splice(i, 1)[0];
      chat.push({ k:'say', name:q.name, text:q.text }); trimChat(); paintPanel();
    }
  }
}

/* ===== 끝 ===== */
let ended = false;
function finish(){
  if(ended || !on) return;
  ended = true; on = false;
  /* 점수는 방장 브라우저가 센 것 — 터무니없는 값은 잘라서 받는다 */
  const SANE = 100000;
  const sc = k2 => Math.min(SANE, Math.max(0, Math.round(scores[k2] || 0)));
  const rank = players.slice().sort((a, b) => sc(b.key) - sc(a.key));
  const myI = rank.findIndex(p => p.key === me());
  const r = { score: sc(me()),
              rank: myI < 0 ? rank.length : myI + 1,
              total: rank.length,
              board: rank.map(p => ({ name:p.name, score: sc(p.key) })) };
  Net.leave();
  if(onEnd) onEnd(r);
}

/* ===== 오른쪽 패널 (HTML) ===== */
function paintPanel(){
  const pl = $('cmPlayers'); if(!pl) return;
  const rank = players.slice().sort((a, b) => (scores[b.key] || 0) - (scores[a.key] || 0));
  /* 이름이 겹치면 뒤에 번호를 붙여서 누가 누군지 보이게 */
  const seen = Object.create(null), dup = Object.create(null);
  players.forEach(p => { dup[p.name] = (dup[p.name] || 0) + 1; });
  const label = p => {
    if(dup[p.name] < 2) return p.name;
    seen[p.name] = (seen[p.name] || 0) + 1;
    return p.name + ' ' + seen[p.name];
  };
  const tag2 = Object.create(null);
  players.forEach(p => { tag2[p.key] = label(p); });
  pl.innerHTML = rank.map(p => {
    const ch = (typeof CHARS !== 'undefined' && CHARS.find(c => c.id === p.look)) || null;
    const img = ch && SRC[ch.run] ? '<img src="' + escAttr(SRC[ch.run]) + '" alt="">' : '<i class="noimg"></i>';
    const tag = p.key === drawerKey ? '<em class="pen">✎</em>'
              : hits.includes(p.key) ? '<em class="ok">✓</em>' : '';
    return '<div class="cmp' + (p.key === me() ? ' mine' : '') + '">' + img +
           '<b>' + esc(tag2[p.key] || p.name) + (p.key === me() ? ' (나)' : '') + '</b>' + tag +
           '<span>' + Math.round(scores[p.key] || 0) + '</span></div>';
  }).join('');

  const log = $('cmLog'); if(!log) return;
  const near = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
  log.innerHTML = chat.slice(-60).map(m =>
    m.k === 'sys' ? '<p class="sys">' + esc(m.text) + '</p>'
  : m.k === 'hit' ? '<p class="hit"><b>' + esc(m.name) + '</b> ' + esc(m.text) + '</p>'
  :                 '<p><b>' + esc(m.name) + '</b> ' + esc(m.text) + '</p>').join('');
  if(near) log.scrollTop = log.scrollHeight;

  const inp = $('cmInput');
  if(inp){
    const mute = isDrawer() || hits.includes(me()) || phase !== 'draw';
    inp.disabled = !!mute;
    inp.placeholder = isDrawer() ? '그리는 사람은 못 적어요'
                    : hits.includes(me()) ? '벌써 맞혔어요!'
                    : phase === 'draw' ? '정답을 적어보세요' : '곧 시작해요';
  }
}

/* ===== 캔버스 ===== */
function draw(){
  const k = uiK();
  g.fillStyle = '#F3EAE1'; g.fillRect(0, 0, W, H);
  hitBoxes = [];

  const b = board();
  /* 도화지 */
  g.save(); ink();
  g.fillStyle = '#FFFCF8'; rrect(b.x, b.y, b.w, b.h, 18 * k); g.fill(); g.stroke();
  g.restore();

  /* 그림 */
  g.save();
  g.beginPath(); rrect(b.x, b.y, b.w, b.h, 18 * k); g.clip();
  g.lineCap = 'round'; g.lineJoin = 'round';
  const sc = b.w / 1000;
  for(const s of strokes){
    if(s.p.length < 2) continue;
    g.strokeStyle = COLORS[s.c] || COLORS[0];
    g.lineWidth = Math.max(1.2, WIDTHS[s.w] * sc * 1.15);
    g.beginPath();
    g.moveTo(b.x + s.p[0] * sc, b.y + s.p[1] * (b.h / 1000));
    if(s.p.length === 2){ g.lineTo(b.x + s.p[0] * sc + 0.1, b.y + s.p[1] * (b.h / 1000)); }
    for(let i = 2; i < s.p.length; i += 2)
      g.lineTo(b.x + s.p[i] * sc, b.y + s.p[i + 1] * (b.h / 1000));
    g.stroke();
  }
  g.restore();

  drawTop(k, b);
  if(phase === 'wait') drawWait(k, b);
  else if(phase === 'pick' && isDrawer() && !secret) drawPick(k, b);
  else if(isDrawer() && phase === 'draw') drawTools(k, b);
  else drawFoot(k, b);
}

function drawTop(k, b){
  const f = (s, w) => (w || 700) + ' ' + (s * k) + 'px Gaegu, sans-serif';
  g.save(); g.textBaseline = 'middle';

  /* 왼쪽 — 라운드 */
  g.textAlign = 'left'; g.fillStyle = '#8A7264'; g.font = f(16, 400);
  const info = phase === 'wait' ? '방 코드 ' + (Net.roomCode() || '')
             : round + '바퀴 / ' + ROUNDS + ' · ' + (turn + 1) + '번째';
  g.fillText(info, b.x + 4 * k, H * 0.055);

  /* 가운데 — 힌트 또는 안내 */
  const mx = b.x + b.w / 2;
  g.textAlign = 'center'; g.fillStyle = '#4E4038';
  if(phase === 'draw'){
    if(isDrawer()){
      g.font = f(26); g.fillText(secret || '', mx, H * 0.072);
      g.font = f(13, 400); g.fillStyle = '#8A7264';
      g.fillText('이 단어를 그려주세요', mx, H * 0.112);
    }else{
      g.font = f(30); g.fillText(hintStr || '', mx, H * 0.072);
      g.font = f(13, 400); g.fillStyle = '#8A7264';
      const n = hintStr ? hintStr.split(' ').length : 0;
      g.fillText(pname(drawerKey) + '님이 그리는 중' + (n ? ' · ' + n + '글자' : ''),
                 mx, H * 0.115);
    }
  }else if(phase === 'pick'){
    g.font = f(22);
    g.fillText(isDrawer() ? '단어를 고르세요' : pname(drawerKey) + '님이 단어를 고르는 중…',
               mx, H * 0.08);
  }else if(phase === 'turnend'){
    g.font = f(22); g.fillText('차례 끝!', mx, H * 0.08);
  }

  /* 오른쪽 — 남은 시간 */
  if(phase === 'pick' || phase === 'draw' || phase === 'turnend'){
    const total = phase === 'pick' ? PICK_SEC : phase === 'draw' ? DRAW_SEC : END_SEC;
    const r = 20 * k, cx = b.x + b.w - r - 2 * k, cy = H * 0.075;
    const frac = Math.max(0, Math.min(1, left / total));
    g.save();
    g.lineWidth = 5 * k; g.strokeStyle = '#EFE4D8';
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = left < 11 && phase === 'draw' ? '#D4708A' : '#8FBF92';
    g.beginPath(); g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac); g.stroke();
    g.restore();
    g.fillStyle = '#4E4038'; g.textAlign = 'center'; g.font = f(19);
    g.fillText(String(Math.ceil(left)), cx, cy + 1);
  }
  g.restore();
}

/* 기다리는 방 */
function drawWait(k, b){
  const f = (s, w) => (w || 700) + ' ' + (s * k) + 'px Gaegu, sans-serif';
  g.save(); g.textAlign = 'center'; g.textBaseline = 'middle';
  const cx = b.x + b.w / 2;
  g.fillStyle = '#8A7264'; g.font = f(17, 400);
  g.fillText('친구에게 이 코드를 알려주세요', cx, b.y + b.h * 0.22);

  const code = Net.roomCode() || '------';
  g.font = f(62); g.fillStyle = '#4E4038';
  g.fillText([...code].join(' '), cx, b.y + b.h * 0.37);

  g.font = f(16, 400); g.fillStyle = '#8A7264';
  g.fillText(players.length + '명 모였어요 · ' + MIN_P + '명부터 시작할 수 있어요',
             cx, b.y + b.h * 0.53);

  if(isHost()){
    const w = 200 * k, h = 54 * k, x = cx - w / 2, y = b.y + b.h * 0.64;
    const ok = players.length >= MIN_P;
    g.save(); g.globalAlpha = ok ? 1 : 0.4;
    ink(); g.fillStyle = '#8FBF92'; rrect(x, y, w, h, 18 * k); g.fill(); g.stroke();
    g.fillStyle = '#FFFCF8'; g.font = f(26);
    g.fillText('시작하기', cx, y + h / 2 + 1);
    g.restore();
    if(ok) hitBoxes.push({ x, y, w, h, go: startGame });
  }else{
    g.font = f(17, 400); g.fillStyle = '#8A7264';
    g.fillText('방장이 시작하기를 누르면 시작해요', cx, b.y + b.h * 0.66);
  }
  g.restore();
}

/* 단어 고르기 */
function drawPick(k, b){
  const f = (s, w) => (w || 700) + ' ' + (s * k) + 'px Gaegu, sans-serif';
  g.save(); g.textAlign = 'center'; g.textBaseline = 'middle';
  const n = choices.length || 3;
  const cw = Math.min(190 * k, b.w / n - 14 * k), ch = 92 * k;
  const gap = 14 * k, total = n * cw + (n - 1) * gap;
  const x0 = b.x + b.w / 2 - total / 2, y = b.y + b.h * 0.42;
  choices.forEach((w, i) => {
    const x = x0 + i * (cw + gap);
    ink(); g.fillStyle = '#FFF8F0';
    rrect(x, y, cw, ch, 18 * k); g.fill(); g.stroke();
    g.fillStyle = '#4E4038'; g.font = f(28);
    g.fillText(w, x + cw / 2, y + ch / 2);
    hitBoxes.push({ x, y, w:cw, h:ch, go: () => pickWord(w) });
  });
  g.fillStyle = '#8A7264'; g.font = f(16, 400);
  g.fillText('고르지 않으면 왼쪽 단어로 시작해요', b.x + b.w / 2, y + ch + 30 * k);
  g.restore();
}

/* 그리기 도구 — 도화지 폭 안에 반드시 들어가게 줄여 맞춥니다 */
function drawTools(k, b){
  const y = b.y + b.h + 10 * k;
  const h0 = Math.min(44 * k, Math.max(26, H - y - 8 * k));
  const BTN = [['되돌리기', undoStroke], ['전체 지우기', clearBoard]];

  /* 글씨 폭을 실제로 재서 필요한 자리를 구하고, 넘치면 같은 비율로 줄인다 */
  g.save();
  g.font = '700 ' + (15 * k) + 'px Gaegu, sans-serif';
  const txtW = BTN.map(([t]) => g.measureText(t).width + 20 * k);
  g.restore();
  const need1 = COLORS.length * (h0 + 5 * k) + 8 * k +
                WIDTHS.length * (h0 * 0.8 + 5 * k) + 8 * k +
                txtW.reduce((a, w) => a + w + 6 * k, 0);
  const avail = b.w - 8 * k;                      /* 패널에 닿지 않게 여유를 둔다 */
  const s = need1 > avail ? Math.max(0.46, avail / need1) : 1;
  const h = h0 * s, r = h / 2, gap = 5 * k * s;

  let x = b.x + r;
  COLORS.forEach((c, i) => {
    const on2 = penC === i;
    g.save(); ink(on2 ? LW() * 1.6 : LW() * 0.9);
    g.fillStyle = c;
    g.beginPath(); g.arc(x, y + r, r * (on2 ? 0.95 : 0.74), 0, 7); g.fill(); g.stroke();
    if(i === ERASER){ g.fillStyle = '#8A7264'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '700 ' + (12 * k * s) + 'px Gaegu, sans-serif'; g.fillText('지움', x, y + r + 1); }
    g.restore();
    hitBoxes.push({ x:x - r, y, w:r * 2, h, go: () => { penC = i; dirty = true; } });
    x += r * 2 + gap;
  });
  x += 8 * k * s;
  WIDTHS.forEach((w, i) => {
    const on2 = penW === i;
    g.save(); ink(on2 ? LW() * 1.4 : LW() * 0.8);
    g.fillStyle = on2 ? '#FFF8F0' : '#F3EAE1';
    rrect(x, y, r * 1.6, h, 10 * k * s); g.fill(); g.stroke();
    g.fillStyle = '#5A4A40';
    g.beginPath(); g.arc(x + r * 0.8, y + r, Math.max(2, w * 0.42 * k * s), 0, 7); g.fill();
    g.restore();
    hitBoxes.push({ x, y, w:r * 1.6, h, go: () => { penW = i; dirty = true; } });
    x += r * 1.6 + gap;
  });
  x += 8 * k * s;
  BTN.forEach(([t, fn], i) => {
    const bw = txtW[i] * s;
    g.save(); ink(LW() * 0.9); g.fillStyle = '#FFF8F0';
    rrect(x, y, bw, h, 12 * k * s); g.fill(); g.stroke();
    g.fillStyle = '#5A4A40'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '700 ' + (15 * k * s) + 'px Gaegu, sans-serif';
    g.fillText(t, x + bw / 2, y + h / 2 + 1);
    g.restore();
    hitBoxes.push({ x, y, w:bw, h, go: fn });
    x += bw + 6 * k * s;
  });
}

/* 그리는 사람이 아닐 때 아래 안내 */
function drawFoot(k, b){
  const y = b.y + b.h + 10 * k;
  g.save(); g.textAlign = 'center'; g.textBaseline = 'top';
  g.fillStyle = '#8A7264'; g.font = '400 ' + (15 * k) + 'px Gowun Dodum, sans-serif';
  const msg = phase === 'turnend' ? '잠시 뒤 다음 차례로 넘어가요'
            : phase === 'pick' ? '곧 그림이 시작돼요'
            : phase === 'draw' ? '오른쪽에 정답을 적어보세요'
            : '';
  g.fillText(msg, b.x + b.w / 2, y + 8 * k);
  g.restore();
}

/* 단어 고르기는 숫자키 1·2·3 으로도 됩니다 */
function pick(i){
  if(phase !== 'pick' || !isDrawer() || secret) return;
  const w = choices[i];
  if(w) pickWord(w);
}
function key(code){
  if(code === 'KeyZ' && isDrawer()) undoStroke();
  const n = ['Digit1', 'Digit2', 'Digit3'].indexOf(code);
  if(n >= 0) pick(n);
}

return { enter, quit, frame, down, move, up, key, say, finish, pick,
         startGame, paintPanel, layout,
         peek: () => ({ phase, round, turn, drawerKey, hostKey, left,
                        players: players.length, strokes: strokes.length,
                        hits: hits.slice(), scores: Object.assign({}, scores),
                        hint: hintStr, secret, chat: chat.slice(-6) }),
         panelPx, WORDS, REWARD_CAP, MIN_P, ROUNDS, DRAW_SEC };
})();
