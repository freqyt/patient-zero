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
  $('over').classList.toggle('show', st==='over');
}
function startGame(){
  chunkCache.clear();
  for (const P of propCache.values()) for (const pr of P){ pr.live = false; pr.gone = false; }   // gas pumps etc. rebuilt each run
  $('shop').classList.remove('show');
  const hp = 100 + 10*META.rank('flesh');
  S = {
    t:0, state:'play',
    player:{x:0,y:40,r:12,hp,maxHp:hp,biteCd:0,biteT:0,biteA:0,face:Math.PI/2,flash:0,frenzy:0,devourCd:0,moving:false,saw:0},
    humans:[], minions:[], corpses:[], bodies:[], pb:[], hb:[], gems:[], parts:[], pools:[], texts:[], lights:[], items:[], itemT:4, flashT:0,
    kills:0, bonusDna:0, level:1, xp:0, xpNext:4, pendingLv:0, mods:{spit:1}, evo:{}, rerolls:3 + META.rank('reroll'), spawnAcc:0, shake:0,
    wt:{spit:0,spikes:1.5,screech:2,trail:0}, banner:null, crowd:null, nextCrowd:14,
    bosses:{}, maxHorde:0, wasNight:false, finalWave:false, winT:0, hazT:0, overtime:false,
  };
  S.combo = 0; S.comboT = 0;
  SFX.init(); MUSIC.start(); MUSIC.setMode('day');
  setState('play');
  // a few oblivious civilians already in view, so the hunt starts immediately
  for (let i=0;i<7;i++){ const a = rand(0,TAU), d = rand(110,200); spawnHuman('civ', S.player.x+Math.cos(a)*d, S.player.y+Math.sin(a)*d*0.7); }
  // DNA Lab: Patient Origin starts you with a small horde
  for (let i=0;i<2*META.rank('origin');i++){ const a = rand(0,TAU); addMinion(S.player.x+Math.cos(a)*40, S.player.y+Math.sin(a)*30, 'civ', pick(LOOKS.civ)); }
  banner('THE OUTBREAK BEGINS', 'HUNT THE LIVING');
}
const L = k => S.mods[k] || 0;
const E = k => !!S.evo[k];
function nightAmt(){ const p = (S.t % 100)/100; return clamp((p-0.62)/0.05,0,1) * clamp((1-p)/0.04,0,1); }
const infectChance = () => Math.min(0.95, 0.40 + 0.10*L('contagion') + 0.03*META.rank('virulence'));
const hordeCap = () => 8 + 5*L('horde') + (E('alpha') ? 10 : 0);
function banner(text, sub){ S.banner = {text, sub, t:3.2}; }
function floatText(x,y,txt,col,crit){ S.texts.push({x,y,txt,col,t:crit ? 0.7 : 0.9, crit}); }
function heal(v){ const p = S.player; p.hp = Math.min(p.maxHp, p.hp+v); }
const isTarget = h => h.type !== 'crate' && h.type !== 'hazard';

// ---------- spawning ----------
// a random point just outside the visible screen rectangle
function edgePos(margin){
  const p = S.player, hw = VW/2 + margin, hh = VH/2 + margin;
  if (Math.random() < hw/(hw+hh)) return [p.x + rand(-hw,hw), p.y + (Math.random()<.5 ? -hh : hh)];
  return [p.x + (Math.random()<.5 ? -hw : hw), p.y + rand(-hh,hh)];
}
function spawnHuman(type, x, y){
  const T = HT[type], sc = T.boss ? 1 + S.t/400 : 1 + S.t/300;
  if (x===undefined) [x, y] = edgePos(30);
  const h = {type, x, y, r:T.r, hp:T.hp*sc, maxHp:T.hp*sc, sp:T.sp*rand(0.9,1.1), xp:T.xp, boss:!!T.boss, air:!!T.air,
    cd:rand(0.5,1.5), cd2:2, cd3:0, burst:0, bt:0, flash:0, stun:0, kx:0, ky:0, face:Math.random()*TAU, wa:Math.random()*TAU,
    strafe:Math.random()<0.5?1:-1, turret:0, dead:false, panic:0, look: T.boss ? null : pick(LOOKS[type])};
  S.humans.push(h); return h;
}
function pickType(){
  const t = S.t, w = {
    civ: Math.max(0.3, 1 - t/420),
    beat: t>12 ? Math.min(0.6,(t-12)/120) : 0,
    cop: t>70 ? Math.min(0.16,(t-70)/450) : 0,
    riot: t>110 ? Math.min(0.28,(t-110)/400) : 0,
    soldier: t>180 ? Math.min(0.32,(t-180)/320) : 0,
    flamer: t>240 ? Math.min(0.22,(t-240)/450) : 0 };
  let sum = 0; for (const k in w) sum += w[k];
  let r = Math.random()*sum; for (const k in w){ r -= w[k]; if (r<=0) return k; } return 'civ';
}
function spawnCrowd(){
  const [cx, cy] = edgePos(90), n = 14 + Math.floor(S.t/30);
  for (let i=0;i<n;i++) spawnHuman(Math.random()<0.18 && S.t>40 ? 'beat' : 'civ', cx+rand(-60,60), cy+rand(-60,60));
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
  if (Math.random() < 0.12 && isTarget(h)){ dmg *= 2; floatText(h.x, h.y-10, Math.round(dmg)+'!', '#ffe060', true); }
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
  h.hp -= dmg;
  if (!quiet){ h.flash = 0.07; if (Math.random()<0.5) FX.blood(h.x,h.y,2,false); }
  else h.toxic = 0.2;
  if (h.hp <= 0){ if (src==='aura' && E('aura')) h.nova = true; killHuman(h); }
}
function killHuman(h){
  if (h.type==='crate'){ h.dead = true; breakCrate(h); return; }
  if (h.type==='hazard'){ h.dead = true; h.prop.live = false; h.prop.gone = true; S.shake = Math.max(S.shake, 8);
    explode(h.x, h.y, h.sub==='pump' ? 105 : 80, 70 + S.t/5, 'zombie', 'fire'); return; }
  h.dead = true; S.kills++; SFX.at('die', h.x, h.y);
  FX.blood(h.x,h.y,h.boss?30:8,false);
  S.gems.push({x:h.x, y:h.y, v:h.xp, big:h.boss || h.xp>=4});
  if (L('hunger')) heal(0.6*L('hunger'));
  if (h.nova){ FX.explosion(h.x, h.y, 40, 'green');   // Necrotic Nova: victims burst
    for (const o of S.humans) if (!o.dead && o!==h && isTarget(o) && d2(o,h) < 48*48) dmgHuman(o, 25, 'nova', true); }
  if (h.boss){
    heal(60); S.shake = 16;
    for (let i=0;i<(h.type==='heli'?6:2);i++) FX.explosion(h.x+rand(-40,40), h.y+rand(-30,20), rand(80,140), 'fire');
    if (h.type==='heli'){ S.winT = 2.8; banner('GUNSHIP DOWN', 'THE CITY IS YOURS'); SFX.play('nuke'); }
    else { banner('APC DESTROYED','IT DROPPED A BOSS CHEST'); S.items.push({k:'chest', x:h.x, y:h.y, t:1e9, seed:Math.random(), pop:0.5}); }
    return;
  }
  if (Math.random() < infectChance()) S.corpses.push({x:h.x, y:h.y, t:0.9, max:0.9, v:h.type, look:h.look});
  else FX.corpse(h);
}
function addMinion(x,y,v,look){
  const V = VAR[v], hm = 1 + 0.15*L('alpha');
  S.minions.push({x,y,v,r:V.r,hp:V.hp*hm,maxHp:V.hp*hm,atkCd:0,rt:0,target:null,slot:Math.random()*TAU,flash:0,
    look: zombieLook(look), rise:0.45, face:Math.PI/2, wob:Math.random()*TAU});
}
function hurtMinion(m, dmg){
  if (m.hp<=0) return;
  m.hp -= dmg; m.flash = 0.07;
  if (m.hp <= 0){
    FX.blood(m.x,m.y,7,true); SFX.at('squish', m.x, m.y);
    const lb = L('boom');
    if (lb) explode(m.x,m.y,45+10*lb, 18+16*lb, 'zombie');
    if (VAR[m.v].bloat) explode(m.x,m.y,85, 40+S.t/8, 'zombie', 'fire');
  }
}
function hurtPlayer(dmg){
  const p = S.player; if (S.winT > 0) return;
  if (E('spikes')) dmg *= 0.65;
  SFX.play('hurt'); p.hp -= dmg; p.flash = 0.1; S.shake = Math.min(8, S.shake + dmg*0.5);
  if (p.hp <= 0){ p.hp = 0; gameOver(false); }
}
function explode(x,y,r,dmg,side,style){
  SFX.at('boom', x, y);
  FX.explosion(x,y,r, style==='fire' || side==='human' ? 'fire' : 'green');
  if (side==='zombie'){ for (const h of S.humans) if (!h.dead && d2(h,{x,y}) < (r+h.r)**2) dmgHuman(h,dmg,'boom'); }
  else if (side==='human'){
    for (const m of S.minions) if (d2(m,{x,y}) < (r+m.r)**2) hurtMinion(m,dmg*1.3);
    if (d2(S.player,{x,y}) < (r+S.player.r)**2) hurtPlayer(dmg);
  }
}
function devour(){
  const p = S.player; if (p.devourCd > 0) return;
  let best = null, bd = 120*120;
  for (const m of S.minions){ if (m.rise>0) continue; const d = d2(p,m); if (d<bd){ bd=d; best=m; } }
  if (!best){ floatText(p.x,p.y,'NO MINION','#a09aa8'); return; }
  best.hp = 0; FX.blood(best.x,best.y,14,true);
  SFX.play('devour'); heal(22 + p.maxHp*0.08); p.frenzy = 3.5; p.devourCd = 5;
  floatText(p.x,p.y,'FRENZY!','#ff5a5a');
}
function hfire(h, ang, spd, dmg, opts){
  const ox = h.x+Math.cos(ang)*h.r*1.4, oy = h.y+Math.sin(ang)*h.r*1.4;
  const b = Object.assign({x:ox, y:oy, vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd, spd, dmg, t:1.6, r:3}, opts||{});
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
  $('overTitle').textContent = win ? 'THE CITY HAS FALLEN' : 'YOU WERE PUT DOWN';
  $('overTitle').style.color = win ? '#9be03a' : '#ff5a5a';
  $('overSub').textContent = win ? 'The gunship burns. The streets belong to the dead.' : 'Patient Zero is gone... but the infection lingers.';
  const mm = Math.floor(S.t/60), ss = String(Math.floor(S.t%60)).padStart(2,'0');
  $('overStats').innerHTML = `TIME <span>${mm}:${ss}</span><br>DEVOURED <span>${S.kills}</span><br>BIGGEST HORDE <span>${S.maxHorde}</span><br>LEVEL <span>${S.level}</span><br>DNA EARNED <span>+${dna}</span>`;
  $('overDna').textContent = `DNA BANK: ${META.dna}`;
}

// ---------- level up ----------
function openLevel(reroll){
  if (S.state !== 'level' && !reroll) SFX.play('levelup');
  setState('level');
  const owned = Object.keys(S.mods), full = owned.length >= MAX_SLOTS;
  const pool = (full ? owned : Object.keys(MUTS)).filter(k => L(k) < MAXLV), opts = [];
  // a ready evolution always takes the first card
  const evos = Object.keys(EVOS).filter(k => L(k) >= MAXLV && L(EVOS[k].w) > 0 && !E(k));
  if (evos.length) opts.push('evo:' + pick(evos));
  $('slots').textContent = full ? `SLOTS FULL ${MAX_SLOTS}/${MAX_SLOTS} - UPGRADES ONLY` : `MUTATION SLOTS ${owned.length}/${MAX_SLOTS}`;
  while (opts.length < 3 && pool.length) opts.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
  if (!opts.length) opts.push('_heal');
  const el = $('cards'); el.innerHTML = '';
  opts.forEach((k,i) => {
    const c = document.createElement('button'); c.className = 'card';
    if (k==='_heal') c.innerHTML = `<div class="k">${i+1}</div><div class="nm">FEAST</div><div class="lv">FULLY EVOLVED</div><div class="ds">Heal 50 HP.</div>`;
    else if (k.startsWith('evo:')){ const b = k.slice(4), V = EVOS[b]; c.className = 'card evo';
      c.innerHTML = `<div class="k">${i+1}</div><img class="ic" src="${emojiIcon(V.ic,'#7a5208').toDataURL()}" alt=""><div class="nm">${V.n}</div>
        <div class="lv">EVOLUTION: ${MUTS[b].n.toUpperCase()} + ${MUTS[V.w].n.toUpperCase()}</div><div class="ds">${V.d}</div>`; }
    else { const M = MUTS[k], l = L(k), src = mutIcon(k).toDataURL(), ev = evoHint(k);
      c.innerHTML = `<div class="k">${i+1}</div><img class="ic" src="${src}" alt=""><div class="nm">${M.n}</div>
        <div class="lv ${l?'':'new'}">${l ? 'LV '+l+' &gt; '+(l+1) : 'NEW!'}</div><div class="ds">${l?M.u:M.b}</div>${ev}`; }
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
  if (k==='_heal') heal(50);
  else if (k.startsWith('evo:')){ const b = k.slice(4); S.evo[b] = true; SFX.play('evolve'); banner('EVOLVED!', EVOS[b].n.toUpperCase()); S.flashT = 0.3; }
  else { S.mods[k] = L(k) + 1; if (k==='hide'){ p.maxHp += 25; heal(25); } }
  S.pendingLv--;
  if (S.pendingLv > 0) openLevel(); else setState('play');
}
function rerollLevel(){ if (S.state==='level' && S.rerolls > 0){ S.rerolls--; SFX.play('click'); openLevel(true); } }

// ---------- items & crates ----------
const ITEMS = {heart:{n:'FRESH HEART', w:.34}, magnet:{n:'MAGNET', w:.26}, saw:{n:'CHAINSAW', w:.22}, bomb:{n:'BIOHAZARD', w:.18}, dice:{n:'REROLL DIE', w:.2}};
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
function spawnItem(k, x, y){ if (x === undefined) [x, y] = onScreenPos(); S.items.push({k, x, y, t:30, seed:Math.random()}); }
function staticTarget(type, x, y, hp, r, extra){
  return Object.assign({type, x, y, r, hp, maxHp:hp, sp:0, xp:0, flash:0, stun:0, kx:0, ky:0, cd:0, cd2:0, cd3:0, face:0, dead:false, seed:Math.random()}, extra||{});
}
// loot crates: targets for your attacks and horde; smash one for a random item
function spawnCrate(){ const [x, y] = onScreenPos(); S.humans.push(staticTarget('crate', x, y, 30, 12)); FX.dust(x, y); SFX.at('item', x, y); }
function breakCrate(h){
  FX.splinter(h.x, h.y, 16); SFX.at('crateBreak', h.x, h.y);
  spawnItem(pickItemType(), h.x, h.y);
  S.items[S.items.length-1].pop = 0.4;
}
function useItem(it){
  const p = S.player;
  switch (it.k){
    case 'heart': heal(30 + p.maxHp*0.2); FX.blood(p.x, p.y, 8, false); SFX.play('eat'); floatText(p.x, p.y, '+HEALTH', '#ff7a8a'); break;
    case 'magnet': for (const g of S.gems) g.pull = true; SFX.play('magnet'); floatText(p.x, p.y, 'MAGNET!', '#ff9ccc'); break;
    case 'saw': p.saw = 8; SFX.play('saw'); floatText(p.x, p.y, 'CHAINSAW!', '#ffb040'); break;
    case 'bomb': biohazard(); break;
    case 'chest': openChest(); break;
    case 'dice': S.rerolls++; SFX.play('select'); floatText(p.x, p.y, '+1 REROLL', '#c8d8ff'); break;
  }
}
// boss chest: the armored carrier drops one; it never despawns
function openChest(){
  const p = S.player; SFX.play('chest'); S.flashT = 0.45; S.shake = 6;
  const evos = Object.keys(EVOS).filter(k => L(k) >= MAXLV && L(EVOS[k].w) > 0 && !E(k));
  let msg;
  if (evos.length){ const b = pick(evos); S.evo[b] = true; S.pendingLv += 2; msg = 'FREE EVOLUTION: ' + EVOS[b].n.toUpperCase(); }
  else { S.pendingLv += 3; msg = '+3 FREE MUTATIONS'; }
  p.hp = p.maxHp; S.bonusDna += 40;
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
    h.dead = true; S.kills++; n++; FX.blood(h.x, h.y, 6, false); FX.corpse(h);
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
  MUSIC.setMode(bossAlive ? 'boss' : isNight ? 'night' : 'day');
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
    const spd = 160*GS*(1+0.1*L('legs'))*(E('trail')?1.15:1)*(1+0.2*nt)*(p.frenzy>0?1.4:1)*k;
    p.x += mx*spd*dt; p.y += my*spd*dt; p.face = Math.atan2(my,mx); }
  p.frenzy -= dt; p.devourCd -= dt; p.flash -= dt; p.biteT -= dt;
  if (L('hide')) heal(0.4*L('hide')*dt);

  // bite
  p.biteCd -= dt;
  if (p.biteCd <= 0){
    const reach = 18 + 6*L('jaws'); let tgt = null, bd = 1e9;
    for (const h of S.humans){ if (h.dead || h.air) continue; const d = Math.sqrt(d2(p,h))-h.r-p.r; if (d<reach && d<bd){ bd=d; tgt=h; } }
    if (tgt){ const dmg = 20*(1+0.3*L('jaws'))*(p.frenzy>0?2:1)*(1+0.3*nt)*(1+0.04*(S.level-1));
      SFX.play('bite'); dmgHuman(tgt, crit(tgt, dmg), 'bite'); p.biteCd = p.frenzy>0 ? 0.28 : 0.45; p.biteT = 0.12; p.biteA = Math.atan2(tgt.y-p.y, tgt.x-p.x); }
  }

  // mutations: attacks only fire at targets on screen AND within range; otherwise they stay charged
  const visible = h => !h.dead && Math.abs(h.x-p.x) < VW/2 - 8 && Math.abs(h.y-p.y) < VH/2 - 8;
  // pumps/barrels are only worth shooting when there are humans next to them
  const worth = h => h.type!=='hazard' || S.humans.some(o => isTarget(o) && !o.dead && d2(o,h) < 90*90);
  const anyTarget = range => S.humans.some(h => visible(h) && isTarget(h) && d2(h,p) < (range+h.r)**2);
  const wt = S.wt; let l = L('spit');
  if (l){ wt.spit = Math.max(0, wt.spit - dt); if (wt.spit<=0){
    const n = 1 + Math.floor(l/2) + (E('spit') ? 2 : 0);
    const tg = S.humans.filter(h => visible(h) && worth(h) && d2(h,p) < 320*320).sort((a,b)=>d2(a,p)-d2(b,p)).slice(0,n);
    if (tg.length){ wt.spit = 1.25*(1-0.1*l); SFX.play('spit', 0.6);
      for (let i=0;i<n;i++){ const t = tg[i % tg.length], a = Math.atan2(t.y-p.y,t.x-p.x) + (i>=tg.length ? rand(-.2,.2) : 0);
        S.pb.push({x:p.x,y:p.y,vx:Math.cos(a)*300*GS,vy:Math.sin(a)*300*GS,dmg:12+6*l,t:1.2/GS,r:6,pierce:1+Math.max(0,l-2)+(E('spit')?2:0),hit:new Set(),k:'spit'}); } } } }
  l = L('spikes');
  if (l){ wt.spikes = Math.max(0, wt.spikes - dt); if (wt.spikes<=0 && anyTarget(160)){ wt.spikes = (3.2 - 0.3*l)*(E('spikes') ? 0.5 : 1); SFX.play('bone');
    const n = 6 + 2*l, off = Math.random()*TAU;
    for (let i=0;i<n;i++){ const a = off + i/n*TAU;
      S.pb.push({x:p.x,y:p.y,vx:Math.cos(a)*260*GS,vy:Math.sin(a)*260*GS,dmg:16+8*l,t:0.6/GS,r:5,pierce:3,hit:new Set(),k:'spike'}); } } }
  l = L('screech');
  if (l){ const R = (110 + 20*l)*(E('screech') ? 1.5 : 1);
    wt.screech = Math.max(0, wt.screech - dt); if (wt.screech<=0 && anyTarget(R)){ wt.screech = E('screech') ? 3.5 : 7.5 - 0.8*l; SFX.play('screech');
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
  if (S.itemT <= 0){ S.itemT = rand(9,14); if (S.humans.filter(h => h.type==='crate').length < 3) spawnCrate(); }
  for (const it of S.items){ it.t -= dt; if (it.pop > 0){ it.pop -= dt; continue; } if (d2(it,p) < (p.r+12)**2){ it.got = true; useItem(it); } }
  S.items = S.items.filter(it => !it.got && it.t > 0);
  S.hazT -= dt; if (S.hazT <= 0){ S.hazT = 0.3; promoteHazards(); }
  S.flashT = Math.max(0, S.flashT - dt);
  if (p.saw > 0){ p.saw -= dt; SFX.play('sawbuzz', 0.7);
    const fx = Math.cos(p.face), fy = Math.sin(p.face);
    for (const h of S.humans){ if (h.dead || h.air) continue;
      const dx = h.x-p.x, dy = h.y-p.y, d = Math.hypot(dx,dy); if (d > 95 + h.r) continue;
      if (d < 42 + h.r || (dx*fx + dy*fy)/(d||1) > 0.5){
        dmgHuman(h, 340*dt, 'saw', true); h.flash = 0.05;
        if (isTarget(h) && Math.random() < dt*18) FX.blood(h.x, h.y, 3, false);
        if (Math.random() < dt*12) S.parts.push({k:'spark', x:h.x, y:h.y, vx:rand(-160,160), vy:rand(-120,40), t:.2, max:.2, col:'#ffe08a'}); } } }

  // spawning & bosses
  const rate = 0.75 * Math.min(1.8 + S.t/50, 10) * (isNight ? 0.85 : 1);
  S.spawnAcc += dt*rate;
  while (S.spawnAcc >= 1){ S.spawnAcc--; if (S.humans.length < 220) spawnHuman(pickType()); }
  if (S.t >= S.nextCrowd){ S.nextCrowd += 50; spawnCrowd(); }
  for (const bt of [240, 480]) if (S.t >= bt && !S.bosses[bt]){ S.bosses[bt] = true; spawnHuman('apc'); banner('ARMORED CARRIER','IT CRUSHES THE DEAD'); SFX.play('alarm'); }
  if (S.t >= 540 && !S.bosses.heli){ S.bosses.heli = true; const [x,y] = edgePos(60); spawnHuman('heli', x, y);
    banner('GUNSHIP INBOUND','DESTROY IT TO TAKE THE CITY'); SFX.play('alarm'); }
  if (S.t >= 555 && !S.finalWave){ S.finalWave = true; for (let i=0;i<14;i++) spawnHuman(i%3 ? 'soldier' : 'riot'); }
  if (S.t >= GAME_LEN && !S.overtime && S.winT <= 0){ S.overtime = true; banner('OVERTIME','THE GUNSHIP MUST FALL'); }
  if (S.crowd){ S.crowd.t -= dt; if (S.crowd.t<=0) S.crowd = null; }

  // humans
  const viewR = Math.hypot(VW,VH)/2;
  // humans move at half pace, creeping up to +25% faster by the end of the run
  const hsp = GS * (1 + 0.25*Math.min(S.t, GAME_LEN)/GAME_LEN);
  for (const h of S.humans){
    if (h.dead) continue;
    h.flash -= dt; h.cd -= dt*0.75; h.cd2 -= dt*0.75; h.cd3 -= dt;
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
    const rangeMul = 1 - 0.3*nt;
    switch (h.type){
      case 'civ':
        if (zd < 190){ vx = -Math.cos(ang); vy = -Math.sin(ang); sp *= 1.1; h.face = ang+Math.PI; h.panic = 0.5; }
        else { h.wa += rand(-2,2)*dt;
          if (zd > 320){ const tp = Math.atan2(p.y-h.y, p.x-h.x); h.wa += clamp(((tp-h.wa+Math.PI*3)%TAU)-Math.PI, -dt*1.5, dt*1.5); }
          vx = Math.cos(h.wa)*0.45; vy = Math.sin(h.wa)*0.45; h.face = h.wa; h.panic -= dt; }
        break;
      case 'cop': case 'soldier': {
        const R = (h.type==='cop' ? 190 : 230)*rangeMul; h.face = ang;
        if (zd > R*0.8){ vx = Math.cos(ang); vy = Math.sin(ang); }
        else if (zd < R*0.45){ vx = -Math.cos(ang); vy = -Math.sin(ang); }
        else { vx = Math.cos(ang+Math.PI/2*h.strafe)*0.6; vy = Math.sin(ang+Math.PI/2*h.strafe)*0.6; if (Math.random()<dt*0.4) h.strafe *= -1; }
        const spread = 0.07 + 0.18*nt;
        if (h.type==='cop' && h.cd<=0 && zd<R){ h.cd = rand(1.7,2.3); hfire(h, ang+rand(-spread,spread), 250, 6); }
        if (h.type==='soldier'){
          if (h.cd<=0 && zd<R){ h.cd = rand(2.2,2.8); h.burst = 3; h.bt = 0; }
          if (h.burst>0){ h.bt -= dt; if (h.bt<=0){ h.bt = 0.09; h.burst--; hfire(h, ang+rand(-spread,spread), 300, 6); } }
        }
        break; }
      case 'beat':   // baton cop: rushes in and clubs whatever zombie is closest
        h.face = ang; h.swing = (h.swing||0) - dt; vx = Math.cos(ang); vy = Math.sin(ang);
        if (zd < h.r+z.r+6 && h.cd<=0){ h.cd = rand(0.9,1.2); h.swing = 0.15; SFX.at('baton', h.x, h.y);
          if (z===p) hurtPlayer(6); else { hurtMinion(z, 10); z.x += Math.cos(ang)*6; z.y += Math.sin(ang)*6; } }
        break;
      case 'riot':
        h.face = ang; vx = Math.cos(ang); vy = Math.sin(ang);
        if (zd < h.r+z.r+4 && h.cd<=0){ h.cd = 0.9;
          if (z===p) hurtPlayer(10); else { hurtMinion(z, 14); z.x += Math.cos(ang)*12; z.y += Math.sin(ang)*12; } }
        break;
      case 'flamer':
        h.face = ang;
        if (zd > 70){ vx = Math.cos(ang); vy = Math.sin(ang); }
        if (zd < 130){ h.bt -= dt; if (h.bt<=0){ h.bt = 0.05; hfire(h, ang+rand(-.28,.28), rand(180,230), 2.5, {t:0.5, r:7, fire:true}); } }
        break;
      case 'apc': {
        const pa = Math.atan2(p.y-h.y, p.x-h.x);
        h.face += clamp(((pa-h.face+Math.PI*3)%TAU)-Math.PI, -dt*1.2, dt*1.2);
        vx = Math.cos(h.face); vy = Math.sin(h.face); h.turret = ang;
        if (h.cd<=0 && zd<300){ h.cd = 0.16; hfire(h, ang+rand(-.12,.12), 320, 4); }
        if (h.cd2<=0){ h.cd2 = 3; h.recoil = 1; const pd2 = Math.sqrt(d2(h,p)); hfire(h, pa, 200, 22, {t:Math.min(2.5,pd2/200), r:7, shell:true}); }
        for (const m of S.minions) if (d2(h,m) < (h.r+m.r)**2) hurtMinion(m, 60*dt);
        if (d2(h,p) < (h.r+p.r+4)**2 && h.cd3<=0){ h.cd3 = 0.6; hurtPlayer(8); }
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
            hfire(h, a, 200, 18, {t:Math.min(3, d/200), r:7, shell:true}); } }
        h.drop = (h.drop === undefined ? 8 : h.drop) - dt;
        if (h.drop <= 0){ h.drop = 14; for (let i=0;i<2;i++) spawnHuman('soldier', h.x+rand(-20,20), h.y+rand(-10,10)); }
        break; }
    }
    h.x += vx*sp*hsp*dt; h.y += vy*sp*hsp*dt;
  }

  // corpses rising
  for (const c of S.corpses){ c.t -= dt;
    if (c.t <= 0){ if (S.minions.length < hordeCap()){ addMinion(c.x,c.y,c.v,c.look); FX.rise(c.x,c.y); SFX.at('rise', c.x, c.y); }
      else FX.corpse({x:c.x, y:c.y, look:c.look}); } }
  S.corpses = S.corpses.filter(c => c.t > 0);

  // minions
  const am = (1 + 0.2*L('alpha'))*(E('alpha') ? 1.5 : 1), as = 1 + 0.08*L('alpha');
  S.minions.forEach((m,i) => {
    m.flash -= dt; m.atkCd -= dt; m.wob += dt*8;
    if (m.rise > 0){ m.rise -= dt; return; }
    const V = VAR[m.v];
    m.rt -= dt;
    if (m.target && m.target.dead) m.target = null;
    if (m.rt <= 0){ m.rt = rand(0.2,0.35);
      const t = nearestHuman(m, 260, true); m.target = (t && d2(t,p) < 420*420) ? t : null; }
    let tx, ty;
    if (m.target){ tx = m.target.x; ty = m.target.y; }
    else { const ring = 46 + (i%4)*16, a = m.slot + S.t*0.25;
      tx = p.x + Math.cos(a)*ring; ty = p.y + Math.sin(a)*ring*0.8; }
    const dx = tx-m.x, dy = ty-m.y, dl = Math.hypot(dx,dy);
    let spd = 118*GS*V.sp*as*(1+0.35*nt); if (d2(m,p) > 200*200) spd *= 1.6;
    if (dl > 4){ const s = Math.min(spd*dt, dl); m.x += dx/dl*s; m.y += dy/dl*s; m.face = Math.atan2(dy,dx); }
    if (m.target && dl < m.r + m.target.r + 5 && m.atkCd <= 0){ m.atkCd = 0.7; dmgHuman(m.target, 8*V.dmg*am*(1+0.4*nt), 'minion'); }
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
    if (b.shell){ if (b.t<=0) explode(b.x,b.y,70,22,'human'); continue; }
    if (d2(b,p) < (b.r+p.r)**2){ hurtPlayer(b.dmg); b.t = 0; continue; }
    for (const m of S.minions) if (m.hp>0 && m.rise<=0 && d2(b,m) < (b.r+m.r)**2){ hurtMinion(m, b.fire ? b.dmg*3 : b.dmg); b.t = 0; break; } }
  S.hb = S.hb.filter(b => b.t > 0);
  S.minions = S.minions.filter(m => m.hp > 0);
  S.humans = S.humans.filter(h => !h.dead);

  // brains
  const grab = 80*(1 + 0.2*META.rank('scent')), xpMul = 1 + 0.06*META.rank('appetite');
  for (const g of S.gems){ const d = Math.sqrt(d2(g,p));
    if (d < grab || g.pull){ g.pull = true; const s = Math.min(d, Math.max(420, d*3)*dt); g.x += (p.x-g.x)/(d||1)*s; g.y += (p.y-g.y)/(d||1)*s; }
    if (d < p.r+6){ g.got = true; S.xp += g.v*xpMul; SFX.play('pickup', 0.8, S.combo++); S.comboT = 0.6;
      while (S.xp >= S.xpNext){ S.xp -= S.xpNext; S.level++; S.pendingLv++; S.xpNext = Math.floor(4 + Math.pow(S.level,1.3)*2.2); } } }
  S.comboT -= dt; if (S.comboT <= 0) S.combo = 0;
  S.gems = S.gems.filter(g => !g.got);
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
  if (!S){ if (k==='enter' || k===' ') startGame(); return; }
  if (S.state==='play'){
    if (k==='e' || k==='shift') devour();
    if (k==='p' || k==='escape') setState('pause');
  } else if (S.state==='pause'){ if (k==='p' || k==='escape') setState('play'); }
  else if (S.state==='level'){ if (k>='1' && k<='3'){ const c = $('cards').children[+k-1]; if (c) c.click(); } if (k==='r') rerollLevel(); }
  else if (S.state==='over'){ if (k==='r' || k==='enter') startGame(); }
});
addEventListener('keyup', e => { K[e.key.toLowerCase()] = false; });
addEventListener('blur', () => { for (const k in K) K[k] = false; resetStick(); if (S && S.state==='play') setState('pause'); });

// ---------- input: touch (virtual stick + buttons) ----------
const touch = {used:false, stick:null, id:null, ox:0, oy:0};
function lowXY(e){ return [e.clientX*DPR/SCALE, e.clientY*DPR/SCALE]; }
function touchButtons(){ return [{id:'eat', x:LW-26, y:LH-34, r:17, label:'EAT'}, {id:'snd', x:LW-62, y:20, r:9, label: SFX.muted ? 'OFF' : 'SND'}]; }
cv.addEventListener('pointerdown', e => {
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
$('startBtn').onclick = startGame;
$('againBtn').onclick = startGame;
$('labBtn').onclick = () => openShop('title');
$('labBtn2').onclick = () => openShop('over');
$('shopBack').onclick = closeShop;
$('reroll').onclick = rerollLevel;
$('pause').onclick = () => { if (S && S.state==='pause') setState('play'); };
$('titleDna').textContent = META.dna ? `DNA BANK: ${META.dna}` : '';
let last = performance.now();
function frame(now){
  const dt = Math.min(0.05, (now-last)/1000); last = now;
  if (S && S.state==='play') update(dt);
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
