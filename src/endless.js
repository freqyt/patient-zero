"use strict";
// ---------- endless mode: after the Gunship falls you can keep the run going ----------
// A new wave every 60s: a burst of every threat seen this run, a random boss every other wave, and humans
// that get tougher (+15% HP) and more numerous (+10% spawns) each wave. Dying ends the run and pays DNA.
const endlessHp = () => S.endless ? 1 + 0.15*S.endless.wave : 1;
const endlessRate = () => S.endless ? 1 + 0.1*S.endless.wave : 1;
function startEndless(){
  if (!S || S.state !== 'over' || S.endless || !S.won) return;
  S.endless = {t0:S.t, k0:S.kills, wave:0, next:S.t + 15};
  S.winT = 0; S.overtime = false; S.player.hp = S.player.maxHp;
  SFX.play('alarm'); setState('play');
  banner('ENDLESS NIGHT', 'THE ARMY SENDS EVERYTHING IT HAS');
}
function updateEndless(){
  const En = S.endless; if (S.t < En.next) return;
  En.wave++; En.next = S.t + 60;
  banner('WAVE ' + En.wave, 'HUMANS +' + Math.round((endlessHp()-1)*100) + '% HP');
  SFX.play('alarm');
  const types = S.plan.map(e => e.k);
  for (let i=0;i<10 + 3*En.wave;i++) spawnHuman(pick(types));
  if (En.wave % 2 === 0) spawnBoss(pick(BOSS_POOL));
}
// called from gameOver when an endless run ends
function endEndless(){
  const En = S.endless, wave = En.wave, last = META.runs[0] || {};
  const dna = Math.round((Math.floor((S.kills - En.k0)/6 + (S.t - En.t0)/8) + 15*wave) * S.H.dna);
  META.award(dna, S.t, S.kills, false);
  META.patchLastRun({wave, kills:S.kills, t:Math.floor(S.t), level:S.level, dna:(last.dna || 0) + dna, killer:S.lastHit, build:runBuild()});
  $('overTitle').textContent = 'THE NIGHT IS OVER'; $('overTitle').style.color = '#c8a0ff';
  $('overSub').textContent = `The city fell, and the dead held it for ${wave} wave${wave === 1 ? '' : 's'}.`;
  const mm = Math.floor(S.t/60), ss = String(Math.floor(S.t%60)).padStart(2,'0');
  $('overStats').innerHTML = `WAVE <span>${wave}</span> &middot; TIME <span>${mm}:${ss}</span> &middot; LEVEL <span>${S.level}</span><br>DEVOURED <span>${S.kills}</span> &middot; ENDLESS DNA <span>+${dna}</span>`;
  return dna;
}
