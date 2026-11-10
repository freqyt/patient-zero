"use strict";

// ---------- post-game breakdown ----------
const SRC_INFO = {
  bite:{n:'Bite', ic:'🦷'}, spit:{mut:'spit'}, spike:{mut:'spikes'}, screech:{mut:'screech'}, aura:{mut:'aura'}, pool:{mut:'trail'},
  minion:{n:'Your Horde', ic:'🧟'}, boom:{mut:'boom'}, bloater:{n:'Bloaters', ic:'🔥'}, hazard:{n:'Fuel Explosions', ic:'⛽'},
  saw:{n:'Bone Gatling', ic:'💀'}, wisps:{mut:'wisps'}, wave:{mut:'wave'}, bloom:{mut:'bloom'}, beam:{mut:'beam'}, hbone:{n:'Bone Squad', ic:'🦴'}, gat:{n:'Bone Gatling', ic:'💀'}, lash:{mut:'lash'}, spores:{mut:'spores'}, elite:{n:'Elite blasts', ic:'💥'}, bomb:{n:'Biohazard', ic:'☣️'}, nova:{evo:'aura'}, acid:{evo:'spit'}, other:{n:'Other', ic:'❔'},
};
const HEAL_INFO = {hide:['Necrotic Hide','🛡️'], hunger:['Ravenous','🍖'], heart:['Fresh Hearts','🫀'], chest:['Boss Chests','🎁'],
  feast:['Feast','🩸'], regen:['Natural Regen','💚'], leech:['Blood Leech','🩸'], lash:['Blood Whip','🐙'], chitin:['Chitin (blocked)','🐚'], boss:['Boss Kills','💀'], other:['Other','❔']};
const TAKEN_INFO = {beat:['Baton Cops','👮'], cop:['Pistol Cops','🔫'], soldier:['Soldiers','🪖'], riot:['Riot Police','🛡️'], flamer:['Flamethrowers','🔥'],
  apc:['Armored Carrier','🚛'], heli:['Gunship','🚁'], shell:['Shells','💣'], dog:['K9 Units','🐕'], grenadier:['Grenadiers','💣'], sniper:['Snipers','🎯'], swat:['SWAT Van','🚓'], jugg:['Juggernaut','🦾'], cure:['The Cure','💉'], elite:['Volatile Elites','💥'], other:['Other','❔']};
const ITEM_NAMES = {heart:'Hearts', magnet:'Magnets', saw:'Gatlings', clover:'Clovers', bomb:'Biohazards', dice:'Dice', chest:'Chests'};
const fmtN = v => v >= 10000 ? (v/1000).toFixed(1) + 'k' : v >= 100 ? Math.round(v) + '' : v >= 10 ? v.toFixed(0) : v.toFixed(1);
function srcLabel(k){
  const I = SRC_INFO[k] || SRC_INFO.other;
  if (I.evo) return [EVOS[I.evo].n, emojiIcon(EVOS[I.evo].ic, '#7a5208')];
  if (I.mut) return S.evo[I.mut] ? [EVOS[I.mut].n, emojiIcon(EVOS[I.mut].ic, '#7a5208')] : [MUTS[I.mut].n, emojiIcon(MUTS[I.mut].ic)];
  return [I.n, emojiIcon(I.ic)];
}
// seconds a source was available, for DPS
function srcTime(k){
  const I = SRC_INFO[k] || {};
  if (k === 'saw' || k === 'gat') return S.st.sawTime;
  if (I.evo) return S.t - (S.gotAt['evo:'+I.evo] ?? S.t);
  if (I.mut) return S.t - (S.gotAt[I.mut] ?? S.t);
  return S.t;
}
function statsHTML(){
  const st = S.st, img = c => `<img src="${c.toDataURL()}" alt="">`;
  const section = (title, rows, empty) => `<div class="sect"><div class="sh">${title}</div>${rows.length ? rows.join('') : `<div class="none">${empty}</div>`}</div>`;
  const bar = (frac, col) => `<div class="bar"><i style="width:${Math.max(2, frac*100).toFixed(0)}%;background:${col}"></i></div>`;
  // damage dealt
  const dmg = Object.entries(st.dmg).sort((a,b) => b[1]-a[1]), top = dmg.length ? dmg[0][1] : 1, totalD = dmg.reduce((a,e) => a+e[1], 0);
  const dRows = dmg.map(([k,v]) => { const [nm, ic] = srcLabel(k), t = srcTime(k), dps = t > 1 && k !== 'bomb' ? fmtN(v/t) : '-';
    return `<div class="srow">${img(ic)}<div class="sn">${nm}${bar(v/top, '#9be03a')}</div><div class="sv">${fmtN(v)}<small>${Math.round(v/totalD*100)}%</small></div><div class="sv">${dps}<small>DPS</small></div><div class="sv">${st.kills[k]||0}<small>KILLS</small></div></div>`; });
  // healing
  const heals = Object.entries(st.heal).filter(e => e[1] >= 1).sort((a,b) => b[1]-a[1]), topH = heals.length ? heals[0][1] : 1;
  const hRows = heals.map(([k,v]) => { const [nm, e] = HEAL_INFO[k] || HEAL_INFO.other;
    return `<div class="srow s2">${img(emojiIcon(e))}<div class="sn">${nm}${bar(v/topH, '#ff7a8a')}</div><div class="sv">${fmtN(v)}<small>HP</small></div></div>`; });
  // damage taken
  const taken = Object.entries(st.taken).filter(e => e[1] >= 1).sort((a,b) => b[1]-a[1]), topT = taken.length ? taken[0][1] : 1;
  const tRows = taken.map(([k,v]) => { const [nm, e] = TAKEN_INFO[k] || TAKEN_INFO.other;
    return `<div class="srow s2">${img(emojiIcon(e))}<div class="sn">${nm}${bar(v/topT, '#ff5a5a')}</div><div class="sv">${fmtN(v)}<small>HP</small></div></div>`; });
  const items = Object.entries(st.items).map(([k,v]) => `${ITEM_NAMES[k]||k} ${v}`).join(' &middot; ') || 'none';
  const evos = Object.keys(S.evo).map(k => EVOS[k].n).join(', ') || 'none';
  const misc = `<div class="sect"><div class="sh">THE OUTBREAK</div><div class="misc">
    <span>Zombies raised <b>${st.risen}</b></span><span>Horde lost <b>${st.lost}</b></span><span>Biggest horde <b>${S.maxHorde}</b></span>
    <span>Crates smashed <b>${st.crates}</b></span><span>Elites slain <b>${st.elites||0}</b></span><span>Luck <b>${luck()}</b></span><span>Curse <b>${curse()}</b></span><span>Attack speed <b>+${Math.round((AS()-1)*100)}%</b></span><span>Total damage <b>${fmtN(totalD)}</b></span>
    <span class="wide">Items: <b>${items}</b></span><span class="wide">Evolutions: <b>${evos}</b></span></div></div>`;
  return section('DAMAGE DEALT', dRows, 'No damage dealt.') + section('HEALING', hRows, 'No healing.') + section('DAMAGE TAKEN', tRows, 'Untouched!') + misc;
}


// pause screen: run stats plus every weapon and item with its level
function renderPause(){
  giveUpArmed = false; $('quitBtn').textContent = 'GIVE UP'; $('soundBtn').textContent = 'SOUND: ' + (SFX.muted ? 'OFF' : 'ON');
  const mm = Math.floor(S.t/60), ss = String(Math.floor(S.t%60)).padStart(2,'0'), img = c => `<img src="${c.toDataURL()}" alt="">`;
  const stat = (k, v, c) => `<span>${k} <b style="color:${c||'#f6f0e0'}">${v}</b></span>`;
  const dmgMul = (1 + 0.12*L('might')) * (S.ch.dmg || 1);
  const stats = [stat('TIME', mm+':'+ss), stat('KILLS', S.kills), stat('LEVEL', S.level, '#ff9ccc'), stat('HORDE', hordeCount()+'/'+hordeCap(), '#9be03a'),
    stat('REROLLS', S.rerolls, '#c8d8ff'), stat('LUCK', luck(), '#7aff7a'), stat('CURSE', curse(), '#c080ff'), stat('XP GAIN', '+'+Math.round((xpBonus()-1)*100)+'%', '#ff9ccc'), stat('ATTACK SPEED', '+'+Math.round((AS()-1)*100)+'%', '#ffe84a'),
    stat('DAMAGE', '+'+Math.round((dmgMul-1)*100)+'%', '#ff9a7a'), stat('HP', Math.ceil(S.player.hp)+'/'+S.player.maxHp, '#ff7a8a'),
    S.heat ? stat('HEAT', S.heat, HEAT_COL[S.heat]) : '', S.endless ? stat('WAVE', S.endless.wave, '#c8a0ff') : ''].join('');
  const row = k => { const ev = S.evo[k], nm = ev ? EVOS[k].n : MUTS[k].n, lv = L(k);
    return `<div class="mrow${ev ? ' ev' : ''}">${img(mutIcon(k))}<div class="mn">${nm}${ev ? ' <small>EVOLVED</small>' : ''}</div>
      <div class="mp">${'<i class="on"></i>'.repeat(lv)}${'<i></i>'.repeat(maxLv(k)-lv)}</div><div class="ml">LV ${lv}</div></div>`; };
  const list = (title, keys, cap) => `<div class="sect"><div class="sh">${title} ${keys.length}/${cap}</div>${keys.map(row).join('')}${
    '<div class="mrow empty"><div></div><div class="mn">EMPTY SLOT</div></div>'.repeat(Math.max(0, cap - keys.length))}</div>`;
  const own = Object.keys(S.mods);
  $('pauseStats').innerHTML = `<div class="sect"><div class="sh">${S.ch.n}</div><div class="misc">${stats}</div></div>` +
    list('WEAPONS', own.filter(isWeapon), slotsW()) + list('ITEMS', own.filter(k => !isWeapon(k)), slotsI());
}
