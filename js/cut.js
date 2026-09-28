"use strict";
/* 뽑기 연출 — 꺅두기 하우스 */

/* ===== 뽑기 연출 씬 (인트로 → 캐릭터 공개 → 결과) ===== */
const CUTC={
  N: {s1:'#E9F6E2',s2:'#FFF8F0',orb:'#8FBF92',ray:'rgba(123,196,127,.16)',
      plate:'#EAF6E4',label:'',intro:3.6,rev:2.4},
  R: {s1:'#DCEFFA',s2:'#FFF8F0',orb:'#8FC0D8',ray:'rgba(169,217,240,.22)',
      plate:'#DFF0FA',label:'귀한 예감!',intro:4.4,rev:2.9},
  SR:{s1:'#FFDFE9',s2:'#FFF7D6',orb:'#FF9EB5',ray:'rgba(255,158,181,.26)',
      plate:'#FFE3EC',label:'아주 귀함!',intro:5.2,rev:3.6}
};
let cut=null;

function startCut(rank, results, onDone){
  const cast=[];
  const pool=CHARS.filter(c=>c.id!==char.id);
  const pick=[char].concat(pool.sort(()=>Math.random()-0.5).slice(0,5));
  pick.forEach((c,i)=>{
    const depth=0.55+Math.random()*0.55;
    cast.push({c, depth,
      tx: W*(0.10+i*0.145)+ (Math.random()-.5)*30,
      delay: i*0.13+Math.random()*0.1,
      yOff: (1-depth)*H*0.10, ph: Math.random()*6.3});
  });
  cast.sort((a,b)=>a.depth-b.depth);
  cut={phase:'intro', t:0, rank, results, idx:0, onDone,
       cast, sparks:[], rings:[], burst:false, plateSeed:Math.random()*6.3};
  sweepUp(CUTC[rank].intro*0.92, rank);
}
function skipCut(){ if(!cut) return; const f=cut.onDone; cut=null; f(); }   // 전부 건너뛰기
function advanceCut(){                                                      // 한 컷 넘기기
  if(!cut) return;
  if(cut.phase==='intro'){ cut.t=Math.max(cut.t, CUTC[cut.rank].intro*0.90); }
  else { nextReveal(); }
}
function nextReveal(){
  cut.idx++;
  if(cut.idx>=cut.results.length){ const f=cut.onDone; cut=null; f(); return; }
  cut.t=0; cut.stamped=false; cut.plateSeed=Math.random()*6.3;
  revealSound(cut.results[cut.idx].rank);
}
function revealSound(rank){
  if(rank==='SR'){ arp([784,1175],0.13,0.16,'square'); setTimeout(shimmer,140); }
  else if(rank==='R') arp([659,988],0.12,0.13);
  else arp([587,880],0.11,0.11);
}
function swish(){
  if(!ctx) return;
  const t=ctx.currentTime, s=ctx.createBufferSource(), g2=ctx.createGain(), f=ctx.createBiquadFilter();
  s.buffer=noise(); f.type='bandpass'; f.frequency.setValueAtTime(600,t);
  f.frequency.exponentialRampToValueAtTime(4200,t+0.25); f.Q.value=1.4;
  g2.gain.setValueAtTime(0.0001,t); g2.gain.exponentialRampToValueAtTime(0.12,t+0.12);
  g2.gain.exponentialRampToValueAtTime(0.0001,t+0.3);
  s.connect(f); f.connect(g2); g2.connect(master); s.start(t); s.stop(t+0.35);
}
function sprite(key,x,y,h,rot,alpha,flip){
  const img=IMG[key];
  if(!img||!img.complete||!img.naturalWidth) return;
  const w=h*(img.naturalWidth/img.naturalHeight);
  g.save(); g.globalAlpha=alpha===undefined?1:alpha;
  g.translate(x,y); g.rotate(rot||0);
  if(flip) g.scale(-1,1);
  g.drawImage(img,-w/2,-h,w,h); g.restore();
}
function rays(cx,cy,spin,col,alpha,n){
  g.save(); g.translate(cx,cy); g.rotate(spin);
  const R=Math.max(W,H)*1.3;
  for(let i=0;i<(n||14);i++){
    g.rotate(Math.PI*2/(n||14));
    g.beginPath(); g.moveTo(0,0);
    g.lineTo(Math.cos(-0.055)*R,Math.sin(-0.055)*R);
    g.lineTo(Math.cos(0.055)*R,Math.sin(0.055)*R);
    g.closePath(); g.globalAlpha=alpha; g.fillStyle=col; g.fill();
  }
  g.restore(); g.globalAlpha=1;
}
const easeOut=t=>1-Math.pow(1-t,3);
const easeBack=t=>{ const c=1.70158+1; return 1+c*Math.pow(t-1,3)+1.70158*Math.pow(t-1,2); };

/* ── 인트로: 두기들이 모여들고 클로버가 터진다 ── */
function drawIntro(dt){
  const C=CUTC[cut.rank], dur=C.intro, p=Math.min(1,cut.t/dur);
  const ox=W*0.5, oy=H*0.40, gy=H*0.84;
  const heat=Math.max(0,Math.min(1,(p-0.34)/0.52));

  let sx=0,sy=0;
  if(p>0.60 && p<0.90){ const k=(cut.rank==='SR'?8:cut.rank==='R'?5:2.5)*heat;
    sx=(Math.random()-.5)*k; sy=(Math.random()-.5)*k; }
  g.save(); g.translate(sx,sy);

  const grd=g.createLinearGradient(0,0,0,H);
  grd.addColorStop(0,C.s1); grd.addColorStop(1,C.s2);
  g.fillStyle=grd; g.fillRect(-20,-20,W+40,H+40);
  if(p>0.10) rays(ox,oy,cut.t*(0.35+heat*2.0),C.ray,0.22+heat*0.7);

  if(Math.random()<0.45+heat) cut.sparks.push({x:Math.random()*W,y:H+10,
    v:50+Math.random()*170*(1+heat), r:2+Math.random()*4, a:1});
  cut.sparks.forEach(s=>{ if(s.vx!==undefined){ s.x+=s.vx*dt; s.y+=s.vy*dt; s.vy+=480*dt; }
                          else s.y-=s.v*dt; s.a-=dt*0.35; });
  cut.sparks=cut.sparks.filter(s=>s.a>0 && s.y>-30);
  cut.sparks.forEach(s=>{ g.globalAlpha=Math.max(0,s.a)*0.85; g.fillStyle=C.orb;
    g.beginPath(); g.arc(s.x,s.y,s.r,0,6.3); g.fill(); });
  g.globalAlpha=1;

  g.strokeStyle='rgba(120,95,75,.45)'; g.lineWidth=LW();
  g.beginPath(); for(let x=0;x<=W;x+=14) g.lineTo(x,gy+Math.sin((x+cut.t*160)*0.03)*1.6); g.stroke();

  // 두기들이 하나씩 달려 들어와 자리를 잡는다
  cut.cast.forEach(m=>{
    const lt=Math.max(0, cut.t-m.delay), run=Math.min(1, lt/0.85);
    const x=-W*0.15+(m.tx+W*0.15)*easeOut(run);
    const h=Math.min(H*0.20, W*0.13)*m.depth*(m.c.scale||1);
    const base=gy-m.yOff;
    let y=base, rot=0, key=m.c.run;
    if(run<1) y=base-Math.abs(Math.sin(lt*22))*9*m.depth;              // 달려온다
    else if(p<0.86) y=base-Math.abs(Math.sin(cut.t*5+m.ph))*5*(1+heat); // 제자리 통통
    else {                                                              // 놀라서 점프
      const jp=Math.min(1,(p-0.86)/0.14);
      y=base-Math.sin(jp*Math.PI)*H*0.13*m.depth; key=m.c.jump; rot=(m.c.jumpRot||-0.15)*0.8;
    }
    sprite(key, x, y, h, rot, 0.55+0.45*m.depth, m.c.flip);
  });

  // 네잎클로버
  if(p>0.30){
    const drop=Math.min(1,(p-0.30)/0.16);
    const oyy=oy-(1-easeOut(drop))*H*0.6;
    const R=Math.min(W,H)*0.10*(0.6+0.4*drop+heat*0.5);
    const jx=(Math.random()-.5)*7*heat, jy=(Math.random()-.5)*7*heat;
    const hal=g.createRadialGradient(ox+jx,oyy+jy,R*0.4,ox+jx,oyy+jy,R*3);
    hal.addColorStop(0,C.ray); hal.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle=hal; g.beginPath(); g.arc(ox+jx,oyy+jy,R*3,0,6.3); g.fill();
    g.save(); g.translate(ox+jx,oyy+jy); g.rotate(cut.t*0.7);
    g.strokeStyle='#5A4A40'; g.lineWidth=LW();
    g.beginPath(); g.moveTo(0,R*0.3); g.quadraticCurveTo(R*0.3,R*1.0,R*0.15,R*1.5); g.stroke();
    for(let i=0;i<4;i++){ g.rotate(Math.PI/2); wobble(0,-R*0.62,R*0.46,i*1.7,C.orb,'#5A4A40'); }
    g.fillStyle='#5A4A40'; g.beginPath(); g.arc(0,0,R*0.10,0,6.3); g.fill();
    if(p>0.66){
      g.strokeStyle='#5A4A40'; g.lineWidth=LW()*0.7; g.globalAlpha=Math.min(1,(p-0.66)/0.18);
      g.beginPath(); g.moveTo(-R*0.5,-R*0.3); g.lineTo(-R*0.1,0); g.lineTo(-R*0.35,R*0.4); g.stroke();
      g.beginPath(); g.moveTo(R*0.45,-R*0.35); g.lineTo(R*0.1,R*0.05); g.stroke();
      g.globalAlpha=1;
    }
    g.restore();
  }

  if(p>=0.88 && !cut.burst){
    cut.burst=true;
    for(let i=0;i<46;i++){ const a=Math.random()*6.283, v=220+Math.random()*560;
      cut.sparks.push({x:ox,y:oy,r:3+Math.random()*5,a:1,vx:Math.cos(a)*v,vy:Math.sin(a)*v}); }
    cut.rings.push({r:10,a:1},{r:10,a:1,d:0.14});
    if(cut.rank==='SR'){ arp([660,880,1175,1568],0.075,0.16,'square'); shimmer(); }
    else if(cut.rank==='R') arp([740,988],0.09,0.13); else arp([680],0,0.11);
  }
  cut.rings.forEach(r=>{ if(r.d>0){ r.d-=dt; return; } r.r+=dt*Math.max(W,H)*1.5; r.a-=dt*1.3; });
  cut.rings=cut.rings.filter(r=>r.a>0);
  cut.rings.forEach(r=>{ g.globalAlpha=Math.max(0,r.a); g.strokeStyle=C.orb; g.lineWidth=LW();
    g.beginPath(); g.arc(ox,oy,r.r,0,6.3); g.stroke(); });
  g.globalAlpha=1;

  if(p>=0.88){
    const f=Math.max(0,1-(p-0.88)/0.10);
    g.globalAlpha=f*0.95; g.fillStyle='#FFF'; g.fillRect(-20,-20,W+40,H+40); g.globalAlpha=1;
    if(C.label){
      const pop=Math.min(1,(p-0.90)/0.06);
      g.save(); g.translate(W/2,H*0.26); g.scale(0.7+0.45*pop,0.7+0.45*pop); g.rotate(-0.04);
      g.textAlign='center'; g.font='700 '+Math.round(Math.min(W,H)*0.11)+'px "Gaegu", sans-serif';
      g.lineWidth=LW(); g.strokeStyle='#5A4A40'; g.strokeText(C.label,0,0);
      g.fillStyle=cut.rank==='SR'?'#FFD36E':'#FFF8F0'; g.fillText(C.label,0,0);
      g.restore();
    }
  }
  g.restore();

  if(p>=1){ cut.phase='reveal'; cut.t=0; cut.idx=0; cut.stamped=false;
            cut.sparks=[]; cut.rings=[]; revealSound(cut.results[0].rank); }
}

/* ── 캐릭터 공개: 한 명씩 이름판과 함께 ── */
function drawReveal(dt){
  const r=cut.results[cut.idx], C=CUTC[r.rank];
  const dur=C.rev, q=Math.min(1,cut.t/dur);
  const cx=W*0.60, gy=H*0.86;

  let sx=0,sy=0;
  if(r.rank==='SR' && q>0.12 && q<0.24){ sx=(Math.random()-.5)*10; sy=(Math.random()-.5)*10; }
  g.save(); g.translate(sx,sy);

  const grd=g.createLinearGradient(0,0,0,H);
  grd.addColorStop(0,C.s1); grd.addColorStop(1,C.s2);
  g.fillStyle=grd; g.fillRect(-20,-20,W+40,H+40);
  rays(cx,H*0.42,cut.t*0.45,C.ray,0.30, r.rank==='SR'?18:12);

  // 캐릭터 등장
  const inP=Math.min(1,q/0.30);
  let x=cx, y=gy, rot=0, sc=1;
  if(r.rank==='SR'){                       // 정면에서 쾅
    sc=1+2.0*(1-easeOut(inP)); rot=0.18*(1-inP);
  } else {                                 // 옆에서 슝
    x=cx+(W*0.55)*(1-easeBack(inP)); rot=0.35*(1-inP);
  }
  const squash=q>0.30&&q<0.46 ? 1+0.10*Math.sin((q-0.30)/0.16*Math.PI) : 1;
  const bob=q>0.46 ? Math.sin(cut.t*3.4)*6 : 0;
  const H0=Math.min(H*0.52, W*0.34)*(r.c.scale||1)*sc;
  sprite(r.c.run, x, y-bob, H0/squash, rot, Math.min(1,q/0.12), r.c.flip);

  if(q<0.16){ const f=1-q/0.16;             // 등장 섬광
    g.globalAlpha=f*0.8; g.fillStyle='#FFF'; g.fillRect(-20,-20,W+40,H+40); g.globalAlpha=1; }

  // 이름판 — 왼쪽에서 따단
  if(q>0.30){
    const pp=Math.min(1,(q-0.30)/0.22), e=easeBack(pp);
    const pw=Math.min(W*0.46,340), ph=Math.min(H*0.30,116);
    const px=-pw+(W*0.06+pw)*e, py=H*0.30;
    g.save(); g.translate(px,py); g.rotate(-0.025+Math.sin(cut.t*1.6)*0.006);
    g.fillStyle=C.plate; roundRect(0,0,pw,ph,18); g.fill();
    g.lineWidth=LW(); g.strokeStyle='#5A4A40'; g.stroke();
    g.save(); roundRect(0,0,pw,ph,18); g.clip();      // 빛 훑기
    const sw=((cut.t*0.9)%1.6)/1.6;
    const sg=g.createLinearGradient(pw*(sw*1.6-0.4),0,pw*(sw*1.6-0.1),ph);
    sg.addColorStop(0,'rgba(255,255,255,0)'); sg.addColorStop(0.5,'rgba(255,255,255,.75)');
    sg.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle=sg; g.fillRect(0,0,pw,ph); g.restore();

    g.textAlign='left'; g.fillStyle='#C8A94B';
    g.font='700 '+Math.round(ph*0.20)+'px "Gaegu", sans-serif';
    g.fillText('★'.repeat(STARS[r.rank])+'  '+RARITY[r.rank].name, 18, ph*0.28);
    g.fillStyle='#5A4A40';
    g.font='700 '+Math.round(ph*0.36)+'px "Gaegu", sans-serif';
    g.fillText(r.c.name, 16, ph*0.66);
    g.fillStyle='#8A7264'; g.font='400 '+Math.round(ph*0.155)+'px "Gowun Dodum", sans-serif';
    g.fillText(r.c.meta, 18, ph*0.86);
    g.restore();
  }

  // NEW 도장 / 겹침 표시
  if(q>0.50){
    const st=Math.min(1,(q-0.50)/0.16);
    const scl=1+1.6*(1-easeOut(st));
    g.save(); g.translate(W*0.30, H*0.24); g.rotate(-0.30+0.30*(1-st)); g.scale(scl,scl);
    if(r.isNew){
      g.fillStyle='#EFA6B8'; roundRect(-52,-22,104,44,12); g.fill();
      g.lineWidth=LW(); g.strokeStyle='#5A4A40'; g.stroke();
      g.textAlign='center'; g.fillStyle='#5A4A40';
      g.font='700 30px "Gaegu", sans-serif'; g.fillText('NEW', 0, 11);
    } else {
      g.fillStyle='#EAF6E4'; roundRect(-68,-20,136,40,12); g.fill();
      g.lineWidth=LW(); g.strokeStyle='#5A4A40'; g.stroke();
      g.textAlign='center'; g.fillStyle='#4E8A52';
      g.font='700 24px "Gaegu", sans-serif'; g.fillText('겹침 +'+r.refund, 0, 9);
    }
    g.restore();
    if(!cut.stamped){ cut.stamped=true; blip(r.isNew?1180:520, 0.1);
      if(r.rank==='SR') for(let i=0;i<22;i++){ const a=Math.random()*6.283, v=160+Math.random()*320;
        cut.sparks.push({x:cx,y:H*0.55,r:3+Math.random()*4,a:1,vx:Math.cos(a)*v,vy:Math.sin(a)*v}); } }
  }

  // 반짝이
  if(r.rank!=='N' && Math.random()<0.6) cut.sparks.push({x:Math.random()*W,y:H+8,
    v:70+Math.random()*150, r:2+Math.random()*3, a:1});
  cut.sparks.forEach(s=>{ if(s.vx!==undefined){ s.x+=s.vx*dt; s.y+=s.vy*dt; s.vy+=430*dt; }
                          else s.y-=s.v*dt; s.a-=dt*0.5; });
  cut.sparks=cut.sparks.filter(s=>s.a>0 && s.y>-20);
  cut.sparks.forEach(s=>{ g.globalAlpha=Math.max(0,s.a)*0.85; g.fillStyle=C.orb;
    g.beginPath(); g.arc(s.x,s.y,s.r,0,6.3); g.fill(); });
  g.globalAlpha=1;

  // 몇 번째인지
  g.textAlign='right'; g.fillStyle='rgba(120,95,75,.45)';
  g.font='400 15px "Gowun Dodum", sans-serif';
  g.fillText((cut.idx+1)+' / '+cut.results.length, W-18, 30);
  g.restore();

  if(q>=1) nextReveal();
}

function drawCut(dt){
  cut.t+=dt;
  if(cut.phase==='intro') drawIntro(dt); else drawReveal(dt);
}
