"use strict";
/* 공용 도구 — 꺅두기 하우스 */

/* ===============================================================
   공용 도구 — 캔버스 · 크기 · 선 굵기
   =============================================================== */
/* 클릭재킹 방지 — 남의 사이트가 iframe 으로 감싸면 아무것도 보여주지 않는다.
   (frame-ancestors 는 <meta> 로는 적용되지 않아서 여기서 한 번 더 막습니다) */
if(window.top !== window.self){
  try{ window.top.location = window.self.location; }catch(e){}
  document.documentElement.replaceChildren();
  const w = document.createElement('p');
  w.textContent = '이 게임은 다른 사이트 안에서는 열 수 없어요.';
  w.setAttribute('style', 'font:16px sans-serif;padding:24px;color:#4E4038');
  document.documentElement.appendChild(w);
  throw new Error('framed');
}

const $ = id => document.getElementById(id);
const cv = $('cv');
let g = cv.getContext('2d');
let W = 960, H = 540, dpr = 1;
const modal = $('modal');
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function resize(){
  const r = cv.getBoundingClientRect();
  dpr = Math.min(2, window.devicePixelRatio || 1);
  W = Math.max(320, r.width); H = Math.max(240, r.height);
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener('resize', () => {
  resize();
  if(typeof DugiRun !== 'undefined') DugiRun.resize();
  if(typeof CatchMind !== 'undefined') CatchMind.layout();
});

const uiK = () => Math.max(0.85, Math.min(1.7, Math.min(W / 960, H / 540)));
/* 게임 안의 모든 선은 이 굵기 하나로 통일 */
const LW = () => Math.max(2.0, 2.5 * uiK());

/* 살짝 찌그러진 동그라미 — 손으로 그린 느낌 (뽑기 연출의 클로버 잎) */
function wobble(x, y, r, seed, fill, stroke){
  g.beginPath();
  for(let a = 0; a <= 6.29; a += Math.PI / 12){
    const rr = r + Math.sin(a * 3 + seed) * r * 0.055;
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    a === 0 ? g.moveTo(px, py) : g.lineTo(px, py);
  }
  g.closePath();
  if(fill){ g.fillStyle = fill; g.fill(); }
  if(stroke){ g.strokeStyle = stroke; g.lineWidth = LW(); g.stroke(); }
}

function roundRect(x, y, w, h, r){
  r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  g.beginPath(); g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

/* ===============================================================
   보안 — 사용자가 넣은 글자는 반드시 이걸 거쳐서 화면에 올린다
   =============================================================== */
const ESC_MAP = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;', '`':'&#96;' };
/* HTML 본문에 넣을 때 */
function esc(v){ return String(v == null ? '' : v).replace(/[&<>"'`]/g, c => ESC_MAP[c]); }
/* 속성값에 넣을 때 (따옴표까지 확실히) */
const escAttr = esc;

/* 이름처럼 사람이 직접 적는 값 — 허용한 글자만 남긴다 (화이트리스트) */
function cleanName(v, max){
  return String(v == null ? '' : v)
    .normalize('NFC')
    .replace(/[\u0000-\u001F\u007F\u200B-\u200F\u2028\u2029\uFEFF]/g, '')  // 제어·보이지 않는 글자
    .replace(/[^\uAC00-\uD7A3\u3131-\u318E a-zA-Z0-9._-]/g, '')                // 한글·영문·숫자·일부 기호만
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max || 8);
}
