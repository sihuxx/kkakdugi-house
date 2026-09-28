"use strict";
/* 리듬게임 배경 — 꺅두기 하우스 */

/* ===== 배경 테마 ===== */
function rgb(h){ return [parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)]; }
function mix(a,b,k){ const A=rgb(a),B=rgb(b);
  return 'rgb('+Math.round(A[0]+(B[0]-A[0])*k)+','+Math.round(A[1]+(B[1]-A[1])*k)+','+Math.round(A[2]+(B[2]-A[2])*k)+')'; }
const THEMES={
  meadow:{ props:['flower','mushroom','rock','tuft'], particle:'petal', pColor:'#EFA6B8', flyer:'bird',
    a:{sky1:'#D8EEFA',sky2:'#FFF8F0',far:'#EFE5D3',near:'#E3D6BE',ground:'#F7F1E4',ink:'#5A4A40',grass:'#8FBF92',orb:'sun',orbC:'#FFE9A8',star:0},
    b:{sky1:'#FFD2B8',sky2:'#FFF4E8',far:'#EBD5C0',near:'#DFBE9E',ground:'#F6E7D6',ink:'#5A4A40',grass:'#8FBF7A',orb:'sun',orbC:'#FFBF86',star:0} },
  rain:{ props:['puddle','tuft','puddle','rock'], particle:'rain', pColor:'#9FC9DE', flyer:'bird',
    a:{sky1:'#C3D6E0',sky2:'#EDF3F6',far:'#D6E2E6',near:'#C2D2D8',ground:'#E9F0F2',ink:'#2B3A40',grass:'#8FB9A8',orb:null,orbC:'#FFFFFF',star:0},
    b:{sky1:'#D9EDF6',sky2:'#FFF8F0',far:'#E2E9DE',near:'#CBDCCF',ground:'#F0F4EE',ink:'#2B3A40',grass:'#8FBF92',orb:'sun',orbC:'#FFF0C0',star:0} },
  night:{ props:['mushroom','rock','flower','mushroom'], particle:'sparkle', pColor:'#FFF3C4', flyer:'shoot',
    a:{sky1:'#26314F',sky2:'#5B6B94',far:'#3E4C74',near:'#313C5E',ground:'#39456A',ink:'#F2EFE4',grass:'#8FA6CE',orb:'moon',orbC:'#FFF6D8',star:1},
    b:{sky1:'#4B5A88',sky2:'#F4CDBE',far:'#6C6E95',near:'#4E4F79',ground:'#5A5A80',ink:'#F7F2E6',grass:'#A9AFD0',orb:'moon',orbC:'#FFF0D0',star:.4} },
  desert:{ props:['cactus','rock','cactus','tuft'], particle:'dust', pColor:'#D9C4A0', flyer:'tumble',
    a:{sky1:'#FFCF9A',sky2:'#FFF3E2',far:'#EDC79C',near:'#DCA87C',ground:'#F2DFC3',ink:'#3A2B22',grass:'#C9A46F',orb:'sun',orbC:'#FFB36B',star:0},
    b:{sky1:'#6E5E8C',sky2:'#E6A98E',far:'#8A7392',near:'#6B5570',ground:'#8A7561',ink:'#F6EFE4',grass:'#9A8A78',orb:'sun',orbC:'#FFD59E',star:.7} }
};
function lerpTheme(T,k){
  const a=T.a,b=T.b,o={};
  ['sky1','sky2','far','near','ground','ink','grass','orbC'].forEach(key=>o[key]=mix(a[key],b[key],k));
  o.orb=k<0.5?a.orb:b.orb; o.star=a.star+(b.star-a.star)*k;
  return o;
}

/* 배경 소품 / 입자 */
let props=[], bushes=[];
function seedScenery(){
  props=[]; bushes=[];
  for(let i=0;i<10;i++) props.push({x:i*190+Math.random()*60, kind:null, s:0.8+Math.random()*0.5});
  for(let i=0;i<7;i++) bushes.push({x:i*260+Math.random()*80, s:0.7+Math.random()*0.7});
}
function propKind(section){ const p=THEMES[song.theme].props; return p[section%p.length]; }

function drawProp(kind,x,gy,s,th){
  g.save(); g.translate(x,gy); g.scale(s,s);
  g.lineWidth=LW(); g.strokeStyle=th.ink; g.lineJoin='round';
  if(kind==='flower'){
    g.strokeStyle=th.grass; g.beginPath(); g.moveTo(0,0); g.quadraticCurveTo(2,-12,0,-22); g.stroke();
    g.fillStyle='#EFA6B8'; g.strokeStyle=th.ink;
    for(let i=0;i<5;i++){ const a=i/5*6.28; g.beginPath(); g.ellipse(Math.cos(a)*6,-22+Math.sin(a)*6,4.5,4.5,0,0,6.3); g.fill(); g.stroke(); }
    g.fillStyle='#FFE9A8'; g.beginPath(); g.arc(0,-22,3.4,0,6.3); g.fill(); g.stroke();
  } else if(kind==='mushroom'){
    g.fillStyle='#FFF8F0'; g.beginPath(); g.rect(-3.5,-14,7,14); g.fill(); g.stroke();
    g.fillStyle='#E88C8C'; g.beginPath(); g.ellipse(0,-14,13,9,0,Math.PI,0); g.fill(); g.stroke();
    g.fillStyle='#FFF8F0'; [[-5,-16],[4,-18],[0,-13]].forEach(p=>{ g.beginPath(); g.arc(p[0],p[1],2.1,0,6.3); g.fill(); });
  } else if(kind==='rock'){
    g.fillStyle=th.near; g.beginPath();
    g.moveTo(-13,0); g.quadraticCurveTo(-9,-12,0,-13); g.quadraticCurveTo(10,-12,13,0); g.closePath(); g.fill(); g.stroke();
  } else if(kind==='puddle'){
    g.fillStyle='#8FC0D8'; g.globalAlpha=.75;
    g.beginPath(); g.ellipse(0,-2,22,6,0,0,6.3); g.fill(); g.globalAlpha=1; g.stroke();
    g.strokeStyle='#FFF8F0'; g.lineWidth=LW()*0.55;
    g.beginPath(); g.ellipse(-4,-3,9,2.4,0,0,6.3); g.stroke();
  } else if(kind==='cactus'){
    g.fillStyle='#8FAE6E'; g.beginPath();
    g.moveTo(-5,0); g.lineTo(-5,-26); g.quadraticCurveTo(-5,-32,0,-32); g.quadraticCurveTo(5,-32,5,-26); g.lineTo(5,0); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(-5,-16); g.lineTo(-13,-16); g.lineTo(-13,-24); g.stroke();
    g.beginPath(); g.moveTo(5,-21); g.lineTo(12,-21); g.lineTo(12,-28); g.stroke();
  } else {                                  // tuft
    g.strokeStyle=th.grass; g.lineWidth=LW();
    g.beginPath(); g.moveTo(0,0); g.quadraticCurveTo(4,-11,11,-15); g.stroke();
    g.beginPath(); g.moveTo(0,0); g.quadraticCurveTo(-4,-10,-10,-14); g.stroke();
    g.beginPath(); g.moveTo(0,0); g.lineTo(0,-16); g.stroke();
  }
  g.restore();
}
function spawnParticles(dt,th){
  const kind=THEMES[song.theme].particle, col=THEMES[song.theme].pColor;
  let rate = kind==='rain'?70 : kind==='dust'?16 : kind==='sparkle'?7 : 7;
  if(REDUCED) rate*=0.3;
  if(parts.length>240) return;
  let n=rate*dt; n = Math.floor(n) + (Math.random() < (n%1) ? 1 : 0);
  for(let i=0;i<n;i++){
    if(kind==='rain') parts.push({k:kind,x:Math.random()*W*1.2,y:-10,vx:-150,vy:760,life:1,c:col});
    else if(kind==='dust') parts.push({k:kind,x:W+10,y:groundY()-Math.random()*26,vx:-240-Math.random()*120,vy:-6-Math.random()*20,r:2+Math.random()*4,life:1,c:col});
    else if(kind==='sparkle') parts.push({k:kind,x:Math.random()*W,y:Math.random()*groundY()*0.9,vx:-14,vy:8,r:1.5+Math.random()*2,life:1,c:col});
    else parts.push({k:'petal',x:W+10,y:Math.random()*H*0.45,vx:-58-Math.random()*45,vy:18+Math.random()*26,r:3.5+Math.random()*2.5,life:1,ph:Math.random()*6.3,c:col});
  }
}
function drawParticles(dt){
  for(const p of parts){
    p.x+=p.vx*dt; p.y+=p.vy*dt;
    if(p.k==='petal') p.x+=Math.sin((p.ph+=dt*2.4))*22*dt;
    if(p.k==='dust') p.life-=dt*1.1;
    else if(p.k==='sparkle') p.life-=dt*0.5;
    else if(p.k==='petal') p.life-=dt*0.09;
  }
  parts=parts.filter(p=>p.life>0 && p.y<H+20 && p.x>-30);
  for(const p of parts){
    g.globalAlpha=Math.max(0,Math.min(1,p.life))*(p.k==='sparkle'?0.5+0.5*Math.sin(performance.now()/300+p.x):1);
    if(p.k==='rain'){ g.strokeStyle=p.c; g.lineWidth=LW()*0.55; g.beginPath(); g.moveTo(p.x,p.y); g.lineTo(p.x-4,p.y+12); g.stroke(); }
    else { g.fillStyle=p.c; g.beginPath(); g.ellipse(p.x,p.y,p.r*(p.k==='petal'?1.5:1),p.r,p.k==='petal'?0.6:0,0,6.3); g.fill(); }
  }
  g.globalAlpha=1;
}
function spawnFlyer(){
  const k=THEMES[song.theme].flyer;
  if(k==='bird')   flyers.push({k, x:W+40, y:H*(0.12+Math.random()*0.18), vx:-110, ph:0});
  if(k==='shoot')  flyers.push({k, x:W*0.8, y:H*0.1, vx:-420, vy:180, life:1});
  if(k==='tumble') flyers.push({k, x:W+30, y:groundY()-12, vx:-230, rot:0});
}
function drawFlyers(dt,th){
  for(const f of flyers){
    f.x+=f.vx*dt; if(f.vy) f.y+=f.vy*dt; f.ph=(f.ph||0)+dt*8; if(f.k==='tumble') f.rot+=dt*7;
    g.strokeStyle=th.ink; g.lineWidth=LW()*0.7; g.lineCap='round';
    if(f.k==='bird'){
      for(let i=0;i<3;i++){
        const bx=f.x+i*26, by=f.y+Math.sin(f.ph+i)*5+(i%2)*12, w=7+Math.sin(f.ph+i)*3;
        g.beginPath(); g.moveTo(bx-9,by); g.quadraticCurveTo(bx-4,by-w,bx,by);
        g.quadraticCurveTo(bx+4,by-w,bx+9,by); g.stroke();
      }
    } else if(f.k==='shoot'){
      f.life-=dt*0.7; g.globalAlpha=Math.max(0,f.life); g.strokeStyle='#FFF3C4'; g.lineWidth=LW();
      g.beginPath(); g.moveTo(f.x,f.y); g.lineTo(f.x+46,f.y-20); g.stroke(); g.globalAlpha=1;
    } else {
      g.save(); g.translate(f.x,f.y); g.rotate(f.rot); g.strokeStyle='#B99A6B';
      g.beginPath(); g.arc(0,0,11,0,6.3); g.stroke();
      g.beginPath(); g.moveTo(-11,0); g.lineTo(11,0); g.moveTo(0,-11); g.lineTo(0,11); g.stroke(); g.restore();
    }
  }
  flyers=flyers.filter(f=>f.x>-140 && (f.life===undefined||f.life>0));
}

/* ===== 풍경 ===== */
function scene(t,th,prog){
  const gy=groundY();
  const grd=g.createLinearGradient(0,0,0,gy);
  grd.addColorStop(0,th.sky1); grd.addColorStop(1,th.sky2);
  g.fillStyle=grd; g.fillRect(0,0,W,gy);

  if(th.star>0.01){
    g.fillStyle='#FFF8F0';
    for(const s of stars){
      g.globalAlpha=th.star*(0.45+0.55*Math.abs(Math.sin(t*1.2+s.p)));
      g.beginPath(); g.arc(s.x*W,s.y*H,s.r,0,6.3); g.fill();
    }
    g.globalAlpha=1;
  }
  if(th.orb){
    const ox=W*(0.14+0.7*prog), oy=gy-H*(0.24+0.36*Math.sin(Math.PI*Math.min(1,prog+0.12)));
    g.fillStyle=th.orbC; g.globalAlpha=.95;
    if(th.orb==='moon'){
      g.beginPath(); g.arc(ox,oy,20,0,6.3); g.fill();
      g.globalAlpha=1; g.fillStyle=th.sky1;
      g.beginPath(); g.arc(ox+9,oy-6,17,0,6.3); g.fill();
    } else { g.beginPath(); g.arc(ox,oy,24,0,6.3); g.fill(); }
    g.globalAlpha=1;
  }
  // 먼 언덕 두 겹
  const hw=W*0.62, o1=(t*9)%hw;
  g.fillStyle=th.far;
  for(let i=-1;i<3;i++){ const x=i*hw-o1;
    g.beginPath(); g.moveTo(x,gy); g.quadraticCurveTo(x+hw*0.5,gy-H*0.30,x+hw,gy); g.closePath(); g.fill(); }
  const hw2=W*0.46, o2=(t*22)%hw2;
  g.fillStyle=th.near;
  for(let i=-1;i<4;i++){ const x=i*hw2-o2;
    g.beginPath(); g.moveTo(x,gy); g.quadraticCurveTo(x+hw2*0.5,gy-H*0.17,x+hw2,gy); g.closePath(); g.fill(); }
  // 중간 덤불
  g.fillStyle=th.far;
  for(const b of bushes){
    b.x-=0; const bx=((b.x-t*60)%(W+300)+W+300)%(W+300)-150;
    g.beginPath(); g.ellipse(bx,gy-6,26*b.s,14*b.s,0,Math.PI,0); g.fill();
  }
  // 땅
  g.fillStyle=th.ground; g.fillRect(0,gy,W,H-gy);
  g.strokeStyle=th.ink; g.lineWidth=LW(); g.beginPath();
  for(let x=0;x<=W;x+=14) g.lineTo(x,gy+Math.sin((x+t*230)*0.03)*1.6);
  g.stroke();
  // 소품 (구간마다 종류가 바뀐다)
  const section=Math.max(0,Math.floor(t/(song.barDur*4)));
  for(const p of props){
    p.x-=0;
    let px=((p.x-t*230)%(W+420)+W+420)%(W+420)-120;
    if(px>W+60 || p.kind===null) p.kind=propKind(section);
    drawProp(p.kind,px,gy+2,p.s,th);
  }
}
