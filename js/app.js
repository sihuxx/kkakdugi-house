"use strict";
/* 셸 — 화면 전환·입력·루프 — 꺅두기 하우스 */

/* ===============================================================
   셸 — 화면 전환 · 입력 · 메인 루프
   =============================================================== */
let mode = 'home';          // home · play · pause · result · cut · run · runresult · cafe · caferesult
let last = performance.now();

function showScreen(el){
  [$('introScreen'), $('resultScreen'), $('runResult'), $('pauseScreen')]
    .forEach(s => { if(s) s.hidden = s !== el; });
  $('pauseBtn').hidden = !(mode === 'play');
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
  DugiRun.start({ look: look(), course: S.course, onEnd: runEnd });
}
function runEnd(r){
  mode = 'runresult';
  $('runPad').hidden = true;
  const co = COURSE(S.course), before = S.career.deliver || 0;
  const pay = Math.round((r.jelly * 3.6 + r.dist / 110 + (r.cleared ? 90 + r.hp * 45 : 0))
                         * co.pay * payMult('deliver'));
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
  payOut(pay, 'deliver', 'runReward', co.name);
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
  const pay = Math.round((r.score / 9 + r.tip * 12 + 40) * payMult('cafe'));
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

/* ===== 처음 시작 ===== */
function askName(){
  showScreen($('introScreen'));
  $('introName').value = S.dugi.name;
  $('topbar').hidden = true; $('careBar').hidden = true;
  setTimeout(() => $('introName').focus(), 200);
}
function finishIntro(){
  const v = ($('introName').value || '').trim().slice(0, 6) || '두기';
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
  if(keyWait >= 0 && modalOpen === 'settings'){
    e.preventDefault();
    if(e.code !== 'Escape'){ settings.keys[keyWait] = e.code; save(); }
    keyWait = -1; openModal('settings'); return;
  }
  if(mode === 'play' && !modalOpen){
    const ln = laneOfCode(e.code);
    if(ln !== undefined){ e.preventDefault(); laneHold[ln] = true; hit(ln); return; }
  }
  if(e.code === 'Escape'){
    if(modalOpen) closeModal();
    else if(mode === 'play') pause();
    else if(mode === 'pause') resumePlay();
  }
});
addEventListener('keyup', e => {
  if(mode === 'run'){ DugiRun.key(e.code, false); return; }
  if(KMAP[e.code]) keys[KMAP[e.code]] = false;
  const ln = laneOfCode(e.code); if(ln !== undefined) laneHold[ln] = false;
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
  if(mode === 'cut'){ advanceCut(); return; }
  if(mode === 'home'){
    if(mini && mini.kind === 'feed'){ miniClick(p.x, p.y); return; }
    homeDown(p.x, p.y); return;
  }
  if(mode !== 'play') return;
  const ln = Math.max(0, Math.min(3, Math.floor((p.x - fieldX()) / laneW())));
  touchLane[e.pointerId] = ln; laneHold[ln] = true; hit(ln);
});
cv.addEventListener('pointermove', e => {
  if(mode !== 'home') return;
  const p = canvasXY(e);
  homeMove(p.x, p.y, ptrDown);
});
cv.addEventListener('pointerup', e => {
  ptrDown = false;
  if(mode === 'run'){ DugiRun.pointer(0, false); return; }
  if(mode === 'home'){ homeUp(); return; }
  const ln = touchLane[e.pointerId];
  if(ln !== undefined){ laneHold[ln] = false; delete touchLane[e.pointerId]; }
});
cv.addEventListener('pointercancel', e => {
  ptrDown = false;
  if(mode === 'home'){ homeUp(); return; }
  const ln = touchLane[e.pointerId];
  if(ln !== undefined){ laneHold[ln] = false; delete touchLane[e.pointerId]; }
});
document.addEventListener('visibilitychange', () => { if(document.hidden && mode === 'play') pause(); });

document.addEventListener('pointerdown', e => {
  audioKick();
  if(e.target.closest('button,.songrow,.dcard,.lv,.cover,.sinfo,.shopcard,.jobcard,.tab')) uiClick();
}, true);
function audioKick(){
  initAudio();
  if(mode !== 'pause' && !cdTimer && ctx.state === 'suspended') ctx.resume();
  if(mode === 'home' || mode === 'result' || mode === 'runresult' || mode === 'caferesult') bgmStart();
}

/* 버튼 */
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
$('pauseBtn').onclick = () => pause();
$('resumeBtn').onclick = () => resumePlay();
$('quitBtn').onclick = () => quitPlay();
$('againBtn').onclick = () => startGame();
$('homeBtn').onclick = () => goHome();
$('runAgain').onclick = () => { if(mode === 'caferesult') startCafe(); else startRun(); };
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
    else if(mode === 'play' || mode === 'pause' || mode === 'result'){ stepPlay(dt, ts); }
    else { updateHome(dt); drawHome(dt); }
    $('miniClose').hidden = !(mode === 'home' && mini);
  }catch(err){
    console.error('frame', err);            // 한 번 삐끗해도 게임은 계속 돈다
  }
  requestAnimationFrame(frame);
}

/* ===== 시작 ===== */
seedScenery();
resize();
applySkin();
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
