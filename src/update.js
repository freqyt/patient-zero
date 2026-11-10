"use strict";

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
  { // music reacts to the fight: how many threats are on screen, Bone Gatling, low health, and time
    let near = 0; for (const h of S.humans) if (isTarget(h) && Math.abs(h.x-p.x) < VW/2 && Math.abs(h.y-p.y) < VH/2) near++;
    MUSIC.setMood(near/35 + (p.saw > 0 ? 0.3 : 0), p.hp/p.maxHp < 0.3, Math.min(4, Math.floor(S.t/150))); }
  if (S.winT > 0){ S.winT -= dt; if (S.winT <= 0){ gameOver(true); return; } }

  // player movement (keyboard or touch stick)
  let mx = (K.d||K.arrowright?1:0) - (K.a||K.arrowleft?1:0), my = (K.s||K.arrowdown?1:0) - (K.w||K.arrowup?1:0);
  if (touch.stick){ mx = touch.stick.dx; my = touch.stick.dy; }
  const ml = Math.hypot(mx,my);
  p.moving = ml > 0.05;
  if (p.moving){ const k = Math.min(1, ml); mx /= ml; my /= ml;
    const spd = 160*GS*(S.ch.spd||1)*(1+0.1*L('legs'))*(E('trail')?1.15:1)*(1+0.2*nt)*k;
    const sn = p.snared > 0 ? 0.15 : 1;   // a bear trap holds you briefly
    p.x += mx*spd*sn*dt; p.y += my*spd*sn*dt; p.face = Math.atan2(my,mx); }
  if (p.snared > 0) p.snared -= dt;
  p.flash -= dt; p.biteT -= dt;
  if (L('hide')) heal(0.4*L('hide')*dt, 'hide');
  if (S.ch.regen) heal(S.ch.regen*dt, 'regen');
  S.unlockT = (S.unlockT || 0) - dt; if (S.unlockT <= 0){ S.unlockT = 0.5; checkUnlocks(false); }

  // bite
  p.biteCd -= dt;
  if (p.biteCd <= 0){
    const reach = 18 + 6*L('jaws'); let tgt = null, bd = 1e9;
    for (const h of S.humans){ if (h.dead || h.air) continue; const d = Math.sqrt(d2(p,h))-h.r-p.r; if (d<reach && d<bd){ bd=d; tgt=h; } }
    if (tgt){ const dmg = 20*(S.ch.bite||1)*(1+0.3*L('jaws'))*(1+0.3*nt)*(1+0.04*(S.level-1));
      SFX.play('bite'); dmgHuman(tgt, crit(tgt, dmg), 'bite'); p.biteCd = 0.45/AS(); p.biteT = 0.12; p.biteA = Math.atan2(tgt.y-p.y, tgt.x-p.x); }
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
  const rate = 0.75 * Math.min(1.8 + S.t/50, 10) * (isNight ? 0.85 : 1) * (1 + 0.12*curse()) * S.H.spawn * endlessRate();
  S.spawnAcc += dt*rate;
  while (S.spawnAcc >= 1){ S.spawnAcc--; if (S.humans.length < 220) spawnHuman(pickType()); }
  if (S.t >= S.nextCrowd){ S.nextCrowd += 50; spawnCrowd(); }
  [240, 480].forEach((bt, i) => { if (S.t >= bt && !S.bosses[bt]){ S.bosses[bt] = true; spawnBoss(S.bossPlan[i]); } });   // random bosses each run
  if (S.t >= 540 && !S.bosses.heli){ S.bosses.heli = true; const [x,y] = edgePos(60), fk = roster().final; spawnHuman(fk, x, y);
    if (VARIANTS[fk]) banner(...VARIANTS[fk].intro); else banner('GUNSHIP INBOUND','DESTROY IT TO TAKE ' + curMap().place); SFX.play('alarm'); }
  if (S.t >= 555 && !S.finalWave){ S.finalWave = true; const w = roster().wave; for (let i=0;i<14;i++) spawnHuman(i%3 ? w[0] : w[1], undefined, undefined, true); }
  if (S.endless) updateEndless(dt);
  else if (S.t >= GAME_LEN && !S.overtime && S.winT <= 0){ S.overtime = true; const f = S.humans.find(h => h.type==='heli'); banner('OVERTIME', (f ? enemyName(f) : 'THE GUNSHIP') + ' MUST FALL'); }
  if (S.crowd){ S.crowd.t -= dt; if (S.crowd.t<=0) S.crowd = null; }

  updateHumans(dt, p, nt);

  // corpses rising
  for (const c of S.corpses){ c.t -= dt;
    if (c.t <= 0){ if (hordeCount() < hordeCap()){ addMinion(c.x,c.y,c.v,c.look); FX.rise(c.x,c.y); SFX.at('rise', c.x, c.y); }
      else FX.corpse({x:c.x, y:c.y, look:c.look}); } }
  S.corpses = S.corpses.filter(c => c.t > 0);

  updateMinions(dt, p, nt);

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
    if (b.rocket){ const a = Math.atan2(p.y-b.y, p.x-b.x), s = Math.hypot(b.vx, b.vy); b.vx += (Math.cos(a)*s - b.vx)*dt*1.1; b.vy += (Math.sin(a)*s - b.vy)*dt*1.1;
      if (Math.random() < 0.5) FX.smoke(b.x, b.y, 1, 0.4);
      if (d2(b,p) < (b.r+p.r)**2){ b.t = 0; explode(b.x, b.y, 36, b.dmg, 'human', null, b.src); continue; } }
    if (b.bee){ const a = Math.atan2(p.y-b.y, p.x-b.x), s = Math.hypot(b.vx, b.vy); b.vx += (Math.cos(a)*s - b.vx)*dt*1.5; b.vy += (Math.sin(a)*s - b.vy)*dt*1.5; }
    if (d2(b,p) < (b.r+p.r)**2){ b.t = 0; if (!b.fire && !b.harpoon && deflect(b)) continue; hurtPlayer(b.dmg, b.src); if (b.harpoon && !b.owner.dead) b.owner.reel = {tg:p, t:0.7}; continue; }
    for (const m of S.minions) if (m.hp>0 && m.rise<=0 && d2(b,m) < (b.r+m.r)**2){ hurtMinion(m, b.fire ? b.dmg*3 : b.dmg); b.t = 0;
      if (b.harpoon && !b.owner.dead) b.owner.reel = {tg:m, t:0.9}; break; } }
  updateTraps(dt, p); updateBossFx(dt, p);
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
