"use strict";
/* 소리 — 꺅두기 하우스 */

/* ===== 소리 ===== */
let ctx=null, master=null, musicGain=null, sfxGain=null, noiseBuf=null;
function initAudio(){
  if(ctx) return;
  ctx = new (window.AudioContext||window.webkitAudioContext)();
  master = ctx.createGain(); master.gain.value=0.9; master.connect(ctx.destination);
  musicGain = ctx.createGain(); musicGain.gain.value=0.5; musicGain.connect(master);
  sfxGain   = ctx.createGain(); sfxGain.gain.value=1.0;   sfxGain.connect(master);
  applyVolumes();
}
/* 설정의 볼륨을 실제 믹서에 반영 */
function applyVolumes(){
  if(!ctx) return;
  musicGain.gain.value = 0.5 * (settings.volSfx != null ? settings.volSfx : 0.9);
  sfxGain.gain.value   = 1.0*settings.volSfx;
  if(BGM.on && BGM.gain) BGM.gain.gain.setTargetAtTime(0.5*settings.volBgm, ctx.currentTime, 0.1);
}
function tone(time, freq, dur, o){
  const osc=ctx.createOscillator(), g=ctx.createGain(), f=ctx.createBiquadFilter();
  osc.type=o.type||'square'; osc.frequency.value=freq; if(o.detune) osc.detune.value=o.detune;
  f.type='lowpass'; f.frequency.value=o.cut||2600; f.Q.value=.6;
  const peak=o.gain||0.16;
  g.gain.setValueAtTime(0.0001,time);
  g.gain.exponentialRampToValueAtTime(peak,time+0.012);
  g.gain.exponentialRampToValueAtTime(peak*0.5,time+Math.min(0.13,dur*0.5));
  g.gain.exponentialRampToValueAtTime(0.0001,time+dur);
  osc.connect(f); f.connect(g); g.connect(musicGain);
  osc.start(time); osc.stop(time+dur+0.05);
}
function noise(){
  if(!noiseBuf){ noiseBuf=ctx.createBuffer(1,ctx.sampleRate*0.3,ctx.sampleRate);
    const d=noiseBuf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; }
  return noiseBuf;
}
function kick(t){ const o=ctx.createOscillator(),g=ctx.createGain();
  o.type='sine'; o.frequency.setValueAtTime(150,t); o.frequency.exponentialRampToValueAtTime(48,t+0.13);
  g.gain.setValueAtTime(0.45,t); g.gain.exponentialRampToValueAtTime(0.0001,t+0.22);
  o.connect(g); g.connect(musicGain); o.start(t); o.stop(t+0.25); }
function hat(t,loud){ const s=ctx.createBufferSource(),g=ctx.createGain(),f=ctx.createBiquadFilter();
  s.buffer=noise(); f.type='highpass'; f.frequency.value=7200;
  g.gain.setValueAtTime(loud?0.09:0.04,t); g.gain.exponentialRampToValueAtTime(0.0001,t+(loud?0.07:0.04));
  s.connect(f); f.connect(g); g.connect(musicGain); s.start(t); s.stop(t+0.1); }
function clap(t){ const s=ctx.createBufferSource(),g=ctx.createGain(),f=ctx.createBiquadFilter();
  s.buffer=noise(); f.type='bandpass'; f.frequency.value=1700; f.Q.value=1.1;
  g.gain.setValueAtTime(0.16,t); g.gain.exponentialRampToValueAtTime(0.0001,t+0.15);
  s.connect(f); f.connect(g); g.connect(musicGain); s.start(t); s.stop(t+0.2); }
/* 타격음 — 나무 타악기처럼 짧고 동그랗게. 레인마다 음이 다르다 */
const LANE_HZ=[523.25, 659.25, 783.99, 1046.50];   // 도 미 솔 높은도
function hitSound(lane, v){
  if(!ctx) return;
  const t=ctx.currentTime, base=LANE_HZ[lane]||523;
  const vol = v==='perfect'?0.17 : v==='great'?0.13 : 0.085;
  const cut = v==='perfect'?5600 : v==='great'?3200 : 1700;
  const o=ctx.createOscillator(), g=ctx.createGain(), f=ctx.createBiquadFilter();
  o.type='sine'; o.frequency.setValueAtTime(base,t);
  o.frequency.exponentialRampToValueAtTime(base*0.985,t+0.14);
  f.type='lowpass'; f.frequency.value=cut;
  g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.0001,t+0.19);
  o.connect(f); f.connect(g); g.connect(sfxGain); o.start(t); o.stop(t+0.22);
  const o2=ctx.createOscillator(), g2=ctx.createGain();      // 배음
  o2.type='triangle'; o2.frequency.setValueAtTime(base*2.01,t);
  g2.gain.setValueAtTime(vol*0.35,t); g2.gain.exponentialRampToValueAtTime(0.0001,t+0.10);
  o2.connect(g2); g2.connect(sfxGain); o2.start(t); o2.stop(t+0.12);
  if(v!=='good'){                                            // 톡 하는 어택
    const s=ctx.createBufferSource(), gn=ctx.createGain(), fn=ctx.createBiquadFilter();
    s.buffer=noise(); fn.type='highpass'; fn.frequency.value=v==='perfect'?4200:2800;
    gn.gain.setValueAtTime(vol*0.45,t); gn.gain.exponentialRampToValueAtTime(0.0001,t+0.028);
    s.connect(fn); fn.connect(gn); gn.connect(sfxGain); s.start(t); s.stop(t+0.05);
  }
}
function missSound(){
  if(!ctx) return;
  const t=ctx.currentTime, o=ctx.createOscillator(), g=ctx.createGain(), f=ctx.createBiquadFilter();
  o.type='triangle'; o.frequency.setValueAtTime(190,t); o.frequency.exponentialRampToValueAtTime(95,t+0.18);
  f.type='lowpass'; f.frequency.value=900;
  g.gain.setValueAtTime(0.12,t); g.gain.exponentialRampToValueAtTime(0.0001,t+0.24);
  o.connect(f); f.connect(g); g.connect(sfxGain); o.start(t); o.stop(t+0.26);
}
/* 버튼 누르는 소리 — 똑 */
function uiClick(){
  if(!ctx) return;
  const t=ctx.currentTime, o=ctx.createOscillator(), g=ctx.createGain(), f=ctx.createBiquadFilter();
  o.type='sine'; o.frequency.setValueAtTime(1180,t); o.frequency.exponentialRampToValueAtTime(780,t+0.06);
  f.type='lowpass'; f.frequency.value=4200;
  g.gain.setValueAtTime(0.075,t); g.gain.exponentialRampToValueAtTime(0.0001,t+0.09);
  o.connect(f); f.connect(g); g.connect(sfxGain); o.start(t); o.stop(t+0.1);
}

/* 배경음 — 타이틀·집·결과 화면에서 잔잔하게 도는 8마디 루프 */
const BGM={on:false, gain:null, next:0, bar:0, timer:null};
const BGM_CH=[['C3','E3','G3','B3'],['A2','C3','E3','G3'],['F2','A2','C3','E3'],['G2','B2','D3','F3']];
const BGM_MEL=['E5','D5','C5','G4','A4','C5','D5','E5'];
function bgmTone(t,f,dur,vol,type,cut){
  const o=ctx.createOscillator(), g=ctx.createGain(), bf=ctx.createBiquadFilter();
  o.type=type; o.frequency.value=f; bf.type='lowpass'; bf.frequency.value=cut;
  g.gain.setValueAtTime(0.0001,t);
  g.gain.exponentialRampToValueAtTime(vol,t+dur*0.18);
  g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.connect(bf); bf.connect(g); g.connect(BGM.gain);
  o.start(t); o.stop(t+dur+0.05);
}
function bgmStart(){
  if(!ctx || BGM.on) return;
  BGM.gain=ctx.createGain(); BGM.gain.gain.value=0.0001; BGM.gain.connect(master);
  BGM.gain.gain.setTargetAtTime(0.5*settings.volBgm, ctx.currentTime, 0.6);
  BGM.on=true; BGM.next=ctx.currentTime+0.15; BGM.bar=0;
  BGM.timer=setInterval(bgmTick,150); bgmTick();
}
function bgmStop(){
  if(!BGM.on) return;
  clearInterval(BGM.timer); BGM.on=false;
  const g0=BGM.gain;
  try{ g0.gain.cancelScheduledValues(ctx.currentTime);
       g0.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.25); }catch(e){}
  setTimeout(()=>{ try{ g0.disconnect(); }catch(e){} }, 1200);
}
function bgmTick(){
  if(!BGM.on) return;
  const beat=60/84, bar=beat*4;
  while(BGM.next < ctx.currentTime+0.8){
    const t=BGM.next, ch=BGM_CH[BGM.bar%4];
    ch.forEach(n=> bgmTone(t, hz(n), bar*0.96, 0.05, 'triangle', 800));      // 패드
    for(let i=0;i<4;i++)                                                      // 아르페지오
      bgmTone(t+i*beat, hz(ch[(i+2)%4])*2, beat*0.55, 0.035, 'sine', 2600);
    if(BGM.bar%2===0)                                                         // 멜로디 한 음
      bgmTone(t+beat*2.5, hz(BGM_MEL[BGM.bar%8]), beat*1.1, 0.045, 'triangle', 2000);
    BGM.next+=bar; BGM.bar++;
  }
}

function blip(freq,vol){ if(!ctx) return;
  const t=ctx.currentTime,o=ctx.createOscillator(),g=ctx.createGain();
  o.type='triangle'; o.frequency.setValueAtTime(freq,t); o.frequency.exponentialRampToValueAtTime(freq*1.6,t+0.05);
  g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.0001,t+0.12);
  o.connect(g); g.connect(sfxGain||master); o.start(t); o.stop(t+0.14); }

function sweepUp(dur, rank){            // 뽑기 전 긴장감 — 올라가는 소리
  if(!ctx) return;
  const t=ctx.currentTime, o=ctx.createOscillator(), g=ctx.createGain(), f=ctx.createBiquadFilter();
  o.type = rank==='SR' ? 'sawtooth' : 'triangle';
  o.frequency.setValueAtTime(180,t);
  o.frequency.exponentialRampToValueAtTime(rank==='SR'?1500:rank==='R'?900:620, t+dur);
  f.type='lowpass'; f.frequency.setValueAtTime(700,t); f.frequency.exponentialRampToValueAtTime(5000,t+dur);
  g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.16,t+dur*0.8);
  g.gain.exponentialRampToValueAtTime(0.0001,t+dur+0.12);
  o.connect(f); f.connect(g); g.connect(sfxGain||master); o.start(t); o.stop(t+dur+0.2);
  if(rank!=='N'){                        // 심장 두근거림
    for(let i=0;i<4;i++){ const k=ctx.createOscillator(), kg=ctx.createGain(), tt=t+i*(dur/4);
      k.type='sine'; k.frequency.setValueAtTime(90,tt); k.frequency.exponentialRampToValueAtTime(45,tt+0.12);
      kg.gain.setValueAtTime(0.3,tt); kg.gain.exponentialRampToValueAtTime(0.0001,tt+0.18);
      k.connect(kg); kg.connect(sfxGain||master); k.start(tt); k.stop(tt+0.2); }
  }
}
function arp(freqs, gap, vol, type){    // 등급별 팡파르
  if(!ctx) return;
  const t0=ctx.currentTime;
  freqs.forEach((f,i)=>{
    const o=ctx.createOscillator(), g=ctx.createGain(), t=t0+i*gap;
    o.type=type||'triangle'; o.frequency.setValueAtTime(f,t);
    g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.0001,t+0.26);
    o.connect(g); g.connect(sfxGain||master); o.start(t); o.stop(t+0.3);
  });
}
function shimmer(){                      // 아주 귀함 반짝임
  if(!ctx) return;
  const t=ctx.currentTime, s=ctx.createBufferSource(), g=ctx.createGain(), f=ctx.createBiquadFilter();
  s.buffer=noise(); f.type='bandpass'; f.frequency.setValueAtTime(3000,t);
  f.frequency.exponentialRampToValueAtTime(9000,t+0.5); f.Q.value=2.2;
  g.gain.setValueAtTime(0.14,t); g.gain.exponentialRampToValueAtTime(0.0001,t+0.6);
  s.connect(f); f.connect(g); g.connect(sfxGain||master); s.start(t); s.stop(t+0.65);
}

function buildEvents(song){
  const ev=[], S=song.spb, STEP=song.step;
  song.bars.forEach((bar,bi)=>{
    const base=bi*song.barDur, chord=CH[song.chords[bi]]||CH.C;
    for(let s=0;s<S;s++){
      const t=base+s*STEP;
      if(song.kick.includes(s)) ev.push({t,f:()=>kick(at(t))});
      if(song.clap.includes(s)) ev.push({t,f:()=>clap(at(t))});
      if(song.hat.includes(s))  ev.push({t,f:()=>hat(at(t), s%2===0)});
    }
    const bassSteps = S===6 ? [[0,0,1.2],[2,1,.6],[4,2,.6]] : [[0,0,1],[2,2,.5],[4,0,1],[6,1,.5]];
    bassSteps.forEach(([s,ci,mul])=>{
      const t=base+s*STEP;
      ev.push({t,f:()=>tone(at(t), hz(chord[ci]), song.beat*0.85*mul, {type:'triangle',gain:.2,cut:900})});
    });
    if(!bar) return;
    bar.forEach(([st,name,len])=>{
      const t=base+st*STEP, d=len*STEP*0.92;
      ev.push({t,f:()=>{ tone(at(t),hz(name),d,{type:song.wave,gain:.15,cut:song.cut});
                         tone(at(t),hz(name)*2.003,d*0.6,{type:'square',gain:.04,cut:4200,detune:6}); }});
    });
  });
  ev.sort((a,b)=>a.t-b.t);
  return ev;
}

/* 곡 카드 미리듣기 */
let previewUntil=0;
function preview(song){
  initAudio(); if(ctx.state==='suspended') ctx.resume();
  const t0=ctx.currentTime+0.06;
  if(t0 < previewUntil) return;
  let dur=0;
  song.bars.slice(2,4).forEach((bar,i)=>{
    if(!bar) return;
    const base=i*song.barDur;
    bar.forEach(([st,name,len])=>{
      const t=t0+base+st*song.step;
      tone(t,hz(name),len*song.step*0.9,{type:song.wave,gain:.14,cut:song.cut});
      dur=Math.max(dur,base+st*song.step+0.4);
    });
    song.kick.forEach(s=>kick(t0+base+s*song.step));
  });
  previewUntil=t0+dur;
}

/* ===== 집에서 나는 소리 ===== */
function sfxCare(kind){
  if(!ctx) return;
  const t=ctx.currentTime;
  const seq={
    feed:[[523,0],[659,0.08],[784,0.16]],
    water:[[880,0],[1180,0.07]],
    sleep:[[392,0],[330,0.16],[262,0.32]],
    play:[[659,0],[880,0.07],[1046,0.14],[1318,0.21]],
    wash:[[1046,0],[1318,0.06],[1046,0.12]],
    clean:[[440,0],[523,0.06],[440,0.12],[523,0.18]]
  }[kind]||[[660,0]];
  seq.forEach(([f,d])=>blip(f,0.06));
  seq.forEach(([f,d],i)=>{ const o=ctx.createOscillator(),gn=ctx.createGain();
    o.type=kind==='sleep'?'sine':'triangle'; o.frequency.value=f;
    gn.gain.setValueAtTime(0.0001,t+d); gn.gain.exponentialRampToValueAtTime(0.09,t+d+0.01);
    gn.gain.exponentialRampToValueAtTime(0.0001,t+d+0.22);
    o.connect(gn); gn.connect(sfxGain); o.start(t+d); o.stop(t+d+0.26); });
}
function sfxGrow(){
  if(!ctx) return; const t=ctx.currentTime;
  [523,659,784,1046,1318].forEach((f,i)=>{
    const o=ctx.createOscillator(),gn=ctx.createGain();
    o.type='triangle'; o.frequency.value=f;
    gn.gain.setValueAtTime(0.0001,t+i*0.09); gn.gain.exponentialRampToValueAtTime(0.13,t+i*0.09+0.02);
    gn.gain.exponentialRampToValueAtTime(0.0001,t+i*0.09+0.5);
    o.connect(gn); gn.connect(sfxGain); o.start(t+i*0.09); o.stop(t+i*0.09+0.55); });
}
function sfxNo(){
  if(!ctx) return; const t=ctx.currentTime;
  const o=ctx.createOscillator(),gn=ctx.createGain();
  o.type='square'; o.frequency.setValueAtTime(320,t); o.frequency.exponentialRampToValueAtTime(180,t+0.18);
  gn.gain.setValueAtTime(0.07,t); gn.gain.exponentialRampToValueAtTime(0.0001,t+0.2);
  o.connect(gn); gn.connect(sfxGain); o.start(t); o.stop(t+0.22);
}
function sfxCoin(n){
  if(!ctx) return; const t=ctx.currentTime;
  for(let i=0;i<Math.min(6,n);i++){
    const o=ctx.createOscillator(),gn=ctx.createGain();
    o.type='sine'; o.frequency.value=880*Math.pow(1.12,i);
    gn.gain.setValueAtTime(0.0001,t+i*0.06); gn.gain.exponentialRampToValueAtTime(0.1,t+i*0.06+0.01);
    gn.gain.exponentialRampToValueAtTime(0.0001,t+i*0.06+0.25);
    o.connect(gn); gn.connect(sfxGain); o.start(t+i*0.06); o.stop(t+i*0.06+0.3);
  }
}
