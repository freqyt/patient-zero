"use strict";
// ---------- sound effects, synthesized with WebAudio (no audio files) ----------
// Aimed at a 16-bit "sampled" B-movie feel rather than chip beeps: filtered noise, low thumps,
// formant-filtered voices for screams/groans, slight bit-crush grit, and an SNES-style echo bus.
const SFX = (() => {
  let ac = null, dry = null, wet = null, mus = null, nb = null, muted = false;
  try { muted = localStorage.getItem('pz-muted') === '1'; } catch (e) {}
  const last = {};

  function crushCurve(steps){ const n = 1024, c = new Float32Array(n);
    for (let i=0;i<n;i++){ const x = i/(n-1)*2-1; c[i] = Math.round(x*steps)/steps; } return c; }
  function init(){
    if (!ac){
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      ac = new AC();
      const master = ac.createGain(); master.gain.value = 0.55;
      const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
      // gentle quantiser + lowpass = the slightly crunchy, band-limited sound of SNES samples
      const crush = ac.createWaveShaper(); crush.curve = crushCurve(48);
      const tone = ac.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 9000;
      dry = ac.createGain(); wet = ac.createGain(); wet.gain.value = 0.32;
      const dl = ac.createDelay(1), fb = ac.createGain(), dlf = ac.createBiquadFilter();
      dl.delayTime.value = 0.19; fb.gain.value = 0.38; dlf.type = 'lowpass'; dlf.frequency.value = 1700;
      wet.connect(dl); dl.connect(dlf); dlf.connect(fb); fb.connect(dl); dlf.connect(master);
      dry.connect(crush); crush.connect(tone); tone.connect(master);
      // music bus: clean (no crush), with a send into the shared echo
      mus = ac.createGain(); mus.gain.value = muted ? 0 : 0.3; mus.connect(master);
      const ms = ac.createGain(); ms.gain.value = 0.45; mus.connect(ms); ms.connect(wet);
      master.connect(comp); comp.connect(ac.destination);
      nb = ac.createBuffer(1, ac.sampleRate*2, ac.sampleRate);
      const d = nb.getChannelData(0); let b = 0;
      for (let i=0;i<d.length;i++){ const w = Math.random()*2-1; b = 0.97*b + 0.03*w; d[i] = i < d.length/2 ? w : b*6; } // white | brown
    }
    if (ac.state === 'suspended') ac.resume();
  }
  function route(node, echo){ node.connect(dry); if (echo) { const s = ac.createGain(); s.gain.value = echo; node.connect(s); s.connect(wet); } }
  // ---- surviving app switches (iOS Safari "interrupts" audio when the app is backgrounded) ----
  // Audio may only restart inside a user gesture, so every tap/key tries to resume it. If iOS left the
  // context unrecoverable, the next gesture rebuilds it from scratch (music & SFX pick up the new one).
  let needsRebuild = false;
  function unlock(){
    if (!ac || muted) return;
    if (needsRebuild || ac.state === 'closed'){ needsRebuild = false; try { ac.close(); } catch (e) {} ac = null; init(); return; }
    if (ac.state !== 'running'){
      const p = ac.resume(); if (p && p.catch) p.catch(() => {});
      setTimeout(() => { if (ac && ac.state !== 'running' && !document.hidden) needsRebuild = true; }, 350);
    }
  }
  for (const ev of ['pointerdown','touchend','keydown','click']) addEventListener(ev, unlock, {passive:true, capture:true});
  document.addEventListener('visibilitychange', () => {
    if (!ac) return;
    if (document.hidden){ if (ac.state === 'running') ac.suspend().catch(() => {}); }
    else unlock();   // desktop browsers resume here; iOS waits for the next tap
  });
  addEventListener('pageshow', () => unlock());
  // ---- performance: count live sound sources so busy late-game fights never overload phones ----
  let live = 0;
  const track = node => { live++; node.onended = () => { live--; }; };
  function env(g, t, a, d, v){ g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002,v), t+a); g.gain.exponentialRampToValueAtTime(0.0001, t+a+d); }
  // filtered oscillator voice
  function voice({type='sawtooth', f0, f1=f0, dur, vol, delay=0, att=0.005, lp=2000, lp1=lp, q=1, vib=0, echo=0, band}){
    const t = ac.currentTime + delay, o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20,f1), t+att+dur);
    if (vib){ const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = vib; lg.gain.value = f0*0.04; lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t+att+dur+0.05); }
    f.type = band ? 'bandpass' : 'lowpass'; f.Q.value = q; f.frequency.setValueAtTime(lp, t); if (lp1 !== lp) f.frequency.exponentialRampToValueAtTime(Math.max(40,lp1), t+att+dur);
    env(g, t, att, dur, vol); o.connect(f); f.connect(g); route(g, echo);
    track(o); o.start(t); o.stop(t+att+dur+0.05);
  }
  // filtered noise burst; brown=true uses the rumbly half of the buffer
  function hiss({dur, vol, f0, f1=f0, delay=0, type='lowpass', q=1, att=0.003, brown=false, echo=0}){
    const t = ac.currentTime + delay, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = nb; f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(30,f1), t+att+dur);
    env(g, t, att, dur, vol); s.connect(f); f.connect(g); route(g, echo);
    const off = (brown ? 1 : 0) + Math.random()*0.8; track(s); s.start(t, off); s.stop(t+att+dur+0.05);
  }
  // "vocal" sound: saw through two formant bandpasses (screams, groans)
  function vox({f0, f1, dur, vol, formants, delay=0, vib=6, echo=0.25, att=0.02}){
    const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20,f1), t+att+dur);
    const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = vib; lg.gain.value = f0*0.05; lfo.connect(lg); lg.connect(o.frequency);
    env(g, t, att, dur, vol);
    for (const [ff, qq, gg] of formants){ const bp = ac.createBiquadFilter(), fg = ac.createGain(); bp.type = 'bandpass'; bp.frequency.value = ff; bp.Q.value = qq; fg.gain.value = gg; o.connect(bp); bp.connect(fg); fg.connect(g); }
    route(g, echo); track(o); o.start(t); lfo.start(t); o.stop(t+att+dur+0.05); lfo.stop(t+att+dur+0.05);
  }
  const R = (a,b) => a + Math.random()*(b-a);
  const D = {
    // gore & bodies
    bite(v){ hiss({dur:.06, vol:.55*v, f0:2400, f1:500, type:'bandpass', q:1.2}); hiss({dur:.1, vol:.3*v, f0:600, f1:150, delay:.02}); voice({type:'sine', f0:140, f1:60, dur:.08, vol:.25*v}); },
    // deaths: a short, low, muffled grunt ("hngh") - two cheap nodes, pitch varied per human
    die(v){ const f = R(105,175);
      voice({type:'triangle', f0:f, f1:f*R(.55,.7), dur:R(.07,.11), vol:.13*v, lp:650, lp1:300, att:.006});
      hiss({dur:.05, vol:.05*v, f0:700, f1:250, att:.004}); },
    baton(v){ hiss({dur:.05, vol:.35*v, f0:1800, f1:600, type:'bandpass', q:1.5}); voice({type:'sine', f0:150, f1:70, dur:.07, vol:.3*v}); },
    splat(v){ hiss({dur:.12, vol:.3*v, f0:1400, f1:250, type:'lowpass', q:7}); voice({type:'sine', f0:240, f1:90, dur:.08, vol:.14*v}); },
    squish(v){ hiss({dur:.16, vol:.5*v, f0:1100, f1:180, type:'bandpass', q:2.5}); voice({type:'sine', f0:110, f1:45, dur:.14, vol:.3*v}); },
    devour(v){ for (let i=0;i<3;i++) hiss({dur:.07, vol:.5*v, f0:R(1600,2600), f1:300, type:'bandpass', q:1.5, delay:i*.11});
      hiss({dur:.35, vol:.35*v, f0:700, f1:140, type:'bandpass', q:3, delay:.3}); voice({type:'sine', f0:90, f1:50, dur:.3, vol:.3*v, delay:.3});
      vox({f0:120, f1:90, dur:.4, vol:.15*v, formants:[[500,5,1],[900,6,.5]], delay:.35, vib:4}); },
    rise(v){ vox({f0:R(85,110), f1:R(60,75), dur:.7, vol:.2*v, formants:[[420,6,1],[780,7,.6],[2400,9,.15]], vib:5, echo:.35, att:.08});
      hiss({dur:.25, vol:.2*v, f0:500, f1:120, brown:true}); },
    hurt(v){ voice({type:'sawtooth', f0:220, f1:80, dur:.18, vol:.22*v, lp:1200, lp1:300}); hiss({dur:.12, vol:.3*v, f0:1500, f1:300, type:'bandpass', q:1.5}); },
    // player powers
    // throat hork, a lippy "ptoo" pop, then a wet resonant spray
    spit(v){ hiss({dur:.07, vol:.22*v, f0:380, f1:900, type:'bandpass', q:3, brown:true});
      voice({type:'sine', f0:R(560,680), f1:170, dur:.06, vol:.16*v, delay:.055, att:.002});
      hiss({dur:.13, vol:.2*v, f0:2800, f1:450, type:'lowpass', q:9, delay:.06}); },
    bone(v){ hiss({dur:.05, vol:.3*v, f0:3500, f1:1500, type:'bandpass', q:3}); hiss({dur:.08, vol:.2*v, f0:1200, f1:600, type:'bandpass', q:6, delay:.03}); },
    screech(v){ vox({f0:520, f1:300, dur:.55, vol:.28*v, formants:[[1100,4,1],[2600,6,.6],[3400,8,.3]], vib:11, echo:.5, att:.03});
      hiss({dur:.4, vol:.15*v, f0:3500, f1:1200, type:'bandpass', q:1.2, echo:.3}); },
    // humans' weapons
    gun(v){ hiss({dur:.12, vol:.5*v, f0:3200, f1:300, echo:.25}); voice({type:'sine', f0:120, f1:45, dur:.08, vol:.3*v}); },
    mg(v){ hiss({dur:.06, vol:.32*v, f0:2200, f1:300}); voice({type:'sine', f0:90, f1:50, dur:.05, vol:.15*v}); },
    cannon(v){ hiss({dur:.5, vol:.6*v, f0:1400, f1:60, brown:true, echo:.4}); voice({type:'sine', f0:80, f1:28, dur:.45, vol:.5*v}); },
    boom(v){ hiss({dur:.9, vol:.75*v, f0:1600, f1:40, brown:true, echo:.45}); hiss({dur:.15, vol:.4*v, f0:4000, f1:800}); voice({type:'sine', f0:65, f1:22, dur:.7, vol:.55*v}); },
    flame(v){ hiss({dur:.2, vol:.2*v, f0:700, f1:500, type:'bandpass', q:.6, att:.03}); hiss({dur:.2, vol:.12*v, f0:200, f1:150, brown:true, att:.03}); },
    // pickups & UI: soft, wet, a little eerie
    pickup(v,p=0){ const f = 520*Math.pow(2, Math.min(p,14)/12);
      voice({type:'sine', f0:f, f1:f*1.02, dur:.09, vol:.12*v, echo:.35}); voice({type:'triangle', f0:f*2, f1:f*2, dur:.05, vol:.04*v, lp:4000});
      hiss({dur:.05, vol:.12*v, f0:900, f1:400, type:'bandpass', q:5}); },
    levelup(v){ [220,262,330,440].forEach((f,i) => { voice({type:'sawtooth', f0:f, dur:.9-i*.12, vol:.07*v, delay:i*.09, lp:1600, lp1:600, att:.02, echo:.5});
        voice({type:'sine', f0:f*2, dur:.6, vol:.05*v, delay:i*.09, echo:.5}); });
      hiss({dur:.5, vol:.08*v, f0:3000, f1:6000, type:'bandpass', q:2, echo:.5}); },
    select(v){ voice({type:'triangle', f0:330, f1:660, dur:.12, vol:.12*v, lp:3000, echo:.4}); hiss({dur:.08, vol:.12*v, f0:1500, f1:500, type:'bandpass', q:4}); },
    click(v){ hiss({dur:.03, vol:.2*v, f0:2500, f1:1500, type:'bandpass', q:3}); },
    // events
    night(v){ for (const [f,dl] of [[55,0],[82.4,.15],[98,.3],[116.5,.45]]) voice({type:'sawtooth', f0:f, f1:f*.98, dur:2.2, vol:.09*v, delay:dl, att:.4, lp:500, lp1:200, echo:.6});
      vox({f0:70, f1:55, dur:1.4, vol:.12*v, formants:[[400,5,1],[700,6,.5]], delay:.6, vib:3, att:.3, echo:.6}); },
    dawn(v){ [196,247,294].forEach((f,i) => voice({type:'triangle', f0:f, dur:.8, vol:.07*v, delay:i*.15, att:.05, lp:2200, echo:.5})); },
    alarm(v){ for (let i=0;i<3;i++) voice({type:'sawtooth', f0:440, f1:880, dur:.5, vol:.09*v, delay:i*.6, lp:1800, att:.05, echo:.4}); },
    crowd(v){ for (let i=0;i<3;i++){ const f = R(420,640); vox({f0:f, f1:f*1.3, dur:.2, vol:.07*v, formants:[[850,6,1],[1300,8,.6]], delay:i*.07, att:.02}); } },
    gameover(v){ [196,185,165,131].forEach((f,i) => voice({type:'sawtooth', f0:f, f1:f*.97, dur:.7, vol:.1*v, delay:i*.35, lp:900, lp1:300, att:.03, echo:.6}));
      voice({type:'sine', f0:55, f1:40, dur:2, vol:.2*v, delay:1.2, att:.2}); },
    clang(v){ voice({type:'triangle', f0:R(820,900), f1:600, dur:.12, vol:.1*v, echo:.3}); hiss({dur:.04, vol:.2*v, f0:4000, f1:2000, type:'highpass'}); },
    evolve(v){ [196,247,294,392,494].forEach((f,i) => voice({type:'sawtooth', f0:f, dur:1.1-i*.12, vol:.08*v, delay:i*.07, lp:2400, lp1:700, att:.02, echo:.6}));
      vox({f0:90, f1:60, dur:1.2, vol:.14*v, formants:[[420,6,1],[780,7,.6]], delay:.2, vib:5, echo:.6}); hiss({dur:.8, vol:.12*v, f0:800, f1:6000, type:'bandpass', q:2, echo:.6}); },
    // crates
    crack(v){ hiss({dur:.05, vol:.3*v, f0:1200, f1:500, type:'bandpass', q:4}); voice({type:'triangle', f0:220, f1:160, dur:.06, vol:.14*v}); },
    crateBreak(v){ for (let i=0;i<4;i++) hiss({dur:.09, vol:.35*v, f0:R(900,1600), f1:300, type:'bandpass', q:3, delay:i*.035}); voice({type:'sine', f0:140, f1:60, dur:.15, vol:.25*v}); voice({type:'triangle', f0:660, f1:990, dur:.2, vol:.06*v, delay:.12, echo:.5}); },
    chest(v){ hiss({dur:.35, vol:.2*v, f0:300, f1:900, type:'bandpass', q:4});   // creaky lid, then a golden swell
      [262,330,392,523,659,784].forEach((f,i) => voice({type:'triangle', f0:f, dur:.7-i*.06, vol:.07*v, delay:.25+i*.06, lp:4000, echo:.6}));
      voice({type:'sawtooth', f0:131, dur:1.2, vol:.08*v, delay:.25, lp:900, att:.05, echo:.5}); hiss({dur:1, vol:.08*v, f0:4000, f1:9000, type:'highpass', delay:.3, echo:.6}); },
    // items
    item(v){ voice({type:'triangle', f0:880, f1:1320, dur:.18, vol:.06*v, lp:4000, echo:.6}); voice({type:'sine', f0:1760, dur:.12, vol:.03*v, delay:.08, echo:.6}); },
    eat(v){ for (let i=0;i<3;i++) hiss({dur:.08, vol:.45*v, f0:R(1200,2200), f1:250, type:'bandpass', q:2, delay:i*.1});
      voice({type:'sine', f0:160, f1:70, dur:.25, vol:.25*v, delay:.05}); voice({type:'triangle', f0:330, f1:520, dur:.3, vol:.06*v, delay:.3, echo:.5}); },
    magnet(v){ voice({type:'sine', f0:180, f1:1400, dur:.55, vol:.14*v, echo:.5}); voice({type:'sawtooth', f0:90, f1:700, dur:.5, vol:.05*v, lp:1500, echo:.4});
      hiss({dur:.5, vol:.1*v, f0:600, f1:5000, type:'bandpass', q:3, echo:.4}); },
    saw(v){ voice({type:'sawtooth', f0:45, f1:150, dur:.45, vol:.2*v, lp:2400}); hiss({dur:.45, vol:.15*v, f0:800, f1:2500, type:'bandpass', q:2});
      voice({type:'square', f0:30, f1:75, dur:.45, vol:.06*v, lp:900}); },
    sawbuzz(v){ voice({type:'sawtooth', f0:R(110,128), dur:.14, vol:.1*v, lp:2600, att:.01}); hiss({dur:.14, vol:.07*v, f0:1800, type:'bandpass', q:2.5, att:.01}); },
    nuke(v){ hiss({dur:1.6, vol:.8*v, f0:2400, f1:30, brown:true, echo:.5}); voice({type:'sine', f0:55, f1:18, dur:1.4, vol:.6*v});
      hiss({dur:.9, vol:.25*v, f0:300, f1:4000, type:'bandpass', q:1.5, echo:.5});
      for (let i=0;i<4;i++){ const f = R(400,700); vox({f0:f, f1:f*.5, dur:.5, vol:.06*v, formants:[[800,6,1],[1200,8,.6]], delay:.15+i*.08}); } },
    win(v){ [220,277,330,440,554].forEach((f,i) => voice({type:'sawtooth', f0:f, dur:.6, vol:.08*v, delay:i*.14, lp:2000, lp1:800, echo:.5}));
      vox({f0:110, f1:80, dur:1.2, vol:.15*v, formants:[[420,6,1],[780,7,.6]], delay:.6, vib:5, echo:.6}); },
  };
  // minimum spacing so crowds of enemies don't turn into noise
  const GAP = {gun:.075, mg:.1, die:.16, squish:.12, bite:.08, flame:.22, pickup:.04, bone:.1, spit:.07, boom:.12, rise:.25, hurt:.14, crowd:1,
    sawbuzz:.14, item:.2, baton:.12, splat:.1, crack:.1, clang:.1};
  // sounds that must always play (player feedback & big moments); everything else yields when busy
  const KEY = new Set(['levelup','evolve','select','click','hurt','alarm','nuke','night','dawn','gameover','win','devour','eat','magnet','saw','chest','crateBreak']);
  const MAX_LIVE = 36, BURST = 7;          // concurrent sources, and new sounds allowed per 60ms window
  let winStart = 0, winCount = 0;
  function play(name, vol=1, arg){
    if (!ac || muted || ac.state !== 'running' || !D[name]) return;
    const now = ac.currentTime, key = KEY.has(name);
    if (last[name] !== undefined && now - last[name] < (GAP[name] || 0.02)) return;
    if (!key){
      if (live > MAX_LIVE) return;
      if (now - winStart > 0.06){ winStart = now; winCount = 0; }
      if (++winCount > BURST) return;
    }
    last[name] = now;
    try { D[name](vol, arg); } catch (e) { console.warn('sfx', name, e); }
  }
  // positional: quieter the further from Patient Zero; distant noise is skipped entirely
  function at(name, x, y, arg){
    if (!S) return;
    const v = clamp(1 - Math.hypot(x-S.player.x, y-S.player.y)/600, 0, 1);
    if (v > 0.25) play(name, 0.25 + 0.75*v, arg);
  }
  function toggle(){ muted = !muted; if (mus) mus.gain.setTargetAtTime(muted ? 0 : 0.3, ac.currentTime, 0.05); try { localStorage.setItem('pz-muted', muted ? '1' : '0'); } catch (e) {}
    if (!muted){ init(); setTimeout(() => play('click'), 30); } return muted; }
  return {init, play, at, toggle, get live(){ return live; }, get muted(){ return muted; }, get state(){ return ac ? ac.state : 'none'; }, get ctx(){ return ac; }, get musicBus(){ return mus; }, get noise(){ return nb; }};
})();
