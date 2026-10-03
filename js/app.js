"use strict";
/* 셸 — 화면 전환·입력·루프 — 꺅두기 하우스 */

/* ===============================================================
   셸 — 화면 전환 · 입력 · 메인 루프
   =============================================================== */
let mode = 'home';          // home · auth · cut · run · runresult · cafe · caferesult
                            // · cmlobby · catch · catchresult
let last = performance.now();

function showScreen(el){
  [$('introScreen'), $('authScreen'), $('runResult'), $('cmLobby')]
    .forEach(s => { if(s) s.hidden = s !== el; });
  $('careBar').hidden = !(mode === 'home' && place === 'room' && !el && !mini && !deco);
}

/* ===== 위쪽 상태바 ===== */
function refreshBar(){
  const d = S.dugi, lv = loveLv(d.love);
  $('barClover').innerHTML = CLOVER_SVG + '<b>' + S.clover.toLocaleString('ko-KR') + '</b>';
  $('barName').textContent = d.name;
  $('barStage').textContent = '마음 Lv' + lv;
  $('barLook').textContent = look().name;
  $('barHouse').textContent = HOUSE().name;
  const wx = WEATHER(), dp = DAY();
  const wxEl = $('barWx');
  if(wxEl) wxEl.innerHTML = '<i class="wx wx-' + wx.id + '"></i>' + wx.name + ' · ' + dp.name;
  $('expFill').style.width = Math.round(loveProg(d.love) * 100) + '%';
  $('expCap').textContent = lv >= LOVE_MAX ? '최고 단짝!' : ('다음 레벨까지 ' + Math.ceil(loveNext(d.love)));
  const gb = $('gachaBtn');
  if(gb) gb.classList.toggle('alert', typeof freeLeft === 'function' && freeLeft());
  const hearts = Math.min(5, Math.round(lv / 2));
  $('loveHearts').innerHTML = [0,1,2,3,4].map(i => '<i class="' + (i < hearts ? 'on' : '') + '">♥</i>').join('');
  STATS.forEach(s => {
    const bar = $('st_' + s.id);
    if(!bar) return;
    bar.style.width = Math.round(d[s.id]) + '%';
    bar.parentElement.parentElement.classList.toggle('low', d[s.id] < 30);
  });
}

function goHome(){
  const wasOut = (place === 'yard');
  place = 'room';
  mode = 'home'; deco = false; mini = null;
  showScreen(null);
  $('topbar').hidden = false; $('runPad').hidden = true;
  $('cmPanel').hidden = true;
  try{ if(typeof Net !== 'undefined' && Net.roomCode()) Net.leave(); }catch(e){}
  $('skipBtn').hidden = true; $('tapHint').hidden = true;
  $('decoBtn').classList.remove('on'); $('decoBtn').disabled = false;
  if(wasOut){ home.x = LAY.door.x; home.y = 0.22; home.target = null; home.vx = home.vy = 0; }
  checkDaily(); rollGuest(); seedWeather(); seedDust();
  relayout(); refreshBar(); paintCareBar(); paintDaily(); bgmStart();
}

/* ===== 정원으로 나가기 ===== */
function goYard(){
  place = 'yard';
  mode = 'home'; deco = false; mini = null;
  closeModal(); showScreen(null);
  $('topbar').hidden = false; $('runPad').hidden = true;
  $('careBar').hidden = true;
  $('decoBtn').classList.remove('on'); $('decoBtn').disabled = true;
  $('dailyPanel').hidden = true;
  home.x = 0.12; home.y = 0.28; home.target = null; home.autoAct = null;
  home.vx = home.vy = 0; home.act = null; home.sweep = false;
  home.ball.home = true; home.aim = null;
  toast('정원으로 나왔어요', '가게 · 뽑기 · 알바 게시판이 있어요');
  refreshBar();
}

/* ===== 배달 알바 ===== */
function startRun(){
  closeModal(); initAudio(); bgmStop();
  if(ctx && ctx.state === 'suspended') ctx.resume();
  mode = 'run'; $('topbar').hidden = true; $('careBar').hidden = true; showScreen(null);
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
  $('rDist').textContent = Math.floor(r.dist / 10) + ' m';
  $('rJelly').textContent = r.jelly + ' / ' + r.total;
  $('rCombo').textContent = r.combo;
  $('rGrade').textContent = grade;
  if(r.score > (S.runBest || 0)){ S.runBest = Math.round(r.score); $('runBest').textContent = '새 기록!'; }
  else $('runBest').textContent = '최고 기록 ' + (S.runBest || 0).toLocaleString('ko-KR');
  payOut(pay, 'deliver', 'runReward', '배달 알바');
  careerUp('deliver', before);
  showScreen($('runResult'));
  bgmStart();
}

/* ===== 카페 알바 ===== */
function startCafe(){
  closeModal(); initAudio(); bgmStop();
  if(ctx && ctx.state === 'suspended') ctx.resume();
  mode = 'cafe'; $('topbar').hidden = true; $('careBar').hidden = true; showScreen(null);
  CafeGame.start({ onEnd: cafeEnd });
}
function cafeEnd(r){
  mode = 'caferesult';
  const before = S.career.cafe || 0;
  const pay = Math.round((r.score / 8 + r.tip * 17 + 90) * payMult('cafe'));
  $('runTitle').textContent = r.rounds >= 5 ? '오늘도 수고!' : '조금 아쉬워요';
  $('runArt').src = SRC[look().run];
  $('runScore').textContent = Math.round(r.score).toLocaleString('ko-KR');
  $('rDist').textContent = r.rounds + '명';
  $('rJelly').textContent = r.tip + '잔';
  $('rCombo').textContent = 3 - r.miss + ' / 3';
  $('rGrade').textContent = r.rounds >= 7 ? 'S' : r.rounds >= 5 ? 'A' : r.rounds >= 3 ? 'B' : 'C';
  if(r.score > (S.cafeBest || 0)){ S.cafeBest = Math.round(r.score); $('runBest').textContent = '새 기록!'; }
  else $('runBest').textContent = '최고 기록 ' + (S.cafeBest || 0).toLocaleString('ko-KR');
  $('runAgain').textContent = '한 번 더';
  payOut(pay, 'cafe', 'runReward', '카페 알바');
  careerUp('cafe', before);
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
  $('topbar').hidden = true; $('careBar').hidden = true; $('runPad').hidden = true;
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
    $('topbar').hidden = true; $('careBar').hidden = true;
    $('cmPanel').hidden = false;
    CatchMind.layout();
    CatchMind.enter({ name: S.dugi.name, look: S.look, onEnd: catchEnd });
  });
}
function catchEnd(r){
  $('cmPanel').hidden = true;
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
  $('rDist').textContent = r.rank + ' / ' + r.total + '등';
  $('rJelly').textContent = r.total + '명';
  $('rCombo').textContent = (r.board[0] ? r.board[0].name : '-');
  $('rGrade').textContent = r.rank === 1 ? 'S' : r.rank <= Math.ceil(r.total / 2) ? 'A' : 'B';
  if(score > (S.drawBest || 0)){ S.drawBest = score; $('runBest').textContent = '새 기록!'; }
  else $('runBest').textContent = '최고 점수 ' + (S.drawBest || 0).toLocaleString('ko-KR');
  $('runAgain').textContent = '한 번 더';
  payOut(pay, 'draw', 'runReward', '두기 캐치마인드');
  careerUp('draw', before);
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

/* ===== 처음 시작 ===== */
function askName(){
  showScreen($('introScreen'));
  $('introName').value = S.dugi.name;
  $('topbar').hidden = true; $('careBar').hidden = true;
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
  const btn = $('dailyBtn');
  if(btn) btn.classList.toggle('alert', left > 0);
}

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
  if(mode === 'cafe'){
    if(e.code === 'Escape'){ CafeGame.quit(); return; }
    CafeGame.key(e.code); return;
  }
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
  if(mode === 'cafe'){ CafeGame.pointer(p.x, p.y); return; }
  if(mode === 'catch'){ e.preventDefault(); CatchMind.down(p.x, p.y); return; }
  if(mode === 'cut'){ advanceCut(); return; }
  if(mode === 'home'){
    if(mini && mini.kind === 'feed'){ miniClick(p.x, p.y); return; }
    homeDown(p.x, p.y); return;
  }
});
cv.addEventListener('pointermove', e => {
  if(mode === 'catch'){ const q = canvasXY(e); CatchMind.move(q.x, q.y, ptrDown); return; }
  if(mode !== 'home') return;
  const p = canvasXY(e);
  homeMove(p.x, p.y, ptrDown);
});
cv.addEventListener('pointerup', e => {
  ptrDown = false;
  if(mode === 'run'){ DugiRun.pointer(0, false); return; }
  if(mode === 'catch'){ CatchMind.up(); return; }
  if(mode === 'home') homeUp();
});
cv.addEventListener('pointercancel', e => {
  ptrDown = false;
  if(mode === 'catch'){ CatchMind.up(); return; }
  if(mode === 'home') homeUp();
});

document.addEventListener('pointerdown', e => {
  audioKick();
  if(e.target.closest('button,.dcard,.shopcard,.jobcard,.tab,.photo')) uiClick();
}, true);
function audioKick(){
  initAudio();
  if(ctx.state === 'suspended') ctx.resume();
  if(mode === 'home' || mode === 'result' || mode === 'runresult' ||
     mode === 'caferesult' || mode === 'catchresult') bgmStart();
}

/* 버튼 */
$('gachaBtn').onclick = () => openModal('gacha');
$('shopBtn').onclick = () => openModal('shop');
$('dexBtn').onclick  = () => openModal('wardrobe');
$('setBtn').onclick  = () => openModal('settings');
$('outBtn').onclick  = () => openModal('job');
$('albumBtn').onclick = () => openModal('album');
$('dailyBtn').onclick = () => { $('dailyPanel').hidden = !$('dailyPanel').hidden; paintDaily(); };
$('decoBtn').onclick = () => {
  if(place !== 'room'){ toast('집 안에서만 꾸밀 수 있어요', ''); return; }
  deco = !deco; mini = null;
  $('decoBtn').classList.toggle('on', deco);
  $('careBar').hidden = deco || mode !== 'home' || place !== 'room';
  toast(deco ? '꾸미기 모드' : '꾸미기 끝', deco ? '가구를 끌어서 옮기세요' : '자리를 저장했어요');
  if(!deco) save();
};
$('modalClose').onclick = closeModal;
modal.addEventListener('pointerdown', e => { if(e.target === modal) closeModal(); });
$('runAgain').onclick = () => {
  if(mode === 'caferesult') startCafe();
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
function frame(ts){
  const dt = Math.min(0.05, (ts - last) / 1000); last = ts;
  try{
    if(mode === 'cut' && cut){ drawCut(dt); }
    else if(mode === 'run' || mode === 'runresult'){ DugiRun.frame(dt, mode === 'run'); }
    else if(mode === 'cafe' || mode === 'caferesult'){ CafeGame.frame(dt, mode === 'cafe'); }
    else if(mode === 'catch' || mode === 'catchresult'){ CatchMind.frame(dt, mode === 'catch'); }
    else if(mode === 'cmlobby'){ g.fillStyle = '#F3EAE1'; g.fillRect(0, 0, W, H); }
    else { updateHome(dt); drawHome(dt); }
    $('miniClose').hidden = !(mode === 'home' && mini);
  }catch(err){
    console.error('frame', err);            // 한 번 삐끗해도 게임은 계속 돈다
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
  $('topbar').hidden = true; $('careBar').hidden = true;
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
$('acctBtn').onclick  = () => {
  if(Auth.current()) openModal('account'); else showAuth();
};
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
  save(); relayout(); refreshBar(); paintCareBar(); paintDaily();
}

/* 저장할 때마다 서버에도 (너무 자주 올리지 않게 모아서) */
const _saveLocal = save;
save = function(){ _saveLocal(); if(Auth.enabled() && Auth.current()) Auth.pushLater(S); };

/* 로그인 상태가 바뀌면 상단바 버튼 모양도 바꾼다 */
Auth.onChange(u => {
  const b = $('acctBtn');
  if(b) b.textContent = u ? '내 계정' : '로그인';
});

/* 페이지를 열 때: 저장된 세션이 있으면 조용히 이어서 로그인 */
(async function bootAuth(){
  if(!Auth.enabled()) return;
  const u = await Auth.ready();
  if(u){ try{ await mergeCloud(); }catch(e){} }
  else if(!S.named && !localStorage.getItem('ggakdugi.local')) showAuth();
})();
