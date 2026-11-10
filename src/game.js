"use strict";
// ---------- game state & logic (world units = 2x pixels) ----------
let S = null;
const K = {};

function setState(st){
  S.state = st;
  if (st !== 'play') resetStick();
  MUSIC.duck(st === 'pause' || st === 'level');
  $('title').classList.toggle('show', false);
  $('level').classList.toggle('show', st==='level');
  $('pause').classList.toggle('show', st==='pause');
  if (st === 'pause') renderPause();
  $('over').classList.toggle('show', st==='over');
}
function startGame(cid){
  cid = CHARS[cid] ? cid : selChar; const CH = CHARS[cid];
  chunkCache.clear();
  for (const P of propCache.values()) for (const pr of P){ pr.live = false; pr.gone = false; }   // gas pumps etc. rebuilt each run
  $('shop').classList.remove('show');
  const hp = 100 + 10*META.rank('flesh') + (CH.hp || 0);
  S = {
    t:0, state:'play',
    player:{x:0,y:40,r:12,hp,maxHp:hp,biteCd:0,biteT:0,biteA:0,face:Math.PI/2,flash:0,frenzy:0,devourCd:0,moving:false,saw:0},
    humans:[], minions:[], corpses:[], bodies:[], pb:[], hb:[], gems:[], parts:[], pools:[], texts:[], lights:[], items:[], itemT:4, flashT:0,
    kills:0, bonusDna:0, level:1, xp:0, xpNext:4, pendingLv:0, mods:Object.assign({}, CH.start), evo:{}, gotAt:Object.fromEntries(Object.keys(CH.start).map(k => [k, 0])), ch:CH, cid, luckBonus:CH.luck || 0, newChars:[],
    st:{dmg:{}, kills:{}, heal:{}, taken:{}, risen:0, lost:0, devours:0, crates:0, items:{}, sawTime:0}, rerolls:3 + META.rank('reroll') + (CH.rerolls || 0), spawnAcc:0, shake:0,
    wt:{spit:0,spikes:1.5,screech:2,trail:0}, banner:null, crowd:null, nextCrowd:14,
    plan:makeSpawnPlan(), bossPlan:shuffle(roster().bosses.slice()).slice(0,2), mines:[], traps:[], cures:[], bosses:{}, maxHorde:0, wasNight:false, finalWave:false, winT:0, hazT:0, overtime:false,
  };
  S.combo = 0; S.comboT = 0;
  SFX.init(); MUSIC.start(); MUSIC.setMode('day');
  setState('play');
  // a few oblivious civilians already in view, so the hunt starts immediately
  for (let i=0;i<7;i++){ const a = rand(0,TAU), d = rand(110,200); spawnHuman('civ', S.player.x+Math.cos(a)*d, S.player.y+Math.sin(a)*d*0.7); }
  // DNA Lab: Patient Origin starts you with a small horde
  for (let i=0;i<Math.min(hordeCap(), 2*META.rank('origin'));i++){ const a = rand(0,TAU); addMinion(S.player.x+Math.cos(a)*40, S.player.y+Math.sin(a)*30, 'civ', pick(LOOKS.civ)); }
  for (const [t, c] of Object.entries(CH.minions || {})) for (let i=0;i<c;i++){ const a = rand(0,TAU); addMinion(S.player.x+Math.cos(a)*36, S.player.y+Math.sin(a)*26, t, pick(LOOKS[t])); }
  banner('THE OUTBREAK BEGINS', 'HUNT THE LIVING');
}
const L = k => S.mods[k] || 0;
const E = k => !!S.evo[k];
function nightAmt(){ const p = (S.t % 100)/100; return clamp((p-0.62)/0.05,0,1) * clamp((1-p)/0.04,0,1); }
const infectChance = () => Math.min(0.95, 0.40 + 0.10*L('contagion') + 0.03*META.rank('virulence'));
// a smaller horde of tougher zombies (cap 5 -> 20, +6 with Horde King)
const hordeCap = () => 5 + 3*L('horde') + (E('bloom') ? 6 : 0) + (S.ch.horde || 0);
const slotsW = () => BASE_SLOTS + META.rank('wslot'), slotsI = () => BASE_SLOTS + META.rank('islot');
const hordeCount = () => S.minions.reduce((a, m) => a + (m.husk && m.life ? 0 : 1), 0);   // temporary husks don't use horde space
const HORDE_HP = 1.8, HORDE_DMG = 14;
function banner(text, sub){ S.banner = {text, sub, t:3.2}; }
function floatText(x,y,txt,col,crit){ S.texts.push({x,y,txt,col,t:crit ? 0.7 : 0.9, crit}); }
function heal(v, src){ const p = S.player, before = p.hp; p.hp = Math.min(p.maxHp, p.hp+v); stat('heal', src || 'other', p.hp - before); }
// per-run stat counters for the post-game breakdown
function stat(cat, key, v){ if (v > 0) S.st[cat][key] = (S.st[cat][key] || 0) + v; }
const isTarget = h => h.type !== 'crate' && h.type !== 'hazard';
// luck: Lucky Rot levels + clovers picked up this run + DNA Lab Lucky Strain
const luck = () => L('luck') + (S.luckBonus || 0) + META.rank('lucky');
// attack speed multiplier: every cooldown is divided by this
const AS = () => 1 + 0.1*L('haste');
// curse: tougher, faster, more numerous humans for more XP
const curse = () => L('curse');
const xpBonus = () => 1 + 0.06*META.rank('appetite') + 0.1*L('xp') + 0.1*curse();
// Mutant Might boosts everything you deal yourself (not your horde or the environment)
const NOT_MINE = new Set(['minion','bloater','hazard','elite','bomb','hbone','bloom']);

// ---------- spawning ----------
// a random point just outside the visible screen rectangle
function edgePos(margin){
  const p = S.player, hw = VW/2 + margin, hh = VH/2 + margin;
  if (Math.random() < hw/(hw+hh)) return [p.x + rand(-hw,hw), p.y + (Math.random()<.5 ? -hh : hh)];
  return [p.x + (Math.random()<.5 ? -hw : hw), p.y + rand(-hh,hh)];
}
// type is a base enemy (HT) or a map variant (VARIANTS in content.js); h.type is always the base AI, h.kind the variant
function spawnHuman(type, x, y, noPack){
  const V = VARIANTS[type] || null, base = V ? V.base : type, T = HT[base], sc = (T.boss ? 1 + S.t/400 : 1 + S.t/300) * (1 + 0.1*curse());
  if (x===undefined) [x, y] = edgePos(30);
  const hp = (V && V.hp || T.hp)*sc;
  const h = {type:base, kind:type, V, x, y, r:V && V.r || T.r, hp, maxHp:hp, sp:(V && V.sp || T.sp)*rand(0.9,1.1), xp:V && V.xp || T.xp, boss:!!T.boss, air:!!T.air,
    cd:rand(0.5,1.5), cd2:2, cd3:0, burst:0, bt:0, flash:0, stun:0, kx:0, ky:0, face:Math.random()*TAU, wa:Math.random()*TAU,
    strafe:Math.random()<0.5?1:-1, turret:0, dead:false, panic:0, look: T.boss ? (BOSS_LOOKS[type] || null) : pick(LOOKS[type])};
  if (!T.boss) maybeElite(h);
  S.humans.push(h);
  if (V && V.pack && !noPack) for (let i=1;i<V.pack;i++) spawnHuman(type, x+rand(-24,24), y+rand(-18,18), true);   // hounds and coyotes run in packs
  return h;
}
function pickType(){ return planPick(); }   // randomized per-run threat order (content.js)
function spawnCrowd(){
  const [cx, cy] = edgePos(90), n = 14 + Math.floor(S.t/30);
  for (let i=0;i<n;i++) spawnHuman(Math.random()<0.18 ? crowdGuard() : 'civ', cx+rand(-60,60), cy+rand(-60,60), true);
  S.crowd = {x:cx, y:cy, t:9};
  SFX.play('crowd');
  banner('SURVIVORS SPOTTED', 'FRESH MEAT NEARBY');
}

// ---------- combat ----------
function nearestZombie(h){ let best = S.player, bd = d2(h,S.player);
  for (const m of S.minions){ if (m.rise > 0) continue; const d = d2(h,m); if (d<bd){ bd=d; best=m; } } return [best, Math.sqrt(bd)]; }
// minions can't reach the gunship and leave fuel pumps alone
function nearestHuman(o, maxD, forMinion){ let best = null, bd = maxD*maxD;
  for (const h of S.humans){ if (h.dead || (forMinion && (h.air || h.type==='hazard'))) continue; const d = d2(o,h); if (d<bd){ bd=d; best=h; } } return best; }
// player-sourced hits can crit for double damage, shown as a pop-up number
function crit(h, dmg){
  if (Math.random() < 0.12 + 0.04*L('eyes') + 0.03*luck() && isTarget(h)){ dmg *= 2; floatText(h.x, h.y-10, Math.round(dmg)+'!', '#ffe060', true); }
  return dmg;
}
function dmgHuman(h, dmg, src, quiet){
  if (h.dead) return;
  if (h.type==='crate' || h.type==='hazard'){
    h.hp -= dmg;
    if (!quiet){ h.flash = 0.07; if (h.type==='crate'){ FX.splinter(h.x, h.y, 3); SFX.at('crack', h.x, h.y); } else SFX.at('clang', h.x, h.y); }
    if (h.hp <= 0) killHuman(h); return;
  }
  if (h.elite) dmg = eliteHit(h, dmg, src);
  if (h.type==='riot' && src!=='bite' && src!=='minion' && src!=='saw' && src!=='bomb') dmg *= 0.5;
  if (h.elite==='armored') dmg *= 0.6;
  if (L('might') && !NOT_MINE.has(src)) dmg *= 1 + 0.12*L('might');
  if (!NOT_MINE.has(src)) dmg *= S.ch.dmg || 1; else if (src === 'minion') dmg *= S.ch.mdmg || 1;
  stat('dmg', src, Math.min(dmg, Math.max(0, h.hp))); h.lastSrc = src;
  h.hp -= dmg;
  if (!quiet){ h.flash = 0.07; if (Math.random()<0.5) FX.blood(h.x,h.y,2,false); }
  else h.toxic = 0.2;
  if (h.hp <= 0){ if (src==='aura' && E('aura')) h.nova = true; killHuman(h); }
}
function killHuman(h){
  if (h.type==='crate'){ h.dead = true; breakCrate(h); return; }
  if (h.type==='hazard'){ h.dead = true; h.prop.live = false; h.prop.gone = true; S.shake = Math.max(S.shake, 8);
    explode(h.x, h.y, h.sub==='pump' ? 105 : 80, 70 + S.t/5, 'zombie', 'fire', 'hazard'); return; }
  h.dead = true; S.kills++; stat('kills', h.lastSrc || 'other', 1); SFX.at('die', h.x, h.y);
  if (h.elite) eliteDeath(h);
  FX.blood(h.x,h.y,h.boss?30:8,false);
  S.gems.push({x:h.x, y:h.y, v:h.xp, big:h.boss || h.xp>=4});
  if (L('hunger')) heal(0.6*L('hunger'), 'hunger');
  if (h.nova){ FX.explosion(h.x, h.y, 40, 'green');   // Necrotic Nova: victims burst
    for (const o of S.humans) if (!o.dead && o!==h && isTarget(o) && d2(o,h) < 48*48) dmgHuman(o, 25, 'nova', true); }
  if (h.boss){
    heal(60, 'boss'); S.shake = 16;
    for (let i=0;i<(h.type==='heli'?6:2);i++) FX.explosion(h.x+rand(-40,40), h.y+rand(-30,20), rand(80,140), 'fire');
    if (h.type==='heli'){ S.winT = 2.8; banner(enemyName(h)+' DOWN', curMap().place + ' IS YOURS'); SFX.play('nuke'); }
    else { S.st.bossKills = (S.st.bossKills||0) + 1; banner(enemyName(h)+' DOWN','IT DROPPED A BOSS CHEST'); S.items.push({k:'chest', x:h.x, y:h.y, t:1e9, seed:Math.random(), pop:0.5}); }
    return;
  }
  if (Math.random() < infectChance()) S.corpses.push({x:h.x, y:h.y, t:0.9, max:0.9, v:h.type, look:h.look});
  else FX.corpse(h);
}
function addMinion(x,y,v,look){
  const V = VAR[v], hm = (1 + 0.15*L('alpha')) * HORDE_HP * (S.ch.mhp || 1);
  S.minions.push({x,y,v,r:V.r,hp:V.hp*hm,maxHp:V.hp*hm,atkCd:0,rt:0,target:null,slot:Math.random()*TAU,flash:0,
    look: zombieLook(look), rise:0.45, face:Math.PI/2, wob:Math.random()*TAU});
  S.st.risen++;
}
function hurtMinion(m, dmg){
  if (m.hp<=0) return;
  m.hp -= dmg; m.flash = 0.07;
  if (m.hp <= 0){
    FX.blood(m.x,m.y,7,true); SFX.at('squish', m.x, m.y); S.st.lost++;
    const lb = L('boom');
    if (lb) explode(m.x,m.y,45+10*lb, 18+16*lb, 'zombie');
    if (VAR[m.v].bloat) explode(m.x,m.y,85, 40+S.t/8, 'zombie', 'fire', 'bloater');
  }
}
function hurtPlayer(dmg, src){
  const p = S.player; if (S.winT > 0) return;
  if (E('spikes')) dmg *= 0.65;
  dmg *= (1 - 0.04*L('chitin')) * (1 - (S.ch.armor || 0));
  stat('taken', src || 'other', Math.min(dmg, Math.max(0, p.hp)));
  SFX.play('hurt'); p.hp -= dmg; p.flash = 0.1; S.shake = Math.min(8, S.shake + dmg*0.5);
  if (p.hp <= 0){ p.hp = 0; gameOver(false); }
}
function explode(x,y,r,dmg,side,style,src){
  SFX.at('boom', x, y);
  FX.explosion(x,y,r, style==='fire' || side==='human' ? 'fire' : 'green');
  if (side==='zombie'){ for (const h of S.humans) if (!h.dead && d2(h,{x,y}) < (r+h.r)**2) dmgHuman(h,dmg,src||'boom'); }
  else if (side==='human'){
    for (const m of S.minions) if (d2(m,{x,y}) < (r+m.r)**2) hurtMinion(m,dmg*1.3);
    if (d2(S.player,{x,y}) < (r+S.player.r)**2) hurtPlayer(dmg, src||'shell');
  }
}
function devour(){
  const p = S.player; if (p.devourCd > 0) return;
  let best = null, bd = 120*120;
  for (const m of S.minions){ if (m.rise>0) continue; const d = d2(p,m); if (d<bd){ bd=d; best=m; } }
  if (!best){ floatText(p.x,p.y,'NO MINION','#a09aa8'); return; }
  best.hp = 0; FX.blood(best.x,best.y,14,true);
  SFX.play('devour'); S.st.devours++; heal(22 + p.maxHp*0.08, 'devour'); p.frenzy = 3.5; p.devourCd = 5;
  floatText(p.x,p.y,'FRENZY!','#ff5a5a');
}
function hfire(h, ang, spd, dmg, opts){
  const ox = h.x+Math.cos(ang)*h.r*1.4, oy = h.y+Math.sin(ang)*h.r*1.4;
  const b = Object.assign({x:ox, y:oy, vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd, spd, dmg:dmg*(h.dmgMul||1), t:1.6, r:3, src:h.kind || h.type}, opts||{});
  // half-speed projectiles live twice as long, so ranges stay the same
  b.vx *= GS; b.vy *= GS; b.spd *= GS; b.t /= GS;
  if (b.shell) b.t0 = b.t;
  S.hb.push(b);
  if (!b.fire) FX.muzzle(ox, oy, ang, b.shell);
  SFX.at(b.fire ? 'flame' : b.shell ? 'cannon' : h.boss ? 'mg' : 'gun', ox, oy);
}
function gameOver(win){
  SFX.play(win ? 'win' : 'gameover'); MUSIC.setMode('title');
  setState('over');
  const dna = META.runReward(S.kills, S.level, S.t, win) + S.bonusDna; META.award(dna, S.t, S.kills, win);
  $('overTitle').textContent = win ? curMap().place + ' HAS FALLEN' : 'YOU WERE PUT DOWN';
  $('overTitle').style.color = win ? '#9be03a' : '#ff5a5a';
  $('overSub').textContent = win ? 'The gunship burns. The streets belong to the dead.' : 'Patient Zero is gone... but the infection lingers.';
  const mm = Math.floor(S.t/60), ss = String(Math.floor(S.t%60)).padStart(2,'0');
  $('overStats').innerHTML = `TIME <span>${mm}:${ss}</span> &middot; LEVEL <span>${S.level}</span><br>DEVOURED <span>${S.kills}</span> &middot; DNA <span>+${dna}</span>`;
  $('overDetail').innerHTML = statsHTML();
  checkUnlocks(win);
  $('overDna').innerHTML = `DNA BANK: ${META.dna}` + (S.newChars.length ? `<br><span style="color:#ffe070">UNLOCKED: ${S.newChars.join(', ')}</span>` : '');
}

// ---------- post-game breakdown ----------
const SRC_INFO = {
  bite:{n:'Bite', ic:'🦷'}, spit:{mut:'spit'}, spike:{mut:'spikes'}, screech:{mut:'screech'}, aura:{mut:'aura'}, pool:{mut:'trail'},
  minion:{n:'Your Horde', ic:'🧟'}, boom:{mut:'boom'}, bloater:{n:'Bloaters', ic:'🔥'}, hazard:{n:'Fuel Explosions', ic:'⛽'},
  saw:{n:'Bone Gatling', ic:'💀'}, wisps:{mut:'wisps'}, wave:{mut:'wave'}, bloom:{mut:'bloom'}, beam:{mut:'beam'}, hbone:{n:'Bone Squad', ic:'🦴'}, gat:{n:'Bone Gatling', ic:'💀'}, lash:{mut:'lash'}, spores:{mut:'spores'}, elite:{n:'Elite blasts', ic:'💥'}, bomb:{n:'Biohazard', ic:'☣️'}, nova:{evo:'aura'}, acid:{evo:'spit'}, other:{n:'Other', ic:'❔'},
};
const HEAL_INFO = {hide:['Necrotic Hide','🛡️'], hunger:['Ravenous','🍖'], devour:['Devour','🧟'], heart:['Fresh Hearts','🫀'], chest:['Boss Chests','🎁'],
  feast:['Feast','🩸'], regen:['Natural Regen','💚'], leech:['Blood Leech','🩸'], lash:['Blood Whip','🐙'], chitin:['Chitin (blocked)','🐚'], boss:['Boss Kills','💀'], other:['Other','❔']};
const TAKEN_INFO = {beat:['Baton Cops','👮'], cop:['Pistol Cops','🔫'], soldier:['Soldiers','🪖'], riot:['Riot Police','🛡️'], flamer:['Flamethrowers','🔥'],
  apc:['Armored Carrier','🚛'], heli:['Gunship','🚁'], shell:['Shells','💣'], dog:['K9 Units','🐕'], grenadier:['Grenadiers','💣'], sniper:['Snipers','🎯'], swat:['SWAT Van','🚓'], jugg:['Juggernaut','🦾'], cure:['The Cure','💉'], elite:['Elites','💥'], trap:['Bear Traps','🪤'], fire:['Fires','🔥'], other:['Other','❔']};
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
  const tRows = taken.map(([k,v]) => { const [nm, e] = TAKEN_INFO[k] || (VARIANTS[k] ? [VARIANTS[k].n.toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase()), HT[VARIANTS[k].base].boss ? '💀' : '⚔️'] : TAKEN_INFO.other);
    return `<div class="srow s2">${img(emojiIcon(e))}<div class="sn">${nm}${bar(v/topT, '#ff5a5a')}</div><div class="sv">${fmtN(v)}<small>HP</small></div></div>`; });
  const items = Object.entries(st.items).map(([k,v]) => `${ITEM_NAMES[k]||k} ${v}`).join(' &middot; ') || 'none';
  const evos = Object.keys(S.evo).map(k => EVOS[k].n).join(', ') || 'none';
  const misc = `<div class="sect"><div class="sh">THE OUTBREAK</div><div class="misc">
    <span>Zombies raised <b>${st.risen}</b></span><span>Horde lost <b>${st.lost}</b></span><span>Biggest horde <b>${S.maxHorde}</b></span>
    <span>Minions devoured <b>${st.devours}</b></span><span>Crates smashed <b>${st.crates}</b></span><span>Elites slain <b>${st.elites||0}</b></span><span>Luck <b>${luck()}</b></span><span>Curse <b>${curse()}</b></span><span>Attack speed <b>+${Math.round((AS()-1)*100)}%</b></span><span>Total damage <b>${fmtN(totalD)}</b></span>
    <span class="wide">Items: <b>${items}</b></span><span class="wide">Evolutions: <b>${evos}</b></span></div></div>`;
  return section('DAMAGE DEALT', dRows, 'No damage dealt.') + section('HEALING', hRows, 'No healing.') + section('DAMAGE TAKEN', tRows, 'Untouched!') + misc;
}

// ---------- level up ----------
function openLevel(reroll){
  const owned = Object.keys(S.mods), ownW = owned.filter(isWeapon), ownI = owned.filter(k => !isWeapon(k));
  const fullW = ownW.length >= slotsW(), fullI = ownI.length >= slotsI();
  // offer upgrades to anything owned, and new weapons / items only while that kind still has a free slot
  const pool = Object.keys(MUTS).filter(k => L(k) < maxLv(k) && (L(k) > 0 || (isWeapon(k) ? !fullW : !fullI))), opts = [];
  const evos = Object.keys(EVOS).filter(k => L(k) >= maxLv(k) && L(EVOS[k].w) > 0 && !E(k));
  // fully mutated: nothing left to choose, so don't interrupt - level-ups just heal and pay a little DNA
  if (!pool.length && !evos.length){
    const n = S.pendingLv, p = S.player; S.pendingLv = 0; heal(20*n, 'feast'); S.bonusDna += 2*n;
    // still announce it: chime, golden ring burst, sparkles and a pop-up
    SFX.play('lvlmax');
    floatText(p.x, p.y, `LEVEL ${S.level}! +${20*n} HP`, '#ffe070', true);
    S.parts.push({k:'shock', x:p.x, y:p.y, r:6, max:70, t:.45, max2:.45, col:'#ffe070'});
    S.parts.push({k:'shock', x:p.x, y:p.y, r:2, max:40, t:.35, max2:.35, col:'#fff4c0'});
    for (let i=0;i<14;i++) S.parts.push({k:'spark', x:p.x, y:p.y, vx:rand(-160,160), vy:rand(-200,20), t:rand(.3,.6), max:.6, col: Math.random()<.5 ? '#ffe070' : '#ff9ccc'});
    S.lights.push({x:p.x, y:p.y, r:90, spr:BAND.yellow, t:.35, max:.35, a:1});
    if (S.state === 'level') setState('play');
    return;
  }
  if (S.state !== 'level' && !reroll) SFX.play('levelup');
  setState('level');
  // a ready evolution always takes the first card
  if (evos.length) opts.push('evo:' + pick(evos));
  $('slots').textContent = `WEAPONS ${ownW.length}/${slotsW()}${fullW ? ' FULL' : ''}  -  ITEMS ${ownI.length}/${slotsI()}${fullI ? ' FULL' : ''}`;
  let nCards = 3; const lk = luck();
  if (Math.random() < lk*0.15) nCards++;
  if (lk >= 7 && Math.random() < (lk-6)*0.15) nCards++;
  if (nCards > 3 && pool.length + opts.length > 3) $('slots').textContent += '  -  LUCKY! +' + (nCards-3) + ' CHOICE' + (nCards > 4 ? 'S' : '');
  while (opts.length < nCards && pool.length) opts.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
  if (!opts.length) opts.push('_heal');
  const el = $('cards'); el.innerHTML = '';
  opts.forEach((k,i) => {
    const c = document.createElement('button'); c.className = 'card';
    if (k==='_heal') c.innerHTML = `<div class="k">${i+1}</div><div class="nm">FEAST</div><div class="lv">FULLY EVOLVED</div><div class="ds">Heal 50 HP.</div>`;
    else if (k.startsWith('evo:')){ const b = k.slice(4), V = EVOS[b]; c.className = 'card evo';
      c.innerHTML = `<div class="k">${i+1}</div><img class="ic" src="${emojiIcon(V.ic,'#7a5208').toDataURL()}" alt=""><div class="nm">${V.n}</div>
        <div class="lv">EVOLUTION: ${MUTS[b].n.toUpperCase()} + ${MUTS[V.w].n.toUpperCase()}</div><div class="ds">${V.d}</div>`; }
    else { const M = MUTS[k], l = L(k), src = mutIcon(k).toDataURL(), ev = evoHint(k);
      c.className = 'card ' + (isWeapon(k) ? 'weapon' : 'item');
      c.innerHTML = `<div class="k">${i+1}</div><img class="ic" src="${src}" alt=""><div class="tag">${isWeapon(k) ? 'WEAPON' : 'ITEM'}</div><div class="nm">${M.n}</div>
        <div class="lv ${l?'':'new'}">${l ? 'LV '+l+' &gt; '+(l+1)+' / '+maxLv(k) : 'NEW!'}</div><div class="ds">${l?M.u:M.b}</div>${ev}`; }
    c.onclick = () => choose(k);
    el.appendChild(c);
  });
  const rb = $('reroll'); rb.style.display = S.rerolls > 0 ? '' : 'none'; rb.textContent = `REROLL (${S.rerolls})`;
}
// evolution hint, shown only when this card pairs with a mutation you already own:
// "WITH [icon] PARTNER" then "> [icon] EVOLUTION NAME"
function evoHint(k){
  let base = null, partner = null;
  if (EVOS[k] && !E(k) && L(EVOS[k].w) > 0){ base = k; partner = EVOS[k].w; }
  else for (const b in EVOS) if (EVOS[b].w === k && L(b) > 0 && !E(b)){ base = b; partner = b; break; }
  if (!base) return '';
  const img = c => `<img src="${c.toDataURL()}" alt="">`, V = EVOS[base];
  const need = base === k ? 'MAX THIS' : `MAX ${MUTS[base].n.toUpperCase()}`;
  return `<div class="hint"><div class="ln">WITH ${img(emojiIcon(MUTS[partner].ic))} ${MUTS[partner].n.toUpperCase()}</div>
    <div class="ln evo-to">&gt; ${img(emojiIcon(V.ic, '#7a5208'))} ${V.n.toUpperCase()}</div><div class="ln need">${need} TO EVOLVE</div></div>`;
}
function choose(k){
  if (S.state!=='level') return;
  SFX.play('select');
  const p = S.player;
  if (k==='_heal') heal(50, 'feast');
  else if (k.startsWith('evo:')){ const b = k.slice(4); S.evo[b] = true; S.gotAt['evo:'+b] = S.t; SFX.play('evolve'); banner('EVOLVED!', EVOS[b].n.toUpperCase()); S.flashT = 0.3; }
  else { if (!S.mods[k]) S.gotAt[k] = S.t; S.mods[k] = L(k) + 1; if (k==='hide'){ p.maxHp += 25; heal(25, 'hide'); } }
  S.pendingLv--;
  if (S.pendingLv > 0) openLevel(); else setState('play');
}
function rerollLevel(){ if (S.state==='level' && S.rerolls > 0){ S.rerolls--; SFX.play('click'); openLevel(true); } }

// ---------- items & crates ----------
const ITEMS = {heart:{n:'FRESH HEART', w:.34}, magnet:{n:'MAGNET', w:.26}, saw:{n:'BONE GATLING', w:.22}, bomb:{n:'BIOHAZARD', w:.18}, dice:{n:'REROLL DIE', w:.2}, clover:{n:'CLOVER', w:.14}};
function pickItemType(){
  const p = S.player, w = {}; let sum = 0;
  for (const k in ITEMS){ w[k] = ITEMS[k].w * (k==='heart' && p.hp/p.maxHp < 0.5 ? 2.5 : 1); sum += w[k]; }
  let r = Math.random()*sum; for (const k in w){ r -= w[k]; if (r <= 0) return k; } return 'heart';
}
function onScreenPos(){
  const p = S.player; let x = p.x, y = p.y;
  for (let i=0;i<12;i++){ const a = rand(0,TAU), d = rand(110,280); x = p.x + Math.cos(a)*d; y = p.y + Math.sin(a)*d*0.6;
    if (Math.abs(x-p.x) < VW/2-30 && Math.abs(y-p.y) < VH/2-30) break; }
  return [x, y];
}
function spawnItem(k, x, y){ if (x === undefined) [x, y] = onScreenPos(); S.items.push({k, x, y, t:1e9, seed:Math.random()}); }
function staticTarget(type, x, y, hp, r, extra){
  return Object.assign({type, x, y, r, hp, maxHp:hp, sp:0, xp:0, flash:0, stun:0, kx:0, ky:0, cd:0, cd2:0, cd3:0, face:0, dead:false, seed:Math.random()}, extra||{});
}
// loot crates: targets for your attacks and horde; smash one for a random item
function spawnCrate(){ const [x, y] = onScreenPos(); S.humans.push(staticTarget('crate', x, y, 30, 12)); FX.dust(x, y); SFX.at('item', x, y); }
function breakCrate(h){
  S.st.crates++;
  FX.splinter(h.x, h.y, 16); SFX.at('crateBreak', h.x, h.y);
  spawnItem(pickItemType(), h.x, h.y);
  S.items[S.items.length-1].pop = 0.4;
}
function useItem(it){
  const p = S.player; stat('items', it.k, 1);
  switch (it.k){
    case 'heart': heal(30 + p.maxHp*0.2, 'heart'); FX.blood(p.x, p.y, 8, false); SFX.play('eat'); floatText(p.x, p.y, '+HEALTH', '#ff7a8a'); break;
    case 'magnet': for (const g of S.gems){ g.pull = true; g.mag = true; }
      for (const o of S.items) if (o.k !== 'chest' && o !== it){ o.pull = true; o.mag = true; } SFX.play('magnet'); floatText(p.x, p.y, 'MAGNET!', '#ff9ccc'); break;
    case 'saw': p.saw = 8; SFX.play('gatlingUp'); floatText(p.x, p.y, 'BONE GATLING!', '#ece4c8'); break;
    case 'bomb': biohazard(); break;
    case 'chest': openChest(); break;
    case 'clover': S.luckBonus = (S.luckBonus||0) + 1; SFX.play('lucky'); floatText(p.x, p.y, '+1 LUCK', '#7aff7a', true);
      for (let i=0;i<12;i++) S.parts.push({k:'spark', x:p.x, y:p.y, vx:rand(-140,140), vy:rand(-180,20), t:rand(.3,.6), max:.6, col: Math.random()<.5 ? '#7aff7a' : '#e8ff9a'}); break;
    case 'dice': S.rerolls++; SFX.play('select'); floatText(p.x, p.y, '+1 REROLL', '#c8d8ff'); break;
  }
}
// boss chest: the armored carrier drops one; it never despawns
function openChest(){
  const p = S.player; SFX.play('chest'); S.flashT = 0.45; S.shake = 6;
  const evos = Object.keys(EVOS).filter(k => L(k) >= maxLv(k) && L(EVOS[k].w) > 0 && !E(k));
  let msg;
  if (evos.length){ const b = pick(evos); S.evo[b] = true; S.pendingLv += 2; msg = 'FREE EVOLUTION: ' + EVOS[b].n.toUpperCase(); }
  else { S.pendingLv += 3; msg = '+3 FREE MUTATIONS'; }
  heal(p.maxHp, 'chest'); S.bonusDna += 40;
  for (let i=0;i<18;i++){ const a = rand(0,TAU), d = rand(30,110); S.gems.push({x:p.x+Math.cos(a)*d, y:p.y+Math.sin(a)*d*0.7, v:3, big:true}); }
  for (let i=0;i<20;i++) S.parts.push({k:'spark', x:p.x, y:p.y, vx:rand(-200,200), vy:rand(-220,40), t:rand(.3,.7), max:.7, col: Math.random()<.5 ? '#ffe070' : '#fff4c0'});
  banner('BOSS CHEST!', msg + '  +40 DNA');
}
// wipes every human on screen; no brains drop and nobody rises, but brains already on the ground stay
function biohazard(){
  const p = S.player; let n = 0;
  for (const h of S.humans){
    if (h.dead || h.type==='hazard' || Math.abs(h.x-p.x) > VW/2+10 || Math.abs(h.y-p.y) > VH/2+10) continue;
    if (h.type==='crate'){ killHuman(h); continue; }
    if (h.boss){ dmgHuman(h, h.maxHp*(h.type==='heli' ? 0.15 : 0.4), 'bomb'); continue; }
    h.dead = true; S.kills++; n++; stat('kills', 'bomb', 1); FX.blood(h.x, h.y, 6, false); FX.corpse(h);
  }
  for (let i=0;i<10;i++) FX.explosion(p.x + rand(-VW/2,VW/2)*0.9, p.y + rand(-VH/2,VH/2)*0.9, rand(50,90), 'green');
  S.hb.length = 0; S.flashT = 0.7; S.shake = 14; SFX.play('nuke');
  banner('BIOHAZARD!', n + ' HUMANS MELTED');
}
// gas pumps and fuel barrels are drawn as street props until they come into view, then become
// shootable targets that explode (hurting only humans) when destroyed
function promoteHazards(){
  const p = S.player, x0 = Math.floor((p.x-VW)/CH), x1 = Math.floor((p.x+VW)/CH), y0 = Math.floor((p.y-VH)/CH), y1 = Math.floor((p.y+VH)/CH);
  for (let cx=x0; cx<=x1; cx++) for (let cy=y0; cy<=y1; cy++){
    const ch = peekChunk(cx,cy); if (!ch) continue;
    for (const pr of ch.props){
      if ((pr.k!=='pump' && pr.k!=='fuel') || pr.live || pr.gone) continue;
      if (Math.abs(pr.x-p.x) > VW*0.8 || Math.abs(pr.y-p.y) > VH*0.8) continue;
      pr.live = true;
      S.humans.push(staticTarget('hazard', pr.x, pr.y, pr.k==='pump' ? 45 : 22, pr.k==='pump' ? 10 : 8, {sub:pr.k, prop:pr}));
    }
  }
}

// ---------- update ----------
const grid = new Map();
function separate(bodies){
  grid.clear(); const C = 40;
  for (const b of bodies){ const k = (Math.floor(b.x/C)+5000)*10000 + (Math.floor(b.y/C)+5000); let a = grid.get(k); if (!a) grid.set(k, a=[]); a.push(b); }
  for (const b of bodies){
    const cx = Math.floor(b.x/C)+5000, cy = Math.floor(b.y/C)+5000;
    for (let ix=-1; ix<=1; ix++) for (let iy=-1; iy<=1; iy++){
      const a = grid.get((cx+ix)*10000 + cy+iy); if (!a) continue;
      for (const o of a){ if (o===b) continue;
        const dx = b.x-o.x, dy = b.y-o.y, rr = b.r+o.r, dd = dx*dx+dy*dy;
        if (dd >= rr*rr || dd===0) continue;
        const d = Math.sqrt(dd), ov = (rr-d)*0.5, f = (o.mass||1)/((b.mass||1)+(o.mass||1));
        b.x += dx/d*ov*f; b.y += dy/d*ov*f; }
    }
  }
}
function update(dt){
  S.t += dt;
  const p = S.player, nt = nightAmt(), isNight = nt > 0.5;
  if (isNight && !S.wasNight){ SFX.play('night'); banner('NIGHT FALLS', 'THE HORDE GROWS STRONGER'); }
  if (!isNight && S.wasNight){ SFX.play('dawn'); banner('DAWN', 'THE LIVING REGROUP'); }
  S.wasNight = isNight;
  const bossAlive = S.humans.some(h => h.boss && !h.dead);
  MUSIC.setMode(S.humans.some(h => h.type==='heli') ? 'final' : bossAlive ? 'boss' : isNight ? 'night' : 'day');
  { // music reacts to the fight: how many threats are on screen, frenzy/chainsaw, low health, and time
    let near = 0; for (const h of S.humans) if (isTarget(h) && Math.abs(h.x-p.x) < VW/2 && Math.abs(h.y-p.y) < VH/2) near++;
    MUSIC.setMood(near/35 + (p.frenzy > 0 || p.saw > 0 ? 0.3 : 0), p.hp/p.maxHp < 0.3, Math.min(4, Math.floor(S.t/150))); }
  if (S.winT > 0){ S.winT -= dt; if (S.winT <= 0){ gameOver(true); return; } }

  // player movement (keyboard or touch stick)
  let mx = (K.d||K.arrowright?1:0) - (K.a||K.arrowleft?1:0), my = (K.s||K.arrowdown?1:0) - (K.w||K.arrowup?1:0);
  if (touch.stick){ mx = touch.stick.dx; my = touch.stick.dy; }
  const ml = Math.hypot(mx,my);
  p.moving = ml > 0.05;
  if (p.moving){ const k = Math.min(1, ml); mx /= ml; my /= ml;
    const spd = 160*GS*(S.ch.spd||1)*(1+0.1*L('legs'))*(E('trail')?1.15:1)*(1+0.2*nt)*(p.frenzy>0?1.4:1)*k;
    const sn = p.snared > 0 ? 0.15 : 1;   // a bear trap holds you briefly
    p.x += mx*spd*sn*dt; p.y += my*spd*sn*dt; p.face = Math.atan2(my,mx); }
  if (p.snared > 0) p.snared -= dt;
  p.frenzy -= dt; p.devourCd -= dt; p.flash -= dt; p.biteT -= dt;
  if (L('hide')) heal(0.4*L('hide')*dt, 'hide');
  if (S.ch.regen) heal(S.ch.regen*dt, 'regen');
  S.unlockT = (S.unlockT || 0) - dt; if (S.unlockT <= 0){ S.unlockT = 0.5; checkUnlocks(false); }

  // bite
  p.biteCd -= dt;
  if (p.biteCd <= 0){
    const reach = 18 + 6*L('jaws'); let tgt = null, bd = 1e9;
    for (const h of S.humans){ if (h.dead || h.air) continue; const d = Math.sqrt(d2(p,h))-h.r-p.r; if (d<reach && d<bd){ bd=d; tgt=h; } }
    if (tgt){ const dmg = 20*(S.ch.bite||1)*(1+0.3*L('jaws'))*(p.frenzy>0?2:1)*(1+0.3*nt)*(1+0.04*(S.level-1));
      SFX.play('bite'); dmgHuman(tgt, crit(tgt, dmg), 'bite'); p.biteCd = (p.frenzy>0 ? 0.28 : 0.45)/AS(); p.biteT = 0.12; p.biteA = Math.atan2(tgt.y-p.y, tgt.x-p.x); }
  }

  // mutations: attacks only fire at targets on screen AND within range; otherwise they stay charged
  const visible = h => !h.dead && Math.abs(h.x-p.x) < VW/2 - 8 && Math.abs(h.y-p.y) < VH/2 - 8;
  // pumps/barrels are only worth shooting when there are humans next to them
  const worth = h => h.type!=='hazard' || S.humans.some(o => isTarget(o) && !o.dead && d2(o,h) < 90*90);
  const anyTarget = range => S.humans.some(h => visible(h) && isTarget(h) && d2(h,p) < (range+h.r)**2);
  const wt = S.wt; let l = L('spit');
  if (l){ wt.spit = Math.max(0, wt.spit - dt); if (wt.spit<=0){
    const n = 1 + Math.floor(l/2) + (E('spit') ? 2 : 0);
    const tg = S.humans.filter(h => visible(h) && worth(h) && d2(h,p) < (320*(1+0.12*L('eyes')))**2).sort((a,b)=>d2(a,p)-d2(b,p)).slice(0,n);
    if (tg.length){ wt.spit = 1.25*Math.max(0.32, 1-0.085*l)/AS(); SFX.play('spit', 0.6);
      for (let i=0;i<n;i++){ const t = tg[i % tg.length], a = Math.atan2(t.y-p.y,t.x-p.x) + (i>=tg.length ? rand(-.2,.2) : 0);
        S.pb.push({x:p.x,y:p.y,vx:Math.cos(a)*300*GS,vy:Math.sin(a)*300*GS,dmg:12+6*l,t:1.2/GS,r:6,pierce:1+Math.max(0,l-2)+(E('spit')?2:0),hit:new Set(),k:'spit'}); } } } }
  l = L('spikes');
  if (l){ wt.spikes = Math.max(0, wt.spikes - dt); if (wt.spikes<=0 && anyTarget(160*(1+0.12*L('eyes')))){ wt.spikes = (3.2 - 0.3*l)*(E('spikes') ? 0.5 : 1)/AS(); SFX.play('bone');
    const n = 6 + 2*l, off = Math.random()*TAU;
    for (let i=0;i<n;i++){ const a = off + i/n*TAU;
      S.pb.push({x:p.x,y:p.y,vx:Math.cos(a)*260*GS,vy:Math.sin(a)*260*GS,dmg:16+8*l,t:0.6/GS,r:5,pierce:3,hit:new Set(),k:'spike'}); } } }
  l = L('screech');
  if (l){ const R = (110 + 20*l)*(E('screech') ? 1.5 : 1);
    wt.screech = Math.max(0, wt.screech - dt); if (wt.screech<=0 && anyTarget(R)){ wt.screech = (E('screech') ? 3.5 : Math.max(2.5, 7.5 - 0.7*l))/AS(); SFX.play('screech');
    S.parts.push({k:'shock',x:p.x,y:p.y,r:10,max:R,t:.45,max2:.45,col:'#e6ffc0'});
    S.parts.push({k:'shock',x:p.x,y:p.y,r:4,max:R*0.7,t:.35,max2:.35,col:'#9be03a'});
    for (const h of S.humans){ if (h.dead || !isTarget(h)) continue; const d = Math.sqrt(d2(h,p));
      if (d < R+h.r){ const k = h.boss?0.1:1; h.stun = Math.max(h.stun,(1+0.3*l)*k);
        h.kx = (h.x-p.x)/(d||1)*380*k; h.ky = (h.y-p.y)/(d||1)*380*k; dmgHuman(h, 8*l*(E('screech')?4:1), 'screech'); } } } }
  l = L('aura');
  if (l){ const R = (55+13*l)*(E('aura')?1.4:1), dps = (9+7*l)*(E('aura')?2:1);
    for (const h of S.humans) if (!h.dead && isTarget(h) && d2(h,p) < (R+h.r)**2) dmgHuman(h, dps*dt, 'aura', true); }
  // toxic trail: small, frequent puddles that merge into one streak; damage applies once per human
  l = L('trail');
  if (l){ wt.trail -= dt; if (wt.trail<=0 && p.moving){ wt.trail = 0.05;
    const life = 1.8 + 0.5*l;
    S.pools.push({x:p.x+rand(-3,3), y:p.y+rand(-2,2), r:rand(10,13)+2*l+(E('trail')?7:0), t:life, seed:Math.random(), bx:rand(-6,6), by:rand(-4,4)}); } }
  if (S.pools.length){ const dps = (8 + 7*L('trail'))*(E('trail')?2:1);
    for (const h of S.humans){ if (h.dead || !isTarget(h) || h.air) continue;
      for (const q of S.pools) if (d2(h,q) < (q.r*0.9)**2){ dmgHuman(h, dps*dt, 'pool', true); if (Math.random()<dt*6) FX.bubble(h.x,h.y); break; } } }
  for (const q of S.pools) q.t -= dt;
  S.pools = S.pools.filter(q=>q.t>0);

  // crates, items, hazards, chainsaw
  S.itemT -= dt;
  if (S.itemT <= 0){ S.itemT = rand(9,14)*Math.max(0.6, 1 - 0.05*luck()); if (S.humans.filter(h => h.type==='crate').length < 3) spawnCrate(); }
  const igrab = 80*(1 + 0.2*META.rank('scent') + 0.1*L('eyes'));
  for (const it of S.items){ if (it.pop > 0){ it.pop -= dt; continue; }
    const d = Math.sqrt(d2(it,p));
    if (d < igrab || it.pull){ it.pull = true; const s = Math.min(d, (it.mag ? 110 + d*0.6 : 260)*dt); it.x += (p.x-it.x)/(d||1)*s; it.y += (p.y-it.y)/(d||1)*s; }
    if (d < p.r+12){ it.got = true; useItem(it); } }
  S.items = S.items.filter(it => !it.got && it.t > 0);
  S.hazT -= dt; if (S.hazT <= 0){ S.hazT = 0.3; promoteHazards(); }
  S.flashT = Math.max(0, S.flashT - dt);
  updateContent(dt, p);   // new mutations, spore mines, cure gas, threat banners, Bone Gatling (content.js)

  // spawning & bosses
  const rate = 0.75 * Math.min(1.8 + S.t/50, 10) * (isNight ? 0.85 : 1) * (1 + 0.12*curse());
  S.spawnAcc += dt*rate;
  while (S.spawnAcc >= 1){ S.spawnAcc--; if (S.humans.length < 220) spawnHuman(pickType()); }
  if (S.t >= S.nextCrowd){ S.nextCrowd += 50; spawnCrowd(); }
  [240, 480].forEach((bt, i) => { if (S.t >= bt && !S.bosses[bt]){ S.bosses[bt] = true; spawnBoss(S.bossPlan[i]); } });   // random bosses each run
  if (S.t >= 540 && !S.bosses.heli){ S.bosses.heli = true; const [x,y] = edgePos(60), fk = roster().final; spawnHuman(fk, x, y);
    if (VARIANTS[fk]) banner(...VARIANTS[fk].intro); else banner('GUNSHIP INBOUND','DESTROY IT TO TAKE ' + curMap().place); SFX.play('alarm'); }
  if (S.t >= 555 && !S.finalWave){ S.finalWave = true; const w = roster().wave; for (let i=0;i<14;i++) spawnHuman(i%3 ? w[0] : w[1], undefined, undefined, true); }
  if (S.t >= GAME_LEN && !S.overtime && S.winT <= 0){ S.overtime = true; const f = S.humans.find(h => h.type==='heli'); banner('OVERTIME', (f ? enemyName(f) : 'THE GUNSHIP') + ' MUST FALL'); }
  if (S.crowd){ S.crowd.t -= dt; if (S.crowd.t<=0) S.crowd = null; }

  // humans
  const viewR = Math.hypot(VW,VH)/2;
  // humans move at half pace, creeping up to +25% faster by the end of the run
  const hsp = GS * (1 + 0.25*Math.min(S.t, GAME_LEN)/GAME_LEN) * (1 + 0.04*curse());
  for (const h of S.humans){
    if (h.dead) continue;
    const fz = h.elite==='frenzied' ? 1.8 : 1; h.flash -= dt; h.cd -= dt*0.75*fz; h.cd2 -= dt*0.75*fz; h.cd3 -= dt;
    if (h.elite==='regen') h.hp = Math.min(h.maxHp, h.hp + h.maxHp*0.03*dt);
    if (h.elite) eliteTick(h, dt, p);
    if (!isTarget(h)){ h.kx = h.ky = 0; h.stun = 0;
      if (Math.abs(h.x-p.x) > VW*1.5 || Math.abs(h.y-p.y) > VH*1.8){ h.dead = true; if (h.prop) h.prop.live = false; }
      continue; }
    h.x += h.kx*GS*dt; h.y += h.ky*GS*dt; h.kx *= Math.pow(0.02,dt); h.ky *= Math.pow(0.02,dt);
    const pd = Math.sqrt(d2(h,p));
    if (pd > viewR*1.9 && !h.boss){
      if (h.type==='civ' && Math.random()<0.5){ h.dead = true; continue; }
      [h.x, h.y] = edgePos(30); h._lx = undefined;
    }
    if (h.stun > 0){ h.stun -= dt; continue; }
    const [z, zd] = nearestZombie(h), ang = Math.atan2(z.y-h.y, z.x-h.x);
    let vx = 0, vy = 0, sp = h.sp;
    if (h.rage > 0){ h.rage -= dt; sp *= 1.4; }   // the Warlord's war cry
    const rangeMul = 1 - 0.3*nt, V = h.V || {};
    switch (V.ai ? 'map' : h.type){
      case 'map': { const v = aiMap(h, z, zd, ang, dt, p, rangeMul); vx = v[0]; vy = v[1]; break; }
      case 'civ':
        if (zd < 190){ vx = -Math.cos(ang); vy = -Math.sin(ang); sp *= 1.1; h.face = ang+Math.PI; h.panic = 0.5; }
        else { h.wa += rand(-2,2)*dt;
          if (zd > 320){ const tp = Math.atan2(p.y-h.y, p.x-h.x); h.wa += clamp(((tp-h.wa+Math.PI*3)%TAU)-Math.PI, -dt*1.5, dt*1.5); }
          vx = Math.cos(h.wa)*0.45; vy = Math.sin(h.wa)*0.45; h.face = h.wa; h.panic -= dt; }
        break;
      case 'cop': case 'soldier': {
        const R = (V.range || (h.type==='cop' ? 190 : 230))*rangeMul; h.face = ang;
        if (zd > R*0.8){ vx = Math.cos(ang); vy = Math.sin(ang); }
        else if (zd < R*0.45){ vx = -Math.cos(ang); vy = -Math.sin(ang); }
        else { vx = Math.cos(ang+Math.PI/2*h.strafe)*0.6; vy = Math.sin(ang+Math.PI/2*h.strafe)*0.6; if (Math.random()<dt*0.4) h.strafe *= -1; }
        const spread = 0.07 + 0.18*nt;
        if (h.type==='cop' && h.cd<=0 && zd<R){ h.cd = rand(1.7,2.3)*(V.cdMul || 1);
          if (V.pellets){ for (let i=0;i<V.pellets;i++) hfire(h, ang+rand(-V.spread,V.spread), 230, V.bdmg || 6, {t:0.9}); }   // shotgun
          else if (V.fan){ h.burst = V.fan; h.bt = 0; }   // revolver: fan the hammer
          else hfire(h, ang+rand(-spread,spread), V.bspd || 250, V.bdmg || 6); }
        if (h.type==='cop' && V.fan && h.burst>0){ h.bt -= dt; if (h.bt<=0){ h.bt = 0.11; h.burst--; hfire(h, ang+rand(-V.spread,V.spread), 260, 5); } }
        if (h.type==='soldier'){
          if (h.cd<=0 && zd<R){ h.cd = rand(2.2,2.8); h.burst = V.burst || 3; h.bt = 0; }
          if (h.burst>0){ h.bt -= dt; if (h.bt<=0){ h.bt = 0.09; h.burst--; hfire(h, ang+rand(-spread,spread), 300, V.bdmg || 6); } }
        }
        break; }
      case 'beat':   // baton cop: rushes in and clubs whatever zombie is closest
        h.face = ang; h.swing = (h.swing||0) - dt; vx = Math.cos(ang); vy = Math.sin(ang);
        if (zd < h.r+z.r+6 && h.cd<=0){ h.cd = rand(0.9,1.2)*(V.mcd || 1); h.swing = 0.15; SFX.at('baton', h.x, h.y);
          const md = V.mdmg || 1, kb = V.knock === undefined ? 6 : V.knock;   // negative knock = cargo hook drags the target in
          if (z===p) hurtPlayer(6*md*(h.dmgMul||1), h.kind); else { hurtMinion(z, 10*md); z.x += Math.cos(ang)*kb; z.y += Math.sin(ang)*kb; } }
        break;
      case 'riot':
        h.face = ang; vx = Math.cos(ang); vy = Math.sin(ang);
        if (V.bees && zd < 200){ h.beeT = (h.beeT === undefined ? rand(1,3) : h.beeT) - dt;   // beekeepers loose a slow stinging swarm
          if (h.beeT <= 0){ h.beeT = rand(2.6,3.4); for (let i=0;i<3;i++) hfire(h, ang+rand(-.4,.4), rand(80,110), 3, {t:2.2, r:5, bee:true}); } }
        if (zd < h.r+z.r+4 && h.cd<=0){ h.cd = 0.9;
          if (z===p) hurtPlayer(10*(h.dmgMul||1), h.kind); else { hurtMinion(z, 14); z.x += Math.cos(ang)*12; z.y += Math.sin(ang)*12; } }
        break;
      case 'flamer':
        h.face = ang;
        if (zd > 70){ vx = Math.cos(ang); vy = Math.sin(ang); }
        if (zd < 130){ h.bt -= dt; if (h.bt<=0){ h.bt = 0.05; hfire(h, ang+rand(-.28,.28), rand(180,230), 2.5, {t:0.5, r:7, fire:true}); } }
        break;
      case 'dog': case 'medic': case 'grenadier': case 'sniper': case 'swat': case 'jugg': case 'cure': { const v = aiNew(h, z, zd, ang, dt, p, rangeMul); vx = v[0]; vy = v[1]; break; }
      case 'apc': {
        const pa = Math.atan2(p.y-h.y, p.x-h.x);
        h.face += clamp(((pa-h.face+Math.PI*3)%TAU)-Math.PI, -dt*1.2, dt*1.2);
        vx = Math.cos(h.face); vy = Math.sin(h.face); h.turret = ang;
        if (h.cd<=0 && zd<300){ h.cd = 0.16; hfire(h, ang+rand(-.12,.12), 320, 4); }
        if (h.cd2<=0){ h.cd2 = 3; h.recoil = 1; const pd2 = Math.sqrt(d2(h,p)); hfire(h, pa, 200, 22, {t:Math.min(2.5,pd2/200), r:7, shell:true, molotov:!!V.molotov}); }
        for (const m of S.minions) if (d2(h,m) < (h.r+m.r)**2) hurtMinion(m, 60*dt);
        if (d2(h,p) < (h.r+p.r+4)**2 && h.cd3<=0){ h.cd3 = 0.6; hurtPlayer(8, 'apc'); }
        break; }
      case 'heli': {   // final boss: circles you, strafes with a door gun, fires rocket volleys, drops troops
        h.orb = (h.orb === undefined ? Math.atan2(h.y-p.y, h.x-p.x) : h.orb) + dt*0.28;
        const tx = p.x + Math.cos(h.orb)*215, ty = p.y + Math.sin(h.orb)*150;
        h.x += (tx-h.x)*Math.min(1, dt*0.8); h.y += (ty-h.y)*Math.min(1, dt*0.8);
        h.face = Math.atan2(p.y-h.y, p.x-h.x); h.turret = ang;
        if (h.cd<=0){ h.cd = 2.4; h.burst = 6; h.bt = 0; }
        if (h.burst>0){ h.bt -= dt; if (h.bt<=0){ h.bt = 0.08; h.burst--; hfire(h, ang+rand(-.1,.1), 320, 5); } }
        if (h.cd2<=0){ h.cd2 = 5.5; h.recoil = 1;
          for (let i=0;i<3;i++){ const txp = p.x+rand(-70,70), typ = p.y+rand(-45,45), a = Math.atan2(typ-h.y, txp-h.x), d = Math.hypot(txp-h.x, typ-h.y);
            hfire(h, a, 200, 18, {t:Math.min(3, d/200), r:7, shell:true, molotov:!!V.firebomb}); } }
        h.drop = (h.drop === undefined ? 8 : h.drop) - dt;
        if (h.drop <= 0){ h.drop = 14; const dk = V.drops || ['soldier','soldier']; for (let i=0;i<2;i++) spawnHuman(dk[i % dk.length], h.x+rand(-20,20), h.y+rand(-10,10), true); }
        break; }
    }
    h.x += vx*sp*hsp*dt; h.y += vy*sp*hsp*dt;
  }

  // corpses rising
  for (const c of S.corpses){ c.t -= dt;
    if (c.t <= 0){ if (hordeCount() < hordeCap()){ addMinion(c.x,c.y,c.v,c.look); FX.rise(c.x,c.y); SFX.at('rise', c.x, c.y); }
      else FX.corpse({x:c.x, y:c.y, look:c.look}); } }
  S.corpses = S.corpses.filter(c => c.t > 0);

  // minions
  const am = (1 + 0.2*L('alpha'))*(E('bloom') ? 1.5 : 1), as = 1 + 0.08*L('alpha'), HS = S.ch.hs || {};
  S.minions.forEach((m,i) => {
    m.flash -= dt; m.atkCd -= dt; m.wob += dt*8;
    if (m.rise > 0){ m.rise -= dt; return; }
    const V = VAR[m.v];
    m.rt -= dt;
    if (m.target && m.target.dead) m.target = null;
    if (m.rt <= 0){ m.rt = rand(0.2,0.35);
      const t = nearestHuman(m, HS.range || 260, true); m.target = (t && d2(t,p) < (HS.leash || 420)**2) ? t : null; }
    if (m.husk && m.life){ m.life -= dt; if (m.life <= 0){ m.hp = 0; FX.rise(m.x, m.y); return; } }   // temporary husks crumble
    if (HS.regen) m.hp = Math.min(m.maxHp, m.hp + m.maxHp*HS.regen*dt);
    let tx, ty;
    if (m.target){ tx = m.target.x; ty = m.target.y; }
    else switch (HS.form){   // idle formation differs per character
      case 'tight': { const a = m.slot + S.t*0.6, r = 26 + (i%3)*10; tx = p.x + Math.cos(a)*r; ty = p.y + Math.sin(a)*r*0.8; break; }
      case 'front': { const a = p.face + ((i%5)-2)*0.32, r = 40 + Math.floor(i/5)*14; tx = p.x + Math.cos(a)*r; ty = p.y + Math.sin(a)*r*0.8; break; }
      case 'trail': { tx = p.x - Math.cos(p.face)*(26 + i*11) + Math.sin(p.face)*((i%2)*2-1)*6; ty = p.y - Math.sin(p.face)*(20 + i*8); break; }
      default: { const ring = 46 + (i%4)*16, a = m.slot + S.t*0.25; tx = p.x + Math.cos(a)*ring; ty = p.y + Math.sin(a)*ring*0.8; }
    }
    const dx = tx-m.x, dy = ty-m.y, dl = Math.hypot(dx,dy);
    let spd = 118*GS*V.sp*as*(1+0.35*nt)*(HS.spd || 1); if (d2(m,p) > 200*200) spd *= 1.6;
    const holdRange = HS.ranged && m.target && dl < 95;   // the General's squad stops and throws
    if (m.snared > 0) m.snared -= dt;
    else if (dl > 4 && !holdRange){ const s = Math.min(spd*dt, dl); m.x += dx/dl*s; m.y += dy/dl*s; m.face = Math.atan2(dy,dx); }
    let md = HORDE_DMG*V.dmg*am*(1+0.4*nt); if (HS.crit && Math.random() < HS.crit + 0.03*luck()) md *= 2;
    if (HS.ranged && m.target && dl < 140 && dl > m.r + m.target.r + 5 && m.atkCd <= 0){ m.atkCd = 1.1; m.face = Math.atan2(dy,dx);
      S.pb.push({x:m.x, y:m.y, vx:dx/dl*230*GS, vy:dy/dl*230*GS, dmg:md*0.8, t:1.4/GS, r:4, pierce:1, hit:new Set(), k:'hbone'}); }
    else if (m.target && dl < m.r + m.target.r + 5 && m.atkCd <= 0){ m.atkCd = 0.7;
      dmgHuman(m.target, md, m.husk ? 'bloom' : 'minion'); if (L('leech')) heal(md*0.012*L('leech'), 'leech');
      if (HS.lifesteal) m.hp = Math.min(m.maxHp, m.hp + md*HS.lifesteal); }
  });
  S.minions = S.minions.filter(m => m.hp > 0);
  S.maxHorde = Math.max(S.maxHorde, S.minions.length);

  p.mass = 4; for (const h of S.humans) h.mass = h.boss ? 60 : !isTarget(h) ? 80 : h.type==='riot' ? 2.5 : 1;
  separate([p, ...S.minions, ...S.humans.filter(h => !h.dead && !h.air)]);

  // player projectiles
  for (const b of S.pb){ b.x += b.vx*dt; b.y += b.vy*dt; b.t -= dt;
    for (const h of S.humans){ if (h.dead || b.hit.has(h)) continue;
      if (d2(b,h) < (b.r+h.r)**2){ b.hit.add(h); dmgHuman(h, crit(h, b.dmg), b.k);
        if (b.k==='spit'){ FX.splash(b.x,b.y); SFX.at('splat', b.x, b.y);
          if (E('spit')){ FX.explosion(b.x, b.y, 34, 'green');   // Plague Geyser acid splash
            for (const o of S.humans) if (!o.dead && o!==h && isTarget(o) && d2(o,b) < 40*40) dmgHuman(o, b.dmg*0.5, 'acid', true); } }
        if (--b.pierce <= 0){ b.t = 0; break; } } } }
  S.pb = S.pb.filter(b => b.t > 0);
  // human projectiles
  for (const b of S.hb){ b.x += b.vx*dt; b.y += b.vy*dt; b.t -= dt;
    if (b.shell){ if (b.t<=0){ explode(b.x,b.y,b.rad||70,b.dmg,'human',b.molotov ? 'fire' : null,b.src);
        if (b.molotov) for (let i=0;i<5;i++){ const a = rand(0,TAU), d = rand(0,(b.rad||60)*0.55); firePatch(b.x+Math.cos(a)*d, b.y+Math.sin(a)*d*0.7, rand(2.5,4)); } }
      continue; }
    if (b.patch){ b.cd = (b.cd || 0) - dt; if (b.cd > 0) continue;   // burning ground: ticks, never consumed
      if (d2(b,p) < (b.r+p.r)**2){ b.cd = 0.45; hurtPlayer(b.dmg, 'fire'); continue; }
      for (const m of S.minions) if (m.hp>0 && m.rise<=0 && d2(b,m) < (b.r+m.r)**2){ b.cd = 0.45; hurtMinion(m, b.dmg*2); break; }
      continue; }
    if (b.bee){ const a = Math.atan2(p.y-b.y, p.x-b.x), s = Math.hypot(b.vx, b.vy); b.vx += (Math.cos(a)*s - b.vx)*dt*1.5; b.vy += (Math.sin(a)*s - b.vy)*dt*1.5; }
    if (d2(b,p) < (b.r+p.r)**2){ b.t = 0; if (!b.fire && !b.harpoon && deflect(b)) continue; hurtPlayer(b.dmg, b.src); if (b.harpoon && !b.owner.dead) b.owner.reel = {tg:p, t:0.7}; continue; }
    for (const m of S.minions) if (m.hp>0 && m.rise<=0 && d2(b,m) < (b.r+m.r)**2){ hurtMinion(m, b.fire ? b.dmg*3 : b.dmg); b.t = 0;
      if (b.harpoon && !b.owner.dead) b.owner.reel = {tg:m, t:0.9}; break; } }
  updateTraps(dt, p);
  S.hb = S.hb.filter(b => b.t > 0);
  S.minions = S.minions.filter(m => m.hp > 0);
  S.humans = S.humans.filter(h => !h.dead);

  // brains
  const grab = 80*(1 + 0.2*META.rank('scent') + 0.1*L('eyes')), xpMul = xpBonus();
  // idle brains near each other slide together and fuse into one bigger brain (value is kept exactly)
  S.mergeT = (S.mergeT || 0) - dt;
  if (S.mergeT <= 0){ S.mergeT = 0.5;
    const cells = new Map(), off = (S.mergeFlip = !S.mergeFlip) ? 40 : 0;   // shifting grid lets neighbours across cell borders fuse too
    for (const g of S.gems){ if (g.pull || g.mergeTo || g.merged || (g.age||0) < 2.5) continue;
      const k = Math.floor((g.x+off)/80)*100003 + Math.floor((g.y+off)/80); const a = cells.get(k);
      if (!a) cells.set(k, g); else if (g.v > a.v){ a.mergeTo = g; cells.set(k, g); } else g.mergeTo = a; } }
  for (const g of S.gems){
    g.age = (g.age||0) + dt; if (g.pulse > 0) g.pulse -= dt;
    const m = g.mergeTo; if (!m) continue;
    if (m.got || m.merged || m.pull || g.pull){ g.mergeTo = null; continue; }
    if (m.mergeTo){ g.mergeTo = m.mergeTo; continue; }   // follow chains to the final anchor
    const md = Math.sqrt(d2(g,m));
    if (md < 5){ m.v += g.v; g.merged = true; m.pulse = 0.3; m.age = 0; }
    else { const s = Math.min(md, 240*dt); g.x += (m.x-g.x)/md*s; g.y += (m.y-g.y)/md*s; }
  }
  for (const g of S.gems){ if (g.merged) continue; const d = Math.sqrt(d2(g,p));
    if (d < grab || g.pull){ g.mergeTo = null; g.pull = true; const s = Math.min(d, (g.mag ? 140 + d*0.7 : Math.max(420, d*3))*dt); g.x += (p.x-g.x)/(d||1)*s; g.y += (p.y-g.y)/(d||1)*s; }   // magnet (g.mag) pulls are a slow, visible drift
    if (d < p.r+6){ g.got = true; S.xp += g.v*xpMul*(g.wave ? 1.25 : 1); SFX.play('pickup', 0.8, S.combo++); S.comboT = 0.6;
      while (S.xp >= S.xpNext){ S.xp -= S.xpNext; S.level++; S.pendingLv++; S.xpNext = Math.floor(4 + Math.pow(S.level,1.3)*2.2); } } }
  S.comboT -= dt; if (S.comboT <= 0) S.combo = 0;
  S.gems = S.gems.filter(g => !g.got && !g.merged);
  if (S.gems.length > 400) S.gems.splice(0, S.gems.length-400);

  for (const t of S.texts){ t.t -= dt; t.y -= (t.crit ? 40 : 24)*dt; }
  S.texts = S.texts.filter(t => t.t > 0);
  for (const b of S.bodies) b.t -= dt;
  S.bodies = S.bodies.filter(b => b.t > 0);
  if (S.banner){ S.banner.t -= dt; if (S.banner.t<=0) S.banner = null; }
  S.shake *= Math.pow(0.002, dt); if (S.shake < 0.3) S.shake = 0;
  updateFx(dt);
  if (S.pendingLv > 0 && S.state==='play' && S.winT <= 0) openLevel();
}

// ---------- input: keyboard ----------
addEventListener('keydown', e => {
  const k = e.key.toLowerCase(); K[k] = true;
  if (k==='m'){ SFX.toggle(); return; }
  if (k===' ' || k.startsWith('arrow')) e.preventDefault();
  if ($('shop').classList.contains('show')){ if (k==='escape') closeShop(); return; }
  if ($('maps').classList.contains('show')){ if (k==='escape') closeMaps(); if (k==='enter') pickMap(MAP_ID); return; }
  if ($('chars').classList.contains('show')){ if (k==='escape') closeChars(); if (k==='enter') pickChar(selChar); return; }
  if (!S){ if (k==='enter' || k===' ') openChars('title'); return; }
  if (S.state==='play'){
    if (k==='e' || k==='shift') devour();
    if (k==='p' || k==='escape') setState('pause');
  } else if (S.state==='pause'){ if (k==='p' || k==='escape') setState('play'); }
  else if (S.state==='level'){ if (k>='1' && k<='5'){ const c = $('cards').children[+k-1]; if (c) c.click(); } if (k==='r') rerollLevel(); }
  else if (S.state==='over'){ if (k==='r') startGame(S.cid); if (k==='enter') openChars('over'); }
});
addEventListener('keyup', e => { K[e.key.toLowerCase()] = false; });
addEventListener('blur', () => { for (const k in K) K[k] = false; resetStick(); if (S && S.state==='play') setState('pause'); });

// ---------- input: touch (virtual stick + buttons) ----------
const touch = {used:false, stick:null, id:null, ox:0, oy:0};
function lowXY(e){ return [e.clientX*DPR/SCALE, e.clientY*DPR/SCALE]; }
function touchButtons(){ return [{id:'eat', x:LW-26, y:LH-34, r:17, label:'EAT'}]; }
cv.addEventListener('pointerdown', e => {
  // the pause button works for mouse and touch alike (generous hit area for thumbs)
  if (S && S.state === 'play'){ const [x, y] = lowXY(e), b = PAUSE_BTN();
    if (x > b.x-5 && x < b.x+b.w+5 && y > b.y-5 && y < b.y+b.h+5){ e.preventDefault(); setState('pause'); return; } }
  if (e.pointerType === 'mouse') return;
  touch.used = true; e.preventDefault();
  if (!S || S.state!=='play') return;
  const [x,y] = lowXY(e);
  for (const b of touchButtons()) if (Math.hypot(x-b.x, y-b.y) < b.r+6){ if (b.id==='snd') SFX.toggle(); else devour(); return; }
  // always hand the stick to the newest finger, so a lost "finger up" event can never leave it stuck
  touch.id = e.pointerId; touch.ox = x; touch.oy = y; touch.stick = {dx:0, dy:0};
  try { cv.setPointerCapture(e.pointerId); } catch (err) {}
});
cv.addEventListener('pointermove', e => {
  if (e.pointerId !== touch.id) return;
  const [x,y] = lowXY(e), dx = x-touch.ox, dy = y-touch.oy, d = Math.hypot(dx,dy), R = 22;
  if (d > R){ touch.ox = x - dx/d*R; touch.oy = y - dy/d*R; }
  touch.stick = {dx: clamp(dx/R,-1,1), dy: clamp(dy/R,-1,1)};
});
function resetStick(){ touch.id = null; touch.stick = null; }
const endTouch = e => { if (e.pointerId === touch.id) resetStick(); };
// belt and braces: any of these ending the active touch releases the stick
for (const ev of ['pointerup','pointercancel','lostpointercapture']) cv.addEventListener(ev, endTouch);
addEventListener('pointerup', endTouch); addEventListener('pointercancel', endTouch);
addEventListener('touchend', e => { if (e.touches.length === 0) resetStick(); }, {passive:true});
addEventListener('touchcancel', resetStick, {passive:true});
document.addEventListener('visibilitychange', resetStick);
function drawTouchUI(){
  if (!touch.used) return;
  if (touch.stick){ const x = Math.round(touch.ox), y = Math.round(touch.oy);
    lg.globalAlpha = 0.5; lg.fillStyle = '#e0d8f0';
    const n = 40; for (let i=0;i<n;i++){ const a = i/n*TAU; lg.fillRect(Math.round(x+Math.cos(a)*22), Math.round(y+Math.sin(a)*22), 1, 1); }
    pcirc(lg, Math.round(x+touch.stick.dx*22), Math.round(y+touch.stick.dy*22), 7, '#e0d8f0'); lg.globalAlpha = 1; }
  for (const b of touchButtons()){
    lg.globalAlpha = 0.65; pcirc(lg, b.x, b.y, b.r, '#170d1c'); pcirc(lg, b.x, b.y, b.r-1, b.id==='eat' ? '#6a1a2a' : '#1a3a5a'); lg.globalAlpha = 1;
    ptext(lg, b.label, b.x, b.y-3, '#f0e8e0', {align:'center'});
  }
}

// ---------- boot ----------
$('startBtn').onclick = () => openChars('title');
$('againBtn').onclick = () => openChars('over');
$('charsBack').onclick = closeChars;
$('mapsBack').onclick = closeMaps;
$('labBtn').onclick = () => openShop('title');
$('labBtn2').onclick = () => openShop('over');
$('shopBack').onclick = closeShop;
$('reroll').onclick = rerollLevel;
$('resumeBtn').onclick = () => { if (S && S.state==='pause') setState('play'); };
$('soundBtn').onclick = () => { SFX.toggle(); $('soundBtn').textContent = 'SOUND: ' + (SFX.muted ? 'OFF' : 'ON'); };
let giveUpArmed = false;
$('quitBtn').onclick = () => { if (!giveUpArmed){ giveUpArmed = true; $('quitBtn').textContent = 'TAP AGAIN'; return; } giveUpArmed = false; gameOver(false); };
// pause screen: run stats plus every weapon and item with its level
function renderPause(){
  giveUpArmed = false; $('quitBtn').textContent = 'GIVE UP'; $('soundBtn').textContent = 'SOUND: ' + (SFX.muted ? 'OFF' : 'ON');
  const mm = Math.floor(S.t/60), ss = String(Math.floor(S.t%60)).padStart(2,'0'), img = c => `<img src="${c.toDataURL()}" alt="">`;
  const stat = (k, v, c) => `<span>${k} <b style="color:${c||'#f6f0e0'}">${v}</b></span>`;
  const dmgMul = (1 + 0.12*L('might')) * (S.ch.dmg || 1);
  const stats = [stat('TIME', mm+':'+ss), stat('KILLS', S.kills), stat('LEVEL', S.level, '#ff9ccc'), stat('HORDE', hordeCount()+'/'+hordeCap(), '#9be03a'),
    stat('REROLLS', S.rerolls, '#c8d8ff'), stat('LUCK', luck(), '#7aff7a'), stat('CURSE', curse(), '#c080ff'), stat('XP GAIN', '+'+Math.round((xpBonus()-1)*100)+'%', '#ff9ccc'), stat('ATTACK SPEED', '+'+Math.round((AS()-1)*100)+'%', '#ffe84a'),
    stat('DAMAGE', '+'+Math.round((dmgMul-1)*100)+'%', '#ff9a7a'), stat('HP', Math.ceil(S.player.hp)+'/'+S.player.maxHp, '#ff7a8a')].join('');
  const row = k => { const ev = S.evo[k], nm = ev ? EVOS[k].n : MUTS[k].n, lv = L(k);
    return `<div class="mrow${ev ? ' ev' : ''}">${img(mutIcon(k))}<div class="mn">${nm}${ev ? ' <small>EVOLVED</small>' : ''}</div>
      <div class="mp">${'<i class="on"></i>'.repeat(lv)}${'<i></i>'.repeat(maxLv(k)-lv)}</div><div class="ml">LV ${lv}</div></div>`; };
  const list = (title, keys, cap) => `<div class="sect"><div class="sh">${title} ${keys.length}/${cap}</div>${keys.map(row).join('')}${
    '<div class="mrow empty"><div></div><div class="mn">EMPTY SLOT</div></div>'.repeat(Math.max(0, cap - keys.length))}</div>`;
  const own = Object.keys(S.mods);
  $('pauseStats').innerHTML = `<div class="sect"><div class="sh">${S.ch.n}</div><div class="misc">${stats}</div></div>` +
    list('WEAPONS', own.filter(isWeapon), slotsW()) + list('ITEMS', own.filter(k => !isWeapon(k)), slotsI());
}
refreshTitleDna();
let last = performance.now();
function frame(now){
  const dt = Math.min(0.05, (now-last)/1000); last = now;
  if (S && S.state==='play') update(dt);
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
