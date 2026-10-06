"use strict";
/* 셸 — 화면 전환·입력·루프 — 꺅두기 하우스 */

/* ===============================================================
   셸 — 화면 전환 · 입력 · 메인 루프
   =============================================================== */
let mode = 'home';          // home · auth · cut · run · runresult · mine · mineresult
                            // · lost · lostresult · pack · packresult
                            // · cmlobby · catch · catchresult
let last = performance.now();

function showScreen(el){
  [$('introScreen'), $('authScreen'), $('runResult'), $('cmLobby')]
    .forEach(s => { if(s) s.hidden = s !== el; });
}

/* ===== 위쪽 상태바 ===== */
function refreshBar(){
  const d = S.dugi, lv = loveLv(d.love);
  $('barClover').innerHTML = CLOVER_SVG + '<b>' + S.clover.toLocaleString('ko-KR') + '</b>';
  $('barName').textContent = d.name;
  const atMax = (d.lv || 1) >= LV_MAX;
  $('barStage').textContent = 'Lv ' + (d.lv || 1) + (atMax ? ' 최고' : '');
  const wx = WEATHER(), dp = DAY();
  $('barWx').innerHTML = '<i class="wx wx-' + wx.id + '"></i>' + wx.name + ' · ' + dp.name;
  $('expFill').style.width = Math.round(expProg() * 100) + '%';
  $('expFill').parentElement.title = atMax ? '최고 레벨!'
    : '다음 레벨까지 ' + Math.max(0, expNeed(d.lv) - (d.exp || 0)).toLocaleString('ko-KR');
  const hearts = Math.min(5, Math.round(lv / 2));
  $('loveHearts').innerHTML = [0,1,2,3,4].map(i => '<i class="' + (i < hearts ? 'on' : '') + '">♥</i>').join('');

  /* 컨디션 하나로 — 네 수치는 눌렀을 때만 */
  const c = condition();                       /* 0~1 */
  const pct = Math.round(c * 100);
  const mult = 0.80 + 0.30 * c;                /* save.js 의 payMult 와 같은 식 */
  const chip = $('condChip');
  $('condPct').textContent = pct + '%';
  $('condPay').textContent = '알바비 ×' + mult.toFixed(2);
  chip.classList.toggle('low', pct < 50);
  chip.classList.toggle('mid', pct >= 50 && pct < 75);
  $('condRing').style.setProperty('--p', pct + '%');
  STATS.forEach(s2 => {
    const bar = $('st_' + s2.id);
    if(!bar) return;
    bar.style.width = Math.round(d[s2.id]) + '%';
    bar.parentElement.parentElement.classList.toggle('low', d[s2.id] < 30);
  });
  const hint = $('condHint');
  if(hint){
    const worst = STATS.slice().sort((a, b) => d[a.id] - d[b.id])[0];
    hint.textContent = pct >= 90
      ? '최상 — 알바비를 가장 많이 받아요'
      : (worst ? worst.name + '이(가) 제일 낮아요 · 방 안의 물건을 눌러 돌봐주세요' : '');
  }
}

/* 컨디션 칩 — 눌러서 네 수치 펼치기 */
function toggleCond(force){
  const panel = $('condPanel'), chip = $('condChip');
  const open = force === undefined ? panel.hidden : force;
  panel.hidden = !open;
  chip.setAttribute('aria-expanded', open ? 'true' : 'false');
  if(open) refreshBar();
}

function goHome(){
  leavePlaza(); $('emoteBar').hidden = true;
  const wasOut = outside();
  place = 'room';
  mode = 'home'; deco = false; mini = null;
  showScreen(null);
  $('topbar').hidden = false; $('runPad').hidden = true;
  $('cmPanel').hidden = true;
  try{ if(typeof Net !== 'undefined' && Net.roomCode()) Net.leave(); }catch(e){}
  $('skipBtn').hidden = true; $('tapHint').hidden = true;
  if(wasOut){ home.x = LAY.door.x; home.y = 0.22; home.target = null; home.vx = home.vy = 0; }
  checkDaily(); rollGuest(); seedWeather(); seedDust();
  relayout(); refreshBar(); paintDaily(); bgmStart();
}

/* ===== 정원으로 나가기 ===== */
function goYard(){
  leavePlaza(); $('emoteBar').hidden = true;
  place = 'yard';
  mode = 'home'; deco = false; mini = null;
  closeModal(); showScreen(null);
  $('topbar').hidden = false; $('runPad').hidden = true;
  $('dailyPanel').hidden = true;
  home.x = 0.12; home.y = 0.28; home.target = null; home.autoAct = null;
  home.vx = home.vy = 0; home.act = null; home.sweep = false;
  home.ball.home = true; home.aim = null;
  toast('정원으로 나왔어요', '상점 · 뽑기 · 알바 · 랭킹 · 광장');
  refreshBar();
}

/* ===== 광장 ===== */
let plazaBusy = false;
function goPlaza(){
  if(plazaBusy) return;
  if(!Net.enabled()){ toast('광장은 서버 연결이 필요해요', '혼자 하기 모드예요'); return; }
  plazaBusy = true;
  toast('광장으로 가는 중…', '');
  Plaza.enter(err => {
    plazaBusy = false;
    if(err){ toast('광장에 못 들어갔어요', err.message || ''); return; }
    place = 'plaza';
    mode = 'home'; deco = false; mini = null;
    closeModal(); showScreen(null);
    $('topbar').hidden = false; $('runPad').hidden = true;
    $('dailyPanel').hidden = true;
    home.x = 0.12; home.y = 0.42; home.target = null; home.autoAct = null;
    home.vx = home.vy = 0; home.act = null; home.sweep = false;
    home.ball.home = true; home.aim = null;
    paintEmotes();
    toast('광장에 왔어요', '지금 ' + Plaza.count() + '명 · 두기를 누르면 명함');
    refreshBar();
  });
}
function leavePlaza(){
  if(!Plaza.alive()) return;
  Plaza.leave();
  $('emoteBar').hidden = true;
}

/* 인사 — 정해진 6개만. 자유 입력이 없으니 욕설도 스크립트도 못 들어옵니다. */
function paintEmotes(){
  const bar = $('emoteBar');
  bar.innerHTML = '';
  Plaza.emoteList().forEach((txt, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = txt;
    b.onclick = () => Plaza.emote(i);
    bar.appendChild(b);
  });
  bar.hidden = false;
}

/* ===== 배달 알바 ===== */
function startRun(){
  leavePlaza(); closeModal(); initAudio(); bgmStop();
  if(ctx && ctx.state === 'suspended') ctx.resume();
  mode = 'run'; $('topbar').hidden = true; showScreen(null);
  $('runPad').hidden = !(W < 760 || matchMedia('(pointer:coarse)').matches);
  DugiRun.start({ look: look(), onEnd: runEnd });
}
function runEnd(r){
  mode = 'runresult';
  $('runPad').hidden = true;
  const before = S.career.deliver || 0;
  const pay = Math.round((r.jelly * 7 + r.dist / 60 + (r.cleared ? 200 + r.hp * 90 : 0))
                         * payMult('deliver'));
  const grade = r.cleared ? (r.score > 6000 ? 'S' : r.score > 4500 ? 'A' : r.score > 3200 ? 'B' : 'C') : '-';
  $('runTitle').textContent = r.cleared ? '배달 완료!' : '배달 실패…';
  $('runArt').src = SRC[look().run];
  $('runScore').textContent = Math.round(r.score).toLocaleString('ko-KR');
  tally('달린 거리', '주운 동전', '최고 연속');
  $('rDist').textContent = Math.floor(r.dist / 10) + ' m';
  $('rJelly').textContent = r.jelly + ' / ' + r.total;
  $('rCombo').textContent = r.combo;
  $('rGrade').textContent = grade;
  if(r.score > (S.runBest || 0)){ S.runBest = Math.round(r.score); $('runBest').textContent = '새 기록!'; }
  else $('runBest').textContent = '최고 기록 ' + (S.runBest || 0).toLocaleString('ko-KR');
  payOut(pay, 'deliver', 'runReward', '배달 알바');
  careerUp('deliver', before);
  showRank('deliver');
  showScreen($('runResult'));
  bgmStart();
}

/* ===== 광산 알바 ===== */
function startMine(){
  closeModal(); initAudio(); bgmStop();
  if(ctx && ctx.state === 'suspended') ctx.resume();
  mode = 'mine'; $('topbar').hidden = true; showScreen(null);
  $('runPad').hidden = true;
  MineGame.start({ onEnd: mineEnd });
}
function mineEnd(r){
  mode = 'mineresult';
  const before = S.career.mine || 0;
  const pay = Math.round(r.clover * payMult('mine'));
  /* 보물상자에서 주운 건 들고 나왔을 때만 내 것이 된다 */
  const names = [];
  (r.haul || []).forEach(id => {
    const it = ITEM(id); if(!it) return;
    S.bag[id] = (S.bag[id] || 0) + 1; names.push(it.name);
  });
  $('runTitle').textContent = r.collapsed ? '무너졌어요…'
                            : r.bottom    ? '바닥까지 갔다!'
                            : r.depth >= 12 ? '제법 깊이 갔네요'
                                            : '무사히 올라왔어요';
  $('runArt').src = SRC[look().run];
  $('runScore').textContent = Math.round(pay).toLocaleString('ko-KR');
  tally('내려간 깊이', '주운 보물', '들고 온 것');
  $('rDist').textContent = r.depth + ' m';
  $('rJelly').textContent = names.length ? names.join(', ') : '없음';
  $('rCombo').textContent = r.collapsed ? '−' + (r.lost || 0).toLocaleString('ko-KR') : '지킴';
  $('rGrade').textContent = r.collapsed ? '-' : r.depth >= 25 ? 'S' : r.depth >= 17 ? 'A'
                          : r.depth >= 10 ? 'B' : 'C';
  const best = S.mineBest || 0;
  $('runBest').textContent = r.depth >= best ? '가장 깊이 내려갔어요! ' + r.depth + 'm'
                                             : '최고 기록 ' + best + 'm';
  $('runAgain').textContent = '한 번 더';
  payOut(pay, 'mine', 'runReward', '두기 광산 · ' + r.depth + 'm');
  careerUp('mine', before);
  showRank('mine');
  showScreen($('runResult'));
  bgmStart();
}

/* ===== 미아 찾기 ===== */
function startLost(){
  closeModal(); initAudio(); bgmStop();
  if(ctx && ctx.state === 'suspended') ctx.resume();
  mode = 'lost'; $('topbar').hidden = true;
  $('runPad').hidden = true; showScreen(null);
  LostGame.start({ onEnd: lostEnd });
}
function lostEnd(r){
  mode = 'lostresult';
  const before = S.career.lost || 0;
  const score = Math.min(60000, Math.max(0, Math.round(r.score) || 0));
  const pay = Math.round((score * 0.19 + 60) * payMult('lost'));
  $('runTitle').textContent = r.round >= 10 ? '안내소의 달인!'
                            : r.round >= 5  ? '잘 찾았어요'
                                            : '눈이 아직 덜 떠졌네요';
  $('runArt').src = SRC[look().run];
  $('runScore').textContent = score.toLocaleString('ko-KR');
  tally('찾은 손님', '헛짚음', '내 도감');
  $('rDist').textContent = r.round + '명 찾음';
  $('rJelly').textContent = r.miss + '번 헛짚음';
  $('rCombo').textContent = S.own.length + '종';
  $('rGrade').textContent = r.round >= 12 ? 'S' : r.round >= 8 ? 'A' : r.round >= 4 ? 'B' : 'C';
  if(score > (S.lostBest || 0)){ S.lostBest = score; $('runBest').textContent = '새 기록!'; }
  else $('runBest').textContent = '최고 점수 ' + (S.lostBest || 0).toLocaleString('ko-KR');
  $('runAgain').textContent = '한 번 더';
  payOut(pay, 'lost', 'runReward', '미아 찾기 · ' + r.round + '명');
  careerUp('lost', before);
  showRank('lost');
  showScreen($('runResult'));
  bgmStart();
}

/* ===== 택배 포장 ===== */
function startPack(){
  closeModal(); initAudio(); bgmStop();
  if(ctx && ctx.state === 'suspended') ctx.resume();
  mode = 'pack'; $('topbar').hidden = true;
  $('runPad').hidden = true; showScreen(null);
  PackGame.start({ onEnd: packEnd });
}
function packEnd(r){
  mode = 'packresult';
  const before = S.career.pack || 0;
  const score = Math.min(300000, Math.max(0, Math.round(r.score) || 0));
  const pay = Math.round((score * 0.42 + 60) * payMult('pack'));
  $('runTitle').textContent = r.lines >= 25 ? '창고의 전설!'
                            : r.lines >= 12 ? '깔끔하게 쌌네요'
                                            : '상자가 금방 찼어요';
  $('runArt').src = SRC[look().run];
  $('runScore').textContent = score.toLocaleString('ko-KR');
  tally('지운 줄', '쌓은 칸', '한 번에 최다');
  $('rDist').textContent = r.lines + '줄';
  $('rJelly').textContent = r.placed + '칸';
  $('rCombo').textContent = (r.burst || 0) + '줄';
  $('rGrade').textContent = r.lines >= 30 ? 'S' : r.lines >= 18 ? 'A' : r.lines >= 8 ? 'B' : 'C';
  if(score > (S.packBest || 0)){ S.packBest = score; $('runBest').textContent = '새 기록!'; }
  else $('runBest').textContent = '최고 점수 ' + (S.packBest || 0).toLocaleString('ko-KR');
  $('runAgain').textContent = '한 번 더';
  payOut(pay, 'pack', 'runReward', '택배 포장 · ' + r.lines + '줄');
  careerUp('pack', before);
  showRank('pack');
  showScreen($('runResult'));
  bgmStart();
}

/* ===============================================================
   캐치마인드 — 여럿이 하는 알바
   =============================================================== */
function cmErr(t){
  const el = $('cmErr');
  el.textContent = t || ''; el.hidden = !t;
}
function startCatch(){
  closeModal(); initAudio();
  if(ctx && ctx.state === 'suspended') ctx.resume();
  if(!Net.enabled()){
    toast('서버가 연결되지 않았어요', '혼자 하는 알바를 해주세요');
    openModal('job'); return;
  }
  mode = 'cmlobby';
  $('topbar').hidden = true; $('runPad').hidden = true;
  $('cmPanel').hidden = true;
  cmErr(''); $('cmCode').value = '';
  showScreen($('cmLobby'));
}
function enterRoom(code){
  const btn = $('cmJoin'), mk = $('cmMake');
  btn.disabled = mk.disabled = true; cmErr('연결하는 중…');
  Net.join(code, { name: S.dugi.name, look: S.look }, err => {
    btn.disabled = mk.disabled = false;
    if(err){ cmErr(String(err.message || '들어가지 못했어요')); return; }
    cmErr('');
    mode = 'catch';
    bgmStop();
    showScreen(null);
    $('topbar').hidden = true;
    $('cmPanel').hidden = false;
    CatchMind.layout();
    Plaza.setMyRoom(code);          /* 광장 사람들 눈에 '방 열림' 으로 보입니다 */
    CatchMind.enter({ name: S.dugi.name, look: S.look, onEnd: catchEnd });
  });
}
function catchEnd(r){
  $('cmPanel').hidden = true;
  Plaza.setMyRoom('');
  if(!r){ mode = 'home'; goHome(); openModal('job'); return; }
  mode = 'catchresult';
  const before = S.career.draw || 0;
  /* 점수는 남의 브라우저가 센 것이라 그대로 믿지 않는다 — 값도 자르고 보상에도 상한 */
  const score = Math.min(100000, Math.max(0, Math.round(r.score) || 0));
  const raw = Math.round((score * 0.45 + 110) * payMult('draw'));
  const pay = Math.min(CatchMind.REWARD_CAP, raw);
  $('runTitle').textContent = r.rank === 1 ? '1등!' : r.rank + '등이에요';
  $('runArt').src = SRC[look().run];
  $('runScore').textContent = score.toLocaleString('ko-KR');
  tally('내 등수', '함께한 사람', '1등');
  $('rDist').textContent = r.rank + ' / ' + r.total + '등';
  $('rJelly').textContent = r.total + '명';
  $('rCombo').textContent = (r.board[0] ? r.board[0].name : '-');
  $('rGrade').textContent = r.rank === 1 ? 'S' : r.rank <= Math.ceil(r.total / 2) ? 'A' : 'B';
  if(score > (S.drawBest || 0)){ S.drawBest = score; $('runBest').textContent = '새 기록!'; }
  else $('runBest').textContent = '최고 점수 ' + (S.drawBest || 0).toLocaleString('ko-KR');
  $('runAgain').textContent = '한 번 더';
  payOut(pay, 'draw', 'runReward', '두기 캐치마인드');
  careerUp('draw', before);
  showRank('draw');
  showScreen($('runResult'));
  bgmStart();
}
$('cmMake').onclick = () => enterRoom(Net.makeCode());
$('cmJoinForm').onsubmit = e => {
  e.preventDefault();
  const c = Net.tidyCode($('cmCode').value);
  if(!Net.okCode(c)){ cmErr('방 코드 6자리를 확인해주세요'); return; }
  enterRoom(c);
};
$('cmCode').addEventListener('input', e => {
  const v = Net.tidyCode(e.target.value);
  if(e.target.value !== v) e.target.value = v;
  cmErr('');
});
$('cmBack').onclick = () => { mode = 'home'; goHome(); openModal('job'); };
$('cmQuit').onclick = () => { if(confirm('방에서 나갈까요?')) CatchMind.quit(); };
$('cmForm').onsubmit = e => {
  e.preventDefault();
  const v = $('cmInput').value;
  $('cmInput').value = '';
  CatchMind.say(v);
};

/* 결과 화면의 네 칸 이름을 알바마다 바꿔 단다 */
function tally(a, b, c, d){
  $('rDistL').textContent = a; $('rJellyL').textContent = b;
  $('rComboL').textContent = c; $('rGradeL').textContent = d || '등급';
}

/* 결과 화면 아래에 지금 랭크와 (로그인했다면) 전체 등수 */
function showRank(jobId){
  const n = S.career[jobId] || 0, rk = jobRank(n), nx = jobRankNext(n);
  const el = $('runRank');
  el.innerHTML = '<i class="rbadge" style="color:' + rk.color + ';background:' + rk.bg + '">' +
    esc(rk.name) + '</i><span>' + n + '번째 · ' +
    (nx ? esc(nx.name) + '까지 ' + (nx.at - n) + '번' : '최고 랭크!') + '</span>' +
    '<b id="runBoardMe">…</b>';
  el.hidden = false;
  const me = $('runBoardMe');
  if(!Board.enabled()){ me.textContent = ''; return; }
  me.textContent = '순위 확인 중…';
  Board.submit(jobId).then(r => {
    if(!r) { me.textContent = ''; return; }
    me.textContent = r.rank ? '전체 ' + r.rank + '위 / ' + r.total + '명' : '';
  }).catch(() => { me.textContent = ''; });
}

/* ===== 처음 시작 ===== */
function askName(){
  showScreen($('introScreen'));
  $('introName').value = S.dugi.name;
  $('topbar').hidden = true;
  setTimeout(() => $('introName').focus(), 200);
}
function finishIntro(){
  const v = cleanName($('introName').value, 8) || '두기';
  S.dugi.name = v; S.named = true; save();
  initAudio(); goHome();
  toast(v + '와(과) 함께!', '두기를 쓰다듬어 보세요');
}

/* ===== 오늘의 할 일 ===== */
function paintDaily(){
  const el = $('dailyList'); if(!el) return;
  checkDaily();
  el.innerHTML = '';
  let left = 0;
  S.daily.list.forEach(row => {
    const def = dailyDef(row.id); if(!def) return;
    if(!row.got) left++;
    const li = document.createElement('div');
    li.className = 'dq' + (row.got ? ' got' : '');
    li.innerHTML = '<span class="chk">' + (row.got ? '✓' : '') + '</span>' +
      '<b>' + def.txt + '</b><i>' + Math.min(row.n, def.need) + '/' + def.need + '</i>' +
      '<span class="pay">' + CLOVER_SVG + def.pay + '</span>';
    el.appendChild(li);
  });
  dailyLeftN = left;
}
/* 남은 할 일 수 — 집 안 '할 일판' 에 빨간 점을 띄울 때 씁니다 */
let dailyLeftN = 0;
function dailyLeft(){ return dailyLeftN; }

/* ===== 입력 ===== */
const KMAP = { KeyW:'w', KeyA:'a', KeyS:'s', KeyD:'d',
               ArrowUp:'w', ArrowLeft:'a', ArrowDown:'s', ArrowRight:'d' };

addEventListener('keydown', e => {
  audioKick();
  if(mode === 'run'){
    if(e.code === 'Escape'){ DugiRun.quit(); return; }
    if(!e.repeat) DugiRun.key(e.code, true);
    if(['Space','ArrowUp','ArrowDown','KeyW','KeyS','KeyE'].includes(e.code)) e.preventDefault();
    return;
  }
  if(mode === 'mine'){
    if(['Space','ArrowUp','ArrowDown','Enter'].includes(e.code)) e.preventDefault();
    if(!e.repeat) MineGame.key(e.code);
    return;
  }
  if(mode === 'lost'){ if(!e.repeat) LostGame.key(e.code); return; }
  if(mode === 'pack'){ if(!e.repeat) PackGame.key(e.code); return; }
  if(mode === 'catch'){
    const typing = /^(INPUT|TEXTAREA)$/.test((document.activeElement || {}).tagName || '');
    if(e.code === 'Escape'){ if(typing) $('cmInput').blur(); else CatchMind.quit(); return; }
    if(!typing) CatchMind.key(e.code);
    return;
  }
  if(mode === 'home' && !modalOpen){
    if(mini && e.code === 'Escape'){ closeMini(); return; }
    if(KMAP[e.code] && !mini){ e.preventDefault(); keys[KMAP[e.code]] = true; home.target = null; return; }
    if((e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') && !mini){
      e.preventDefault(); if(home.near) act(home.near); return; }
  }
  if(modalOpen && e.code === 'Escape'){ closeModal(); return; }
  if(e.repeat) return;
  if(mode === 'cut'){
    if(e.code === 'Escape'){ e.preventDefault(); skipCut(); }
    else if(e.code === 'Space' || e.code === 'Enter'){ e.preventDefault(); advanceCut(); }
    return;
  }

  if(e.code === 'Escape' && modalOpen) closeModal();
});
addEventListener('keyup', e => {
  if(mode === 'run'){ DugiRun.key(e.code, false); return; }
  if(KMAP[e.code]) keys[KMAP[e.code]] = false;
});
addEventListener('blur', () => { for(const k in keys) keys[k] = false; });

let ptrDown = false;
function canvasXY(e){
  const r = cv.getBoundingClientRect();
  return { x:(e.clientX - r.left) / r.width * W, y:(e.clientY - r.top) / r.height * H };
}
cv.addEventListener('pointerdown', e => {
  audioKick(); ptrDown = true;
  const p = canvasXY(e);
  if(mode === 'run'){ DugiRun.pointer(p.y / H, true); return; }
  if(mode === 'mine'){ MineGame.pointer(p.x, p.y); return; }
  if(mode === 'lost'){ LostGame.pointer(p.x, p.y); return; }
  if(mode === 'pack'){ e.preventDefault(); PackGame.down(p.x, p.y); return; }
  if(mode === 'catch'){ e.preventDefault(); CatchMind.down(p.x, p.y); return; }
  if(mode === 'cut'){ advanceCut(); return; }
  if(mode === 'home'){
    if(mini && mini.kind === 'feed'){ miniClick(p.x, p.y); return; }
    homeDown(p.x, p.y); return;
  }
});
cv.addEventListener('pointermove', e => {
  if(mode === 'catch'){ const q = canvasXY(e); CatchMind.move(q.x, q.y, ptrDown); return; }
  if(mode === 'pack'){ const q = canvasXY(e); PackGame.move(q.x, q.y, ptrDown); return; }
  if(mode !== 'home') return;
  const p = canvasXY(e);
  homeMove(p.x, p.y, ptrDown);
});
cv.addEventListener('pointerup', e => {
  ptrDown = false;
  if(mode === 'run'){ DugiRun.pointer(0, false); return; }
  if(mode === 'catch'){ CatchMind.up(); return; }
  if(mode === 'pack'){ PackGame.up(); return; }
  if(mode === 'home') homeUp();
});
cv.addEventListener('pointercancel', e => {
  ptrDown = false;
  if(mode === 'catch'){ CatchMind.up(); return; }
  if(mode === 'pack'){ PackGame.up(); return; }
  if(mode === 'home') homeUp();
});

document.addEventListener('pointerdown', e => {
  audioKick();
  if(!e.target.closest('#menuPanel,#menuBtn')) toggleMenu(false);
  if(!e.target.closest('#condPanel,#condChip')) toggleCond(false);
  if(e.target.closest('button,.dcard,.shopcard,.jobcard,.tab,.photo')) uiClick();
}, true);
function audioKick(){
  initAudio();
  if(ctx.state === 'suspended') ctx.resume();
  if(mode === 'home' || mode === 'result' || mode === 'runresult' ||
     mode === 'mineresult' || mode === 'lostresult' ||
     mode === 'packresult' || mode === 'catchresult') bgmStart();
}

$('condChip').onclick = () => toggleCond();

/* ☰ — 설정·꾸미기·할 일·계정. 세계에 두기엔 애매한 '시스템' 메뉴만 모았습니다. */
function toggleMenu(force){
  const panel = $('menuPanel'), btn = $('menuBtn');
  const open = force === undefined ? panel.hidden : force;
  panel.hidden = !open;
  btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  btn.classList.toggle('on', open);
  if(open) paintMenu();
}
function paintMenu(){
  $('mDeco').textContent = deco ? '꾸미기 끝내기' : '꾸미기';
  $('mAcct').textContent = (typeof Auth !== 'undefined' && Auth.current()) ? '내 계정' : '로그인';
  $('mDaily').classList.toggle('dot', dailyLeft() > 0);
}
Plaza.onCount = n => { if(place === 'plaza') refreshBar(); };
$('menuBtn').onclick = () => toggleMenu();
$('mDaily').onclick = () => { toggleMenu(false); toggleDaily(); };
$('mDeco').onclick  = () => { toggleMenu(false); toggleDeco(); };
$('mAcct').onclick  = () => { toggleMenu(false); openAccount(); };
$('mSet').onclick   = () => { toggleMenu(false); openModal('settings'); };

/* 메뉴는 전부 사물에서 열립니다 (care.js 의 act 참고) */
function toggleDaily(){
  const p2 = $('dailyPanel');
  p2.hidden = !p2.hidden;
  paintDaily();
}
function toggleDeco(){
  if(place !== 'room'){ toast('집 안에서만 꾸밀 수 있어요', ''); return; }
  deco = !deco; mini = null;
  toast(deco ? '꾸미기 모드' : '꾸미기 끝',
        deco ? '가구를 끌어서 옮기세요 · 공구함을 다시 누르면 끝' : '자리를 저장했어요');
  if(!deco) save();
}
function openAccount(){
  if(Auth.current()) openModal('account'); else showAuth();
}
$('modalClose').onclick = closeModal;
modal.addEventListener('pointerdown', e => { if(e.target === modal) closeModal(); });
$('runAgain').onclick = () => {
  if(mode === 'mineresult') startMine();
  else if(mode === 'lostresult') startLost();
  else if(mode === 'packresult') startPack();
  else if(mode === 'catchresult') startCatch();
  else startRun();
};
$('runHome').onclick = () => goHome();
$('introGo').onclick = () => finishIntro();
$('introName').addEventListener('keydown', e => { if(e.key === 'Enter') finishIntro(); });
$('skipBtn').onclick = () => skipCut();
$('fsBtn').onclick = () => toggleFs();
$('miniClose').onclick = () => closeMini();
function toggleFs(){
  try{
    if(!document.fullscreenElement){
      const el = document.documentElement, r = el.requestFullscreen || el.webkitRequestFullscreen;
      if(r) Promise.resolve(r.call(el)).catch(() => {});
    }else if(document.exitFullscreen) document.exitFullscreen();
  }catch(e){}
}
document.addEventListener('fullscreenchange', () => {
  document.body.classList.toggle('fs', !!document.fullscreenElement); resize();
});
[['rJump', 'jump'], ['rSlide', 'slide'], ['rSkill', 'skill']].forEach(([id, k]) => {
  const el = $(id); if(!el) return;
  el.addEventListener('pointerdown', e => { e.preventDefault(); DugiRun.pad(k, true); });
  el.addEventListener('pointerup', () => DugiRun.pad(k, false));
  el.addEventListener('pointercancel', () => DugiRun.pad(k, false));
});

/* ===== 메인 루프 ===== */
/* 그리다 터진 횟수 — 시험이 이걸 보고 조용한 사고를 잡는다 */
const frameErr = { n: 0, last: '' };
function frame(ts){
  const dt = Math.min(0.05, (ts - last) / 1000); last = ts;
  FX.watch(dt);                      /* 느려지면 빛 효과를 스스로 끈다 */
  try{
    if(mode === 'cut' && cut){ drawCut(dt); }
    else if(mode === 'run' || mode === 'runresult'){ DugiRun.frame(dt, mode === 'run'); }
    else if(mode === 'mine' || mode === 'mineresult'){ MineGame.frame(dt, mode === 'mine'); }
    else if(mode === 'lost' || mode === 'lostresult'){ LostGame.frame(dt, mode === 'lost'); }
    else if(mode === 'pack' || mode === 'packresult'){ PackGame.frame(dt, mode === 'pack'); }
    else if(mode === 'catch' || mode === 'catchresult'){ CatchMind.frame(dt, mode === 'catch'); }
    else if(mode === 'cmlobby'){ g.fillStyle = '#F3EAE1'; g.fillRect(0, 0, W, H); }
    else { if(place === 'plaza') Plaza.tick(dt); updateHome(dt); drawHome(dt); }
    $('miniClose').hidden = !(mode === 'home' && mini);
  }catch(err){
    /* 한 번 삐끗해도 게임은 계속 돈다. 다만 조용히 넘기면 이런 사고가
       오래 숨어 있어서(실제로 뽑기 연출이 그랬다) 세어두고 처음 몇 번은 남긴다. */
    frameErr.n++;
    frameErr.last = String(err && err.message || err);
    if(frameErr.n <= 3) console.error('frame', err);
  }
  requestAnimationFrame(frame);
}

/* ===== 시작 ===== */
resize();
checkDaily();
if(S.named){
  const away = awayReport();
  goHome();
  if(away) setTimeout(() => showAway(away), 500);
}else askName();
refreshBar();
/* 창을 닫거나 탭을 옮길 때 시각을 적어둔다 */
function stampSeen(){ S.seen = Date.now(); save(); }
addEventListener('beforeunload', stampSeen);
document.addEventListener('visibilitychange', () => { if(document.hidden) stampSeen(); });
setInterval(stampSeen, 60000);
requestAnimationFrame(frame);

/* ===============================================================
   계정 화면 — 회원가입 · 로그인 · 클라우드 세이브 붙이기
   =============================================================== */
let authMode = 'login';
function authMsg(t, bad){
  const el = $('authErr');
  el.textContent = t || '';
  el.hidden = !t;
  el.classList.toggle('ok', !bad && !!t);
}
function setAuthMode(m){
  authMode = m;
  $('tabLogin').classList.toggle('on', m === 'login');
  $('tabJoin').classList.toggle('on', m === 'join');
  $('authGo').textContent = m === 'join' ? '가입하기' : '로그인';
  $('authPw').setAttribute('autocomplete', m === 'join' ? 'new-password' : 'current-password');
  $('pwHint').hidden = m !== 'join';
  authMsg('');
}
function showAuth(){
  mode = 'auth';
  showScreen($('authScreen'));
  $('topbar').hidden = true;
  $('authNote').textContent = Auth.enabled()
    ? '비밀번호는 이 게임이 저장하지 않아요. 인증 서버가 암호화해서 보관합니다.'
    : '서버가 아직 연결되지 않아 이 기기에만 저장됩니다 (js/config.js).';
  $('authForm').hidden = !Auth.enabled();
  $('authForgot').hidden = !Auth.enabled();
  setAuthMode('login');
  setTimeout(() => { try{ $('authEmail').focus(); }catch(e){} }, 150);
}
function leaveAuth(){
  if(S.named) goHome(); else askName();
}

$('tabLogin').onclick = () => setAuthMode('login');
$('tabJoin').onclick  = () => setAuthMode('join');
$('authSkip').onclick = () => { try{ localStorage.setItem('ggakdugi.local', '1'); }catch(e){} leaveAuth(); };
$('authForgot').onclick = async () => {
  const em = $('authEmail').value;
  if(Auth.checkEmail(em)){ authMsg('이메일을 먼저 적어주세요', true); return; }
  $('authForgot').disabled = true;
  try{ await Auth.resetPassword(em); }catch(e){}
  $('authForgot').disabled = false;
  authMsg('가입된 주소라면 재설정 메일을 보냈어요');
};
$('authForm').onsubmit = async e => {
  e.preventDefault();
  const btn = $('authGo');
  if(btn.disabled) return;
  const em = $('authEmail').value, pw = $('authPw').value;
  const keep = $('authKeep').checked;
  btn.disabled = true; authMsg('');
  try{
    if(authMode === 'join'){
      await Auth.signUp(em, pw);
      $('authPw').value = '';
      setAuthMode('login');
      authMsg('메일함을 확인해 인증을 끝내고 로그인해주세요');
    }else{
      await Auth.signIn(em, pw, keep);
      $('authPw').value = '';
      await mergeCloud();
      leaveAuth();
      toast('로그인했어요', Auth.current().email);
    }
  }catch(err){
    authMsg(String(err && err.message || '문제가 생겼어요'), true);
  }finally{
    btn.disabled = false;
  }
};

/* 서버 세이브와 이 기기 세이브 맞추기 */
async function mergeCloud(){
  let remote = null;
  try{ remote = await Auth.pull(); }catch(e){ return; }
  const localAt = S.seen || 0;
  if(!remote){ await Auth.push(S).catch(() => {}); return; }
  const pick = (remote.at > localAt + 60000 && remote.data.named)
    ? 'remote'
    : (S.named ? 'ask' : 'remote');
  if(pick === 'remote' || (pick === 'ask' && confirm(
        '서버에 더 최근 세이브가 있어요.\n서버 것으로 불러올까요?\n(취소하면 이 기기 것을 서버에 올립니다)'))){
    applyCloud(remote.data);
  }else{
    await Auth.push(S).catch(() => {});
  }
}
function applyCloud(data){
  const clean = Auth.sanitizeSave(data);
  if(!clean) return;
  Object.assign(S, clean);
  S.seen = Date.now();
  save(); relayout(); refreshBar(); paintDaily();
}

/* 저장할 때마다 서버에도 (너무 자주 올리지 않게 모아서) */
const _saveLocal = save;
save = function(){ _saveLocal(); if(Auth.enabled() && Auth.current()) Auth.pushLater(S); };

/* 로그인 상태가 바뀌면 상단바를 다시 그린다 */
Auth.onChange(() => { try{ refreshBar(); paintMenu(); }catch(e){} });

/* 페이지를 열 때: 저장된 세션이 있으면 조용히 이어서 로그인 */
(async function bootAuth(){
  if(!Auth.enabled()) return;
  const u = await Auth.ready();
  if(u){ try{ await mergeCloud(); }catch(e){} }
  else if(!S.named && !localStorage.getItem('ggakdugi.local')) showAuth();
})();
