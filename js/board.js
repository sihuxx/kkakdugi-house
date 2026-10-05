"use strict";
/* 순위표 — 꺅두기 하우스 */

/* ===============================================================
   순위표 — 알바별 전체 기록

   점수는 브라우저가 세서 보냅니다. 그래서 이 코드는 "맞는 점수를
   보낸다" 를 보장하지 못합니다. 보장하는 건 아래 둘뿐입니다.
     · 남의 줄은 못 건드린다  (RLS + 서버 트리거가 user_id 를 덮어씀)
     · 말이 안 되는 값은 아예 안 들어간다 (서버 check 제약)
   범위 안에서의 위조는 Edge Function 으로 옮겨야 풀립니다 —
   SECURITY.md 10장에 그대로 적어뒀습니다.
   =============================================================== */
const Board = (function(){
"use strict";

const TOP_N = 20;
/* 각 알바가 올리는 값과, 사람이 낼 수 있는 한계 (서버 제약과 같은 숫자) */
const JOBCAP = { deliver: 200000, mine: 30, lost: 60000, pack: 300000, draw: 100000 };
const UNIT   = { deliver: '점', mine: 'm', lost: '점', pack: '점', draw: '점' };
const bestOf = { deliver: () => S.runBest, mine: () => S.mineBest,
                 lost: () => S.lostBest, pack: () => S.packBest, draw: () => S.drawBest };

let cache = Object.create(null);       /* job -> {at, rows} */
let lastSent = Object.create(null);

const enabled = () => typeof Auth !== 'undefined' && Auth.enabled() && !!Auth.current();
const unit = j => UNIT[j] || '';

/* 내 기록 올리기 → 올린 뒤 내 등수를 돌려준다 */
async function submit(job){
  if(!enabled() || !JOBCAP[job]) return null;
  const raw = Math.round((bestOf[job] && bestOf[job]()) || 0);
  const best = Math.max(0, Math.min(JOBCAP[job], raw));
  if(!best) return null;
  if(lastSent[job] === best){ return rankOf(job, best); }   /* 안 바뀌었으면 다시 안 올린다 */
  try{
    await Auth.api('/rest/v1/scores', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: { user_id: Auth.current().id, job, name: cleanName(S.dugi.name, 8) || '두기', best }
    });
    lastSent[job] = best;
    delete cache[job];
  }catch(e){ return null; }
  return rankOf(job, best);
}

/* 상위 목록 (조금 전 것이면 다시 안 부른다) */
async function top(job, force){
  if(!enabled() || !JOBCAP[job]) return [];
  const c = cache[job];
  if(!force && c && Date.now() - c.at < 30000) return c.rows;
  let rows = [];
  try{
    rows = await Auth.api('/rest/v1/scores?select=name,best,updated_at&job=eq.' +
      encodeURIComponent(job) + '&order=best.desc,updated_at.asc&limit=' + TOP_N);
  }catch(e){ return (c && c.rows) || []; }
  rows = clean(rows, job);
  cache[job] = { at: Date.now(), rows };
  return rows;
}

/* 서버에서 온 것도 남의 데이터로 보고 한 겹 거른다 */
function clean(rows, job){
  if(!Array.isArray(rows)) return [];
  const cap = JOBCAP[job] || 0;
  return rows.slice(0, TOP_N).map(r => ({
    name: cleanName(r && r.name, 8) || '두기',
    best: Math.max(0, Math.min(cap, Math.round(Number(r && r.best) || 0)))
  })).filter(r => r.best > 0);
}

/* 내 점수보다 높은 사람이 몇 명인지 세서 등수를 구한다 */
async function rankOf(job, best){
  if(!enabled()) return null;
  try{
    const head = await Auth.count('/rest/v1/scores?select=user_id&job=eq.' +
      encodeURIComponent(job) + '&best=gt.' + encodeURIComponent(best));
    const all  = await Auth.count('/rest/v1/scores?select=user_id&job=eq.' +
      encodeURIComponent(job));
    if(head == null || all == null) return null;
    return { rank: head + 1, total: all, best };
  }catch(e){ return null; }
}

function forget(){ cache = Object.create(null); lastSent = Object.create(null); }

return { enabled, submit, top, rankOf, forget, unit, TOP_N,
         jobs: () => Object.keys(JOBCAP) };
})();
