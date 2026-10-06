"use strict";
/* 모습·곡·난이도 데이터 — 꺅두기 하우스 */

/* ===== 에셋 ===== */
const SRC = {
  wool:"assets/run.png", wing:"assets/jump.png", poot:"assets/fall.png", clover:"assets/clover.png",
  clown:"assets/clown.png", cowboy:"assets/cowboy.png", fairy:"assets/fairy.png",
  rabbit:"assets/rabbit.png", cat:"assets/cat.png", bear:"assets/bear.png",
  killer:"assets/killer.png", baby:"assets/baby.png", proud:"assets/proud.png",
  icecream:"assets/icecream.png", holdbaby:"assets/holdbaby.png", belly:"assets/belly.png",
  car:"assets/car.png", school:"assets/school.png", snail:"assets/snail.png",
  ring:"assets/ring.png", dugicat:"assets/dugicat.png", cute:"assets/cute.png", chunk:"assets/chunk.png",
  hatdugi:"assets/hatdugi.png", stack:"assets/stack.png", sky:"assets/sky.png", deer:"assets/deer.png",
  bug:"assets/bug.png", sweat:"assets/sweat.png", fart:"assets/fart.png", monster:"assets/monster.png",
  circus:"assets/circus.png", meh:"assets/meh.png", cry:"assets/cry.png"
};
const IMG = {};
for(const k in SRC){ const im=new Image(); im.src=SRC[k]; IMG[k]=im; }

/* ===== 캐릭터 =====
   rank: base 기본 · N 흔함 · R 귀함 · SR 진귀 · UR 전설
   p = 뽑기 확률(%) · style: run 기본 / float 둥둥 / slide 미끄러짐 */
const RARITY = {
  base:{ name:'기본',  color:'#F3EAE1', note:'처음부터 있음' },
  N:   { name:'흔함',  color:'#DCEBD6', note:'합쳐서 78%' },
  R:   { name:'귀함',  color:'#8FC0D8', note:'합쳐서 19.7%' },
  SR:  { name:'진귀',  color:'#EFA6B8', note:'합쳐서 1.7%' },
  UR:  { name:'전설',  color:'#E0B84E', note:'합쳐서 0.5%' },
  /* 맨 위 한 칸 — 두기 한 마리만 들어 있습니다 */
  UU:  { name:'울트라초수퍼전설', short:'울초전', color:'#C98BE8', note:'단 0.1%' }
};
function C(o){ return Object.assign({ flip:true, scale:1, float:0, style:'run', accent:'#8FBF92' }, o); }
const CHARS = [
  C({ id:'wool', name:'양 두기', meta:'포근한 기본', rank:'base', p:0,
      run:'wool', jump:'wing', fall:'poot' }),

  /* ── 흔함 ── */
  C({ id:'proud',    name:'의젓 두기',   meta:'뒷짐 지고 당당하게', rank:'N',
      run:'proud', jump:'proud', fall:'proud', jumpRot:-0.18, fallRot:0.45, accent:'#D9C4A0' }),
  C({ id:'baby',     name:'애기 두기',   meta:'기저귀 차고 아장아장', rank:'N',
      run:'baby', jump:'baby', fall:'baby', scale:0.92, jumpRot:-0.2, fallRot:0.5, accent:'#8FC0D8' }),
  C({ id:'belly',    name:'뱃살 두기',   meta:'배가 먼저 도착함', rank:'N',
      run:'belly', jump:'belly', fall:'belly', scale:1.06, jumpRot:-0.12, fallRot:0.4, accent:'#F3EAE1' }),
  C({ id:'school',   name:'등교 두기',   meta:'터벅터벅 가방 메고', rank:'N',
      run:'school', jump:'school', fall:'school', scale:0.98, jumpRot:-0.15, fallRot:0.42, accent:'#AD9ED4' }),
  C({ id:'holdbaby', name:'애기 안은 두기', meta:'하나 더 데리고 뜀', rank:'N',
      run:'holdbaby', jump:'holdbaby', fall:'holdbaby', jumpRot:-0.16, fallRot:0.45, accent:'#EFA6B8' }),
  C({ id:'car',      name:'두기카 두기', meta:'두기가 두기를 태움', rank:'N',
      run:'car', jump:'car', fall:'car', scale:0.95, style:'slide', jumpRot:-0.1, fallRot:0.3, accent:'#8FC0D8' }),
  C({ id:'snail',    name:'달팽이 두기', meta:'느긋하게 미끄러짐', rank:'N',
      run:'snail', jump:'snail', fall:'snail', scale:0.88, style:'slide', jumpRot:-0.08, fallRot:0.3, accent:'#8FBF92' }),
  C({ id:'cute',     name:'귀여운 두기', meta:'그냥 귀엽다', rank:'UU',
      run:'cute', jump:'cute', fall:'cute', scale:0.96, jumpRot:-0.18, fallRot:0.45, accent:'#EFA6B8' }),
  C({ id:'meh',      name:'심드렁 두기', meta:'별로 안 놀란 표정', rank:'N',
      run:'meh', jump:'meh', fall:'meh', jumpRot:-0.16, fallRot:0.42, accent:'#DCC7A9' }),
  C({ id:'chunk',    name:'통통 두기',   meta:'선이 아주 굵음', rank:'N',
      run:'chunk', jump:'chunk', fall:'chunk', scale:1.04, style:'slide', jumpRot:-0.12, fallRot:0.36, accent:'#D9C4A0' }),
  C({ id:'sweat',    name:'뻘뻘 두기',   meta:'땀 흘리며 달림', rank:'N',
      run:'sweat', jump:'sweat', fall:'sweat', scale:0.98, jumpRot:-0.22, fallRot:0.5, accent:'#8FC0D8' }),
  C({ id:'fart',     name:'푸슉 두기',   meta:'추진력을 얻는 중', rank:'N',
      run:'fart', jump:'fart', fall:'fart', flip:false, scale:1.0, style:'slide', jumpRot:-0.1, fallRot:0.3, accent:'#DCC7A9' }),

  /* ── 귀함 ── */
  C({ id:'rabbit',  name:'토끼탈 두기',  meta:'분홍 토끼탈', rank:'R',
      run:'rabbit', jump:'rabbit', fall:'rabbit', jumpRot:-0.2, fallRot:0.5, accent:'#EFA6B8' }),
  C({ id:'cat',     name:'고양이탈 두기', meta:'노란 고양이탈', rank:'R',
      run:'cat', jump:'cat', fall:'cat', jumpRot:-0.2, fallRot:0.5, accent:'#F5C36B' }),
  C({ id:'bear',    name:'곰 두기',      meta:'갈색 곰 옷', rank:'R',
      run:'bear', jump:'bear', fall:'bear', jumpRot:-0.2, fallRot:0.5, accent:'#A9805A' }),
  C({ id:'icecream',name:'초코 두기',    meta:'아이스크림 한 손에', rank:'R',
      run:'icecream', jump:'icecream', fall:'icecream', scale:0.95, jumpRot:-0.15, fallRot:0.45, accent:'#8B5E3C' }),
  C({ id:'clown',   name:'광대 두기',    meta:'무지개 가발', rank:'R',
      run:'clown', jump:'clown', fall:'clown', jumpRot:-0.22, fallRot:0.5, accent:'#EFA6B8' }),
  C({ id:'cowboy',  name:'카우보이 두기', meta:'카피바라 탑승', rank:'R',
      run:'cowboy', jump:'cowboy', fall:'cowboy', flip:false, scale:1.18, style:'slide',
      jumpRot:-0.1, fallRot:-0.4, accent:'#D9C4A0' }),
  C({ id:'ring',    name:'튜브 두기',    meta:'튜브 끼고 둥실', rank:'R',
      run:'ring', jump:'ring', fall:'ring', scale:1.0, jumpRot:-0.14, fallRot:0.4, accent:'#8FC0D8' }),
  C({ id:'hatdugi', name:'모자 두기',    meta:'중절모를 받쳐 듦', rank:'R',
      run:'hatdugi', jump:'hatdugi', fall:'hatdugi', scale:1.02, jumpRot:-0.2, fallRot:0.48, accent:'#5A4A40' }),
  C({ id:'dugicat', name:'두기냥이',     meta:'고양이가 되어버림', rank:'R',
      run:'dugicat', jump:'dugicat', fall:'dugicat', flip:false, scale:1.12, style:'slide',
      jumpRot:-0.1, fallRot:-0.32, accent:'#DCC7A9' }),
  C({ id:'bug',     name:'두키벌레',     meta:'키운다 vs 썩 꺼져라', rank:'R',
      run:'bug', jump:'bug', fall:'bug', flip:false, scale:1.06, float:14, style:'float',
      jumpRot:-0.12, fallRot:-0.34, accent:'#8FBF92' }),
  C({ id:'cry',     name:'앙앙 두기',    meta:'서럽게 우는 중', rank:'R',
      run:'cry', jump:'cry', fall:'cry', scale:1.0, jumpRot:-0.24, fallRot:0.52, accent:'#8FC0D8' }),

  /* ── 진귀 ── */
  C({ id:'fairy',  name:'요정 두기',     meta:'땅에 안 닿고 둥둥', rank:'SR',
      run:'fairy', jump:'fairy', fall:'fairy', flip:false, scale:1.02, float:26, style:'float',
      jumpRot:-0.12, fallRot:-0.45, accent:'#8FC0D8' }),
  C({ id:'killer', name:'살인마 두기',   meta:'칼 들고 뛰어옴', rank:'SR',
      run:'killer', jump:'killer', fall:'killer', scale:0.95, jumpRot:-0.2, fallRot:0.5, accent:'#C9A9A9' }),
  C({ id:'stack',  name:'삼단 두기',     meta:'셋이 쌓여서 하나', rank:'SR',
      run:'stack', jump:'stack', fall:'stack', scale:1.22, jumpRot:-0.1, fallRot:0.34, accent:'#AD9ED4' }),
  C({ id:'circus', name:'곡예 두기',     meta:'공 위에서 균형', rank:'SR',
      run:'circus', jump:'circus', fall:'circus', scale:1.08, jumpRot:-0.16, fallRot:0.44, accent:'#E0A45C' }),
  C({ id:'monster',name:'괴물 두기',     meta:'이빨이 아주 많음', rank:'SR',
      run:'monster', jump:'monster', fall:'monster', flip:false, scale:1.1, style:'slide',
      jumpRot:-0.14, fallRot:-0.4, accent:'#8FC0D8' }),

  /* ── 전설 ── */
  C({ id:'sky',   name:'하늘 두기',   meta:'새를 타고 날아감', rank:'UR',
      run:'sky', jump:'sky', fall:'sky', flip:false, scale:1.16, float:34, style:'float',
      jumpRot:-0.1, fallRot:-0.4, accent:'#8FC0D8' }),
  C({ id:'deer',  name:'루돌프 두기', meta:'일 년에 한 번 나옴', rank:'UR',
      run:'deer', jump:'deer', fall:'deer', scale:1.06, jumpRot:-0.22, fallRot:0.5, accent:'#D4708A' })
];
const COMING = [];

/* ===== 음이름 → 주파수 ===== */
const PC={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
function midi(n){ const m=/^([A-G])([#b]?)(-?\d)$/.exec(n); if(!m) return 60;
  return PC[m[1]] + (m[2]==='#'?1:m[2]==='b'?-1:0) + (parseInt(m[3],10)+1)*12; }
function hz(n){ return 440*Math.pow(2,(midi(n)-69)/12); }
const CH={ C:['C3','E3','G3'], G:['G2','B2','D3'], F:['F2','A2','C3'], Am:['A2','C3','E3'],
           Dm:['D3','F3','A3'], Em:['E3','G3','B3'], Bb:['Bb2','D3','F3'], D:['D3','F#3','A3'] };
