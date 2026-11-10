"use strict";
// ---------- composed SNES-style soundtrack ----------
// Hand-written pieces played by a lookahead step sequencer (16 steps per bar). Melodies are written in a
// tiny tracker notation: 16 tokens per bar, a note name starts a note, "." holds it, "-" is silence.
// The game only switches between pieces and adds/removes composed layers by intensity:
//   intensity -> drums, hi-hats, chord-tone counter-arpeggio, drum fills
//   danger    -> heartbeat pulse and darker pads
//   key       -> whole piece transposes up a semitone every 2.5 minutes (applied at the top of a loop)
const MUSIC = (() => {
  const SONGS = {
    // "Patient Zero" - title: slow music box over pads, A minor
    title: {bpm:76, bass:'whole', drums:null, lead:'box', order:['A'], sections:{
      A:{chords:['Am','F','Dm','E','Am','F','E','Am'], lead:[
        'A4 . . . C5 . . . E5 . . . D5 . C5 .',
        'C5 . . . A4 . . . F4 . . . . . . .',
        'D5 . . . F5 . . . A5 . . . F5 . . .',
        'B4 . . . G#4 . . . E4 . . . . . . .',
        'A4 . . . C5 . . . E5 . . . A5 . . .',
        'A5 . . . F5 . . . C5 . . . A4 . . .',
        'E5 . . . B4 . . . G#4 . . . E4 . . .',
        'A4 . . . . . . . . . . . - . . .']}}},
    // "Shambling Streets" - day: creeping walking bass, A minor
    day: {bpm:92, bass:'walk', drums:'day', lead:'synth', order:['A','B'], sections:{
      A:{chords:['Am','Am','F','G','Am','Am','F','E'], lead:[
        'E5 . . . . . D5 . C5 . . . A4 . . .',
        'C5 . D5 . E5 . . . G5 . E5 . C5 . . .',
        'F5 . . . A5 . . . C5 . . . A4 . . .',
        'B4 . . . D5 . . . G5 . . . F5 . D5 .',
        'E5 . . . . . D5 . C5 . . . A4 . C5 .',
        'E5 . . . A5 . . . G5 . E5 . D5 . C5 .',
        'A4 . . . C5 . . . F5 . . . E5 . C5 .',
        'E5 . . . . . . . B4 . . . G#4 . . .']},
      B:{chords:['Dm','Am','Dm','E','F','G','Am','Am'], lead:[
        'F5 . . . E5 . D5 . . . A4 . . . . .',
        'C5 . . . B4 . A4 . . . E4 . . . . .',
        'F5 . . . A5 . . . F5 . D5 . A4 . D5 .',
        'E5 . . . . . . . G#5 . . . B5 . . .',
        'A5 . . . . . G5 . F5 . . . C5 . . .',
        'B4 . . . D5 . . . G5 . . . . . . .',
        'A5 . . . E5 . . . C5 . . . E5 . . .',
        'A4 . . . . . . . - . . . . . . .']}}},
    // "Dead of Night" - night: driving 8th-note bass, D minor
    night: {bpm:104, bass:'drive', drums:'night', lead:'synth', order:['A','B'], sections:{
      A:{chords:['Dm','Bb','Gm','A','Dm','Bb','C','A'], lead:[
        'D5 . . . F5 . . . A5 . . . F5 . D5 .',
        'D5 . . . . . . . Bb4 . . . . . . .',
        'G4 . . . Bb4 . . . D5 . . . Bb4 . G4 .',
        'A4 . . . . . C#5 . E5 . . . . . . .',
        'F5 . . . E5 . D5 . A5 . . . . . . .',
        'Bb5 . . . A5 . G5 . F5 . . . D5 . . .',
        'E5 . . . G5 . . . C5 . . . E5 . G5 .',
        'A5 . . . . . . . E5 . . . C#5 . . .']},
      B:{chords:['Gm','Dm','Bb','A','Bb','C','A','A'], lead:[
        'Bb4 . . . D5 . G5 . . . D5 . Bb4 . . .',
        'A4 . . . . . . . F4 . . . A4 . . .',
        'D5 . . . F5 . Bb5 . . . F5 . D5 . . .',
        'E5 . . . . . C#5 . . . A4 . . . . .',
        'F5 . . . . . D5 . Bb4 . . . D5 . F5 .',
        'G5 . . . E5 . . . C5 . . . E5 . G5 .',
        'A5 . . . . . E5 . C#5 . . . E5 . . .',
        'A4 . . . . . . . - . . . . . . .']}}},
    // "Armored Assault" - bosses: galloping bass and a staccato riff, E minor
    boss: {bpm:138, bass:'gallop', drums:'boss', lead:'riff', order:['A','B'], sections:{
      A:{chords:['Em','C','D','B'], lead:[
        'E5 . E5 . G5 . E5 . B5 . G5 . E5 . B4 .',
        'E5 . E5 . G5 . E5 . C6 . G5 . E5 . C5 .',
        'F#5 . F#5 . A5 . F#5 . D6 . A5 . F#5 . D5 .',
        'D#5 . F#5 . B5 . . . F#5 . . . D#5 . B4 .']},
      B:{chords:['Am','Em','C','B'], lead:[
        'A5 . . . C6 . . . A5 . E5 . C5 . E5 .',
        'G5 . . . B5 . . . E6 . . . B5 . G5 .',
        'C6 . . . G5 . . . E5 . . . G5 . C6 .',
        'B5 . . . . . F#5 . D#5 . . . B4 . . .']}}},
    // the Gunship finale: the boss theme, three semitones higher and faster
    final: {bpm:148, transpose:3, ref:'boss'},
  };
  // ---- parsing ----
  const NOTE = {C:0, D:2, E:4, F:5, G:7, A:9, B:11};
  function midi(tok){ const m = /^([A-G])(#|b)?(-?\d)$/.exec(tok); if (!m) return null;
    return (+m[3] + 1)*12 + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); }
  // chord name -> {root (midi, octave 3), tones}
  function chord(name){ const m = /^([A-G])(#|b)?(m?)$/.exec(name); let r = 48 + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    if (r >= 60) r -= 12; return {root:r, tones: m[3] ? [r, r+3, r+7] : [r, r+4, r+7]}; }
  // per bar: array of 16 slots, each null or {m, dur} in steps
  function parseBar(str){ const tk = str.trim().split(/\s+/); while (tk.length < 16) tk.push('.');
    const out = new Array(16).fill(null);
    for (let i=0;i<16;i++){ const m = midi(tk[i]); if (m === null) continue;
      let d = 1; while (i+d < 16 && tk[i+d] === '.') d++; out[i] = {m, dur:d}; }
    return out; }
  for (const k in SONGS){ const s = SONGS[k]; if (s.ref) continue;
    s.bars = []; for (const sec of s.order){ const S2 = s.sections[sec];
      S2.chords.forEach((c, i) => s.bars.push({sec, chord: chord(c), lead: parseBar(S2.lead[i])})); } }
  for (const k in SONGS){ const s = SONGS[k]; if (s.ref){ const b = SONGS[s.ref]; Object.assign(s, {bass:b.bass, drums:b.drums, lead:b.lead, order:b.order, bars:b.bars}); } }

  // ---- synth voices ----
  let timer = null, next = 0, step = 0, mode = 'title', want = 'title', duck = 1;
  let inten = 0, intenWant = 0, danger = false, key = 0, keyWant = 0;
  const ctx = () => SFX.ctx, N = m => 440*Math.pow(2, (m-69)/12);
  function env(g, t, a, hold, rel, v){ g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t+a); g.gain.setValueAtTime(v, t+a+hold); g.gain.exponentialRampToValueAtTime(0.0001, t+a+hold+rel); }
  function osc(type, f, t, a, hold, rel, v, lp, detune=0, vib=0){
    if (!isFinite(f) || !isFinite(t)) return;
    const c = ctx(), o = c.createOscillator(), fl = c.createBiquadFilter(), g = c.createGain();
    o.type = type; o.frequency.value = f; o.detune.value = detune; fl.type = 'lowpass'; fl.frequency.value = lp;
    if (vib){ const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 5.5; lg.gain.value = vib; l.connect(lg); lg.connect(o.detune); l.start(t); l.stop(t+a+hold+rel+0.05); }
    env(g, t, a, hold, rel, v*duck); o.connect(fl); fl.connect(g); g.connect(SFX.musicBus); o.start(t); o.stop(t+a+hold+rel+0.05);
  }
  function noise(t, f0, f1, dur, v, type){
    const c = ctx(), s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = SFX.noise; fl.type = type || 'lowpass'; fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(f1, t+dur);
    env(g, t, 0.002, 0, dur, v*duck); s.connect(fl); fl.connect(g); g.connect(SFX.musicBus); s.start(t, Math.random()*0.5); s.stop(t+dur+0.05);
  }
  function kick(t, v, f0=120){ const c = ctx(), o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(40, t+0.12);
    env(g, t, 0.002, 0.02, 0.16, v*duck); o.connect(g); g.connect(SFX.musicBus); o.start(t); o.stop(t+0.25); }
  const snare = (t, v) => { noise(t, 2000, 600, 0.14, v, 'bandpass'); osc('triangle', 190, t, 0.002, 0.01, 0.06, v*0.5, 2000); };
  const hat = (t, v) => noise(t, 9000, 6000, 0.03, v, 'highpass');
  function leadNote(inst, m, t, dur, sd){
    if (inst === 'box'){ osc('triangle', N(m), t, 0.003, 0.02, dur*sd*0.9 + 0.3, 0.07, 3500); osc('sine', N(m+12), t, 0.003, 0.01, dur*sd*0.5 + 0.2, 0.025, 6000); }
    else if (inst === 'riff'){ const d = Math.min(dur, 2)*sd; osc('sawtooth', N(m), t, 0.004, d*0.55, d*0.4, 0.04, 2400, -6); osc('sawtooth', N(m), t, 0.004, d*0.55, d*0.4, 0.03, 2400, 6); }
    else { const d = dur*sd; osc('sawtooth', N(m), t, 0.012, d*0.75, Math.min(0.25, d*0.4), 0.034, 2000, -5, d > sd*3 ? 12 : 0);
      osc('triangle', N(m), t, 0.012, d*0.75, Math.min(0.25, d*0.4), 0.03, 3000, 5); }
  }
  // ---- one 16th step ----
  function playStep(st, t){
    const song = SONGS[mode], sd = 60/song.bpm/4, nb = song.bars.length, bi = Math.floor(st/16) % nb, s = st % 16;
    if (st % (nb*16) === 0) key = keyWant;   // transpose only at the top of the loop
    const bar = song.bars[bi], tr = key + (song.transpose || 0), ch = bar.chord, it = mode === 'title' ? 0 : inten;
    const root = ch.root + tr, tones = ch.tones.map(x => x + tr);
    // pads: the bar's chord, darker when in danger
    if (s === 0) for (const m of tones) for (const d of [-8, 8]) osc('sawtooth', N(m), t, sd*3, sd*10, sd*3, mode === 'boss' || mode === 'final' ? 0.016 : 0.022, danger ? 500 : 900, d);
    // bass
    const b = root - 12, fifth = b + (tones[2] - tones[0]);
    let bn = null, bd = 2;
    switch (song.bass){
      case 'whole': if (s === 0){ bn = b; bd = 16; } break;
      case 'walk': bn = {0:b, 3:b, 6:fifth, 8:b+12, 11:fifth, 14:b}[s] ?? null; break;
      case 'drive': if (s % 2 === 0) bn = [b, b, b+12, b, b, b+12, fifth, b][s/2]; break;
      case 'gallop': if (s % 4 !== 1) bn = s % 8 === 0 ? b : b - (s === 14 ? 0 : 0); if (s === 12) bn = b + 12; bd = 1; break;
    }
    if (bn !== null){ osc('sawtooth', N(bn), t, 0.005, bd*sd*0.7, sd*0.6, 0.1, song.bass === 'gallop' ? 700 : 450 + it*200); osc('sine', N(bn-12), t, 0.005, bd*sd*0.7, sd*0.8, 0.08, 300); }
    // lead melody (composed)
    const ev = bar.lead[s]; if (ev) leadNote(song.lead, ev.m + tr, t, ev.dur, sd);
    // counter-arpeggio from the chord tones (only when things get busy)
    if (it > 0.5 && song.drums && s % 2 === 0){ const arp = [tones[0]+12, tones[1]+12, tones[2]+12, tones[1]+12][(s/2) % 4];
      osc('triangle', N(arp), t, 0.003, sd*0.4, sd*0.8, 0.022, 2600); }
    // drums
    const last = bi === nb-1 || (song.order.length > 1 && (bi+1) % (nb/song.order.length) === 0), fill = last && s >= 12 && it > 0.5;
    switch (song.drums){
      case 'day':
        if (it > 0.2 && (s === 0 || s === 8)) kick(t, 0.24);
        if (it > 0.35 && (s === 4 || s === 12) && !fill) snare(t, 0.08);
        if (it > 0.55 && s % 4 === 2) hat(t, 0.03);
        break;
      case 'night':
        if (s === 0 || s === 6 || s === 8 || (it > 0.6 && s === 14)) kick(t, 0.28);
        if ((s === 4 || s === 12) && !fill) snare(t, 0.1);
        if (s % 2 === 0) hat(t, it > 0.5 ? 0.035 : 0.022);
        break;
      case 'boss':
        if (s === 0 || s === 3 || s === 8 || s === 11 || (it > 0.7 && s === 14)) kick(t, 0.32);
        if ((s === 4 || s === 12) && !fill) snare(t, 0.13);
        if (s % (it > 0.6 ? 1 : 2) === 0) hat(t, 0.028);
        if (s === 0 && bi % 4 === 0) noise(t, 6000, 2500, 0.6, 0.05, 'highpass');
        break;
    }
    if (fill) snare(t, 0.05 + (s-12)*0.02);
    // danger: heartbeat under everything
    if (danger && (s === 0 || s === 3 || s === 8 || s === 11)) kick(t, s % 8 === 0 ? 0.34 : 0.22, 70);
  }
  function tick(){
    const c = ctx(); if (!c || c.state !== 'running' || SFX.muted){ if (c) next = Math.max(next, c.currentTime); return; }
    if (next < c.currentTime || next > c.currentTime + 1) next = c.currentTime + 0.05;
    inten += (intenWant - inten) * 0.05;
    while (next < c.currentTime + 0.15){
      if (step % 16 === 0 && want !== mode){ mode = want; step = 0; }
      try { playStep(step, next); } catch (e) { console.warn('music', e); }
      next += 60/SONGS[mode].bpm/4; step++;
    }
  }
  return {
    start(){ if (!timer && SFX.ctx){ next = SFX.ctx.currentTime + 0.1; timer = setInterval(tick, 30); } },
    setMode(m){ if (SONGS[m]) want = m; },
    setMood(i, d, k){ intenWant = clamp(i, 0, 1); danger = !!d; keyWant = k|0; },
    duck(on){ duck = on ? 0.4 : 1; },
    get mode(){ return mode; }, get intensity(){ return inten; },
    SONGS,   // exposed for testing
  };
})();
