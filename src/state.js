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
    plan:makeSpawnPlan(), bossPlan:shuffle(BOSS_POOL.slice()).slice(0,2), mines:[], cures:[], bosses:{}, maxHorde:0, wasNight:false, finalWave:false, winT:0, hazT:0, overtime:false,
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
