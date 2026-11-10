"use strict";

// ---------- spawning ----------
// a random point just outside the visible screen rectangle
function edgePos(margin){
  const p = S.player, hw = VW/2 + margin, hh = VH/2 + margin;
  if (Math.random() < hw/(hw+hh)) return [p.x + rand(-hw,hw), p.y + (Math.random()<.5 ? -hh : hh)];
  return [p.x + (Math.random()<.5 ? -hw : hw), p.y + rand(-hh,hh)];
}
function spawnHuman(type, x, y){
  const T = HT[type], sc = (T.boss ? 1 + S.t/400 : 1 + S.t/300) * (1 + 0.1*curse()) * S.H.hp * endlessHp();
  if (x===undefined) [x, y] = edgePos(30);
  const h = {type, x, y, r:T.r, hp:T.hp*sc, maxHp:T.hp*sc, sp:T.sp*rand(0.9,1.1), xp:T.xp, boss:!!T.boss, air:!!T.air,
    cd:rand(0.5,1.5), cd2:2, cd3:0, burst:0, bt:0, flash:0, stun:0, kx:0, ky:0, face:Math.random()*TAU, wa:Math.random()*TAU,
    strafe:Math.random()<0.5?1:-1, turret:0, dead:false, panic:0, look: T.boss ? null : pick(LOOKS[type])};
  if (!T.boss) maybeElite(h);
  S.humans.push(h); return h;
}
function pickType(){ return planPick(); }   // randomized per-run threat order (content.js)
function spawnCrowd(){
  const [cx, cy] = edgePos(90), n = 14 + Math.floor(S.t/30);
  for (let i=0;i<n;i++) spawnHuman(Math.random()<0.18 ? crowdGuard() : 'civ', cx+rand(-60,60), cy+rand(-60,60));
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
  if (Math.random() < 0.12 + 0.04*L('eyes') + 0.03*luck() && isTarget(h)){ dmg *= 2; floatText(h.x, h.y-10, Math.round(dmg)+'!', '#ffe060', true); S.texts[S.texts.length-1].num = true; }
  return dmg;
}
function dmgHuman(h, dmg, src, quiet){
  if (h.dead) return;
  if (h.type==='crate' || h.type==='hazard'){
    h.hp -= dmg;
    if (!quiet){ h.flash = 0.07; if (h.type==='crate'){ FX.splinter(h.x, h.y, 3); SFX.at('crack', h.x, h.y); } else SFX.at('clang', h.x, h.y); }
    if (h.hp <= 0) killHuman(h); return;
  }
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
  h.dead = true; S.kills++; stat('kills', h.lastSrc || 'other', 1); SFX.at('die', h.x, h.y); seen(h.boss ? 'b' : 'e', h.type);
  if (h.elite) eliteDeath(h);
  FX.blood(h.x,h.y,h.boss?30:8,false);
  S.gems.push({x:h.x, y:h.y, v:h.xp, big:h.boss || h.xp>=4});
  if (L('hunger')) heal(0.6*L('hunger'), 'hunger');
  if (h.nova){ FX.explosion(h.x, h.y, 40, 'green');   // Necrotic Nova: victims burst
    for (const o of S.humans) if (!o.dead && o!==h && isTarget(o) && d2(o,h) < 48*48) dmgHuman(o, 25, 'nova', true); }
  if (h.boss){
    heal(60, 'boss'); S.shake = 16;
    for (let i=0;i<(h.type==='heli'?6:2);i++) FX.explosion(h.x+rand(-40,40), h.y+rand(-30,20), rand(80,140), 'fire');
    if (h.type==='heli' && !S.endless){ S.winT = 2.8; banner('GUNSHIP DOWN', 'THE CITY IS YOURS'); SFX.play('nuke'); }
    else { S.st.bossKills = (S.st.bossKills||0) + 1; banner(BOSS_NAME[h.type]+' DOWN','IT DROPPED A BOSS CHEST'); S.items.push({k:'chest', x:h.x, y:h.y, t:1e9, seed:Math.random(), pop:0.5}); }
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
  m.hp -= dmg*S.H.dmg; m.flash = 0.07;
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
  dmg *= (1 - 0.04*L('chitin')) * (1 - (S.ch.armor || 0)) * S.H.dmg;
  if (S.firstHit === null) S.firstHit = S.t; S.lastHit = src || 'other';
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
  const b = Object.assign({x:ox, y:oy, vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd, spd, dmg:dmg*(h.dmgMul||1), t:1.6, r:3, src:h.type}, opts||{});
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
  let feats;
  if (S.endless){ endEndless(); finishRun(); feats = checkFeats(true); }
  else {
    S.won = win;
    const dna = Math.round((META.runReward(S.kills, S.level, S.t, win) + S.bonusDna) * S.H.dna); META.award(dna, S.t, S.kills, win);
    $('overTitle').textContent = win ? 'THE CITY HAS FALLEN' : 'YOU WERE PUT DOWN';
    $('overTitle').style.color = win ? '#9be03a' : '#ff5a5a';
    $('overSub').textContent = win ? 'The gunship burns. The streets belong to the dead.' : 'Patient Zero is gone... but the infection lingers.';
    const mm = Math.floor(S.t/60), ss = String(Math.floor(S.t%60)).padStart(2,'0');
    $('overStats').innerHTML = `TIME <span>${mm}:${ss}</span> &middot; LEVEL <span>${S.level}</span><br>DEVOURED <span>${S.kills}</span> &middot; DNA <span>+${dna}</span>` +
      (S.heat ? ` &middot; <span style="color:${HEAT_COL[S.heat]}">HEAT ${S.heat}</span>` : '');
    checkUnlocks(win);
    META.recordRun({at:Date.now(), cid:S.cid, win, t:Math.floor(S.t), kills:S.kills, level:S.level, dna, heat:S.heat, killer: win ? null : S.lastHit, build:runBuild(), wave:0});
    finishRun(); feats = checkFeats(win);
  }
  $('overDetail').innerHTML = statsHTML();
  $('overDna').innerHTML = `DNA BANK: ${META.dna}` + (S.newChars.length ? `<br><span style="color:#ffe070">UNLOCKED: ${S.newChars.join(', ')}</span>` : '') +
    feats.map(f => `<br><span style="color:#ffe070">FEAT: ${f.n} +${f.dna} DNA</span>`).join('');
  $('endlessBtn').style.display = win && !S.endless ? '' : 'none';
}
// weapons and items at the end of a run, evolved ones marked with *
const runBuild = () => Object.keys(S.mods).map(k => (S.evo[k] ? '*' : '') + k);
// save this run's codex discoveries
function finishRun(){ META.mergeSeen(S.seen); for (const c in S.seen) S.seen[c] = {}; }
