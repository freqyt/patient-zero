"use strict";
// ---------- Heat: optional difficulty tiers, unlocked one at a time by winning on the tier below ----------
// Every tier stacks: tougher, faster, more numerous humans who hit harder and more elites, less healing,
// and a bigger DNA payout for the run.
const HEAT_MAX = 5;
const HEAT = h => ({hp:1 + 0.15*h, spawn:1 + 0.08*h, speed:1 + 0.03*h, elite:1 + 0.4*h, dmg:1 + 0.08*h, heal:1 - 0.05*h, dna:1 + 0.25*h});
const pct = v => Math.round(Math.abs(v - 1)*100) + '%';
function heatDesc(h){
  if (!h) return 'THE STANDARD OUTBREAK.';
  const H = HEAT(h);
  return `+${pct(H.hp)} ENEMY HP, +${pct(H.spawn)} SPAWNS, +${pct(H.speed)} SPEED, +${pct(H.dmg)} ENEMY DAMAGE, +${pct(H.elite)} ELITES, -${pct(H.heal)} HEALING. DNA x${H.dna}.`;
}
const HEAT_COL = ['#a89ab8', '#ffd860', '#ffa040', '#ff6a3a', '#ff3a5a', '#ff3aff'];
// heat picker shown on the character select screen
function renderHeat(){
  const el = $('heatRow'); if (!el) return;
  const max = META.heatMax, sel = META.heatSel;
  if (!max){ el.innerHTML = ''; $('heatDesc').textContent = ''; return; }
  el.innerHTML = '<span class="hl">HEAT</span>' + Array.from({length: HEAT_MAX + 1}, (_, h) =>
    `<button class="heat${h === sel ? ' sel' : ''}${h > max ? ' locked' : ''}" data-h="${h}" style="--hc:${HEAT_COL[h]}"${h > max ? ' disabled' : ''}>${h > max ? '&#128274;' : h}</button>`).join('');
  $('heatDesc').innerHTML = `<span style="color:${HEAT_COL[sel]}">HEAT ${sel}</span>: ${heatDesc(sel)}` +
    (max < HEAT_MAX ? `<br><span class="need">WIN ON HEAT ${max} TO UNLOCK HEAT ${max + 1}</span>` : '');
  for (const b of el.querySelectorAll('button.heat')) b.onclick = () => { if (b.disabled) return; META.heatSel = +b.dataset.h; SFX.play('click'); renderHeat(); };
}
