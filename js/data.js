"use strict";
/* 모습·곡·난이도 데이터 — 꺅두기 하우스 */

/* ===== 에셋 ===== */
const SRC = {
  wool:"assets/run.png", wing:"assets/jump.png", poot:"assets/fall.png", clover:"assets/clover.png",
  clown:"assets/clown.png", cowboy:"assets/cowboy.png", fairy:"assets/fairy.png",
  rabbit:"assets/rabbit.png", cat:"assets/cat.png", bear:"assets/bear.png",
  huggy:"assets/huggy.png", killer:"assets/killer.png", baby:"assets/baby.png", proud:"assets/proud.png",
  icecream:"assets/icecream.png", holdbaby:"assets/holdbaby.png", belly:"assets/belly.png",
  car:"assets/car.png", school:"assets/school.png", snail:"assets/snail.png"
};
const IMG = {};
for(const k in SRC){ const im=new Image(); im.src=SRC[k]; IMG[k]=im; }

/* ===== 캐릭터 =====
   rank: base 기본 · N 흔함 · R 귀함 · SR 아주 귀함 · SSR 전설
   p = 뽑기 확률(%) · style: run 기본 / float 둥둥 / slide 미끄러짐 */
const RARITY = {
  base:{ name:'기본',      color:'#F3EAE1', note:'처음부터 있음' },
  N:   { name:'흔함',      color:'#DCEBD6', note:'각 7.9%' },
  R:   { name:'귀함',      color:'#8FC0D8', note:'각 5.3%' },
  SR:  { name:'아주 귀함', color:'#EFA6B8', note:'각 3.7%' },
  SSR: { name:'전설',      color:'#AD9ED4', note:'2%' }
};
function C(o){ return Object.assign({ flip:true, scale:1, float:0, style:'run', accent:'#8FBF92' }, o); }
const CHARS = [
  C({ id:'wool', name:'양 두기', meta:'포근한 기본', rank:'base', p:0,
      run:'wool', jump:'wing', fall:'poot' }),

  C({ id:'proud',    name:'의젓 두기',   meta:'뒷짐 지고 당당하게', rank:'N', p:7.9,
      run:'proud', jump:'proud', fall:'proud', jumpRot:-0.18, fallRot:0.45, accent:'#D9C4A0' }),
  C({ id:'baby',     name:'애기 두기',   meta:'기저귀 차고 아장아장', rank:'N', p:7.9,
      run:'baby', jump:'baby', fall:'baby', scale:0.92, jumpRot:-0.2, fallRot:0.5, accent:'#8FC0D8' }),
  C({ id:'belly',    name:'뱃살 두기',   meta:'배가 먼저 도착함', rank:'N', p:7.9,
      run:'belly', jump:'belly', fall:'belly', scale:1.06, jumpRot:-0.12, fallRot:0.4, accent:'#F3EAE1' }),
  C({ id:'school',   name:'등교 두기',   meta:'터벅터벅 가방 메고', rank:'N', p:7.9,
      run:'school', jump:'school', fall:'school', scale:0.98, jumpRot:-0.15, fallRot:0.42, accent:'#AD9ED4' }),
  C({ id:'holdbaby', name:'애기 안은 두기', meta:'하나 더 데리고 뜀', rank:'N', p:7.9,
      run:'holdbaby', jump:'holdbaby', fall:'holdbaby', jumpRot:-0.16, fallRot:0.45, accent:'#EFA6B8' }),
  C({ id:'car',      name:'두기카 두기', meta:'두기가 두기를 태움', rank:'N', p:7.9,
      run:'car', jump:'car', fall:'car', scale:0.95, style:'slide', jumpRot:-0.1, fallRot:0.3, accent:'#8FC0D8' }),
  C({ id:'snail',    name:'달팽이 두기', meta:'느긋하게 미끄러짐', rank:'N', p:7.9,
      run:'snail', jump:'snail', fall:'snail', scale:0.88, style:'slide', jumpRot:-0.08, fallRot:0.3, accent:'#8FBF92' }),

  C({ id:'rabbit',  name:'토끼탈 두기',  meta:'분홍 토끼탈', rank:'R', p:5.3,
      run:'rabbit', jump:'rabbit', fall:'rabbit', jumpRot:-0.2, fallRot:0.5, accent:'#EFA6B8' }),
  C({ id:'cat',     name:'고양이탈 두기', meta:'노란 고양이탈', rank:'R', p:5.3,
      run:'cat', jump:'cat', fall:'cat', jumpRot:-0.2, fallRot:0.5, accent:'#F5C36B' }),
  C({ id:'bear',    name:'곰 두기',      meta:'갈색 곰 옷', rank:'R', p:5.3,
      run:'bear', jump:'bear', fall:'bear', jumpRot:-0.2, fallRot:0.5, accent:'#A9805A' }),
  C({ id:'icecream',name:'초코 두기',    meta:'아이스크림 한 손에', rank:'R', p:5.3,
      run:'icecream', jump:'icecream', fall:'icecream', scale:0.95, jumpRot:-0.15, fallRot:0.45, accent:'#8B5E3C' }),
  C({ id:'clown',   name:'광대 두기',    meta:'무지개 가발', rank:'R', p:5.3,
      run:'clown', jump:'clown', fall:'clown', jumpRot:-0.22, fallRot:0.5, accent:'#EFA6B8' }),
  C({ id:'cowboy',  name:'카우보이 두기', meta:'카피바라 탑승', rank:'R', p:5.3,
      run:'cowboy', jump:'cowboy', fall:'cowboy', flip:false, scale:1.18, style:'slide',
      jumpRot:-0.1, fallRot:-0.4, accent:'#D9C4A0' }),

  C({ id:'fairy',  name:'요정 두기',     meta:'땅에 안 닿고 둥둥', rank:'SR', p:3.7,
      run:'fairy', jump:'fairy', fall:'fairy', flip:false, scale:1.02, float:26, style:'float',
      jumpRot:-0.12, fallRot:-0.45, accent:'#8FC0D8' }),
  C({ id:'huggy',  name:'허기워기 두기', meta:'이빨이 아주 많음', rank:'SR', p:3.7,
      run:'huggy', jump:'huggy', fall:'huggy', scale:1.05, jumpRot:-0.25, fallRot:0.55, accent:'#C9A9A9' }),
  C({ id:'killer', name:'살인마 두기',   meta:'칼 들고 뛰어옴', rank:'SR', p:3.7,
      run:'killer', jump:'killer', fall:'killer', scale:0.95, jumpRot:-0.2, fallRot:0.5, accent:'#C9A9A9' })
];
const COMING = [{ name:'3D 두기', meta:'모델링해서 넣을 자리', rank:'SSR', p:2 }];

/* ===== 음이름 → 주파수 ===== */
const PC={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
function midi(n){ const m=/^([A-G])([#b]?)(-?\d)$/.exec(n); if(!m) return 60;
  return PC[m[1]] + (m[2]==='#'?1:m[2]==='b'?-1:0) + (parseInt(m[3],10)+1)*12; }
function hz(n){ return 440*Math.pow(2,(midi(n)-69)/12); }
const CH={ C:['C3','E3','G3'], G:['G2','B2','D3'], F:['F2','A2','C3'], Am:['A2','C3','E3'],
           Dm:['D3','F3','A3'], Em:['E3','G3','B3'], Bb:['Bb2','D3','F3'], D:['D3','F#3','A3'] };

/* ===== 곡 =====
   마디 = [칸, 음이름, 길이(칸), 'jump'?] · null 마디는 반주만 (인트로/여운) */
const S1A=[
 [[0,'C5',1],[2,'D5',1],[4,'E5',1],[6,'G5',1,'jump']],
 [[0,'E5',3],[4,'D5',1],[6,'E5',1]],
 [[0,'G5',1],[2,'E5',1],[4,'D5',1],[6,'C5',1]],
 [[0,'A4',4]],
 [[0,'C5',1],[2,'D5',1],[4,'E5',1],[6,'G5',1]],
 [[0,'A5',3,'jump'],[4,'G5',1],[6,'E5',1]],
 [[0,'D5',1],[2,'E5',1],[4,'G5',1],[6,'E5',1]],
 [[0,'C5',6]]];
const S1B=[
 [[0,'G5',1],[2,'A5',1],[4,'C6',1,'jump'],[6,'A5',1]],
 [[0,'G5',3],[4,'E5',1],[6,'G5',1]],
 [[0,'A5',1,'jump'],[2,'G5',1],[4,'E5',1],[6,'D5',1]],
 [[0,'E5',4]]];

const S2A=[
 [[0,'A4',1],[2,'C5',1],[4,'D5',1],[6,'E5',1,'jump']],
 [[0,'G5',3],[4,'E5',1],[6,'D5',1]],
 [[0,'E5',1],[2,'D5',1],[4,'C5',1],[6,'A4',1]],
 [[0,'C5',4]],
 [[0,'E5',1],[2,'G5',1],[4,'A5',1,'jump'],[6,'G5',1]],
 [[0,'E5',3],[4,'D5',1],[6,'C5',1]],
 [[0,'D5',1],[2,'E5',1],[4,'G5',1],[6,'E5',1]],
 [[0,'A4',6]]];
const S2B=[
 [[0,'C6',1,'jump'],[2,'A5',1],[4,'G5',1],[6,'E5',1]],
 [[0,'D5',3],[4,'E5',1],[6,'G5',1]],
 [[0,'A5',1],[2,'G5',1],[4,'E5',1],[6,'D5',1]],
 [[0,'C5',4]]];

const S3A=[
 [[0,'G4',2],[2,'D5',1],[3,'B4',1],[4,'D5',2]],
 [[0,'E5',2],[2,'D5',1],[3,'B4',1],[4,'A4',2]],
 [[0,'B4',2],[2,'E5',1],[3,'D5',1],[4,'B4',2]],
 [[0,'G4',6]],
 [[0,'D5',2],[2,'G5',1,'jump'],[3,'E5',1],[4,'D5',2]],
 [[0,'B4',2],[2,'D5',1],[3,'E5',1],[4,'G5',2]],
 [[0,'E5',2],[2,'D5',1],[3,'B4',1],[4,'A4',2]],
 [[0,'G4',6]]];
const S3B=[
 [[0,'E5',2],[2,'G5',1],[3,'A5',1,'jump'],[4,'G5',2]],
 [[0,'E5',3],[3,'D5',1],[4,'B4',2]],
 [[0,'D5',2],[2,'E5',1],[3,'G5',1],[4,'E5',2]],
 [[0,'D5',6]]];

const S4A=[
 [[0,'F4',1],[1,'A4',1],[2,'C5',1],[4,'D5',1],[6,'C5',1]],
 [[0,'A4',1],[2,'C5',1],[4,'F5',1,'jump'],[6,'D5',1]],
 [[0,'C5',1],[1,'D5',1],[2,'C5',1],[4,'A4',1],[6,'G4',1]],
 [[0,'F4',4]],
 [[0,'C5',1],[2,'D5',1],[4,'F5',1,'jump'],[5,'D5',1],[6,'C5',1]],
 [[0,'A4',1],[2,'C5',1],[4,'D5',1],[6,'C5',1]],
 [[0,'F5',1],[2,'D5',1],[4,'C5',1],[6,'A4',1]],
 [[0,'F4',6]]];
const S4B=[
 [[0,'D5',1],[2,'F5',1],[4,'G5',1,'jump'],[6,'F5',1]],
 [[0,'D5',3],[4,'C5',1],[6,'A4',1]],
 [[0,'C5',1],[2,'D5',1],[4,'F5',1],[6,'D5',1]],
 [[0,'C5',4]]];

function mkSong(o){
  o.bars = [null,null, ...o.A, ...o.B, ...o.A.slice(4), null, null];
  o.step = 60/o.bpm/ (o.spb===6 ? 1 : 2) / (o.spb===6 ? 2 : 1);
  o.beat = 60/o.bpm;
  o.step = o.beat/2;                    // 8분음표 한 칸 (왈츠도 동일)
  o.barDur = o.step*o.spb;
  o.end = o.bars.length*o.barDur;
  return o;
}
const SONGS = [
  mkSong({ id:'clover', title:'클로버 산책', mood:'포근한 산책길', bpm:112, spb:8,
    A:S1A, B:S1B, wave:'square', cut:3200,
    chords:['C','G','C','G','F','G','C','Am','F','G','F','C','G','G','C','Am','F','G','C','C'],
    kick:[0,4], clap:[2,6], hat:[0,1,2,3,4,5,6,7], theme:'meadow' }),
  mkSong({ id:'puddle', title:'물웅덩이 탭댄스', mood:'비 갠 오후', bpm:126, spb:8,
    A:S2A, B:S2B, wave:'triangle', cut:2600,
    chords:['Am','F','Am','F','C','G','Am','F','Dm','Em','F','C','Dm','Em','C','G','Am','F','Am','Am'],
    kick:[0,3,4], clap:[2,6], hat:[0,2,4,6], theme:'rain' }),
  mkSong({ id:'star', title:'별사탕 왈츠', mood:'밤하늘 셋박자', bpm:150, spb:6,
    A:S3A, B:S3B, wave:'sine', cut:2200,
    chords:['G','Em','G','Em','C','D','G','Em','C','D','C','G','D','D','C','D','G','Em','G','G'],
    kick:[0], clap:[2,4], hat:[0,2,4], theme:'night' }),
  mkSong({ id:'speed', title:'푸슝 스피드런', mood:'전속력 사막', bpm:150, spb:8,
    A:S4A, B:S4B, wave:'sawtooth', cut:2900,
    chords:['F','C','F','C','Dm','C','F','C','Bb','C','Dm','Bb','C','C','Dm','C','F','C','F','F'],
    kick:[0,2,4,6], clap:[4], hat:[0,1,2,3,4,5,6,7], theme:'desert' })
];

/* ===== 곡 표지 ===== */
const COVERS={
  clover:'<svg viewBox="0 0 64 64"><rect width="64" height="64" rx="10" fill="#EAF6E4"/>'+
    '<circle cx="47" cy="17" r="8" fill="#FFE9A8"/>'+
    '<path d="M-2 48 Q16 33 34 48 Q48 38 66 48 L66 66 L-2 66Z" fill="#DCE9CE"/>'+
    '<g stroke="#5A4A40" stroke-width="2" fill="#8FBF92">'+
    '<circle cx="24" cy="30" r="6"/><circle cx="34" cy="30" r="6"/>'+
    '<circle cx="29" cy="24" r="6"/><circle cx="29" cy="36" r="6"/></g>'+
    '<path d="M29 38 L29 52" stroke="#8FBF92" stroke-width="3" fill="none"/></svg>',
  puddle:'<svg viewBox="0 0 64 64"><rect width="64" height="64" rx="10" fill="#DCE9F0"/>'+
    '<g stroke="#8FC0D8" stroke-width="3" stroke-linecap="round">'+
    '<path d="M14 8 L10 20"/><path d="M28 4 L24 18"/><path d="M44 10 L40 22"/><path d="M56 6 L52 18"/>'+
    '<path d="M20 26 L16 36"/><path d="M38 28 L34 38"/></g>'+
    '<ellipse cx="32" cy="50" rx="22" ry="7" fill="#8FC0D8" stroke="#5A4A40" stroke-width="2"/>'+
    '<ellipse cx="27" cy="49" rx="9" ry="2.6" fill="none" stroke="#FFF8F0" stroke-width="2"/></svg>',
  star:'<svg viewBox="0 0 64 64"><rect width="64" height="64" rx="10" fill="#38456A"/>'+
    '<g fill="#FFF6D8"><circle cx="12" cy="14" r="1.8"/><circle cx="26" cy="8" r="1.3"/>'+
    '<circle cx="50" cy="12" r="1.6"/><circle cx="18" cy="30" r="1.2"/><circle cx="56" cy="30" r="1.4"/>'+
    '<circle cx="40" cy="22" r="1"/><circle cx="8" cy="44" r="1.2"/></g>'+
    '<circle cx="42" cy="24" r="12" fill="#FFF6D8"/><circle cx="47" cy="20" r="11" fill="#38456A"/>'+
    '<path d="M-2 52 Q16 42 34 52 Q48 45 66 52 L66 66 L-2 66Z" fill="#46557E"/></svg>',
  speed:'<svg viewBox="0 0 64 64"><rect width="64" height="64" rx="10" fill="#FFD9AE"/>'+
    '<circle cx="20" cy="20" r="10" fill="#FFB36B"/>'+
    '<g stroke="#D9A87B" stroke-width="3" stroke-linecap="round">'+
    '<path d="M6 34 L26 34"/><path d="M12 41 L34 41"/><path d="M4 48 L22 48"/></g>'+
    '<path d="M-2 52 Q20 45 40 52 Q54 47 66 52 L66 66 L-2 66Z" fill="#E8C49B"/>'+
    '<g fill="#8FAE6E" stroke="#5A4A40" stroke-width="2">'+
    '<rect x="44" y="30" width="9" height="24" rx="4"/>'+
    '<rect x="36" y="36" width="9" height="6" rx="3"/></g></svg>'
};

/* ===== 난이도 ===== */
const DIFFS = [
  { id:'easy',      name:'쉬움',   approach:2.20, wmul:1.20, mult:1.0, hint:'큰 박자만 · 판정 넉넉' },
  { id:'normal',    name:'보통',   approach:2.00, wmul:1.00, mult:1.2, hint:'멜로디 그대로' },
  { id:'hard',      name:'어려움', approach:1.70, wmul:0.88, mult:1.6, hint:'엇박 추가 · 노트가 빨라짐' },
  { id:'nightmare', name:'악몽',   approach:1.42, wmul:0.72, mult:2.2, hint:'8분음표 전부 · 판정 칼같음' }
];
