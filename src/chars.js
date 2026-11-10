"use strict";
// ---------- playable characters: different stats & starting mutations, unlocked by in-run tasks ----------
// Stat fields (all optional): hp (+max HP), spd (move mult), dmg (your damage mult), bite (bite mult), armor (damage
// reduction), regen (HP/s), horde (+cap), mhp (horde HP mult), mdmg (horde damage mult), luck, rerolls, minions {type:n}
const CHARS = {
  zero:    {n:'PATIENT ZERO', d:'Balanced. Where it all began.', start:{spit:1},
            look:{skin:'#9ccc48', shirt:'#c4d8e0', gear:'brain', gown:true}},
  butcher: {n:'THE BUTCHER', d:'+40 HP, +30% bite damage, 10% slower.', start:{spikes:1}, hp:40, bite:1.3, spd:0.9,
            look:{skin:'#a6b86a', shirt:'#d8d0c0', pants:'#3a3226', gear:null, hair:'#1a1418', style:2, apron:true},
            task:{k:'kills', n:500, txt:'Devour 500 humans in one run'}},
  nurse:   {n:'NURSE ROT', d:'Regenerates 1 HP/s; horde has +25% HP.', start:{aura:1}, regen:1, mhp:1.25,
            look:{skin:'#b4c4a0', shirt:'#e8e8e0', gear:'medic', gown:true, medic:true},
            task:{k:'time', n:300, txt:'Survive until 5:00'}},
  rex:     {n:'RIOT REX', d:'+20 HP, takes 15% less damage, starts with 2 brutes.', start:{chitin:1, spit:1}, hp:20, armor:0.15, minions:{riot:2},
            look:{skin:'#8aa070', shirt:'#2b3242', pants:'#222838', gear:'riot'},
            task:{k:'boss', n:1, txt:'Defeat a mid-game boss'}},
  queen:   {n:'SWARM QUEEN', d:'+4 horde size, horde hits 30% harder; you hit 20% softer.', start:{horde:1, spit:1}, horde:4, mdmg:1.3, dmg:0.8,
            look:{skin:'#b4a0c8', shirt:'#6a3a7a', pants:'#3a2048', gear:null, hair:'#3a1a4a', style:1},
            task:{k:'horde', n:15, txt:'Have 15 zombies in your horde at once'}},
  lou:     {n:'LUCKY LOU', d:'+2 luck, +2 rerolls, -15 HP.', start:{luck:1, spit:1}, luck:2, rerolls:2, hp:-15,
            look:{skin:'#a8c070', shirt:'#d84a6a', pants:'#e0d8b0', gear:null, hair:'#2a1a14', style:0, floral:true},
            task:{k:'clovers', n:3, txt:'Pick up 3 clovers in one run'}},
  jogger:  {n:'THE JOGGER', d:'25% faster, -20 HP.', start:{trail:1}, spd:1.25, hp:-20,
            look:{skin:'#9cc070', shirt:'#3a8ad8', pants:'#2a2a30', gear:null, hair:'#c8a050', style:0, headband:true},
            task:{k:'evolve', n:1, txt:'Evolve any mutation'}},
  general: {n:'THE GENERAL', d:'+20% damage; starts with Lash Tendrils and Mutant Might.', start:{lash:1, might:1}, dmg:1.2,
            look:{skin:'#88a068', shirt:'#4b5a35', pants:'#3a4430', gear:'helmet', vest:true},
            task:{k:'win', n:1, txt:'Destroy the Gunship'}},
};
// each character's horde fights differently (hs fields are read by the minion AI in game.js)
const CHAR_HORDE = {
  zero:    {n:'THE HORDE',    d:'Circles you and hunts nearby prey.', hs:{}},
  butcher: {n:'GLUTTONS',     d:'Heal 30% of the damage they deal, but shamble slower.', hs:{lifesteal:0.3, spd:0.9}},
  nurse:   {n:'ORDERLIES',    d:'Stay close to you and slowly regenerate.', hs:{form:'tight', regen:0.04, range:200}},
  rex:     {n:'RIOT LINE',    d:'Form a 30% tougher shield wall in front of you.', hs:{form:'front', range:180, leash:300}, mhp:1.3},
  queen:   {n:'THE SWARM',    d:'Fast hunters that range far for prey.', hs:{spd:1.35, range:340, leash:540}},
  lou:     {n:'LUCKY MOB',    d:'Their hits can crit, more often with luck.', hs:{crit:0.15}},
  jogger:  {n:'PACK RUNNERS', d:'Very fast; they run in a trail behind you.', hs:{form:'trail', spd:1.4}},
  general: {n:'BONE SQUAD',   d:'Hang back and throw bones instead of clawing.', hs:{ranged:true, range:220}},
};
for (const k in CHAR_HORDE){ const H = CHAR_HORDE[k]; Object.assign(CHARS[k], {hs:H.hs, hn:H.n, hd:H.d}); if (H.mhp) CHARS[k].mhp = (CHARS[k].mhp || 1)*H.mhp; }
const CHAR_ORDER = Object.keys(CHARS);
let selChar = 'zero';
try { const c = localStorage.getItem('pz-char'); if (c && CHARS[c]) selChar = c; } catch (e) {}

// checked twice a second during a run; also on game over for the win task
function checkUnlocks(win){
  const done = {kills: S.kills, time: S.t, boss: S.st.bossKills || 0, horde: S.minions.length, clovers: S.st.items.clover || 0,
    evolve: Object.keys(S.evo).length, win: win ? 1 : 0};
  for (const id of CHAR_ORDER){
    const C = CHARS[id]; if (!C.task || META.hasChar(id)) continue;
    if (done[C.task.k] >= C.task.n && META.unlockChar(id)){
      (S.newChars = S.newChars || []).push(C.n);
      if (S.state !== 'over'){ banner('UNLOCKED: ' + C.n, 'NEW CHARACTER IN THE SELECT SCREEN'); SFX.play('lucky'); }
    }
  }
}

// character select overlay
let charsReturn = 'title';
function openChars(from){
  charsReturn = from; SFX.init(); MUSIC.start(); MUSIC.setMode('title');
  for (const id of ['title','over','shop']) $(id).classList.remove('show');
  $('chars').classList.add('show'); renderChars();
}
function closeChars(){ $('chars').classList.remove('show'); refreshTitleDna(); $(charsReturn).classList.add('show'); }
function pickChar(id){ selChar = id; try { localStorage.setItem('pz-char', id); } catch (e) {} openMaps(id); }
function renderChars(){
  const el = $('charGrid'); el.innerHTML = '';
  for (const id of CHAR_ORDER){
    const C = CHARS[id], open = META.hasChar(id);
    const portrait = charSprite(playerLook(C.start, id), 0, 0, 'reach', false);
    const starts = Object.keys(C.start).map(k => `<img class="mini" src="${emojiIcon(MUTS[k].ic).toDataURL()}" alt="${MUTS[k].n}" title="${MUTS[k].n}">`).join('');
    const b = document.createElement('button'); b.className = 'card char' + (open ? '' : ' locked') + (id === selChar ? ' sel' : '');
    b.innerHTML = `<img class="ic portrait" src="${portrait.toDataURL()}" alt=""><div class="nm">${C.n}</div>
      ${open ? `<div class="ds">${C.d}</div><div class="ds hz">HORDE: ${C.hn} - ${C.hd}</div><div class="lv">STARTS WITH ${starts}</div>` : `<div class="ds">LOCKED</div><div class="lv lock">${C.task.txt.toUpperCase()}</div>`}`;
    b.onclick = () => { if (open){ SFX.play('select'); pickChar(id); } else SFX.play('click'); };
    el.appendChild(b);
  }
}
