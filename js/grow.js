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
  { id:'bowl',   name:'밥그릇',      price:0,   base:true, zone:'kitchen', slot:'K4', sz:0.8, act:'feed',
    desc:'두기 밥그릇' },
  { id:'tub',    name:'대야',        price:0,   base:true, zone:'kitchen', slot:'K5', sz:0.9, act:'wash',
    desc:'씻기는 자리' },
  { id:'plant',  name:'화분',        price:0,   base:true, zone:'bed',     slot:'B3', sz:0.9, act:'water',
    desc:'물을 주면 자라요' },
  { id:'ball',   name:'공',          price:0,   base:true, zone:'living',  slot:'L8', sz:0.7, act:'play',
    desc:'던지고 놀기' },
  { id:'bed',    name:'침대',        price:0,   base:true, zone:'bed',     slot:'B1', sz:1.15, act:'sleep',
    desc:'여기서 자면 기운이 차요' },

  { id:'fridge', name:'냉장고',      price:680, zone:'kitchen', slot:'K1', sz:1.3, boost:{ full:6 },
    desc:'밥 배부름 +6' },
  { id:'sink',   name:'싱크대',      price:380, zone:'kitchen', slot:'K2', sz:1.15, boost:{ clean:5 },
    desc:'씻길 때 깨끗함 +5' },
  { id:'table',  name:'식탁',        price:340, zone:'kitchen', slot:'K3', sz:1.05, boost:{ fun:2 },
    desc:'밥 먹을 자리 (기분 +2)' },
  { id:'rug',    name:'러그',        price:220, zone:'living',  slot:'L7', sz:1.5, floorLayer:true, boost:{ fun:2 },
    desc:'기분 회복 +2' },
  { id:'sofa',   name:'소파',        price:1400, zone:'living', slot:'L3', sz:1.25, boost:{ energy:5, fun:3 },
    desc:'푹신함 (기운 +5 · 기분 +3)', need:1 },
  { id:'tv',     name:'티비',        price:560, zone:'living',  slot:'L2', sz:1.1, boost:{ fun:5 },
    desc:'놀아줄 때 기분 +5' },
  { id:'shelf',  name:'책장',        price:420, zone:'living',  slot:'L1', sz:1.2, boost:{ pay:0.04 },
    desc:'알바 시급 +4%' },
  { id:'cake',   name:'생일 케이크', price:900, zone:'living',  slot:'L9', sz:0.85, boost:{ love:0.15 },
    desc:'마음 +15%', need:1 },
  { id:'piano',  name:'장난감 피아노', price:1200, zone:'living', slot:'L4', sz:1.05, boost:{ pay:0.08 },
    desc:'알바 시급 +8%', need:2 },
  { id:'lamp',   name:'꼬마 램프',   price:320, zone:'bed',     slot:'B4', sz:0.95, boost:{ energy:4 },
    desc:'잘 때 기운 +4' },
  { id:'toybox', name:'장난감 상자', price:480, zone:'bed',     slot:'B5', sz:0.85, boost:{ fun:4 },
    desc:'놀아줄 때 기분 +4' },
  { id:'cushion',name:'폭신 쿠션',   price:0,   zone:'bed',     slot:'B6', sz:0.75, boost:{ energy:3, love:0.05 },
    desc:'마음 Lv5 선물', lock:'love5' },
  { id:'hammock',name:'해먹',        price:0,   zone:'living',  slot:'L5', sz:1.1, boost:{ energy:6 },
    desc:'마음 Lv8 선물', lock:'love8' },
  { id:'trophy', name:'단짝 트로피', price:0,   zone:'living',  slot:'L6', sz:0.8, boost:{ pay:0.1, love:0.1 },
    desc:'마음 Lv10 선물', lock:'love10' },

  { id:'frame', slot:'LW1',  name:'액자',        price:260, zone:'living',  on:'wall', boost:{ pay:0.05 },
    desc:'알바 시급 +5%' },
  { id:'clock', slot:'KW1',  name:'벽시계',      price:300, zone:'kitchen', on:'wall', boost:{ pay:0.05 },
    desc:'알바 시급 +5%' },
  { id:'garland', slot:'LW2',name:'장식 깃발',   price:380, zone:'living',  on:'wall', boost:{ fun:3 },
    desc:'집이 화사해져요 (기분 +3)' },
  { id:'poster', slot:'BW1', name:'포스터',      price:450, zone:'bed',     on:'wall', boost:{ love:0.05 },
    desc:'마음 +5%', need:1 },
  { id:'window2', slot:'BW2',name:'작은 창문',   price:800, zone:'bed',     on:'wall', boost:{ fun:4 },
    desc:'햇빛이 들어와요 (기분 +4)', need:2 }
];

/* ===== 가구 자리(슬롯) — 구역마다 못 박아 둔다 =====
   row 1 = 벽쪽(큰 가구) · 0 = 가운데 · 2 = 앞쪽(작은 것)
   현관은 거실 벽 0.50 고정이라 벽쪽 슬롯은 그 양옆으로 비켜 둔다 */
const SLOTS = {
  kitchen: [
    { id:'K1', x:0.07, y:0.04, row:1 }, { id:'K2', x:0.22, y:0.07, row:1 },
    { id:'K3', x:0.14, y:0.38, row:0 },
    { id:'K4', x:0.07, y:0.74, row:2 }, { id:'K5', x:0.21, y:0.78, row:2 }
  ],
  living: [
    { id:'L1', x:0.36, y:0.04, row:1 }, { id:'L2', x:0.64, y:0.04, row:1 },
    { id:'L3', x:0.39, y:0.34, row:0 }, { id:'L4', x:0.66, y:0.38, row:0 },
    { id:'L5', x:0.42, y:0.20, row:0 }, { id:'L6', x:0.55, y:0.20, row:0 },
    { id:'L7', x:0.50, y:0.60, row:2 },
    { id:'L8', x:0.34, y:0.76, row:2 }, { id:'L9', x:0.62, y:0.74, row:2 }
  ],
  bed: [
    { id:'B1', x:0.76, y:0.04, row:1 }, { id:'B2', x:0.95, y:0.08, row:1 },
    { id:'B3', x:0.72, y:0.38, row:0 }, { id:'B4', x:0.90, y:0.40, row:0 },
    { id:'B5', x:0.80, y:0.76, row:2 }, { id:'B6', x:0.88, y:0.78, row:2 }
  ]
};
const WALL_SLOTS = {
  kitchen: [{ id:'KW1', x:0.25 }, { id:'KW2', x:0.31 }],
  living:  [{ id:'LW1', x:0.34 }, { id:'LW2', x:0.60 }],
  bed:     [{ id:'BW1', x:0.68 }, { id:'BW2', x:0.78 }]
};
const SLOT = (zone, id) => (SLOTS[zone] || []).find(s => s.id === id);
const FURN = id => FURNITURE.find(f => f.id === id);
const BASE_FURN = FURNITURE.filter(f => f.base).map(f => f.id);
const ZONES = ['kitchen', 'living', 'bed'];
const ZONE_NAME = { kitchen:'주방', living:'거실', bed:'침실' };

/* 방에 늘 있는 것 */
const PLACES = [
  { id:'wardrobe', name:'옷장',      zone:'bed',    slot:'B2', sz:1.25, act:'wardrobe' },
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
const CAREER_NEED = [0, 2, 5, 9, 14, 20, 27, 36, 48, 62];    // 몇 번 일했나
const careerLv = n => { let l = 1; CAREER_NEED.forEach((v, i) => { if(n >= v) l = i + 1; }); return l; };
const careerPay = n => 1 + 0.05 * (careerLv(n) - 1);

const JOBS = [
  { id:'deliver', game:'run', name:'배달 알바', place:'동네 골목',
    desc:'장애물을 피해 달려서 배달', pay:'동전을 줍고 제시간에 도착하면 보너스', color:'#EFA6B8' },
  { id:'cafe', game:'cafe', name:'카페 알바', place:'골목 카페',
    desc:'손님 주문을 외워서 담기', pay:'길게 외울수록 팁이 커져요', color:'#D9C4A0' }
];
const JOB = id => JOBS.find(j => j.id === id);


/* ===== 오늘의 할 일 ===== */
const DAILY_POOL = [
  { id:'d_feed',  txt:'밥 두 번 주기',      need:2, kind:'care:feed',  pay:60 },
  { id:'d_pet',   txt:'30번 쓰다듬기',      need:30, kind:'pet',       pay:50 },
  { id:'d_play',  txt:'공놀이 한 번',       need:1, kind:'care:play',  pay:45 },
  { id:'d_clean', txt:'방 청소하기',        need:1, kind:'care:clean', pay:40 },
  { id:'d_job',   txt:'알바 한 번 다녀오기', need:1, kind:'job',        pay:80 },
  { id:'d_wash',  txt:'깨끗하게 씻기기',    need:1, kind:'care:wash',  pay:45 },
  { id:'d_water', txt:'화분에 물 주기',     need:1, kind:'care:water', pay:35 },
  { id:'d_coin',  txt:'클로버 300 모으기',  need:300, kind:'earn',     pay:70 },
  { id:'d_guest', txt:'손님에게 간식 주기',  need:1, kind:'guest',     pay:65 }
];

/* ===== 업적 ===== */


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

/* ===== 날씨 — 하루 단위로 정해진다 ===== */
const WEATHERS = [
  { id:'sun',   name:'맑음',   odds:46, note:'볕이 좋아요',        fun:2,  pay:1.00 },
  { id:'cloud', name:'흐림',   odds:24, note:'구름이 많아요',      fun:0,  pay:1.00 },
  { id:'rain',  name:'비',     odds:22, note:'비가 와요',          fun:-2, pay:1.12 },
  { id:'snow',  name:'눈',     odds:8,  note:'눈이 내려요!',       fun:3,  pay:1.20 }
];
function dayKey(d){ d = d || new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
/* 같은 날이면 늘 같은 날씨가 나오도록 날짜를 씨앗으로 */
function weatherOf(key){
  let x = (key * 9301 + 49297) % 233280, r = (x / 233280) * 100, acc = 0;
  for(const w of WEATHERS){ acc += w.odds; if(r < acc) return w; }
  return WEATHERS[0];
}
const WEATHER = () => weatherOf(dayKey());

/* ===== 손님 ===== */
const GUEST_LINES = [
  '놀러 왔어요!', '지나가다 들렀어요', '집 예쁘다~', '간식 있어요?', '오랜만이에요!'
];
const GUEST_GIFTS = [
  { kind:'clover', n:180, txt:'클로버 180' },
  { kind:'clover', n:260, txt:'클로버 260' },
  { kind:'item',   id:'snack', txt:'간식 하나' },
  { kind:'love',   n:14, txt:'마음 듬뿍' }
];
