"use strict";
/* 성장·가구·돌봄 데이터 — 꺅두기 하우스 */

/* ===============================================================
   키우기 데이터 — 마음 레벨 · 집 · 가구 · 돌봄 · 알바
   =============================================================== */

/* ===== 마음 레벨 — 돌볼수록 오르는 메인 진행 ===== */
const LOVE_NEED = [0, 40, 100, 190, 320, 500, 740, 1050, 1450, 1950];   // Lv1~10
const LOVE_MAX = LOVE_NEED.length;
function loveLv(v){ let l = 1; LOVE_NEED.forEach((n, i) => { if(v >= n) l = i + 1; }); return l; }
function loveProg(v){
  const l = loveLv(v);
  if(l >= LOVE_MAX) return 1;
  const a = LOVE_NEED[l - 1], b = LOVE_NEED[l];
  return (v - a) / (b - a);
}
function loveNext(v){ const l = loveLv(v); return l >= LOVE_MAX ? 0 : LOVE_NEED[l] - v; }
/* 레벨마다 열리는 것 */
const LOVE_UNLOCK = {
  2:  { txt:'두기가 이름을 알아들어요',      talk:true },
  3:  { txt:'두기가 따라다니기 시작!',        follow:true },
  4:  { txt:'혼잣말이 늘었어요' },
  5:  { txt:'특별 가구 · 쿠션 해금',          furn:'cushion' },
  6:  { txt:'쓰다듬으면 더 좋아해요',         petx:1.5 },
  7:  { txt:'알바 시급 보너스 ↑' },
  8:  { txt:'특별 가구 · 해먹 해금',          furn:'hammock' },
  9:  { txt:'두기가 가끔 선물을 물어와요',    gift:true },
  10: { txt:'최고의 단짝!',                   furn:'trophy' }
};
const loveBonus = v => 0.02 * (loveLv(v) - 1) + (loveLv(v) >= 7 ? 0.06 : 0);

/* ===== 집 단계 ===== */
const HOUSES = [
  { id:'old',  name:'낡은 방',   price:0,    wide:0.72, tall:0.46,
    note:'벽지가 들뜨고 바닥도 삐걱거려요', slots:6 },
  { id:'cozy', name:'아늑한 집', price:2400, wide:0.90, tall:0.48,
    note:'도배도 새로 하고 마루도 깔았어요', slots:11 },
  { id:'big',  name:'넓은 집',   price:7000, wide:1.00, tall:0.50,
    note:'창이 크고 천장도 높아요', slots:16 }
];
const HOUSE = () => HOUSES[Math.min(HOUSES.length - 1, S.house || 0)];

/* 벽지 · 바닥 (상점에서 삼) */
const WALLS = [
  { id:'w0', name:'기본 벽지',   price:0,   a:'#FBEEDD', b:'#F4E2CB', pat:'dot' },
  { id:'w1', name:'민트 줄무늬', price:280, a:'#E8F6EF', b:'#D9EEE4', pat:'stripe' },
  { id:'w2', name:'분홍 물방울', price:320, a:'#FDEFF3', b:'#F8E1E8', pat:'dot' },
  { id:'w3', name:'하늘 격자',   price:420, a:'#EAF4FB', b:'#DCECF7', pat:'grid' }
];
const FLOORS = [
  { id:'f0', name:'기본 마루',   price:0,   a:'#EBD4B4', b:'#DCC29A' },
  { id:'f1', name:'밝은 마루',   price:260, a:'#F3E4C9', b:'#E6D2AE' },
  { id:'f2', name:'회색 타일',   price:340, a:'#E4E6E4', b:'#D3D6D4' },
  { id:'f3', name:'분홍 카펫',   price:460, a:'#F6DCE3', b:'#EBC7D2' }
];
const WALLNOW  = () => WALLS.find(w => w.id === (S.wall || 'w0')) || WALLS[0];
const FLOORNOW = () => FLOORS.find(f => f.id === (S.floor || 'f0')) || FLOORS[0];

/* ===== 스탯 ===== */
const STATS = [
  { id:'full',   name:'배부름', color:'#E0A45C' },
  { id:'clean',  name:'깨끗함', color:'#8FC0D8' },
  { id:'fun',    name:'기분',   color:'#EFA6B8' },
  { id:'energy', name:'기운',   color:'#8FBF92' }
];

/* ===== 가구 =====
   zone: kitchen · living · bed  /  row 1 = 벽쪽, 0 = 앞쪽
   자리는 구역 안에서 자동 배치되고, 꾸미기 모드에서 옮기면 그 자리가 저장된다 */
const FURNITURE = [
  { id:'bowl',   name:'밥그릇',      price:0,   base:true, zone:'kitchen', row:0, act:'feed',
    desc:'두기 밥그릇' },
  { id:'tub',    name:'대야',        price:0,   base:true, zone:'kitchen', row:0, act:'wash',
    desc:'씻기는 자리' },
  { id:'plant',  name:'화분',        price:0,   base:true, zone:'living',  row:1, act:'water',
    desc:'물을 주면 자라요' },
  { id:'ball',   name:'공',          price:0,   base:true, zone:'living',  row:0, act:'play',
    desc:'던지고 놀기' },
  { id:'bed',    name:'침대',        price:0,   base:true, zone:'bed',     row:1, act:'sleep',
    desc:'여기서 자면 기운이 차요' },

  { id:'fridge', name:'냉장고',      price:680, zone:'kitchen', row:1, boost:{ full:6 },
    desc:'밥 배부름 +6' },
  { id:'sink',   name:'싱크대',      price:380, zone:'kitchen', row:1, boost:{ clean:5 },
    desc:'씻길 때 깨끗함 +5' },
  { id:'table',  name:'식탁',        price:340, zone:'kitchen', row:0, boost:{ fun:2 },
    desc:'밥 먹을 자리 (기분 +2)' },
  { id:'rug',    name:'러그',        price:220, zone:'living',  row:2, boost:{ fun:2 },
    desc:'기분 회복 +2' },
  { id:'sofa',   name:'소파',        price:1400, zone:'living', row:1, boost:{ energy:5, fun:3 },
    desc:'푹신함 (기운 +5 · 기분 +3)', need:1 },
  { id:'tv',     name:'티비',        price:560, zone:'living',  row:1, boost:{ fun:5 },
    desc:'놀아줄 때 기분 +5' },
  { id:'shelf',  name:'책장',        price:420, zone:'living',  row:1, boost:{ pay:0.04 },
    desc:'알바 시급 +4%' },
  { id:'cake',   name:'생일 케이크', price:900, zone:'living',  row:0, boost:{ love:0.15 },
    desc:'마음 +15%', need:1 },
  { id:'piano',  name:'장난감 피아노', price:1200, zone:'living', row:1, boost:{ pay:0.08 },
    desc:'알바 시급 +8%', need:2 },
  { id:'lamp',   name:'꼬마 램프',   price:320, zone:'bed',     row:1, boost:{ energy:4 },
    desc:'잘 때 기운 +4' },
  { id:'toybox', name:'장난감 상자', price:480, zone:'bed',     row:0, boost:{ fun:4 },
    desc:'놀아줄 때 기분 +4' },
  { id:'cushion',name:'폭신 쿠션',   price:0,   zone:'bed',     row:0, boost:{ energy:3, love:0.05 },
    desc:'마음 Lv5 선물', lock:'love5' },
  { id:'hammock',name:'해먹',        price:0,   zone:'living',  row:1, boost:{ energy:6 },
    desc:'마음 Lv8 선물', lock:'love8' },
  { id:'trophy', name:'단짝 트로피', price:0,   zone:'living',  row:0, boost:{ pay:0.1, love:0.1 },
    desc:'마음 Lv10 선물', lock:'love10' },

  { id:'frame',  name:'액자',        price:260, zone:'living',  on:'wall', boost:{ pay:0.05 },
    desc:'알바 시급 +5%' },
  { id:'clock',  name:'벽시계',      price:300, zone:'kitchen', on:'wall', boost:{ pay:0.05 },
    desc:'알바 시급 +5%' },
  { id:'garland',name:'장식 깃발',   price:380, zone:'living',  on:'wall', boost:{ fun:3 },
    desc:'집이 화사해져요 (기분 +3)' },
  { id:'poster', name:'포스터',      price:450, zone:'bed',     on:'wall', boost:{ love:0.05 },
    desc:'마음 +5%', need:1 },
  { id:'window2',name:'작은 창문',   price:800, zone:'bed',     on:'wall', boost:{ fun:4 },
    desc:'햇빛이 들어와요 (기분 +4)', need:2 }
];
const FURN = id => FURNITURE.find(f => f.id === id);
const BASE_FURN = FURNITURE.filter(f => f.base).map(f => f.id);
const ZONES = ['kitchen', 'living', 'bed'];
const ZONE_NAME = { kitchen:'주방', living:'거실', bed:'침실' };

/* 방에 늘 있는 것 */
const PLACES = [
  { id:'wardrobe', name:'옷장',      zone:'bed',    row:1, act:'wardrobe' },
  { id:'door',     name:'현관',      zone:'living', act:'out', wall:true }
];

/* ===== 정원 (집 밖) — 자리는 고정 ===== */
const YARD = [
  { id:'house', name:'우리 집',     x:0.12, y:0.03, act:'in' },
  { id:'shop',  name:'가게',        x:0.40, y:0.02, act:'shop' },
  { id:'gmach', name:'뽑기 기계',   x:0.62, y:0.07, act:'gacha' },
  { id:'board', name:'알바 게시판', x:0.84, y:0.05, act:'job' }
];

/* ===== 먹이 ===== */
const FOODS = [
  { id:'carrot', name:'당근',     color:'#F09A5B', full:22 },
  { id:'bread',  name:'빵',       color:'#E8C98A', full:26 },
  { id:'berry',  name:'딸기',     color:'#F4899B', full:18 },
  { id:'fish',   name:'생선',     color:'#8FC0D8', full:28 },
  { id:'icecre', name:'아이스크림', color:'#FFE3EC', full:16 }
];

/* ===== 소모품 ===== */
const ITEMS = [
  { id:'snack', name:'간식',   price:40,  use:'배부름 +18 · 기분 +10', add:{ full:18, fun:10 }, love:4 },
  { id:'soap',  name:'거품비누', price:50, use:'씻길 때 한 번에 깨끗',  add:{ clean:45 },        love:3 },
  { id:'toy',   name:'삑삑이', price:70,  use:'기분 +26',              add:{ fun:26 },          love:5 },
  { id:'pillow',name:'낮잠 베개', price:90, use:'기운 +45',            add:{ energy:45 },       love:3 }
];
const ITEM = id => ITEMS.find(i => i.id === id);

/* ===== 돌봄 ===== */
const CARE = {
  feed:  { name:'밥 주기',   verb:'냠냠!',    cost:0, love:6, mini:'feed',
           stat:'full',   tip:'좋아하는 음식을 찾아보세요' },
  wash:  { name:'씻기기',    verb:'뽀득뽀득', cost:0, love:5, mini:'wash',
           stat:'clean',  tip:'문질러서 때를 지워요' },
  play:  { name:'놀아주기',  verb:'꺅!',      cost:0, love:7, mini:'play',
           stat:'fun',    tip:'공을 당겼다 놓아 던지기' },
  sleep: { name:'재우기',    verb:'쿨쿨…',    cost:0, love:4, mini:'sleep',
           stat:'energy', tip:'침대로 데려가 재워요' },
  water: { name:'물 주기',   verb:'쪼르륵~',  cost:0, love:3, mini:'water',
           stat:'fun',    tip:'화분이 자라요' },
  clean: { name:'청소하기',  verb:'쓱싹쓱싹', cost:0, love:3, mini:'clean',
           stat:'clean',  tip:'먼지를 문질러 치워요' }
};
const CARE_ORDER = ['feed', 'wash', 'play', 'sleep', 'water', 'clean'];

/* ===== 알바 ===== */
const CAREER_NEED = [0, 3, 8, 16, 28, 45, 70, 100, 140, 200];    // 몇 번 일했나
const careerLv = n => { let l = 1; CAREER_NEED.forEach((v, i) => { if(n >= v) l = i + 1; }); return l; };
const careerPay = n => 1 + 0.05 * (careerLv(n) - 1);

const JOBS = [
  { id:'dish', game:'rhythm', name:'설거지 알바', place:'분식집 주방',
    desc:'노래에 맞춰 접시를 씻어요', pay:'깨끗이 씻을수록 시급이 올라요', color:'#8FC0D8' },
  { id:'deliver', game:'run', name:'배달 알바', place:'동네 골목',
    desc:'장애물을 피해 달려서 배달', pay:'동전을 줍고 제시간에 도착하면 보너스', color:'#EFA6B8' },
  { id:'cafe', game:'cafe', name:'카페 알바', place:'골목 카페',
    desc:'손님 주문을 외워서 담기', pay:'길게 외울수록 팁이 커져요', color:'#D9C4A0' }
];
const JOB = id => JOBS.find(j => j.id === id);

/* 배달 코스 — 경력이 쌓이면 열린다 */
const COURSES = [
  { id:'town',  name:'동네 한 바퀴', lv:1, hp:3, v0:400, vmax:600, dense:1.00, pay:1.00,
    sky:['#DCF0FB', '#F4FAF3'], desc:'기본 코스' },
  { id:'hill',  name:'언덕길',      lv:3, hp:2, v0:440, vmax:650, dense:1.30, pay:1.35,
    sky:['#FFE9D6', '#FFF6EC'], desc:'발판과 구덩이가 많아요' },
  { id:'night', name:'야간 빗길',   lv:5, hp:2, v0:470, vmax:700, dense:1.5, pay:1.75,
    sky:['#3E4668', '#7E7FA6'], desc:'미끄럽고 어두워요', slippery:true, dark:true }
];
const COURSE = id => COURSES.find(c => c.id === id) || COURSES[0];

/* ===== 오늘의 할 일 ===== */
const DAILY_POOL = [
  { id:'d_feed',  txt:'밥 두 번 주기',      need:2, kind:'care:feed',  pay:60 },
  { id:'d_pet',   txt:'30번 쓰다듬기',      need:30, kind:'pet',       pay:50 },
  { id:'d_play',  txt:'공놀이 한 번',       need:1, kind:'care:play',  pay:45 },
  { id:'d_clean', txt:'방 청소하기',        need:1, kind:'care:clean', pay:40 },
  { id:'d_job',   txt:'알바 한 번 다녀오기', need:1, kind:'job',        pay:80 },
  { id:'d_wash',  txt:'깨끗하게 씻기기',    need:1, kind:'care:wash',  pay:45 },
  { id:'d_water', txt:'화분에 물 주기',     need:1, kind:'care:water', pay:35 },
  { id:'d_coin',  txt:'클로버 300 모으기',  need:300, kind:'earn',     pay:70 }
];

/* ===== 업적 ===== */
const ACHIEVES = [
  { id:'a_pet',  txt:'100번 쓰다듬기',   need:100, kind:'pet',   pay:200 },
  { id:'a_job',  txt:'알바 10번',        need:10,  kind:'job',   pay:250 },
  { id:'a_love', txt:'마음 레벨 5',      need:5,   kind:'love',  pay:300 },
  { id:'a_dex',  txt:'모습 10종 모으기',  need:10,  kind:'dex',   pay:350 },
  { id:'a_furn', txt:'가구 10개 놓기',    need:10,  kind:'furn',  pay:300 },
  { id:'a_house',txt:'넓은 집으로 이사',  need:2,   kind:'house', pay:500 }
];

/* ===== 꺅두기런 두기별 스킬 ===== */
const SKILLS = {
  dash:   { name:'돌진!',      desc:'3초 무적 돌진 · 장애물을 부숴요', dur:3.0,  color:'#EFA6B8' },
  glide:  { name:'둥실둥실',   desc:'4초 동안 천천히 떨어져요',        dur:4.0,  color:'#8FC0D8' },
  magnet: { name:'동전 자석',  desc:'5초 동안 동전이 따라와요',        dur:5.0,  color:'#8FBF92' },
  hop:    { name:'폭신 점프',  desc:'6초 동안 3단 점프가 돼요',        dur:6.0,  color:'#D9C4A0' },
  slow:   { name:'느긋느긋',   desc:'5초 동안 천천히 · 동전 2배',      dur:5.0,  color:'#AD9ED4' }
};
const CHAR_SKILL = {
  wool:'hop', proud:'hop', baby:'magnet', belly:'glide', school:'magnet',
  holdbaby:'hop', car:'dash', snail:'slow', rabbit:'hop', cat:'magnet', bear:'slow',
  icecream:'magnet', clown:'dash', cowboy:'dash', fairy:'glide', huggy:'dash', killer:'dash'
};
const skillOf = c => SKILLS[CHAR_SKILL[c.id] || 'magnet'];
const skillIdOf = c => CHAR_SKILL[c.id] || 'magnet';
