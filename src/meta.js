"use strict";
// ---------- DNA Lab: persistent upgrades bought with DNA earned each run ----------
const META = (() => {
  const KEY = 'pz-meta-v1';
  let data = {dna:0, up:{}, best:{t:0, kills:0, wins:0}, chars:['zero']};
  try { const s = localStorage.getItem(KEY); if (s) data = Object.assign(data, JSON.parse(s)); } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} };
  const UPS = {
    flesh:    {n:'THICK FLESH',    d:'+10 max HP',                       max:5, cost:30, ic:'🫀'},
    origin:   {n:'PATIENT ORIGIN', d:'Start each run with +2 minions',   max:3, cost:60, ic:'🧟'},
    reroll:   {n:'MUTAGEN',        d:'+1 starting reroll (base 3)',       max:3, cost:50, ic:'🎲'},
    appetite: {n:'APPETITE',       d:'+6% XP from brains',               max:5, cost:40, ic:'🧠'},
    scent:    {n:'SCENT',          d:'+20% brain pickup range',          max:3, cost:35, ic:'👃'},
    lucky:    {n:'LUCKY STRAIN',   d:'+1 luck every run',                max:3, cost:55, ic:'🍀'},
    virulence:{n:'VIRULENCE',      d:'+3% chance the slain rise',        max:5, cost:45, ic:'🦠'},
  };
  const rank = k => data.up[k] || 0;
  const cost = k => UPS[k].cost * (rank(k) + 1);
  return {
    UPS, rank, cost,
    hasChar: id => data.chars.includes(id),
    unlockChar(id){ if (data.chars.includes(id)) return false; data.chars.push(id); save(); return true; },
    get dna(){ return data.dna; }, get best(){ return data.best; },
    buy(k){ if (rank(k) >= UPS[k].max || data.dna < cost(k)) return false; data.dna -= cost(k); data.up[k] = rank(k) + 1; save(); return true; },
    // DNA for a run: kills, level reached and time survived; big bonus for a win
    runReward(kills, level, t, win){ return Math.floor(kills/8 + level*2 + t/20) + (win ? 100 : 0); },
    award(n, t, kills, win){ data.dna += n; data.best.t = Math.max(data.best.t, t); data.best.kills = Math.max(data.best.kills, kills); if (win) data.best.wins++; save(); },
  };
})();

// shop overlay
let shopReturn = 'title';
function openShop(from){
  shopReturn = from; SFX.init(); MUSIC.start(); MUSIC.setMode('title');
  for (const id of ['title','over']) $(id).classList.remove('show');
  $('shop').classList.add('show'); renderShop();
}
function closeShop(){
  $('shop').classList.remove('show');
  $(shopReturn).classList.add('show');
  if (shopReturn === 'over') $('overDna').textContent = `DNA BANK: ${META.dna}`;
}
function renderShop(){
  $('shopDna').textContent = META.dna;
  const el = $('shopGrid'); el.innerHTML = '';
  for (const k in META.UPS){
    const U = META.UPS[k], r = META.rank(k), maxed = r >= U.max, c = META.cost(k), afford = META.dna >= c;
    const b = document.createElement('button'); b.className = 'card' + (maxed ? ' maxed' : afford ? '' : ' poor');
    b.innerHTML = `<img class="ic" src="${emojiIcon(U.ic).toDataURL()}" alt=""><div class="nm">${U.n}</div>
      <div class="pips">${'<i class="on"></i>'.repeat(r)}${'<i></i>'.repeat(U.max-r)}</div>
      <div class="ds">${U.d}</div><div class="lv">${maxed ? 'MAXED' : c + ' DNA'}</div>`;
    b.onclick = () => { if (META.buy(k)){ SFX.play('select'); renderShop(); } else SFX.play('click'); };
    el.appendChild(b);
  }
}
