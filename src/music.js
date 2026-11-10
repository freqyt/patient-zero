"use strict";
// ---------- generative SNES-style music ----------
// Lookahead step sequencer (16 steps/bar, 4-bar phrases). Each mood (title/day/night/boss) has three
// chord sections that it wanders between; every phrase re-rolls the arpeggio style and may add a
// generated lead melody. Live game state drives it:
//   intensity (how busy the screen is) -> denser bass, more drums, faster arps, fills at phrase ends
//   danger (low health)                -> heartbeat pulse, darker pads
//   key                                -> rises a semitone every 2.5 minutes for creeping tension
const MUSIC = (() => {
  let timer = null, next = 0, step = 0, mode = 'title', want = 'title', duck = 1;
  let inten = 0, intenWant = 0, danger = false, key = 0, keyWant = 0;
  let section = 'A', arpStyle = 'up', lead = null, phraseSeed = 1;
  const N = m => 440 * Math.pow(2, (m-69)/12);
  const Q = {m:[0,3,7], M:[0,4,7], d:[0,3,6]};
  const SONGS = {
    title: {bpm:70,  root:57, base:0.0, sections:{A:[[0,'m'],[-4,'M'],[3,'M'],[-2,'M']], B:[[5,'m'],[3,'M'],[-4,'M'],[-5,'M']], C:[[-4,'M'],[-2,'M'],[0,'m'],[0,'m']]}},
    day:   {bpm:86,  root:57, base:0.15, sections:{A:[[0,'m'],[-4,'M'],[3,'M'],[-2,'M']], B:[[5,'m'],[0,'m'],[7,'m'],[-4,'M']], C:[[-4,'M'],[-2,'M'],[0,'m'],[0,'m']]}},
    night: {bpm:100, root:50, base:0.4, sections:{A:[[0,'m'],[-4,'M'],[5,'m'],[7,'M']], B:[[0,'m'],[-2,'M'],[-4,'M'],[7,'M']], C:[[5,'m'],[0,'m'],[1,'M'],[7,'M']]}},
    boss:  {bpm:134, root:52, base:0.75, sections:{A:[[0,'m'],[1,'M'],[0,'m'],[-2,'M']], B:[[0,'m'],[-4,'M'],[1,'M'],[7,'M']], C:[[0,'m'],[1,'M'],[2,'m'],[3,'M']]}},
  };
  const FLOW = {A:['B','B','C','A'], B:['A','C','A'], C:['A','B']};
  const BASS = [
    [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
    [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,0,1,0],
    [1,0,2,0, 1,0,2,0, 1,0,2,0, 1,0,2,1],
    [1,0,1,1, 2,0,1,1, 1,0,1,1, 2,0,1,2],
  ];
  const SCALE = [0,2,3,5,7,8,10];   // natural minor, for lead passing tones
  const ctx = () => SFX.ctx;
  const R = (a,b) => a + Math.random()*(b-a);
  function env(g, t, a, hold, rel, v){ g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t+a); g.gain.setValueAtTime(v, t+a+hold); g.gain.exponentialRampToValueAtTime(0.0001, t+a+hold+rel); }
  function osc(type, f, t, a, hold, rel, v, lp, detune=0){
    const c = ctx(), o = c.createOscillator(), fl = c.createBiquadFilter(), g = c.createGain();
    o.type = type; o.frequency.value = f; o.detune.value = detune; fl.type = 'lowpass'; fl.frequency.value = lp;
    env(g, t, a, hold, rel, v*duck); o.connect(fl); fl.connect(g); g.connect(SFX.musicBus); o.start(t); o.stop(t+a+hold+rel+0.05);
  }
  function hit(t, f0, f1, dur, v, type){
    const c = ctx(), s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = SFX.noise; fl.type = type || 'lowpass'; fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(f1, t+dur);
    env(g, t, 0.002, 0, dur, v*duck); s.connect(fl); fl.connect(g); g.connect(SFX.musicBus); s.start(t, Math.random()*0.5); s.stop(t+dur+0.05);
  }
  function kick(t, v, f0=120){ const c = ctx(), o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(40, t+0.12);
    env(g, t, 0.002, 0.02, 0.16, v*duck); o.connect(g); g.connect(SFX.musicBus); o.start(t); o.stop(t+0.25); }
  const chordAt = (song, bar) => { const [off, q] = song.sections[section][bar]; const r = song.root + key + off; return Q[q].map(i => r + i); };
  // called at the top of each 4-bar phrase: pick the next section, arp style, maybe a lead melody
  function newPhrase(first){
    const song = SONGS[mode];
    if (!first){ const opts = FLOW[section]; section = opts[Math.random()*opts.length|0]; }
    key = keyWant; phraseSeed = Math.random();
    const styles = mode === 'title' ? ['up','updown','broken'] : ['up','down','updown','broken','random','pedal'];
    arpStyle = styles[Math.random()*styles.length|0];
    const it = Math.max(song.base, inten);
    lead = null;
    if (mode !== 'title' && (section === 'B' || it > 0.6) && Math.random() < 0.75){
      // a 2-bar motif built from chord tones and scale passing notes, repeated with a twist in bars 3-4
      const rhythm = [[0,3,6,8,11,14],[0,2,4,8,10,12],[0,4,6,7,8,12,14],[0,3,4,8,11,12,15]][Math.random()*4|0];
      const notes = rhythm.map(() => Math.random() < 0.7 ? [0,2,4][Math.random()*3|0] : 'p' + (Math.random()*7|0));
      lead = {rhythm, notes, oct: mode === 'boss' ? 12 : 24};
    }
  }
  function playStep(st, t){
    const song = SONGS[mode], it = Math.max(song.base, inten);
    const bpm = song.bpm + (mode !== 'title' ? Math.round(it*8) : 0), sd = 60/bpm/4;
    const bar = Math.floor(st/16) % 4, s = st % 16, ch = chordAt(song, bar);
    if (st % 64 === 0) newPhrase(st === 0);
    // pads (once per bar; darker when in danger)
    const padLp = danger ? 520 : mode === 'boss' ? 1300 : 950;
    if (s === 0) for (const m of ch) for (const d of [-9, 9]) osc('sawtooth', N(m), t, sd*4, sd*9, sd*3, mode==='boss' ? 0.02 : 0.028, padLp, d);
    // bass: pattern density follows intensity
    const bp = BASS[Math.min(3, Math.floor(it*4 + (mode==='boss' ? 1 : 0)))];
    if (bp[s]){ const m = ch[0] - 12 + (bp[s] === 2 ? 12 : 0);
      osc('sawtooth', N(m), t, 0.005, sd*0.7, sd*0.8, 0.11, mode === 'boss' ? 750 : 420 + it*300); osc('sine', N(m-12), t, 0.005, sd*0.7, sd, 0.09, 300); }
    // arpeggio: style re-rolled each phrase, rate rises with intensity
    const rate = mode === 'title' ? 4 : it < 0.3 ? 4 : it < 0.7 ? 2 : 1;
    if (s % rate === 0){
      const tones = [ch[0]+12, ch[1]+12, ch[2]+12, ch[0]+24, ch[1]+24], i = (s/rate)|0;
      let m;
      switch (arpStyle){
        case 'up': m = tones[i % 4]; break;
        case 'down': m = tones[3 - (i % 4)]; break;
        case 'updown': m = tones[[0,1,2,3,2,1][i % 6]]; break;
        case 'broken': m = tones[[0,2,1,3,1,4,2,3][i % 8]]; break;
        case 'random': m = tones[Math.random()*5|0]; break;
        case 'pedal': m = i % 2 ? tones[0] : tones[1 + (i>>1) % 3]; break;
      }
      osc('triangle', N(m), t, 0.004, sd*0.45*rate, sd*1.3, rate === 1 ? 0.03 : 0.042, 2800);
    }
    // lead melody
    if (lead){ const li = lead.rhythm.indexOf(s);
      if (li >= 0){ let nIdx = lead.notes[li]; if (bar >= 2 && li === lead.rhythm.length-1) nIdx = 1;
        const m = typeof nIdx === 'number' ? ch[nIdx] + lead.oct : song.root + key + SCALE[+nIdx.slice(1)] + lead.oct;
        osc('sawtooth', N(m), t, 0.01, sd*1.2, sd*1.6, 0.03, 1900); osc('triangle', N(m+12), t, 0.01, sd, sd*1.2, 0.012, 3000); } }
    // drums
    if (mode !== 'title'){
      const fill = bar === 3 && s >= 12 && it > 0.4;
      if (s % 8 === 0 || (it > 0.5 && s === 6) || (it > 0.8 && s % 4 === 0)) kick(t, 0.26 + it*0.1);
      if (it > 0.32 && (s === 4 || s === 12) && !fill) hit(t, 1900, 500, 0.14, 0.11, 'bandpass');
      if (fill) hit(t, 2200, 600, 0.08, 0.06 + (s-12)*0.02, 'bandpass');
      if (it > 0.2 && s % (it > 0.65 ? 1 : 2) === 0) hit(t, 8500, 5500, 0.025, it > 0.65 ? 0.022 : 0.03, 'highpass');
      if (st % 64 === 0 && it > 0.5) hit(t, 6000, 2500, 0.6, 0.05, 'highpass');   // crash at phrase start
    }
    // danger: heartbeat "lub-dub" under everything
    if (danger && (s === 0 || s === 3 || s === 8 || s === 11)) kick(t, s % 8 === 0 ? 0.34 : 0.22, 70);
  }
  function tick(){
    const c = ctx(); if (!c || c.state !== 'running' || SFX.muted){ if (c) next = Math.max(next, c.currentTime); return; }
    // after a suspend or a rebuilt audio context the clock jumps; re-anchor instead of stalling or bursting
    if (next < c.currentTime || next > c.currentTime + 1) next = c.currentTime + 0.05;
    inten += (intenWant - inten) * 0.05;
    while (next < c.currentTime + 0.15){
      if (step % 16 === 0 && want !== mode){ mode = want; step = 0; section = 'A'; }
      playStep(step, next);
      const song = SONGS[mode], it = Math.max(song.base, inten);
      next += 60/(song.bpm + (mode !== 'title' ? Math.round(it*8) : 0))/4; step++;
    }
  }
  return {
    start(){ if (!timer && SFX.ctx){ next = SFX.ctx.currentTime + 0.1; timer = setInterval(tick, 30); } },
    setMode(m){ if (SONGS[m]) want = m; },
    // live game state: intensity 0..1, danger flag, key offset in semitones
    setMood(i, d, k){ intenWant = clamp(i, 0, 1); danger = !!d; keyWant = k|0; },
    duck(on){ duck = on ? 0.4 : 1; },
    get mode(){ return mode; }, get section(){ return section; }, get arp(){ return arpStyle; }, get intensity(){ return inten; },
  };
})();
