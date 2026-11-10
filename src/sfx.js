"use strict";
// ---------- chiptune-style sound effects, synthesized with WebAudio (no audio files) ----------
const SFX = (() => {
  let ac = null, out = null, nb = null, muted = false;
  try { muted = localStorage.getItem('pz-muted') === '1'; } catch (e) {}
  const last = {};
  function init(){
    if (!ac){
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      ac = new AC();
      out = ac.createGain(); out.gain.value = 0.5;
      const comp = ac.createDynamicsCompressor(); out.connect(comp); comp.connect(ac.destination);
      nb = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = nb.getChannelData(0); for (let i=0;i<d.length;i++) d[i] = Math.random()*2 - 1;
    }
    if (ac.state === 'suspended') ac.resume();
  }
  function env(g, t, a, d, v){ g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002,v), t+a); g.gain.exponentialRampToValueAtTime(0.0001, t+a+d); }
  function tone(type, f0, f1, dur, vol, delay=0, att=0.004){
    const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20,f1), t+dur);
    env(g, t, att, dur, vol); o.connect(g); g.connect(out); o.start(t); o.stop(t+att+dur+0.03);
  }
  function noise(dur, vol, f0, f1, delay=0, type='lowpass', q=1){
    const t = ac.currentTime + delay, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = nb; s.loop = true; f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30,f1), t+dur);
    env(g, t, 0.003, dur, vol); s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random()*0.5); s.stop(t+dur+0.05);
  }
  const R = (a,b) => a + Math.random()*(b-a);
  const D = {
    bite(v){ noise(.07,.5*v,3000,300); tone('square',220,70,.07,.12*v); },
    die(v){ const f = R(500,820); tone('square',f,f*1.6,.06,.07*v); tone('square',f*1.6,f*.5,.16,.07*v,.06); },
    squish(v){ noise(.12,.35*v,900,120); tone('sine',140,50,.12,.2*v); },
    spit(v){ noise(.1,.25*v,1800,300,0,'bandpass',3); tone('sine',300,120,.1,.12*v); },
    bone(v){ tone('triangle',900,1400,.05,.12*v); noise(.05,.15*v,5000,2000,0,'highpass'); },
    screech(v){ tone('sawtooth',900,380,.45,.13*v); tone('square',1300,600,.4,.05*v,.02); noise(.3,.12*v,4000,1500,0,'bandpass',2); },
    gun(v){ noise(.09,.42*v,4000,400); tone('square',160,50,.05,.09*v); },
    mg(v){ noise(.05,.28*v,2500,300); },
    cannon(v){ noise(.3,.55*v,1500,80); tone('sine',90,30,.3,.4*v); },
    boom(v){ noise(.6,.7*v,1200,40); tone('sine',70,25,.5,.5*v); tone('square',50,30,.2,.1*v); },
    flame(v){ noise(.16,.14*v,900,600,0,'bandpass',.7); },
    pickup(v,p=0){ const f = 660*Math.pow(2, Math.min(p,14)/12); tone('square',f,f,.04,.06*v); tone('square',f*1.5,f*1.5,.05,.05*v,.035); },
    levelup(v){ [523,659,784,1047].forEach((f,i) => tone('square',f,f,.09,.1*v,i*.07)); tone('triangle',1047,1047,.3,.12*v,.28); },
    select(v){ tone('square',784,1175,.08,.1*v); },
    rise(v){ tone('sawtooth',110,70,.5,.09*v); tone('sawtooth',114,72,.5,.07*v,.02); noise(.2,.14*v,400,100); },
    devour(v){ noise(.08,.5*v,2500,300); noise(.08,.5*v,2500,300,.1); noise(.25,.3*v,600,150,.2); tone('sine',200,80,.2,.2*v,.2); },
    hurt(v){ tone('square',300,90,.15,.14*v); noise(.1,.2*v,2000,400); },
    night(v){ tone('triangle',110,110,1.6,.15*v,0,.3); tone('triangle',131,131,1.6,.1*v,.1,.3); tone('triangle',165,155,1.6,.08*v,.2,.3); },
    dawn(v){ [392,523,659].forEach((f,i) => tone('triangle',f,f,.4,.08*v,i*.12)); },
    alarm(v){ for (let i=0;i<4;i++){ tone('square',880,660,.18,.08*v,i*.36); tone('square',660,880,.18,.08*v,i*.36+.18); } },
    crowd(v){ tone('square',988,988,.06,.07*v); tone('square',1319,1319,.1,.07*v,.08); },
    rally(v){ tone('square',330,495,.1,.08*v); },
    hunt(v){ tone('square',495,330,.1,.08*v); },
    gameover(v){ [392,330,262,196].forEach((f,i) => tone('square',f,f*.98,.25,.1*v,i*.25)); },
    win(v){ [523,659,784,659,784,1047].forEach((f,i) => tone('square',f,f,.14,.1*v,i*.13)); },
    click(v){ tone('square',600,600,.03,.06*v); },
  };
  // minimum spacing so crowds of enemies don't turn into noise
  const GAP = {gun:.045, mg:.07, die:.07, squish:.06, bite:.05, flame:.12, pickup:.03, bone:.1, spit:.05, boom:.08, rise:.15, hurt:.12};
  function play(name, vol=1, arg){
    if (!ac || muted || ac.state !== 'running' || !D[name]) return;
    const now = ac.currentTime;
    if (last[name] !== undefined && now - last[name] < (GAP[name] || 0.02)) return;
    last[name] = now;
    try { D[name](vol, arg); } catch (e) {}
  }
  // positional: quieter the further from Patient Zero
  function at(name, x, y, arg){
    if (!S) return;
    const v = clamp(1 - Math.hypot(x-S.player.x, y-S.player.y)/700, 0, 1);
    if (v > 0.05) play(name, 0.25 + 0.75*v, arg);
  }
  function toggle(){ muted = !muted; try { localStorage.setItem('pz-muted', muted ? '1' : '0'); } catch (e) {}
    if (!muted){ init(); setTimeout(() => play('click'), 30); } return muted; }
  return {init, play, at, toggle, get muted(){ return muted; }};
})();
