"use strict";
/* 모달 — 옷장·상점·뽑기·설정 — 꺅두기 하우스 */

/* ===============================================================
   모달 — 옷장 · 상점 · 뽑기 · 도감 · 설정 · 외출
   =============================================================== */
let modalOpen = null;
const CLOVER_SVG = '<svg class="cv" viewBox="0 0 20 20" aria-hidden="true">' +
  '<g fill="#8FBF92" stroke="#5A4A40" stroke-width="1.6">' +
  '<circle cx="10" cy="5.6" r="3.5"/><circle cx="14.4" cy="10" r="3.5"/>' +
  '<circle cx="10" cy="14.4" r="3.5"/><circle cx="5.6" cy="10" r="3.5"/></g>' +
  '<path d="M10 11 L10 19" stroke="#8FBF92" stroke-width="1.8" fill="none"/></svg>';
const STARS = { base:1, N:1, R:2, SR:3, UR:4 };
const starRow = rk => '<span class="stars">' + '★'.repeat(STARS[rk]) + '</span>';
let freshIds = new Set();

/* ===== 뽑기 로직 ===== */
const PULL1 = 110, PULL10 = 1000;
/* 겹침 환급 — 뽑기 값(1회 100~110)보다 확실히 낮게.
   예전엔 기댓값이 132 라서 뽑을수록 클로버가 늘어났습니다.
   그러면 알바를 할 이유도, 아껴 쓸 이유도 사라져요. 지금은 기댓값 약 30. */
const REFUND = { N:18, R:45, SR:140, UR:400 };
/* 전설·진귀는 정말 안 나옵니다. 대신 천장이 있으니 언젠가는 옵니다. */
const RATE = [['N', 75], ['R', 21], ['SR', 3.4], ['UR', 0.6]];
const PITY_SR = 100, PITY_UR = 320;                 /* 천장 */
const POOL = rk => CHARS.filter(c => c.rank === rk);
function rollRank(force){
  if(force) return force;
  let r = Math.random() * 100;
  for(const [rk, p] of RATE){ if(r < p) return rk; r -= p; }
  return 'N';
}
function freeLeft(){ return S.freeDay !== today(); }
function pull(n, free){
  const cost = free ? 0 : (n === 10 ? PULL10 : PULL1);
  if(S.clover < cost) return null;
  if(free){ S.freeDay = today(); }
  addClover(-cost);
  const got = [];
  for(let i = 0; i < n; i++){
    const force = (n === 10 && i === 9 && !got.some(x => x.rank !== 'N')) ? 'R' : null;
    let rk = rollRank(force);
    /* 천장 — 90번 안에 진귀 이상, 250번 안에 전설 */
    S.pityU = (rk === 'UR') ? 0 : (S.pityU || 0) + 1;
    S.pity  = (rk === 'SR' || rk === 'UR') ? 0 : S.pity + 1;
    if(S.pityU >= PITY_UR){ rk = 'UR'; S.pity = S.pityU = 0; }
    else if(S.pity >= PITY_SR){ rk = 'SR'; S.pity = 0; }
    const pool = POOL(rk), c = pool[Math.floor(Math.random() * pool.length)];
    const isNew = !owns(c.id);
    if(isNew){ S.own.push(c.id); freshIds.add(c.id); }
    else addClover(REFUND[rk] || 30);
    got.push({ c, rank: rk, isNew, refund: isNew ? 0 : (REFUND[rk] || 30) });
  }
  addExp(5 * n);                              /* 뽑기도 함께 자란다 */
  checkRewards(); save(); refreshBar();
  return got;
}

/* ===== 카드 ===== */
function dexCard(c2, onPick){
  const has = owns(c2.id), isNew = freshIds.has(c2.id);
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'dcard r-' + c2.rank + (has ? '' : ' locked') + (c2.id === S.look ? ' sel' : '');
  b.innerHTML = starRow(c2.rank) +
    (isNew ? '<span class="newbadge">NEW</span>' : '') +
    '<span class="art"><img alt="" src="' + SRC[c2.run] + '"></span>' +
    '<span class="nm">' + (has ? c2.name : '???') + '</span>' +
    '<span class="meta">' + (has ? c2.meta : RARITY[c2.rank].name) + '</span>';
  b.onclick = () => { freshIds.delete(c2.id); (onPick || openLookDetail)(c2); };
  return b;
}
function buildDex(body, onPick){
  const bar = document.createElement('div'); bar.className = 'dexbar';
  const nx = nextReward(), pct = Math.round(S.own.length / CHARS.length * 100);
  bar.innerHTML = '<div class="track"><div class="fill" style="width:' + pct + '%"></div></div>' +
    '<div class="cap"><span><b>' + S.own.length + '</b> / ' + CHARS.length + ' 종</span>' +
    '<span>' + (nx ? '다음 보상 — ' + nx.n + '종에서 ' + nx.txt : '보상 전부 받음!') + '</span></div>';
  body.appendChild(bar);
  const wrap = document.createElement('div'); wrap.className = 'dex';
  ['base', 'UR', 'SR', 'R', 'N'].forEach(rk => {
    const list = CHARS.filter(x => x.rank === rk), soon = COMING.filter(x => x.rank === rk);
    if(!list.length && !soon.length) return;
    const grp = document.createElement('div'); grp.className = 'rgroup';
    const have = list.filter(x => owns(x.id)).length;
    grp.innerHTML = '<div class="rlabel"><i style="background:' + RARITY[rk].color + '"></i>' +
      '<b>' + RARITY[rk].name + '</b> ' + starRow(rk) +
      '<span>' + (list.length ? have + '/' + list.length + ' · ' : '') + RARITY[rk].note + '</span></div>';
    const row = document.createElement('div'); row.className = 'dexrow';
    list.forEach(c2 => row.appendChild(dexCard(c2, onPick)));
    soon.forEach(s => {
      const d = document.createElement('div'); d.className = 'dcard r-' + rk + ' soon';
      d.innerHTML = starRow(rk) + '<span class="art"><b>3D</b></span>' +
        '<span class="nm">' + s.name + '</span><span class="meta">준비 중</span>';
      row.appendChild(d);
    });
    grp.appendChild(row); wrap.appendChild(grp);
  });
  body.appendChild(wrap);
}

/* ===== 모습 상세 ===== */
function openLookDetail(c2){
  modalOpen = 'wardrobe';
  const body = $('modalBody'); body.innerHTML = '';
  $('modalTitle').textContent = '두기 모습';
  $('modalHint').textContent = '';
  $('modalClose').hidden = true;
  const has = owns(c2.id), R = RARITY[c2.rank];
  const d = document.createElement('div'); d.className = 'detail';
  d.innerHTML =
    '<div class="art" style="background:' + R.color + '44"><i></i>' +
      '<img alt="" src="' + SRC[c2.run] + '"' + (has ? '' : ' style="filter:brightness(0);opacity:.2"') + '></div>' +
    '<div class="info">' +
      '<span class="rk" style="background:' + R.color + '">' + starRow(c2.rank) + ' ' + R.name + '</span>' +
      '<h3>' + (has ? c2.name : '??? 두기') + '</h3>' +
      '<p class="desc">' + (has ? c2.meta : '아직 만나지 못한 모습이에요.') + '</p>' +
      '<div class="facts">' +
        '<span>뽑기 확률 <b>' + (c2.p ? c2.p + '%' : '기본 보유') + '</b></span>' +
        '<span>배달 스킬 <b>' + skillOf(c2).name + '</b></span>' +
        '<span>보유 <b>' + (has ? '가지고 있음' : '없음') + '</b></span>' +
      '</div><div class="row"></div></div>';
  body.appendChild(d);
  const row = d.querySelector('.row');
  if(has){
    const pick = document.createElement('button');
    pick.className = 'btn'; pick.type = 'button';
    pick.textContent = S.look === c2.id ? '지금 이 모습이에요' : '이 모습으로 갈아입기';
    pick.disabled = S.look === c2.id;
    pick.onclick = () => { S.look = c2.id; save(); refreshBar(); toast('갈아입었어요', c2.name); closeModal(); };
    row.appendChild(pick);
  }
  const back = document.createElement('button');
  back.className = 'btn ghost small'; back.type = 'button'; back.textContent = '옷장으로';
  back.onclick = () => openModal('wardrobe');
  row.appendChild(back);
}

/* ===== 상점 ===== */
let shopTab = 'furn';
function buildShop(body){
  const top = document.createElement('div'); top.className = 'gtop';
  top.innerHTML = CLOVER_SVG + '<b>' + S.clover.toLocaleString('ko-KR') + '</b>' +
    '<span>집을 넓히고 가구로 꾸며요</span>';
  body.appendChild(top);

  const tabs = document.createElement('div'); tabs.className = 'tabs';
  [['furn', '가구'], ['item', '소모품'], ['room', '벽지·바닥'], ['house', '이사']].forEach(([id, nm]) => {
    const b2 = document.createElement('button');
    b2.type = 'button'; b2.className = 'tab' + (shopTab === id ? ' on' : '');
    b2.textContent = nm;
    b2.onclick = () => { shopTab = id; openModal('shop'); };
    tabs.appendChild(b2);
  });
  body.appendChild(tabs);

  if(shopTab === 'house') return buildHouseTab(body);
  if(shopTab === 'item')  return buildItemTab(body);
  if(shopTab === 'room')  return buildRoomTab(body);

  const grid = document.createElement('div'); grid.className = 'shopgrid'; body.appendChild(grid);
  FURNITURE.filter(f => !f.base && !f.lock).forEach(f => {
    const has = hasFurn(f.id);
    const locked = (f.need || 0) > (S.house || 0);
    const full = !has && !locked && S.furn.length >= HOUSE().slots;
    const b2 = document.createElement('button');
    b2.type = 'button';
    b2.className = 'shopcard' + (has ? ' own' : '') + (locked ? ' locked' : '') +
                   (S.clover < f.price && !has && !locked ? ' poor' : '');
    b2.innerHTML = '<span class="pic"><canvas width="96" height="96"></canvas></span>' +
      '<span class="nm">' + f.name + '</span>' +
      '<span class="meta">' + (locked ? HOUSES[f.need].name + '부터' : f.desc) +
      '<br><i>' + ZONE_NAME[f.zone] + (f.on === 'wall' ? ' 벽' : '') + '</i></span>' +
      '<span class="price">' + (has ? '가지고 있음' : locked ? '🔒' : CLOVER_SVG + f.price) + '</span>';
    grid.appendChild(b2);
    drawFurnIcon(b2.querySelector('canvas'), f.id);
    b2.onclick = () => {
      if(has){ toast('이미 집에 있어요', f.name); return; }
      if(locked){ sfxNo(); toast('집이 좁아요', HOUSES[f.need].name + '으로 이사하면 놓을 수 있어요'); return; }
      if(full){ sfxNo(); toast('자리가 없어요', '이사하면 자리가 늘어나요'); return; }
      if(S.clover < f.price){ sfxNo(); toast('클로버가 모자라요', '알바해서 벌어보세요'); return; }
      addClover(-f.price); S.furn.push(f.id); save(); relayout(); refreshBar(); sfxCoin(3);
      checkAchieve();
      toast(f.name + ' 구입!', ZONE_NAME[f.zone] + '에 놓았어요');
      openModal('shop');
    };
  });
  const cap = document.createElement('p'); cap.className = 'hint';
  cap.textContent = '가구 자리 ' + S.furn.length + ' / ' + HOUSE().slots + '칸 · 위쪽 꾸미기 버튼으로 자리를 옮길 수 있어요';
  body.appendChild(cap);
}
function buildHouseTab(body){
  const cur = HOUSE(), nxt = HOUSES[(S.house || 0) + 1];
  const hs = document.createElement('div'); hs.className = 'house';
  hs.innerHTML = '<canvas width="192" height="144"></canvas>' +
    '<div class="info"><b>' + (nxt ? nxt.name + '으로 이사' : cur.name) + '</b>' +
    '<span>' + (nxt ? nxt.note : '더 좋은 집은 아직 없어요') + '</span>' +
    '<span class="now">지금 · ' + cur.name + ' · 가구 자리 ' + cur.slots + '칸</span>' +
    '<div class="housesteps">' + HOUSES.map((h, i) =>
        '<i class="' + (i <= (S.house || 0) ? 'on' : '') + '"></i>').join('') + '</div></div>';
  body.appendChild(hs);
  drawHouseIcon(hs.querySelector('canvas'), nxt ? (S.house || 0) + 1 : (S.house || 0));
  if(nxt){
    const b2 = document.createElement('button');
    b2.className = 'btn small'; b2.type = 'button';
    b2.innerHTML = '이사 · ' + nxt.price.toLocaleString('ko-KR');
    b2.onclick = () => { if(upgradeHouse()){ relayout(); refreshBar(); openModal('shop'); } };
    hs.appendChild(b2);
  }
}
function buildItemTab(body){
  const grid = document.createElement('div'); grid.className = 'shopgrid'; body.appendChild(grid);
  ITEMS.forEach(it => {
    const have = S.bag[it.id] || 0;
    const b2 = document.createElement('button');
    b2.type = 'button'; b2.className = 'shopcard' + (S.clover < it.price ? ' poor' : '');
    b2.innerHTML = '<span class="pic"><canvas width="96" height="96"></canvas></span>' +
      '<span class="nm">' + it.name + (have ? ' ×' + have : '') + '</span>' +
      '<span class="meta">' + it.use + '</span>' +
      '<span class="price">' + CLOVER_SVG + it.price + '</span>';
    grid.appendChild(b2);
    drawItemIcon(b2.querySelector('canvas'), it.id);
    b2.onclick = () => {
      if(S.clover < it.price){ sfxNo(); toast('클로버가 모자라요', ''); return; }
      addClover(-it.price); S.bag[it.id] = (S.bag[it.id] || 0) + 1; save(); refreshBar(); sfxCoin(2);
      toast(it.name + ' 구입!', '가방에 넣었어요');
      openModal('shop');
    };
  });
  const use = document.createElement('div'); use.className = 'bagrow';
  const owned = Object.keys(S.bag).filter(k => S.bag[k] > 0);
  use.innerHTML = '<b>가방</b>' + (owned.length ? '' : '<span>아직 비어 있어요</span>');
  owned.forEach(id => {
    const it = ITEM(id); if(!it) return;
    const b2 = document.createElement('button');
    b2.className = 'btn ghost small'; b2.type = 'button';
    b2.textContent = it.name + ' 쓰기 (' + S.bag[id] + ')';
    b2.onclick = () => {
      for(const k in it.add) addStat(k, it.add[k]);
      addLove(it.love || 2);
      S.bag[id]--; if(!S.bag[id]) delete S.bag[id];
      save(); refreshBar(); sfxCare('feed');
      toast(it.name + ' 사용!', it.use);
      openModal('shop');
    };
    use.appendChild(b2);
  });
  body.appendChild(use);
}
function buildRoomTab(body){
  const mk = (list, ownList, cur, setter, label) => {
    const h = document.createElement('p'); h.className = 'hint'; h.textContent = label;
    body.appendChild(h);
    const grid = document.createElement('div'); grid.className = 'shopgrid'; body.appendChild(grid);
    list.forEach(w => {
      const has = ownList.includes(w.id);
      const b2 = document.createElement('button');
      b2.type = 'button';
      b2.className = 'shopcard' + (has ? ' own' : '') + (cur === w.id ? ' sel' : '');
      b2.innerHTML = '<span class="swatchbig" style="background:linear-gradient(' + w.a + ',' + w.b + ')"></span>' +
        '<span class="nm">' + w.name + '</span>' +
        '<span class="price">' + (has ? (cur === w.id ? '사용 중' : '고르기') : CLOVER_SVG + w.price) + '</span>';
      grid.appendChild(b2);
      b2.onclick = () => {
        if(!has){
          if(S.clover < w.price){ sfxNo(); toast('클로버가 모자라요', ''); return; }
          addClover(-w.price); ownList.push(w.id); sfxCoin(2);
        }
        setter(w.id); save(); refreshBar(); openModal('shop');
      };
    });
  };
  mk(WALLS, S.walls, S.wall, id => S.wall = id, '벽지');
  mk(FLOORS, S.floors, S.floor, id => S.floor = id, '바닥');
}
function drawItemIcon(cvs, id){
  const c = cvs.getContext('2d'), sw = cvs.width, sh = cvs.height;
  const og = g, oW = W, oH = H; g = c; W = sw; H = sh;
  c.clearRect(0, 0, sw, sh); ink(3.2);
  const cx = sw / 2, cy = sh * 0.56, r = sh * 0.24;
  if(id === 'snack'){ g.fillStyle = '#F6C88B'; rrect(cx - r, cy - r * 0.7, r * 2, r * 1.4, r * 0.4);
    g.fill(); g.stroke(); g.fillStyle = '#C9784F';
    [[-0.4, -0.1], [0.3, 0.2], [0, -0.35]].forEach(([a, b2]) => {
      g.beginPath(); g.arc(cx + a * r, cy + b2 * r, r * 0.16, 0, 7); g.fill(); }); }
  else if(id === 'soap'){ g.fillStyle = '#8FC0D8'; rrect(cx - r, cy - r * 0.6, r * 2, r * 1.2, r * 0.3);
    g.fill(); g.stroke(); g.fillStyle = '#FFFFFF';
    [[-0.6, -1.1, 0.3], [0.1, -1.4, 0.24], [0.6, -1.0, 0.2]].forEach(([a, b2, rr]) => {
      g.beginPath(); g.arc(cx + a * r, cy + b2 * r, r * rr, 0, 7); g.fill(); g.stroke(); }); }
  else if(id === 'toy'){ g.fillStyle = '#EFA6B8'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); g.stroke();
    g.fillStyle = '#FFF8F0'; g.beginPath(); g.arc(cx - r * 0.3, cy - r * 0.3, r * 0.22, 0, 7); g.fill(); }
  else { g.fillStyle = '#E8DFF5'; rrect(cx - r * 1.1, cy - r * 0.6, r * 2.2, r * 1.2, r * 0.5);
    g.fill(); g.stroke(); }
  g = og; W = oW; H = oH;
}

/* 작은 캔버스에 집 그리기 */
function drawHouseIcon(cvs, level){
  const c = cvs.getContext('2d'), sw = cvs.width, sh = cvs.height;
  const og = g, oW = W, oH = H;
  g = c; W = sw; H = sh;
  c.clearRect(0, 0, sw, sh);
  const h = HOUSES[level] || HOUSES[0];
  const bw = sw * (0.42 + level * 0.16), bh = sh * 0.52, bx = sw / 2 - bw / 2, by = sh * 0.9 - bh;
  ink(3);
  g.fillStyle = h.wall; rrect(bx, by, bw, bh, 6); g.fill(); g.stroke();      // 몸통
  g.fillStyle = h.floor;                                                     // 지붕
  g.beginPath(); g.moveTo(bx - 8, by); g.lineTo(sw / 2, by - sh * 0.26);
  g.lineTo(bx + bw + 8, by); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#D98E6A';                                                   // 문
  rrect(sw / 2 - bw * 0.12, sh * 0.9 - bh * 0.42, bw * 0.24, bh * 0.42, 3); g.fill(); g.stroke();
  g.fillStyle = '#CDEBFA';                                                   // 창문
  for(let i = 0; i <= level; i++){
    const wx = bx + bw * (0.16 + i * 0.3);
    rrect(wx, by + bh * 0.2, bw * 0.16, bh * 0.22, 3); g.fill(); g.stroke();
  }
  g = og; W = oW; H = oH;
}

/* 작은 캔버스에 가구 하나 그리기 (상점 카드용) */
function drawFurnIcon(cvs, id){
  const c = cvs.getContext('2d'), sw = cvs.width, sh = cvs.height;
  const og = g, oW = W, oH = H;
  g = c; W = sw; H = sh;                       // 그리기 도구를 잠깐 빌려 쓴다
  c.clearRect(0, 0, sw, sh);
  try{ drawFurn(id, sw / 2, sh * 0.95, sh * 0.25, false); }catch(e){}
  g = og; W = oW; H = oH;
}

/* ===== 알바 고르기 ===== */
function buildJobs(body){
  const info = document.createElement('p'); info.className = 'outinfo';
  info.innerHTML = '컨디션 <b>' + Math.round(condition() * 100) + '%</b> · 마음 <b>Lv' +
                   loveLv(S.dugi.love) + '</b> · 수집 보너스 <b>+' +
                   Math.round(collectBonus() * 100) + '%</b>' +
                   '<br><small>잘 먹고 잘 잔 두기가 일도 잘해요. 일하고 오면 배고프고 지저분해집니다.' +
                   '<br>좋은 등급을 입고 많이 모을수록 알바비가 올라요 (옷장 · 뽑기)</small>';
  body.appendChild(info);
  const row = document.createElement('div'); row.className = 'jobrow'; body.appendChild(row);
  JOBS.forEach(j => {
    const n = S.career[j.id] || 0;
    const rk = jobRank(n), nx = jobRankNext(n);
    const prog = nx ? Math.min(1, (n - rk.at) / (nx.at - rk.at)) : 1;
    const b2 = document.createElement('button');
    b2.type = 'button'; b2.className = 'jobcard';
    b2.innerHTML = '<span class="sign" style="background:' + j.color + '">' +
        (j.multi ? '여럿이 · ' : '') + j.place + '</span>' +
      '<canvas width="208" height="156"></canvas>' +
      '<span class="nm">' + j.name + '</span>' +
      '<span class="meta">' + j.desc + '</span>' +
      '<span class="rankrow"><i class="rbadge" style="color:' + rk.color +
        ';background:' + rk.bg + '">' + rk.name + '</i>' +
        '<span class="rtrack"><b style="width:' + Math.round(prog * 100) +
        '%;background:' + rk.color + '"></b></span>' +
        '<em>' + (nx ? nx.at - n + '번 더' : '최고') + '</em></span>' +
      '<span class="lvrow">' + n + '번 일함 · 시급 x' + (payMult(j.id)).toFixed(2) + '</span>' +
      '<span class="go">일하러 가기</span>';
    row.appendChild(b2);
    drawJobIcon(b2.querySelector('canvas'), j.id);
    b2.onclick = () => {
      if(j.game === 'run') startRun();
      else if(j.game === 'catch') startCatch();
      else if(j.game === 'lost') startLost();
      else if(j.game === 'pack') startPack();
      else startMine();
    };
  });
}
/* ===== 순위표 ===== */
let boardJob = 'deliver';
/* 내 기록 — 로그인 없이도 보이는 부분.
   알바별 최고 점수와, 많이 해볼수록 올라가는 랭크를 같이 보여줍니다. */
function buildMyRecords(body){
  const wrap = document.createElement('div'); wrap.className = 'myrec';
  const best = { deliver:S.runBest, mine:S.mineBest, lost:S.lostBest,
                 pack:S.packBest, draw:S.drawBest };
  wrap.innerHTML = JOBS.map(j => {
    const n = (S.career && S.career[j.id]) || 0;
    const rk = jobRank(n), u = Board.unit(j.id);
    return '<div class="mrow">' +
      '<b>' + esc(j.name) + '</b>' +
      '<span class="jrank" style="color:' + rk.color + ';background:' + rk.bg + '">' +
        esc(rk.name) + '</span>' +
      '<i>' + n + '번</i>' +
      '<span class="mbest">' + (best[j.id] || 0).toLocaleString('ko-KR') + u + '</span>' +
    '</div>';
  }).join('');
  body.appendChild(wrap);
}

function buildBoard(body){
  const box = document.createElement('div'); box.className = 'boardbox';
  body.appendChild(box);
  if(!Board.enabled()){
    box.innerHTML = '<p class="bnote">정원의 <b>우체통</b>에서 로그인하면 ' +
      '다른 사람들과 기록을 견줄 수 있어요.</p>';
    return;
  }
  box.innerHTML = '<div class="tabs" id="bTabs"></div><div id="bList" class="blist"></div>';
  const tabs = box.querySelector('#bTabs');
  JOBS.forEach(j => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'tab' + (j.id === boardJob ? ' on' : '');
    b.textContent = j.name;
    b.onclick = () => { boardJob = j.id; buildBoardList(); 
      [...tabs.children].forEach(c => c.classList.toggle('on', c === b)); };
    tabs.appendChild(b);
  });
  buildBoardList();
}
async function buildBoardList(){
  const el = $('bList'); if(!el) return;
  const job = boardJob;
  el.innerHTML = '<p class="bnote">불러오는 중…</p>';
  let rows = [];
  try{ rows = await Board.top(job); }catch(e){}
  if($('bList') !== el || boardJob !== job) return;        /* 그새 탭이 바뀌었으면 버린다 */
  const u = Board.unit(job);
  if(!rows.length){
    el.innerHTML = '<p class="bnote">아직 기록이 없어요. 첫 번째가 되어보세요!</p>';
  }else{
    const mine = cleanName(S.dugi.name, 8);
    el.innerHTML = rows.map((r, i) =>
      '<div class="brow' + (r.name === mine ? ' me' : '') + '">' +
        '<i class="bno r' + (i < 3 ? i + 1 : '') + '">' + (i + 1) + '</i>' +
        '<b>' + esc(r.name) + '</b>' +
        '<span>' + r.best.toLocaleString('ko-KR') + u + '</span></div>').join('');
  }
  const meBest = { deliver: S.runBest, mine: S.mineBest, lost: S.lostBest,
                   pack: S.packBest, draw: S.drawBest }[job] || 0;
  const foot = document.createElement('p'); foot.className = 'bnote';
  foot.textContent = '내 기록 ' + meBest.toLocaleString('ko-KR') + u;
  el.appendChild(foot);
  if(meBest){
    Board.rankOf(job, meBest).then(r => {
      if(r && $('bList') === el && boardJob === job)
        foot.textContent = '내 기록 ' + meBest.toLocaleString('ko-KR') + u +
          ' · 전체 ' + r.rank + '위 / ' + r.total + '명';
    }).catch(() => {});
  }
}

function drawJobIcon(cvs, id){
  const c = cvs.getContext('2d'), sw = cvs.width, sh = cvs.height;
  const og = g, oW = W, oH = H;
  g = c; W = sw; H = sh;
  c.clearRect(0, 0, sw, sh);
  ink(3.4);
  if(id === 'draw'){
    g.fillStyle = '#EAF6FB'; g.fillRect(0, 0, sw, sh);
    g.fillStyle = '#FFFCF8';                                   // 도화지
    rrect(sw * 0.1, sh * 0.14, sw * 0.62, sh * 0.66, 10); g.fill(); g.stroke();
    g.strokeStyle = '#8FC0D8'; g.lineWidth = 5;                // 끄적인 그림
    g.beginPath();
    g.moveTo(sw * 0.2, sh * 0.6); g.quadraticCurveTo(sw * 0.3, sh * 0.26, sw * 0.42, sh * 0.58);
    g.quadraticCurveTo(sw * 0.52, sh * 0.3, sw * 0.62, sh * 0.6);
    g.stroke();
    g.strokeStyle = '#EFA6B8';
    g.beginPath(); g.arc(sw * 0.38, sh * 0.42, sw * 0.1, 0, 7); g.stroke();
    g.strokeStyle = '#5A4A40'; g.lineWidth = 3.4;
    g.fillStyle = '#E7B075';                                   // 연필
    g.save(); g.translate(sw * 0.74, sh * 0.5); g.rotate(0.5);
    rrect(-sw * 0.05, -sh * 0.3, sw * 0.1, sh * 0.5, 4); g.fill(); g.stroke();
    g.fillStyle = '#FFE0C4';
    g.beginPath(); g.moveTo(-sw * 0.05, sh * 0.2); g.lineTo(0, sh * 0.32);
    g.lineTo(sw * 0.05, sh * 0.2); g.closePath(); g.fill(); g.stroke();
    g.restore();
    g.fillStyle = '#FFF8F0';                                   // 말풍선
    rrect(sw * 0.56, sh * 0.02, sw * 0.4, sh * 0.26, 9); g.fill(); g.stroke();
    g.fillStyle = '#8A7264'; g.textAlign = 'center';
    g.font = '700 22px Gaegu, sans-serif';
    g.fillText('???', sw * 0.76, sh * 0.2);
  }else if(id === 'lost'){
    g.fillStyle = '#F2E8DA'; g.fillRect(0, 0, sw, sh);
    g.fillStyle = '#E3D4BE'; g.fillRect(0, sh * 0.62, sw, sh * 0.38);
    /* 군중 */
    const put = (x, y, r, c) => {
      g.fillStyle = c; ink(2.6);
      g.beginPath(); g.ellipse(sw * x, sh * y, r, r * 1.15, 0, 0, 7); g.fill(); g.stroke();
      g.fillStyle = '#5A4A40';
      g.beginPath(); g.arc(sw * x - r * 0.3, sh * y - r * 0.25, 1.7, 0, 7); g.fill();
      g.beginPath(); g.arc(sw * x + r * 0.25, sh * y - r * 0.25, 1.7, 0, 7); g.fill();
    };
    [[0.16,0.52],[0.33,0.46],[0.5,0.55],[0.67,0.45],[0.84,0.53],
     [0.24,0.74],[0.58,0.76],[0.77,0.72]].forEach(([x,y]) => put(x, y, 11, '#FFFCF8'));
    /* 찾는 두기 — 동그라미로 표시 */
    put(0.41, 0.72, 12, '#FFF3D6');
    g.strokeStyle = '#5E9B63'; g.lineWidth = 3.4;
    g.beginPath(); g.arc(sw * 0.41, sh * 0.72, 19, 0, 7); g.stroke();
    /* 돋보기 */
    g.strokeStyle = '#5A4A40'; g.lineWidth = 3.4;
    g.beginPath(); g.arc(sw * 0.78, sh * 0.26, 14, 0, 7); g.stroke();
    g.beginPath(); g.moveTo(sw * 0.86, sh * 0.36); g.lineTo(sw * 0.95, sh * 0.5); g.stroke();
    g.fillStyle = 'rgba(156,202,223,.45)';
    g.beginPath(); g.arc(sw * 0.78, sh * 0.26, 13, 0, 7); g.fill();
  }else if(id === 'pack'){
    g.fillStyle = '#F4EADC'; g.fillRect(0, 0, sw, sh);
    /* 상자 */
    g.fillStyle = '#E4CDA8'; ink(3.2);
    rrect(sw * 0.1, sh * 0.14, sw * 0.56, sh * 0.72, 8); g.fill(); g.stroke();
    g.fillStyle = '#FBF4E9';
    rrect(sw * 0.14, sh * 0.19, sw * 0.48, sh * 0.62, 5); g.fill();
    /* 칸 */
    const gx = sw * 0.14, gy = sh * 0.19, gw = sw * 0.48, gh = sh * 0.62, cs = gw / 4;
    g.strokeStyle = '#E6D8C2'; g.lineWidth = 1.4;
    for(let i = 1; i < 4; i++){
      g.beginPath(); g.moveTo(gx + i * cs, gy); g.lineTo(gx + i * cs, gy + gh); g.stroke();
      g.beginPath(); g.moveTo(gx, gy + i * gh / 4); g.lineTo(gx + gw, gy + i * gh / 4); g.stroke();
    }
    const cell = (r, c, col) => {
      g.fillStyle = col;
      rrect(gx + c * cs + 2, gy + r * gh / 4 + 2, cs - 4, gh / 4 - 4, 4); g.fill();
    };
    cell(1,0,'#EFA6B8'); cell(1,1,'#EFA6B8'); cell(1,2,'#EFA6B8'); cell(1,3,'#EFA6B8');
    cell(2,0,'#8FC0D8'); cell(3,2,'#8FBF92'); cell(3,3,'#8FBF92');
    /* 들고 있는 블록 */
    g.fillStyle = '#E0B84E'; ink(3.2);
    rrect(sw * 0.72, sh * 0.3, sw * 0.12, sh * 0.16, 4); g.fill(); g.stroke();
    rrect(sw * 0.72, sh * 0.48, sw * 0.12, sh * 0.16, 4); g.fill(); g.stroke();
    rrect(sw * 0.85, sh * 0.48, sw * 0.12, sh * 0.16, 4); g.fill(); g.stroke();
  }else if(id === 'mine'){
    g.fillStyle = '#2E2A3A'; g.fillRect(0, 0, sw, sh);
    [['#C9A06A', 0.30], ['#9AA0A6', 0.56], ['#6E7D92', 0.82]].forEach(([c, t], i) => {
      g.fillStyle = c; g.fillRect(0, sh * t, sw, sh * 0.3);
      g.beginPath(); g.moveTo(0, sh * t); g.lineTo(sw, sh * t); g.stroke();
    });
    g.fillStyle = '#1C1926';                                   // 수직 갱도
    g.fillRect(sw * 0.33, sh * 0.30, sw * 0.34, sh * 0.7);
    g.strokeRect(sw * 0.33, sh * 0.30, sw * 0.34, sh * 0.7);
    [['#8FBF92', 0.44], ['#A98FE0', 0.72]].forEach(([c, t]) => {  // 원석
      g.fillStyle = c;
      g.beginPath();
      g.moveTo(sw * 0.5, sh * t - 11); g.lineTo(sw * 0.59, sh * t);
      g.lineTo(sw * 0.5, sh * t + 11); g.lineTo(sw * 0.41, sh * t);
      g.closePath(); g.fill(); g.stroke();
    });
    g.fillStyle = '#C9A06A';                                   // 곡괭이
    g.save(); g.translate(sw * 0.78, sh * 0.2); g.rotate(0.6);
    rrect(-3, -4, 6, sh * 0.36, 3); g.fill(); g.stroke(); g.restore();
    g.fillStyle = '#9AA0A6';
    g.save(); g.translate(sw * 0.8, sh * 0.17); g.rotate(-0.5);
    rrect(-sw * 0.1, -4, sw * 0.2, 8, 4); g.fill(); g.stroke(); g.restore();
  }else if(id === 'dish'){
    g.fillStyle = '#EAF6FB'; g.fillRect(0, 0, sw, sh);
    g.fillStyle = '#C6DCE6';                                   // 싱크대
    rrect(sw * 0.1, sh * 0.52, sw * 0.8, sh * 0.34, 10); g.fill(); g.stroke();
    g.fillStyle = '#9FC3D2';
    rrect(sw * 0.18, sh * 0.58, sw * 0.64, sh * 0.2, 8); g.fill(); g.stroke();
    [[0.32, 0.46, 0.13], [0.5, 0.4, 0.15], [0.68, 0.47, 0.12]].forEach(([x, y, r]) => {
      g.fillStyle = '#FFF8F0';
      g.beginPath(); g.ellipse(sw * x, sh * y, sw * r, sw * r * 0.82, 0, 0, 7); g.fill(); g.stroke();
      g.strokeStyle = '#8FC0D8';
      g.beginPath(); g.ellipse(sw * x, sh * y, sw * r * 0.55, sw * r * 0.45, 0, 0, 7); g.stroke();
      g.strokeStyle = '#5A4A40';
    });
    g.fillStyle = '#FFFFFF'; g.globalAlpha = .9;               // 거품
    [[0.24, 0.3, 9], [0.36, 0.22, 7], [0.62, 0.22, 8], [0.76, 0.32, 6]].forEach(([x, y, r]) => {
      g.beginPath(); g.arc(sw * x, sh * y, r, 0, 7); g.fill(); g.stroke(); });
    g.globalAlpha = 1;
  }else{
    g.fillStyle = '#FFF0F3'; g.fillRect(0, 0, sw, sh);
    g.fillStyle = '#CFE7C6';                                   // 길
    g.beginPath(); g.moveTo(0, sh * 0.72); g.lineTo(sw, sh * 0.72);
    g.lineTo(sw, sh); g.lineTo(0, sh); g.closePath(); g.fill();
    ink(3.4); g.beginPath(); g.moveTo(0, sh * 0.72); g.lineTo(sw, sh * 0.72); g.stroke();
    g.fillStyle = '#D98E6A';                                   // 배달 상자
    rrect(sw * 0.36, sh * 0.3, sw * 0.28, sh * 0.3, 8); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(sw * 0.36, sh * 0.42); g.lineTo(sw * 0.64, sh * 0.42); g.stroke();
    g.fillStyle = '#FFE08A';                                   // 동전
    [[0.2, 0.52], [0.78, 0.46], [0.86, 0.6]].forEach(([x, y]) => {
      g.beginPath(); g.arc(sw * x, sh * y, 10, 0, 7); g.fill(); g.stroke(); });
    g.strokeStyle = '#5A4A40';                                 // 속도선
    [0.2, 0.34].forEach(y => { g.beginPath();
      g.moveTo(sw * 0.08, sh * y); g.lineTo(sw * 0.28, sh * y); g.stroke(); });
  }
  g = og; W = oW; H = oH;
}

/* ===== 모달 열기 ===== */
function openModal(kind){
  modalOpen = kind;
  const body = $('modalBody'); body.innerHTML = '';
  const sheet = modal.querySelector('.sheet');
  sheet.className = 'sheet' + (['wardrobe','gacha','shop','job','daily','album','rank'].includes(kind) ? ' wide' : '');
  $('modalClose').textContent = '확인'; $('modalClose').hidden = false;

  if(kind === 'wardrobe'){
    $('modalTitle').textContent = '옷장 · 두기 도감';
    $('modalHint').textContent = '모습을 누르면 자세히 볼 수 있어요';
    buildDex(body);
  } else if(kind === 'account'){
    $('modalTitle').textContent = '내 계정';
    $('modalHint').textContent = '세이브가 서버에 저장되고 있어요';
    buildAccount(body);
  } else if(kind === 'album'){
    $('modalTitle').textContent = '사진첩';
    $('modalHint').textContent = '방이 마음에 들 때 찍어두면 남아요 (최대 ' + ALBUM_MAX + '장)';
    buildAlbum(body);
  } else if(kind === 'shop'){
    $('modalTitle').textContent = '가구 상점';
    $('modalHint').textContent = '';
    buildShop(body);
  } else if(kind === 'gacha'){
    $('modalTitle').textContent = '클로버 뽑기';
    $('modalHint').textContent = '';
    buildGacha(body);
  } else if(kind === 'job'){
    $('modalTitle').textContent = '알바하러 가기';
    $('modalHint').textContent = '일하고 오면 클로버와 경험치를 벌어와요';
    buildJobs(body);
  } else if(kind === 'rank'){
    $('modalTitle').textContent = '명예의 전당';
    $('modalHint').textContent = '내 최고 기록과 알바 랭크 · 전체 순위표';
    buildMyRecords(body);
    const h = document.createElement('h4'); h.className = 'bhead'; h.textContent = '전체 순위표';
    body.appendChild(h);
    buildBoard(body);
  } else if(kind === 'settings'){
    $('modalTitle').textContent = '설정';
    $('modalHint').textContent = '';
    buildSettings(body);
  }
  modal.hidden = false;
  sheet.scrollTop = 0; sheet.setAttribute('tabindex', '-1'); sheet.focus({ preventScroll:true });
}
function closeModal(){ modalOpen = null; modal.hidden = true; refreshBar(); }

/* ===== 노래 목록 ===== */
function buildSettings(body){
  const wrap = document.createElement('div'); wrap.className = 'setlist'; body.appendChild(wrap);
  const group = title => {
    const d = document.createElement('div'); d.className = 'setgroup';
    d.innerHTML = '<h5>' + title + '</h5>'; wrap.appendChild(d); return d;
  };
  const row = (parent, title, val, inner, hint) => {
    const d = document.createElement('div'); d.className = 'setrow';
    d.innerHTML = '<div class="lbl"><b>' + esc(title) + '</b><span>' + esc(val) + '</span></div>' + inner +
                  (hint ? '<div class="hint">' + esc(hint) + '</div>' : '');
    parent.appendChild(d); return d;
  };
  const slider = (parent, title, val, attrs, onInput, hint) => {
    const d = row(parent, title, val, '<input type="range" ' + attrs + '>', hint);
    d.querySelector('input').oninput = e => {
      d.querySelector('.lbl span').textContent = onInput(+e.target.value);
    };
    return d;
  };

  const g0 = group('두기');
  const nm = row(g0, '이름', S.dugi.name,
    '<input class="nameinput" type="text" maxlength="8" value="' + escAttr(S.dugi.name) + '">');
  nm.querySelector('input').onchange = e => {
    const v = cleanName(e.target.value, 8) || '두기';
    e.target.value = v;
    S.dugi.name = v; save(); refreshBar(); nm.querySelector('.lbl span').textContent = v;
  };

  const g2 = group('소리');
  [['volBgm', '배경음'], ['volSfx', '효과음']].forEach(([k, label]) => {
    slider(g2, label, Math.round(settings[k] * 100) + '%',
      'min="0" max="100" step="5" value="' + Math.round(settings[k] * 100) + '"',
      v => { settings[k] = v / 100; applyVolumes(); save(); if(k === 'volSfx') uiClick(); return v + '%'; });
  });

  const g3 = group('화면');
  const fxRow = row(g3, '빛 효과', settings.fx === false ? '끔' : '켬',
    '<label class="sw"><input type="checkbox"' + (settings.fx === false ? '' : ' checked') +
    '><span></span></label>',
    '불빛이 번지고 빛기둥이 보입니다. 화면이 끊기면 꺼보세요.');
  fxRow.querySelector('input').onchange = e => {
    settings.fx = !!e.target.checked; save();
    fxRow.querySelector('.lbl span').textContent = settings.fx ? '켬' : '끔';
  };

  const rs = document.createElement('button');
  rs.className = 'btn ghost small'; rs.type = 'button'; rs.textContent = '기본값으로';
  rs.onclick = () => { settings.volBgm = 0.6; settings.volSfx = 0.9; settings.fx = true;
    applyVolumes(); save(); openModal('settings'); };
  wrap.appendChild(rs);
}

/* ===== 뽑기 화면 ===== */
let lastPull = null;
const RANKSOUND = {
  N: () => arp([680], 0, 0.10),
  R: () => arp([740, 988], 0.09, 0.12),
  SR: () => { arp([660, 880, 1175, 1568], 0.075, 0.15, 'square'); shimmer(); },
  UR: () => { arp([523, 784, 1047, 1319, 1568, 2093], 0.07, 0.2, 'square');
              shimmer(); setTimeout(shimmer, 220); }
};
function buildGacha(body){
  const wrap = document.createElement('div'); wrap.className = 'gacha';
  const srLeft = Math.max(0, PITY_SR - (S.pity || 0));
  const urLeft = Math.max(0, PITY_UR - (S.pityU || 0));
  const free = freeLeft();
  wrap.innerHTML =
    '<div class="gtop">' + CLOVER_SVG + '<b id="gWallet">' + S.clover.toLocaleString('ko-KR') + '</b>' +
      '<span>' + RATE.map(([rk, p]) => RARITY[rk].name + ' ' + p + '%').join(' · ') + '</span></div>' +

    /* 천장 — 몇 번 더 뽑으면 확정인지 눈에 보이게 */
    '<div class="pity">' +
      '<div class="prow"><b>진귀 ★★★ 확정까지</b>' +
        '<span class="ptrack"><i style="width:' +
          Math.round((S.pity || 0) / PITY_SR * 100) + '%"></i></span>' +
        '<em>' + srLeft + '번</em></div>' +
      '<div class="prow ur"><b>전설 ★★★★ 확정까지</b>' +
        '<span class="ptrack"><i style="width:' +
          Math.round((S.pityU || 0) / PITY_UR * 100) + '%"></i></span>' +
        '<em>' + urLeft + '번</em></div>' +
    '</div>' +

    '<div class="gstage" id="gStage"><p class="gidle">클로버를 넣고 새 모습을 만나보세요<br>' +
      '<small>10연차에는 귀함 이상이 하나 확정 · 겹치면 클로버로 돌려받아요<br>' +
      '좋은 모습을 입고 다니면 알바비가 오릅니다</small></p></div>' +

    '<div class="gbtns">' +
      '<button class="btn small" id="gFree"' + (free ? '' : ' disabled') + '>' +
        (free ? '오늘의 무료 1회' : '무료는 내일 또') + '</button>' +
      '<button class="btn small" id="g1">1회 · ' + PULL1 + '</button>' +
      '<button class="btn" id="g10">10연차 · ' + PULL10 + '</button>' +
    '</div>' +

    /* 지금 받고 있는 수집 보너스 */
    '<p class="gbonus">지금 알바비 보너스 ' +
      '<b>+' + Math.round(collectBonus() * 100) + '%</b> ' +
      '<small>모습 ' + RARITY[look().rank].name + ' +' + Math.round(lookPay() * 100) + '%' +
      ' · 도감 ' + S.own.length + '종 +' + Math.round(dexPay() * 100) + '%' +
      (dexPay() >= DEX_PAY_CAP ? ' (최대)' : '') + '</small></p>';
  body.appendChild(wrap);

  const run = (n, isFree) => {
    initAudio(); if(ctx.state === 'suspended') ctx.resume();
    const got = pull(n, isFree);
    if(!got){
      const st = $('gStage'); st.classList.remove('hasbanner');
      st.innerHTML = '<p class="gidle">클로버가 모자라요<br><small>알바를 다녀오면 쌓입니다</small></p>';
      sfxNo(); return;
    }
    playCutscene(got);
  };
  $('gFree').onclick = () => { if(freeLeft()) run(1, true); };
  $('g1').onclick = () => run(1);
  $('g10').onclick = () => run(10);
  if(lastPull) renderPullResult(lastPull);
}
const RANK_RC = { R:'#8FC0D8', SR:'#FF9EB5', UR:'#E8C86A' };
function decorate(el, rank){
  if(rank === 'N' || rank === 'base') return;
  const ring = document.createElement('span');
  ring.className = 'ring'; ring.style.setProperty('--rc', RANK_RC[rank] || '#8FC0D8');
  el.appendChild(ring);
  if(rank === 'SR' || rank === 'UR'){
    for(let k = 0; k < (rank === 'UR' ? 14 : 9); k++){
      const s = document.createElement('span'); s.className = 'spark';
      const a = k / 9 * 6.283, d = 42 + Math.random() * 34;
      s.style.setProperty('--dx', (Math.cos(a) * d).toFixed(1) + 'px');
      s.style.setProperty('--dy', (Math.sin(a) * d).toFixed(1) + 'px');
      s.style.animationDelay = (Math.random() * 0.12) + 's';
      el.appendChild(s);
    }
  }
}
const topRank = got => got.some(r => r.rank === 'UR') ? 'UR'
                     : got.some(r => r.rank === 'SR') ? 'SR'
                     : got.some(r => r.rank === 'R')  ? 'R' : 'N';
function renderPullResult(got){
  const st = $('gStage'); if(!st) return;
  const top = topRank(got);
  st.innerHTML = ''; st.classList.toggle('hasbanner', top === 'SR' || top === 'UR');
  if(top === 'SR' || top === 'UR'){
    const bn = document.createElement('div');
    bn.className = 'banner' + (top === 'UR' ? ' ur' : '');
    bn.textContent = top === 'UR' ? '전설 등장!!' : '진귀 등장!';
    st.appendChild(bn);
  }
  const grid = document.createElement('div'); grid.className = 'gresult'; st.appendChild(grid);
  const step = got.length > 1 ? 95 : 0;
  got.forEach((r, i) => {
    const el = document.createElement('div');
    el.className = 'gcard r-' + r.rank +
                   (r.rank === 'SR' || r.rank === 'UR' ? ' shine' : '');
    el.style.animationDelay = (i * step / 1000) + 's';
    el.innerHTML = starRow(r.rank) +
      (r.isNew ? '<span class="newbadge">NEW</span>' : '') +
      '<span class="art"><img alt="" src="' + SRC[r.c.run] + '"></span>' +
      '<span class="nm">' + r.c.name + '</span>' +
      (r.isNew ? '<span class="meta">처음 만남!</span>'
               : '<span class="meta dup">겹침 +' + r.refund + '</span>');
    grid.appendChild(el);
    setTimeout(() => { decorate(el, r.rank);
      if(RANKSOUND[r.rank]) RANKSOUND[r.rank](); }, i * step + 60);
  });
}
function playCutscene(got){
  lastPull = got;
  const top = topRank(got);
  modal.hidden = true; modalOpen = null;
  $('topbar').hidden = true;
  $('dailyPanel').hidden = true; $('miniClose').hidden = true; bgmStop();
  $('skipBtn').hidden = false; $('tapHint').hidden = false;
  mode = 'cut';
  startCut(top, got, () => {
    $('skipBtn').hidden = true; $('tapHint').hidden = true;
    mode = 'home'; $('topbar').hidden = false;
    refreshBar(); bgmStart();
    openModal('gacha');
  });
}


/* ===============================================================
   아래 돌봄 버튼 바
   =============================================================== */


/* ===============================================================
   사진첩
   =============================================================== */
function buildAlbum(body){
  const top = document.createElement('div');
  top.className = 'albumtop';
  const shot = document.createElement('button');
  shot.type = 'button'; shot.className = 'btn';
  shot.textContent = '지금 찍기';
  shot.onclick = () => {
    closeModal();
    setTimeout(() => { if(takePhoto()) setTimeout(() => openModal('album'), 420); }, 60);
  };
  const cnt = document.createElement('span');
  cnt.className = 'hint';
  cnt.textContent = S.album.length + ' / ' + ALBUM_MAX + '장';
  top.appendChild(shot); top.appendChild(cnt);
  body.appendChild(top);

  if(!S.album.length){
    const e = document.createElement('p'); e.className = 'hint';
    e.textContent = '아직 사진이 없어요. 집을 꾸미고 한 장 찍어보세요.';
    body.appendChild(e); return;
  }
  const grid = document.createElement('div'); grid.className = 'albumgrid';
  body.appendChild(grid);
  S.album.forEach((ph, i) => {
    const card = document.createElement('figure');
    card.className = 'photo';
    const d = new Date(ph.t);
    const when = (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' +
                 String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    card.innerHTML = '<img alt="' + escAttr(when) + ' 사진">' +
      '<figcaption><b>' + esc(when) + '</b><span>' + esc(ph.note) + '</span></figcaption>';
    const im0 = card.querySelector('img');
    if(typeof ph.img === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(ph.img)) im0.src = ph.img;
    const del = document.createElement('button');
    del.type = 'button'; del.className = 'pdel'; del.setAttribute('aria-label', '사진 지우기');
    del.textContent = '×';
    del.onclick = () => { dropPhoto(i); openModal('album'); };
    card.appendChild(del);
    grid.appendChild(card);
  });
}

/* ===============================================================
   다녀왔어요 — 자리를 비운 사이 있었던 일
   =============================================================== */
function showAway(r){
  const body = $('modalBody'); body.innerHTML = '';
  modalOpen = 'away';
  modal.querySelector('.sheet').className = 'sheet away';
  $('modalTitle').textContent = '다녀왔어요!';
  const h = Math.floor(r.hrs), m = Math.round((r.hrs - h) * 60);
  $('modalHint').textContent = (h ? h + '시간 ' : '') + (m ? m + '분' : '') + ' 만이에요' +
                               (r.capped ? ' (오래 비웠네요)' : '');
  const w = WEATHER();
  const box = document.createElement('div'); box.className = 'awaybox';
  box.innerHTML = '<p class="awaywx">오늘은 <b>' + w.name + '</b> · ' + w.note + '</p>';
  const ul = document.createElement('div'); ul.className = 'awaylist';
  (r.lines.length ? r.lines : ['두기는 얌전히 기다렸어요']).forEach(t => {
    const li = document.createElement('p'); li.textContent = t; ul.appendChild(li);
  });
  box.appendChild(ul);
  body.appendChild(box);
  $('modalClose').textContent = '두기 보러 가기';
  $('modalClose').hidden = false;
  modal.hidden = false;
}


/* ===============================================================
   내 계정
   =============================================================== */
function buildAccount(body){
  const u = Auth.current();
  const box = document.createElement('div'); box.className = 'acctbox';
  const rows = [
    ['이메일', u ? u.email : '-'],
    ['메일 인증', u && u.verified ? '완료' : '아직'],
    ['세이브', '서버에 자동 저장 중']
  ];
  rows.forEach(([k, v]) => {
    const r = document.createElement('p'); r.className = 'acctrow';
    const b1 = document.createElement('b'); b1.textContent = k;
    const s1 = document.createElement('span'); s1.textContent = v;   /* 서버 값이라 textContent 로만 */
    r.appendChild(b1); r.appendChild(s1); box.appendChild(r);
  });
  body.appendChild(box);

  const now = document.createElement('button');
  now.type = 'button'; now.className = 'btn'; now.textContent = '지금 서버에 저장';
  now.onclick = async () => {
    now.disabled = true;
    try{ await Auth.push(S); toast('서버에 저장했어요', ''); }
    catch(e){ toast('저장에 실패했어요', '잠시 후 다시'); }
    now.disabled = false;
  };
  body.appendChild(now);

  const out = document.createElement('button');
  out.type = 'button'; out.className = 'btn ghost small'; out.textContent = '로그아웃';
  out.onclick = async () => {
    await Auth.signOut();
    closeModal(); toast('로그아웃했어요', '이 기기 세이브는 그대로예요');
  };
  body.appendChild(out);
}
