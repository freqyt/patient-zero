"use strict";
// ---------- generative SNES-style music ----------
// A lookahead step sequencer (16 steps per bar) plays filtered synth bass, detuned pads, an echoing
// arpeggio and light drums. Four moods: title, day (moody A minor), night (darker, driving D minor)
// and boss (fast E phrygian riff). Mood changes land on bar boundaries.
const MUSIC = (() => {
  let timer = null, next = 0, step = 0, mode = 'title', want = 'title', duck = 1;
  const N = m => 440 * Math.pow(2, (m-69)/12);      // midi -> Hz
  // chords as midi triads (root octave 3)
  const SONGS = {
    title: {bpm:70,  chords:[[57,60,64],[53,57,60],[48,52,55],[52,55,59]], bass:[0,10], arp:'slow', drums:''},
    day:   {bpm:84,  chords:[[57,60,64],[53,57,60],[48,52,55],[55,59,62]], bass:[0,6,8,14], arp:'up', drums:'soft'},
    night: {bpm:100, chords:[[50,53,57],[46,50,53],[43,46,50],[45,49,52]], bass:[0,3,6,8,11,14], arp:'pulse', drums:'drive'},
    boss:  {bpm:132, chords:[[52,55,59],[53,57,60],[52,55,59],[50,53,57]], bass:[0,2,3,6,8,10,11,14], arp:'riff', drums:'hard'},
  };
  const ctx = () => SFX.ctx;
  function env(g, t, a, hold, rel, v){ g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t+a); g.gain.setValueAtTime(v, t+a+hold); g.gain.exponentialRampToValueAtTime(0.0001, t+a+hold+rel); }
  function osc(type, f, t, a, hold, rel, v, lp, detune=0){
    const c = ctx(), o = c.createOscillator(), fl = c.createBiquadFilter(), g = c.createGain();
    o.type = type; o.frequency.value = f; o.detune.value = detune; fl.type = 'lowpass'; fl.frequency.value = lp;
    env(g, t, a, hold, rel, v*duck); o.connect(fl); fl.connect(g); g.connect(SFX.musicBus); o.start(t); o.stop(t+a+hold+rel+0.05);
  }
  function hit(t, f0, f1, dur, v, lp, type){
    const c = ctx(), s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = SFX.noise; fl.type = type || 'lowpass'; fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(f1, t+dur);
    env(g, t, 0.002, 0, dur, v*duck); s.connect(fl); fl.connect(g); g.connect(SFX.musicBus); s.start(t, Math.random()*0.5); s.stop(t+dur+0.05);
  }
  function kick(t, v){ const c = ctx(), o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(40, t+0.12);
    env(g, t, 0.002, 0.02, 0.16, v*duck); o.connect(g); g.connect(SFX.musicBus); o.start(t); o.stop(t+0.25); }
  function playStep(st, t){
    const song = SONGS[mode], sd = 60/song.bpm/4, bar = Math.floor(st/16) % 4, s = st % 16, ch = song.chords[bar];
    // pad: three detuned saws per chord tone, slow swell, once per bar
    if (s === 0) for (const m of ch) for (const d of [-9, 9]) osc('sawtooth', N(m), t, sd*4, sd*9, sd*3, mode==='boss' ? 0.022 : 0.03, 900, d);
    // bass
    if (song.bass.includes(s)){ const m = ch[0] - 12 + (mode==='boss' && (s===3 || s===11) ? 1 : 0);
      osc('sawtooth', N(m), t, 0.005, sd*0.8, sd*0.8, 0.12, mode==='boss' ? 700 : 420); osc('sine', N(m-12), t, 0.005, sd*0.8, sd, 0.1, 300); }
    // arpeggio / riff
    const tones = [ch[0]+12, ch[1]+12, ch[2]+12, ch[1]+24];
    if (song.arp === 'up' && s % 2 === 0) osc('triangle', N(tones[(s/2)%4]), t, 0.004, sd*0.5, sd*1.5, 0.045, 3000);
    if (song.arp === 'slow' && s % 4 === 0) osc('triangle', N(tones[(s/4)%4]), t, 0.01, sd*1.5, sd*3, 0.04, 2500);
    if (song.arp === 'pulse' && s % 2 === 0) osc('triangle', N((s%8===0 ? tones[3] : tones[(s/2)%3]) ), t, 0.004, sd*0.4, sd, 0.04, 2400);
    if (song.arp === 'riff'){ const riff = [0,0,1,0,3,0,1,0,0,0,1,0,5,3,1,0]; if (s % 1 === 0 && riff[s] !== undefined && s % 2 === 0)
      osc('sawtooth', N(ch[0] + 12 + riff[s]), t, 0.004, sd*0.6, sd*0.6, 0.035, 1800); }
    // drums
    if (song.drums === 'soft'){ if (s === 0 || s === 8) kick(t, 0.22); if (s % 4 === 2) hit(t, 7000, 4000, 0.04, 0.03, 0, 'highpass'); }
    if (song.drums === 'drive'){ if (s % 8 === 0 || s === 6) kick(t, 0.3); if (s % 8 === 4) hit(t, 1800, 500, 0.14, 0.12, 0, 'bandpass'); if (s % 2 === 0) hit(t, 8000, 5000, 0.03, 0.035, 0, 'highpass'); }
    if (song.drums === 'hard'){ if (s % 4 === 0 || s === 14) kick(t, 0.35); if (s % 8 === 4) hit(t, 2200, 500, 0.16, 0.16, 0, 'bandpass'); hit(t, 9000, 6000, 0.025, 0.03, 0, 'highpass'); }
  }
  function tick(){
    const c = ctx(); if (!c || c.state !== 'running' || SFX.muted){ if (c) next = Math.max(next, c.currentTime); return; }
    // after a suspend or a rebuilt audio context the clock jumps; re-anchor instead of stalling or bursting
    if (next < c.currentTime || next > c.currentTime + 1) next = c.currentTime + 0.05;
    while (next < c.currentTime + 0.15){
      if (step % 16 === 0 && want !== mode){ mode = want; step = 0; }
      playStep(step, next); next += 60/SONGS[mode].bpm/4; step++;
    }
  }
  return {
    start(){ if (!timer && SFX.ctx){ next = SFX.ctx.currentTime + 0.1; timer = setInterval(tick, 30); } },
    setMode(m){ if (SONGS[m]) want = m; },
    duck(on){ duck = on ? 0.4 : 1; },
    get mode(){ return mode; },
  };
})();
