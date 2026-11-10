"use strict";
// ---------- archive: run history, feats (achievements that pay DNA) and the codex ----------

// ---- feats: checked when a run ends; r is a summary of that run ----
const FEATS = [
  {id:'kill100',  n:'FIRST COURSE',     d:'Devour 100 humans in one run.',            dna:15,  t:r => r.kills >= 100},
  {id:'kill1000', n:'MASSACRE',         d:'Devour 1,000 humans in one run.',          dna:40,  t:r => r.kills >= 1000},
  {id:'kill3000', n:'EXTINCTION EVENT', d:'Devour 3,000 humans in one run.',          dna:80,  t:r => r.kills >= 3000},
  {id:'t300',     n:'STILL TWITCHING',  d:'Survive until 5:00.',                       dna:25,  t:r => r.t >= 300},
  {id:'win',      n:'THE CITY FALLS',   d:'Destroy the Gunship.',                      dna:100, t:r => r.win},
  {id:'evo1',     n:'METAMORPHOSIS',    d:'Evolve a mutation.',                        dna:20,  t:r => r.evo >= 1},
  {id:'evo3',     n:'APEX PREDATOR',    d:'Own 3 evolutions in one run.',              dna:60,  t:r => r.evo >= 3},
  {id:'horde20',  n:'LEGION',           d:'Have 20 zombies in your horde at once.',    dna:50,  t:r => r.horde >= 20},
  {id:'boss2',    n:'BOSS RUSH',        d:'Defeat both mid-game bosses in one run.',   dna:50,  t:r => r.boss >= 2},
  {id:'lvl50',    n:'OVERGROWN',        d:'Reach level 50.',                           dna:40,  t:r => r.level >= 50},
  {id:'clean',    n:'UNTOUCHABLE',      d:'Take no damage for the first 2:00.',        dna:40,  t:r => r.clean >= 120},
  {id:'devour25', n:'CANNIBAL',         d:'Devour 25 of your own minions in one run.', dna:25,  t:r => r.devours >= 25},
  {id:'elite10',  n:'TROPHY HUNTER',    d:'Slay 10 elites in one run.',                dna:35,  t:r => r.elites >= 10},
  {id:'crate20',  n:'LOOTER',           d:'Smash 20 crates in one run.',               dna:25,  t:r => r.crates >= 20},
  {id:'luck10',   n:'FOUR-LEAF ROT',    d:'Reach 10 luck.',                            dna:35,  t:r => r.luck >= 10},
  {id:'curse5',   n:'DAMNED',           d:'Reach 5 curse.',                            dna:35,  t:r => r.curse >= 5},
  {id:'heat1',    n:'FEELING THE HEAT', d:'Destroy the Gunship on Heat 1 or higher.',  dna:60,  t:r => r.win && r.heat >= 1},
  {id:'heat3',    n:'INFERNO',          d:'Destroy the Gunship on Heat 3 or higher.',  dna:120, t:r => r.win && r.heat >= 3},
  {id:'heat5',    n:'HELLFIRE',         d:'Destroy the Gunship on Heat 5.',            dna:250, t:r => r.win && r.heat >= 5},
  {id:'wave5',    n:'ENDLESS NIGHT',    d:'Reach wave 5 in endless mode.',             dna:60,  t:r => r.wave >= 5},
  {id:'wave10',   n:'THE LONG DARK',    d:'Reach wave 10 in endless mode.',            dna:120, t:r => r.wave >= 10},
  {id:'chars',    n:'FULL WARD',        d:'Unlock every character.',                   dna:100, t:() => CHAR_ORDER.every(META.hasChar)},
  {id:'wins4',    n:'MANY FACES',       d:'Destroy the Gunship with 4 different characters.', dna:100, t:() => Object.keys(META.winsBy).length >= 4},
  {id:'codex',    n:'PATHOLOGIST',      d:'Complete the codex.',                       dna:150, t:() => codexProgress()[0] === codexProgress()[1]},
];
function checkFeats(win){
  const r = {kills:S.kills, t:S.t, win:win || !!S.won, level:S.level, evo:Object.keys(S.evo).length, horde:S.maxHorde, boss:S.st.bossKills || 0,
    devours:S.st.devours, elites:S.st.elites || 0, crates:S.st.crates, luck:luck(), curse:curse(), heat:S.heat,
    wave:S.endless ? S.endless.wave : 0, clean:S.firstHit === null ? S.t : S.firstHit};
  const got = [];
  for (const F of FEATS) if (!META.hasFeat(F.id) && F.t(r) && META.grantFeat(F.id, F.dna)) got.push(F);
  if (got.length) SFX.play('lucky');
  return got;
}

// ---- codex: everything you can meet or use, revealed the first time you kill / pick / use it ----
const ELITE_D = {armored:'Takes 40% less damage.', swift:'Moves 60% faster.', regen:'Regenerates 3% HP per second.',
  explosive:'Explodes when it dies.', frenzied:'Attacks 80% faster.'};
const PICKUP_D = {heart:'Heals 30 HP plus 20% of your max HP.', magnet:'Slowly pulls every brain and loose pickup to you.',
  saw:'8 seconds of rapid, piercing bone fire.', bomb:'Melts every human on screen. Bosses lose a chunk of HP.',
  dice:'+1 reroll.', clover:'+1 luck for the rest of the run.', chest:'Dropped by bosses: a free evolution or 3 mutations, full heal, +40 DNA.'};
const ENEMY_EMO = {civ:'🧍', medic:'🩺', ...Object.fromEntries(Object.entries(TAKEN_INFO).map(([k, v]) => [k, v[1]]))};
const CODEX = [
  {cat:'e', title:'HUMANS', keys:['civ', ...THREAT_TIERS.flat()], how:'KILL ONE TO STUDY IT',
    icon:k => emojiIcon(ENEMY_EMO[k]), name:k => k === 'civ' ? 'CIVILIANS' : THREAT_NAME[k],
    desc:k => k === 'civ' ? 'THEY RUN. THEY SCREAM. THEY RISE.' : THREAT_SUB[k],
    stat:k => `${HT[k].hp} HP &middot; ${HT[k].xp} XP &middot; RISES WITH ${VAR[k].hp} HP`},
  {cat:'b', title:'BOSSES', keys:['apc', 'swat', 'jugg', 'cure', 'heli'], how:'DEFEAT IT TO STUDY IT',
    icon:k => emojiIcon(ENEMY_EMO[k]), name:k => BOSS_NAME[k],
    desc:k => k === 'heli' ? 'THE FINALE. DESTROY IT TO TAKE THE CITY.' : BOSS_INTRO[k][1], stat:k => `${HT[k].hp} BASE HP`},
  {cat:'x', title:'ELITES', keys:Object.keys(ELITE), how:'SLAY ONE TO STUDY IT',
    icon:() => emojiIcon('💀'), name:k => ELITE[k].n + ' ELITE', desc:k => ELITE_D[k], stat:() => '3.5x HP &middot; 5x XP &middot; HITS 50% HARDER'},
  {cat:'m', title:'WEAPONS', keys:Object.keys(MUTS).filter(isWeapon), how:'TAKE IT IN A RUN',
    icon:k => emojiIcon(MUTS[k].ic), name:k => MUTS[k].n.toUpperCase(), desc:k => MUTS[k].b,
    stat:k => `MAX LV ${maxLv(k)}` + (EVOS[k] ? ` &middot; EVOLVES WITH ${MUTS[EVOS[k].w].n.toUpperCase()}` : '')},
  {cat:'m', title:'ITEMS', keys:Object.keys(MUTS).filter(k => !isWeapon(k)), how:'TAKE IT IN A RUN',
    icon:k => emojiIcon(MUTS[k].ic), name:k => MUTS[k].n.toUpperCase(), desc:k => MUTS[k].b,
    stat:k => { const b = Object.keys(EVOS).find(w => EVOS[w].w === k); return `MAX LV ${maxLv(k)}` + (b ? ` &middot; EVOLVES ${MUTS[b].n.toUpperCase()}` : ''); }},
  {cat:'v', title:'EVOLUTIONS', keys:Object.keys(EVOS), how:'EVOLVE IT IN A RUN',
    icon:k => emojiIcon(EVOS[k].ic, '#7a5208'), name:k => EVOS[k].n.toUpperCase(), desc:k => EVOS[k].d,
    stat:k => `MAX ${MUTS[k].n.toUpperCase()} + ${MUTS[EVOS[k].w].n.toUpperCase()}`, hint:k => `MAX ${MUTS[k].n.toUpperCase()} + ${MUTS[EVOS[k].w].n.toUpperCase()}`},
  {cat:'i', title:'PICKUPS', keys:Object.keys(PICKUP_D), how:'PICK ONE UP',
    icon:k => ITEM_SPR[k], name:k => k === 'chest' ? 'BOSS CHEST' : ITEMS[k].n, desc:k => PICKUP_D[k], stat:() => ''},
];
function codexProgress(){ let n = 0, t = 0; for (const C of CODEX) for (const k of C.keys){ t++; if (META.seen(C.cat, k)) n++; } return [n, t]; }

// ---- overlay ----
let archTab = 'runs';
function openArchive(){ SFX.init(); $('title').classList.remove('show'); $('archive').classList.add('show'); renderArchive(); }
function closeArchive(){ $('archive').classList.remove('show'); refreshTitleDna(); $('title').classList.add('show'); }
const archiveOpen = () => $('archive').classList.contains('show');
const aimg = (c, cls) => `<img src="${c.toDataURL()}" alt=""${cls ? ` class="${cls}"` : ''}>`;
const clock = t => Math.floor(t/60) + ':' + String(Math.floor(t%60)).padStart(2, '0');
function ago(ms){ const m = (Date.now() - ms)/60000; return m < 60 ? Math.max(1, Math.round(m)) + 'M AGO' : m < 1440 ? Math.round(m/60) + 'H AGO' : Math.round(m/1440) + 'D AGO'; }
function renderArchive(){
  for (const b of document.querySelectorAll('#archive .tab')) b.classList.toggle('on', b.dataset.tab === archTab);
  $('archBody').innerHTML = archTab === 'runs' ? runsHTML() : archTab === 'feats' ? featsHTML() : codexHTML();
  $('archBody').scrollTop = 0;
}
function runsHTML(){
  const L = META.life, B = META.best;
  const life = `<div class="lifeline">RUNS <b>${L.runs}</b> &middot; KILLS <b>${L.kills}</b> &middot; PLAYED <b>${Math.round(L.time/60)}M</b> &middot; WINS <b>${B.wins}</b> &middot; BEST <b>${clock(B.t)}</b> / <b>${B.kills}</b> KILLS</div>`;
  if (!META.runs.length) return life + '<div class="none">NO RUNS YET. GO RISE.</div>';
  return life + META.runs.map(r => {
    const res = r.wave ? `<div class="res e">WAVE<br>${r.wave}</div>` : r.win ? '<div class="res w">WON</div>' : '<div class="res l">DIED</div>';
    const killer = r.killer ? (TAKEN_INFO[r.killer] || TAKEN_INFO.other)[0].toUpperCase() : null;
    const bld = (r.build || []).map(k => { const ev = k[0] === '*', b = ev ? k.slice(1) : k; if (!MUTS[b]) return '';
      return aimg(ev && EVOS[b] ? emojiIcon(EVOS[b].ic, '#7a5208') : emojiIcon(MUTS[b].ic), ev ? 'ev' : ''); }).join('');
    return `<div class="run">${res}<div class="who">${(CHARS[r.cid] || CHARS.zero).n}${r.heat ? ` <span style="color:${HEAT_COL[r.heat]}">H${r.heat}</span>` : ''}
      <small>${ago(r.at)}${killer ? ' &middot; KILLED BY ' + killer : ''}</small></div>
      <div class="num"><b>${clock(r.t)}</b> &middot; LV <b>${r.level}</b><br><b>${r.kills}</b> KILLS &middot; <b>+${r.dna}</b> DNA</div><div class="bld">${bld}</div></div>`;
  }).join('');
}
function featsHTML(){
  const n = FEATS.filter(F => META.hasFeat(F.id)).length;
  return `<div class="lifeline">FEATS <b>${n}/${FEATS.length}</b> &middot; EACH PAYS DNA ONCE</div>` + FEATS.map(F => { const got = META.hasFeat(F.id);
    return `<div class="feat${got ? ' got' : ''}"><div class="fn">${got ? '&#9733; ' : ''}${F.n}</div><div class="fd">${F.d}</div><div class="fr">${got ? 'DONE' : '+' + F.dna + ' DNA'}</div></div>`; }).join('');
}
function codexHTML(){
  const [n, t] = codexProgress();
  return `<div class="lifeline">CODEX <b>${n}/${t}</b> &middot; DISCOVERIES ARE SAVED WHEN A RUN ENDS</div>` + CODEX.map(C => {
    const known = C.keys.filter(k => META.seen(C.cat, k)).length;
    return `<div class="sh">${C.title} ${known}/${C.keys.length}</div><div class="cx">` + C.keys.map(k => {
      const cnt = META.seen(C.cat, k);
      if (!cnt) return `<div class="cxe unk">${aimg(C.icon(k))}<div><div class="cn">???</div><div class="cd">${C.hint ? C.hint(k) : C.how}</div></div></div>`;
      const verb = C.cat === 'e' || C.cat === 'b' || C.cat === 'x' ? 'SLAIN' : C.cat === 'i' ? 'USED' : 'TAKEN';
      return `<div class="cxe">${aimg(C.icon(k))}<div><div class="cn">${C.name(k)}</div><div class="cd">${C.desc(k)}</div><div class="cs">${C.stat(k)}${C.stat(k) ? '<br>' : ''}${verb} ${cnt}</div></div></div>`;
    }).join('') + '</div>';
  }).join('');
}
for (const b of document.querySelectorAll('#archive .tab')) b.onclick = () => { archTab = b.dataset.tab; SFX.play('click'); renderArchive(); };
$('archBtn').onclick = openArchive;
$('archBack').onclick = closeArchive;
$('endlessBtn').onclick = startEndless;
