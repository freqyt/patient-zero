"use strict";
// ---------- content: randomized threat plan, elites, new enemies & bosses, new mutations ----------
function shuffle(a){ for (let i=a.length-1;i>0;i--){ const j = Math.random()*(i+1)|0; [a[i],a[j]] = [a[j],a[i]]; } return a; }

// Enemy types unlock in a different order every run. Shuffling happens inside difficulty tiers,
// so early threats are always light and the nastiest ones always come late.
const THREAT_TIERS = [['beat','dog','cop','medic'], ['riot','soldier','grenadier'], ['flamer','sniper']];
const THREAT_TIMES = [12, 45, 80, 115, 150, 190, 230, 275, 320];
const THREAT_CAP = {beat:.6, dog:.35, cop:.16, medic:.12, riot:.28, soldier:.32, grenadier:.2, flamer:.22, sniper:.12};
const THREAT_NAME = {beat:'BATON COPS', dog:'K9 UNITS', cop:'PISTOL COPS', medic:'FIELD MEDICS', riot:'RIOT POLICE', soldier:'SOLDIERS',
  grenadier:'GRENADIERS', flamer:'FLAMETHROWERS', sniper:'SNIPERS'};
const THREAT_SUB = {beat:'THEY CLUB THE DEAD', dog:'FAST AND HUNGRY', cop:'THEY SHOOT FROM RANGE', medic:'THEY HEAL THE LIVING - KILL THEM FIRST',
  riot:'SHIELDS HALVE YOUR SPIT', soldier:'BURST FIRE', grenadier:'THEY TARGET YOUR HORDE', flamer:'FIRE BURNS THE DEAD', sniper:'WATCH FOR THE RED LASER'};
function makeSpawnPlan(){ return roster().tiers.flatMap(t => shuffle(t.slice())).map((k,i) => ({k, at:THREAT_TIMES[i], told:false})); }
function planPick(){
  const t = S.t, w = {civ: Math.max(0.3, 1 - t/420)};
  for (const e of S.plan) if (t > e.at) w[e.k] = Math.min(THREAT_CAP[baseOf(e.k)] * (VARIANTS[e.k] && VARIANTS[e.k].pack ? 0.5 : 1), (t-e.at)/140);
  let sum = 0; for (const k in w) sum += w[k];
  let r = Math.random()*sum; for (const k in w){ r -= w[k]; if (r <= 0) return k; } return 'civ';
}
const crowdGuard = () => S.t > S.plan[0].at ? S.plan[0].k : 'civ';

// Two mid-game boss slots draw from this pool in random order; the Gunship is always the finale.
const BOSS_POOL = ['apc','swat','jugg','cure'];
const BOSS_INTRO = {apc:['ARMORED CARRIER','IT CRUSHES THE DEAD'], swat:['SWAT VAN','THEY BROUGHT BACKUP'],
  jugg:['JUGGERNAUT','ARMORED. ARMED. ANGRY.'], cure:['THE CURE','ITS GAS MELTS YOUR HORDE']};
function spawnBoss(k){
  const [x, y] = edgePos(60), h = spawnHuman(k, x, y);
  if (k === 'jugg') h.look = JUGG_LOOK;
  if (k === 'cure') h.look = CURE_LOOK;
  banner(...(VARIANTS[k] ? VARIANTS[k].intro : BOSS_INTRO[k])); SFX.play('alarm'); if (h.type === 'swat') SFX.play('siren');
}

// ---------- elites: rare, tougher enemies with a random affix ----------
const ELITE = {armored:{c:'#a8c0d8', n:'ARMORED'}, swift:{c:'#7ad0ff', n:'SWIFT'}, regen:{c:'#7aff7a', n:'REGEN'},
  explosive:{c:'#ff8a3a', n:'VOLATILE'}, frenzied:{c:'#ff4a6a', n:'FRENZIED'}};
// map-specific affixes (each map rolls from its own set of five; see MAP_ROSTER[...].elites)
Object.assign(ELITE, {camo:{c:'#6aa04a', n:'CAMOUFLAGED'}, thorns:{c:'#a0d040', n:'BRAMBLE-SKINNED'}, pack:{c:'#e8a040', n:'PACK LEADER'},
  shock:{c:'#80e0ff', n:'LIVE WIRE'}, oily:{c:'#c8a030', n:'FUEL-SOAKED'}, heavy:{c:'#9a9aa8', n:'HEAVY-SET'},
  scorch:{c:'#ff7a2a', n:'SCORCHED'}, blink:{c:'#e0c8ff', n:'MIRAGE'}});
function maybeElite(h){
  if (S.t < 50 || h.type === 'civ') return;
  if (Math.random() > Math.min(0.1, 0.02 + S.t/600*0.08)) return;
  const set = roster().elites, a = pick(Object.keys(set)); h.elite = a; h.eliteName = set[a];
  h.hp = h.maxHp = h.maxHp*3.5; h.xp *= 5; h.r = Math.round(h.r*1.15); h.dmgMul = 1.5;
  if (a === 'swift') h.sp *= 1.6;
  if (a === 'heavy'){ h.hp = h.maxHp = h.maxHp*1.4; h.r = Math.round(h.r*1.2); h.sp *= 0.85; }
}
function eliteDeath(h){
  S.st.elites = (S.st.elites||0) + 1;
  if (Math.random() < 0.35 + 0.05*luck()){ spawnItem(pickItemType(), h.x, h.y); S.items[S.items.length-1].pop = 0.4; }
  if (h.elite === 'explosive') explode(h.x, h.y, 70, 18, 'human', null, 'elite');
  if (h.elite === 'oily'){ explode(h.x, h.y, 50, 12, 'human', 'fire', 'elite'); for (let i=0;i<7;i++){ const a = i/7*TAU; firePatch(h.x+Math.cos(a)*rand(14,40), h.y+Math.sin(a)*rand(10,28), rand(3,4.5)); } }
  if (h.elite === 'pack'){ const k = roster().pack; for (let i=0;i<3;i++) spawnHuman(k, h.x+rand(-20,20), h.y+rand(-15,15), true); floatText(h.x, h.y-20, 'THE PACK!', '#e8a040'); }
}
// per-frame elite effects that need a timer
function eliteTick(h, dt, p){
  switch (h.elite){
    case 'shock': h.zap = (h.zap === undefined ? rand(1,2.5) : h.zap) - dt;
      if (h.zap <= 0){ h.zap = 2.6; S.parts.push({k:'shock', x:h.x, y:h.y, r:4, max:70, t:.3, max2:.3, col:'#80e0ff'}); SFX.at('zap', h.x, h.y);
        for (const m of S.minions) if (d2(m,h) < 70*70) hurtMinion(m, 10);
        if (d2(p,h) < 70*70) hurtPlayer(6, 'elite'); }
      break;
    case 'scorch': h.burnT = (h.burnT || 0) - dt; if (h.burnT <= 0){ h.burnT = 0.35; firePatch(h.x, h.y+2, 1.6); } break;
    case 'heavy': h.kx = h.ky = 0; h.stun = 0; break;
  }
  if (h.blinkT > 0) h.blinkT -= dt;
}
// damage-time elite reactions; returns the (possibly changed) damage
function eliteHit(h, dmg, src){
  if (h.elite === 'thorns'){
    if (src === 'bite') hurtPlayer(3, 'elite');
    else if (src === 'minion') for (const m of S.minions) if (d2(m,h) < (h.r+m.r+14)**2){ hurtMinion(m, 3); break; }
  }
  if (h.elite === 'blink' && !(h.blinkT > 0) && src !== 'pool' && src !== 'aura' && h.hp - dmg > 0){
    h.blinkT = 2.4; FX.smoke(h.x, h.y, 3, 0.8); const a = rand(0,TAU), d = rand(80,120);
    h.x += Math.cos(a)*d; h.y += Math.sin(a)*d*0.7; FX.smoke(h.x, h.y, 3, 0.8); return dmg*0.5; }
  return dmg;
}
// a burning patch on the ground that hurts zombies standing in it (molotovs, fuel-soaked elites, scorched trails)
function firePatch(x, y, t){ S.hb.push({x, y, vx:0, vy:0, spd:1, dmg:3, t, t0:t, r:9, fire:true, patch:true, src:'fire'}); }

// ---------- AI for the new enemies & bosses; returns a movement vector ----------
function aiNew(h, z, zd, ang, dt, p, rangeMul){
  const V = h.V || {}, dm = (h.dmgMul || 1)*(V.bite || 1), to = [Math.cos(ang), Math.sin(ang)], away = [-to[0], -to[1]];
  const side = k => [Math.cos(ang+Math.PI/2*h.strafe)*k, Math.sin(ang+Math.PI/2*h.strafe)*k];
  switch (h.type){
    case 'dog': {   // zig-zagging sprint, quick bites
      h.face = ang; h.swing = (h.swing||0) - dt;
      if (zd < h.r+z.r+5 && h.cd <= 0){ h.cd = 0.7; h.swing = 0.12; SFX.at('bark', h.x, h.y);
        if (z === p) hurtPlayer(4*dm, h.kind); else hurtMinion(z, 8*dm); }
      const zig = Math.sin(S.t*9 + h.wa)*0.35; return [Math.cos(ang+zig), Math.sin(ang+zig)]; }
    case 'medic': {   // hangs back and pulses heals into nearby humans
      h.face = ang;
      if (h.cd <= 0){ h.cd = 2.2; let healed = 0;
        for (const o of S.humans) if (!o.dead && o !== h && isTarget(o) && !o.air && o.hp < o.maxHp && d2(o,h) < 95*95){ o.hp = Math.min(o.maxHp, o.hp + (12 + o.maxHp*0.08)*(V.heal || 1)); healed++; }
        if (healed){ S.parts.push({k:'shock', x:h.x, y:h.y, r:4, max:95, t:.4, max2:.4, col:'#a0ffb0'}); SFX.at('healpulse', h.x, h.y); } }
      if (zd < 170) return away; if (zd > 240) return [to[0]*0.6, to[1]*0.6]; return side(0.4); }
    case 'grenadier': {   // lobs arcing grenades at whatever zombie is closest (usually your horde)
      const R = 240*rangeMul; h.face = ang;
      if (h.cd <= 0 && zd < R){ h.cd = rand(3.2,4.2);
        const tx = z.x + rand(-20,20), ty = z.y + rand(-15,15), a = Math.atan2(ty-h.y, tx-h.x), d = Math.hypot(tx-h.x, ty-h.y);
        hfire(h, a, 190, 16, {t:Math.min(2.6, d/190), r:6, shell:true, rad:58, molotov:!!V.molotov}); }
      if (zd > R*0.85) return to; if (zd < R*0.5) return away; return [0,0]; }
    case 'sniper': {   // red laser for 1.2s, then one heavy, fast round; keeps its distance
      const R = 380*rangeMul, pd = Math.hypot(p.x-h.x, p.y-h.y), tgt = pd < R ? p : z;
      h.face = Math.atan2(tgt.y-h.y, tgt.x-h.x);
      if (h.aimT > 0){ h.aimT -= dt; h.aimX = tgt.x; h.aimY = tgt.y;
        if (h.aimT <= 0){ h.cd = rand(4,5.5); hfire(h, Math.atan2(h.aimY-h.y, h.aimX-h.x), 620, 18, {r:3}); SFX.at('snipe', h.x, h.y); }
        return [0,0]; }
      if (h.cd <= 0 && Math.hypot(tgt.x-h.x, tgt.y-h.y) < R){ h.aimT = 1.2; h.aimX = tgt.x; h.aimY = tgt.y; return [0,0]; }
      if (pd < 220) return [-Math.cos(h.face), -Math.sin(h.face)]; if (pd > R*0.9) return [Math.cos(h.face)*0.7, Math.sin(h.face)*0.7]; return [0,0]; }
    case 'swat': {   // drives at you, rams, and drops a squad every 8s
      const pa = Math.atan2(p.y-h.y, p.x-h.x);
      h.face += clamp(((pa-h.face+Math.PI*3)%TAU)-Math.PI, -dt*1.4, dt*1.4);
      if (h.cd2 <= 0){ h.cd2 = 8; for (let i=0;i<4;i++) spawnHuman(V.drops ? V.drops[Math.min(i, V.drops.length-1)] : i === 0 ? 'riot' : pick(['beat','beat','dog']), h.x+rand(-30,30), h.y+rand(-25,25), true);
        SFX.at('siren', h.x, h.y); floatText(h.x, h.y-20, 'BACKUP!', '#7ad0ff'); }
      for (const m of S.minions) if (d2(h,m) < (h.r+m.r)**2) hurtMinion(m, 50*dt);
      if (d2(h,p) < (h.r+p.r+4)**2 && h.cd3 <= 0){ h.cd3 = 0.6; hurtPlayer(10, 'swat'); }
      const go = pd2(h,p) > 90 ? 1 : 0.3; return [Math.cos(h.face)*go, Math.sin(h.face)*go]; }
    case 'jugg': {   // sweeping minigun bursts and a bulldozing charge
      h.face = ang; h.turret = ang;
      if (h.charge > 0){ h.charge -= dt;
        for (const m of S.minions) if (d2(h,m) < (h.r+m.r+4)**2){ hurtMinion(m, 40); m.x += Math.cos(h.cAng)*18; m.y += Math.sin(h.cAng)*18; }
        if (d2(h,p) < (h.r+p.r+4)**2 && h.cd3 <= 0){ h.cd3 = 0.8; hurtPlayer(20, 'jugg'); S.shake = 10; }
        return [Math.cos(h.cAng)*4, Math.sin(h.cAng)*4]; }
      if (h.cd2 <= 0){ h.cd2 = 7.5; h.charge = 0.9; h.cAng = Math.atan2(p.y-h.y, p.x-h.x); floatText(h.x, h.y-30, 'CHARGE!', '#ff5a4a'); SFX.at('roar', h.x, h.y); return [0,0]; }
      if (h.cd <= 0){ h.cd = 4; h.burst = 18; h.bt = 0; h.sweep = -0.6; }
      if (h.burst > 0){ h.bt -= dt; if (h.bt <= 0){ h.bt = 0.07; h.burst--; h.sweep += 1.2/18; hfire(h, ang + h.sweep, 330, 5); } return [to[0]*0.3, to[1]*0.3]; }
      if (d2(h,p) < (h.r+p.r+4)**2 && h.cd3 <= 0){ h.cd3 = 0.7; hurtPlayer(12, 'jugg'); }
      return to; }
    case 'cure': {   // gas clouds on your biggest horde cluster + a cleansing spray up close
      h.face = ang; const pd = pd2(h,p);
      if (h.cd2 <= 0){ h.cd2 = 5;
        let best = p, bn = 0; for (const m of S.minions){ let c = 0; for (const o of S.minions) if (d2(m,o) < 60*60) c++; if (c > bn){ bn = c; best = m; } }
        S.cures.push({x:best.x, y:best.y, r:0, max:75, t:6}); SFX.at('spore', best.x, best.y); }
      if (h.cd <= 0 && zd < 140){ h.cd = 0.06; hfire(h, ang+rand(-.25,.25), rand(180,220), 2.5, {t:0.5, r:7, fire:true}); }
      if (pd < 150) return away; if (pd > 230) return to; return side(0.5); }
  }
  return [0,0];
}
const pd2 = (a,b) => Math.hypot(a.x-b.x, a.y-b.y);

// ---------- per-frame updates for new mutations, mines, gas, threat announcements, Bone Gatling ----------
function updateContent(dt, p){
  for (const e of S.plan) if (!e.told && S.t > e.at){ e.told = true; if (!S.banner || S.banner.t < 1.5) banner('NEW THREAT: ' + threatName(e.k), threatSub(e.k)); }
  const vis = h => !h.dead && isTarget(h) && !h.air && Math.abs(h.x-p.x) < VW/2-8 && Math.abs(h.y-p.y) < VH/2-8;
  const rng = 1 + 0.12*L('eyes');
  // Lash Tendrils: whip the nearest humans and drag them toward you
  let l = L('lash');
  if (l){ S.wt.lash = Math.max(0, (S.wt.lash||0) - dt);
    if (S.wt.lash <= 0){ const R = (150 + 15*l)*rng, n = 1 + Math.floor(l/2) + (E('lash') ? 1 : 0);
      const tg = S.humans.filter(h => vis(h) && d2(h,p) < R*R).sort((a,b) => d2(a,p)-d2(b,p)).slice(0,n);
      if (tg.length){ S.wt.lash = Math.max(0.9, 2.0 - 0.2*l)*(E('lash') ? 0.85 : 1)/AS(); SFX.play('lash');
        for (const t of tg){ dmgHuman(t, crit(t, (12 + 6*l)*(E('lash') ? 1.4 : 1)), 'lash');
          if (!t.boss){ const d = pd2(t,p) || 1; t.kx = (p.x-t.x)/d*260; t.ky = (p.y-t.y)/d*260; }
          if (E('lash')) heal(2, 'lash');
          S.parts.push({k:'lash', x:p.x, y:p.y, x2:t.x, y2:t.y, t:.2, max:.2}); } } } }
  // Corpse Bloom: husk zombies claw up next to your prey (temporary; permanent with Horde King if there's room)
  l = L('bloom');
  if (l){ S.wt.bloom = (S.wt.bloom ?? 2) - dt;
    if (S.wt.bloom <= 0){ S.wt.bloom = Math.max(2.5, 6 - 0.6*l)/AS();
      const tg = S.humans.filter(h => vis(h) && d2(h,p) < 260*260);
      for (let i=0;i<1 + Math.floor(l/2) + (E('bloom') ? 1 : 0);i++){ const t = tg.length ? pick(tg) : p;
        const x = t.x + rand(-22,22), y = t.y + rand(-16,16), keep = E('bloom') && hordeCount() < hordeCap();
        addMinion(x, y, 'civ', pick(LOOKS.civ)); const m = S.minions[S.minions.length-1]; m.husk = true; m.life = keep ? 0 : 8 + l;
        S.st.risen--; FX.rise(x, y); }
      SFX.play('rise', 0.6); } }
  // Eye Beam: a piercing line that burns everything along it
  l = L('beam');
  if (l){ S.wt.beam = (S.wt.beam ?? 1) - dt;
    if (S.wt.beam <= 0){
      const tg = S.humans.filter(h => vis(h) && d2(h,p) < (300*rng)**2).sort((a,b) => d2(a,p)-d2(b,p))[0];
      if (tg){ S.wt.beam = Math.max(0.9, 2.6 - 0.25*l)/AS(); SFX.play('beam');
        const len = (220 + 20*l)*(E('beam') ? 2 : 1), dmg = (20 + 10*l)*(E('beam') ? 2 : 1), a0 = Math.atan2(tg.y-p.y, tg.x-p.x);
        for (const a of E('beam') ? [a0, a0+Math.PI] : [a0]){
          const ex = p.x + Math.cos(a)*len, ey = p.y + Math.sin(a)*len;
          for (const h of S.humans){ if (h.dead || !isTarget(h) || h.air) continue;
            const t = clamp(((h.x-p.x)*(ex-p.x) + (h.y-p.y)*(ey-p.y)) / (len*len), 0, 1), qx = p.x + (ex-p.x)*t, qy = p.y + (ey-p.y)*t;
            if ((h.x-qx)**2 + (h.y-qy)**2 < (h.r + 7)**2) dmgHuman(h, crit(h, dmg), 'beam'); }
          S.parts.push({k:'beam', x:p.x, y:p.y, x2:ex, y2:ey, t:.18, max:.18}); } } } }
  // Grave Wisps: an orbit of wisps that burn whatever they pass through
  l = L('wisps');
  if (l){ const ev = E('wisps'), cnt = 1 + Math.floor(l/2) + (ev ? 2 : 0), R = (46 + 4*l)*(ev ? 1.4 : 1);
    const dmg = (10 + 5*l)*(ev ? 1.5*(1 + 0.1*curse()) : 1);
    S.wispA = (S.wispA || 0) + dt*2.6*AS(); S.wisps = [];
    for (let i=0;i<cnt;i++){ const a = S.wispA + i/cnt*TAU; S.wisps.push({x:p.x + Math.cos(a)*R, y:p.y + Math.sin(a)*R*0.7}); }
    for (const w of S.wisps) for (const h of S.humans){ if (h.dead || !isTarget(h) || h.air) continue;
      if (d2(h,w) < (h.r+8)**2 && (h.wispCd || 0) <= S.t){ h.wispCd = S.t + 0.5; dmgHuman(h, crit(h, dmg), 'wisps');
        if (!h.boss){ const d = pd2(h,p) || 1; h.kx = (h.x-p.x)/d*120; h.ky = (h.y-p.y)/d*120; } } } }
  else S.wisps = null;
  // Brain Wave: expanding psychic rings that hurt humans and drag brains toward you
  S.waves = S.waves || [];
  l = L('wave');
  if (l){ S.wt.wave = (S.wt.wave ?? 1.5) - dt;
    if (S.wt.wave <= 0 && S.humans.some(h => vis(h) && d2(h,p) < (150 + 20*l)**2)){ S.wt.wave = Math.max(1.6, 4.5 - 0.35*l)/AS(); SFX.play('wave');
      S.waves.push({x:p.x, y:p.y, r:6, max:(130 + 18*l)*rng, dmg:14 + 7*l, hit:new Set(), hits:E('wave') ? 2 : 1}); } }
  for (const w of S.waves){ const prev = w.r; w.r += 260*dt;
    for (const h of S.humans){ if (h.dead || !isTarget(h) || h.air || w.hit.has(h)) continue;
      const d = pd2(h,w); if (d < w.r + h.r && d > prev - h.r - 4){ w.hit.add(h);
        for (let i=0;i<w.hits;i++) dmgHuman(h, crit(h, w.dmg), 'wave'); if (E('wave')) h.stun = Math.max(h.stun, 0.5); } }
    for (const g of S.gems) if (!g.pull && pd2(g,w) < w.r){ g.pull = true; if (E('wave')) g.wave = true; } }
  S.waves = S.waves.filter(w => w.r < w.max);
  // Spore Pods: drop mines that burst on contact
  l = L('spores');
  if (l){ S.wt.spores = (S.wt.spores ?? 2) - dt;
    if (S.wt.spores <= 0){ S.wt.spores = Math.max(1.4, 4.2 - 0.45*l)/AS();
      for (let i=0;i<(E('spores') ? 3 : 1);i++) S.mines.push({x:p.x+rand(-40,40), y:p.y+rand(-30,30), arm:0.6, t:14, r:(46+8*l)*(E('spores')?1.6:1), dmg:28+12*l, seed:Math.random()});
      SFX.play('spore'); } }
  for (const m of S.mines){ m.t -= dt; m.arm -= dt; if (m.arm > 0 || m.gone) continue;
    for (const h of S.humans) if (!h.dead && isTarget(h) && !h.air && d2(h,m) < (16+h.r)**2){ m.gone = true;
      explode(m.x, m.y, m.r, m.dmg, 'zombie', null, 'spores');
      if (E('spores') && !m.child) for (let i=0;i<2;i++) S.mines.push({x:m.x+rand(-35,35), y:m.y+rand(-25,25), arm:0.8, t:8, r:m.r*0.7, dmg:m.dmg*0.6, child:true, seed:Math.random()});
      break; } }
  S.mines = S.mines.filter(m => !m.gone && m.t > 0); if (S.mines.length > 30) S.mines.splice(0, S.mines.length-30);
  // The Cure's gas: melts zombies, mends humans
  for (const c of S.cures){ c.t -= dt; c.r += (c.max - c.r)*Math.min(1, dt*3);
    for (const m of S.minions) if (m.rise <= 0 && d2(m,c) < c.r*c.r) hurtMinion(m, 22*dt);
    if (d2(p,c) < c.r*c.r && (S.cureTick = (S.cureTick||0) - dt) <= 0){ S.cureTick = 0.5; hurtPlayer(4, 'cure'); }
    for (const h of S.humans) if (!h.dead && isTarget(h) && d2(h,c) < c.r*c.r) h.hp = Math.min(h.maxHp, h.hp + 10*dt); }
  S.cures = S.cures.filter(c => c.t > 0);
  // Bone Gatling item: 8 seconds of rapid, piercing bone rounds at the nearest visible humans
  if (p.saw > 0){ p.saw -= dt; S.st.sawTime += dt; S.gatT = (S.gatT||0) - dt;
    if (S.gatT <= 0){ S.gatT = 0.075/AS();
      const tg = S.humans.filter(h => vis(h) && d2(h,p) < 360*360).sort((a,b) => d2(a,p)-d2(b,p)).slice(0,3);
      if (tg.length){ const t = tg[(S.gatI = ((S.gatI||0)+1) % tg.length)], a = Math.atan2(t.y-p.y, t.x-p.x) + rand(-.05,.05);
        p.face = a; SFX.play('gatling', 0.6);
        S.pb.push({x:p.x+Math.cos(a)*10, y:p.y+Math.sin(a)*10, vx:Math.cos(a)*520*GS, vy:Math.sin(a)*520*GS, dmg:22 + S.level*0.8, t:0.8/GS, r:5, pierce:2, hit:new Set(), k:'gat'});
        S.parts.push({k:'flash', x:p.x+Math.cos(a)*12, y:p.y+Math.sin(a)*12, a, t:.05, max:.05, big:false});
        S.parts.push({k:'casing', x:p.x, y:p.y, vx:Math.cos(a+1.6)*rand(40,80), vy:Math.sin(a+1.6)*rand(40,80), z:10, vz:rand(60,120), t:.6, max:.6}); } } }
}

// Chitin Shell: chance to shrug off a bullet
function deflect(b){
  const l = L('chitin'); if (!l) return false;
  if (Math.random() >= 0.08*l) return false;
  const p = S.player; SFX.play('clang');
  S.parts.push({k:'spark', x:p.x, y:p.y, vx:-b.vx*0.3, vy:-b.vy*0.3, t:.25, max:.25, col:'#e0e8ff'});
  stat('heal', 'chitin', b.dmg);   // shown in the healing table as damage prevented
  return true;
}

// ---------- map rosters: every map fields its own enemies, elites and bosses ----------
// A variant runs on a base enemy's AI (`base`: hp/speed/size come from HT unless overridden) with its own
// look, name and tuning. Some have a behaviour of their own (`ai`, handled in aiNew / aiMap).
// Tuning fields read by the AIs: mdmg/mcd/knock (melee), range/pellets/spread/bdmg/bspd (guns), burst,
// bite, heal, bees, molotov, drops (vehicles & gunships), pack (spawns in groups).
const VARIANTS = {
  // ---- PINE HOLLOW: loggers, hunters and park rangers ----
  lumberjack: {base:'beat', n:'LUMBERJACKS', sub:'AXES HIT SLOW AND HARD', hp:30, sp:76, mdmg:1.7, mcd:1.6, knock:14,
    look:{shirt:['#b83a2a','#3a6aa8','#2a7a3a'], pants:'#3a4a6a', gear:'beanie', hat:['#b83a2a','#e8c030','#2a2a30'], weapon:'axe', plaid:true}},
  hound:      {base:'dog', n:'HUNTING HOUNDS', sub:'THEY HUNT IN PACKS', hp:9, sp:160, pack:3, bite:0.8,
    look:{fur:['#b0783a','#e8dcc0','#6a4a2a'], collar:'#e85a1a'}},
  hunter:     {base:'cop', n:'HUNTERS', sub:'SHOTGUNS: DEADLY UP CLOSE', range:150, pellets:4, spread:0.32, bdmg:4,
    look:{shirt:'#e86a1a', pants:'#5a4a30', gear:'hat', hat:'#e86a1a', weapon:'rifle'}},
  scout:      {base:'medic', n:'SCOUT LEADERS', sub:'FIRST AID FOR THE LIVING - KILL THEM FIRST', heal:1.2,
    look:{shirt:'#8a9a5a', pants:'#5a4a30', gear:'hat', hat:'#6a5a3a', medic:false, bandana:'#e8c03a'}},
  beekeeper:  {base:'riot', n:'BEEKEEPERS', sub:'THICK SUITS HALVE YOUR SPIT; WATCH THE BEES', hp:95, bees:true,
    look:{shirt:'#ece8d8', pants:'#ece8d8', skin:'#ece8d8', gear:'veil', shield:false}},
  poacher:    {base:'soldier', n:'POACHERS', sub:'RIFLE BURSTS FROM THE TREES', burst:2, bdmg:8,
    look:{shirt:'#4a5a2a', pants:'#5a4a30', gear:'beanie', hat:'#3a3a2a', weapon:'rifle', vest:true, vestCol:'#5a4a2a'}},
  trapper:    {base:'grenadier', ai:'trapper', n:'TRAPPERS', sub:'THEY LAY BEAR TRAPS - WATCH YOUR STEP', hp:40,
    look:{shirt:'#7a5a3a', pants:'#4a3a2a', gear:'hat', hat:'#4a3a2a', weapon:'rifle', bandana:'#6a2a2a'}},
  smokejumper:{base:'flamer', n:'SMOKEJUMPERS', sub:'DRIP TORCHES BURN THE DEAD',
    look:{shirt:'#e8c030', pants:'#4a5a3a', gear:'hardhat', hat:'#e8e0d0', weapon:'nozzle', tank:true}},
  deerhunter: {base:'sniper', n:'DEER HUNTERS', sub:'SCOPED RIFLES - WATCH FOR THE LASER',
    look:{shirt:'#e86a1a', pants:'#4a5a2a', gear:'beanie', hat:'#e86a1a', weapon:'longrifle'}},
  harvester:  {base:'apc', n:'TIMBER HARVESTER', intro:['TIMBER HARVESTER','IT CLEARS THE WOODS OF THE DEAD'], paint:{h:48, s:0.75}, hp:1700},
  headranger: {base:'jugg', ai:'headranger', n:'THE HEAD RANGER', intro:['THE HEAD RANGER','HOUNDS, TRAPS AND A DEAD-EYE AIM'], hp:1200, sp:52,
    look:{shirt:'#6a7a4a', pants:'#4a3a2a', skin:'#dda77c', gear:'cowboy', hat:'#8a6a3a', weapon:'longrifle', badge:true}},
  hermit:     {base:'jugg', n:'THE HERMIT', intro:['THE HERMIT','HE HAS BEEN WAITING FOR THIS'], hp:1400,
    look:{shirt:'#7a3a2a', pants:'#3a3a2a', skin:'#c89a70', hair:'#d8d8d0', style:1, plaid:true, weapon:'minigun'}},
  rangerheli: {base:'heli', n:'RANGER CHOPPER', intro:['RANGER CHOPPER INBOUND','DOWN IT TO TAKE THE WOODS'], paint:{h:110, s:0.5, l:0.05}, drops:['poacher','hound']},
  // ---- THE DOCKS: dockers, port security and harbour marines ----
  docker:     {base:'beat', n:'STEVEDORES', sub:'CARGO HOOKS DRAG THE DEAD', hp:28, knock:-12, mdmg:1.2,
    look:{shirt:['#3a5a8a','#5a5a62'], pants:'#2a3040', gear:'hardhat', hat:['#e8c030','#e86a1a','#e8e8e0'], weapon:'hook', vest:true, vestCol:'#f07a1a'}},
  guarddog:   {base:'dog', n:'GUARD DOGS', sub:'TRAINED TO MAUL', hp:16, bite:1.5, sp:140,
    look:{fur:['#1e1c20','#3a2a20'], collar:'#c8c8d0'}},
  security:   {base:'cop', n:'PORT SECURITY', sub:'THEY SHOOT FAST AND OFTEN', bdmg:5, bspd:320, cdMul:0.7,
    look:{shirt:'#2a2a30', pants:'#2a2a30', gear:'cap', weapon:'pistol', vest:true, vestCol:'#d8d830'}},
  hazmat:     {base:'medic', n:'DECON TECHS', sub:'THEY HEAL THE LIVING - KILL THEM FIRST', heal:1.0,
    look:{shirt:'#e8d030', pants:'#e8d030', gear:'mask', medic:false, tank:true}},
  welder:     {base:'riot', n:'WELDERS', sub:'STEEL PLATE HALVES YOUR SPIT', hp:120,
    look:{shirt:'#5a4a3a', pants:'#3a3a42', gear:'welder', shieldCol:'#8a8a92'}},
  marine:     {base:'soldier', n:'HARBOR MARINES', sub:'DISCIPLINED BURST FIRE', burst:4,
    look:{shirt:'#2a4a6a', pants:'#2a3a52', gear:'helmet', weapon:'rifle', vest:true, vestCol:'#3a4a5a'}},
  harpooner:  {base:'grenadier', ai:'harpooner', n:'HARPOONERS', sub:'THEY REEL YOU IN', hp:50,
    look:{shirt:'#e8e0d0', pants:'#2a3a52', gear:'beanie', hat:'#2a3a6a', weapon:'harpoon', plaid:false}},
  cutter:     {base:'flamer', n:'TORCH CUTTERS', sub:'CUTTING TORCHES BURN THE DEAD', hp:70,
    look:{shirt:'#3a3a42', pants:'#2a2a30', gear:'welder', weapon:'nozzle', tank:true}},
  lookout:    {base:'sniper', n:'CRANE LOOKOUTS', sub:'SNIPERS UP HIGH - WATCH FOR THE LASER',
    look:{shirt:'#2a2a30', pants:'#2a3040', gear:'beanie', hat:'#1a1a20', weapon:'longrifle', vest:true, vestCol:'#f07a1a'}},
  straddle:   {base:'swat', n:'STRADDLE CARRIER', intro:['STRADDLE CARRIER','IT UNLOADS A FRESH CREW'], paint:{h:28, s:0.85, l:0.12}, drops:['welder','docker','guarddog']},
  foreman:    {base:'jugg', ai:'foreman', n:'THE FOREMAN', intro:['THE FOREMAN','HE THROWS FUEL DRUMS'], hp:1400, sp:46,
    look:{shirt:'#3a5a8a', pants:'#2a3040', skin:'#b9825a', gear:'hardhat', hat:'#e8e8e0', vest:true, vestCol:'#f07a1a', weapon:'wrench'}},
  deconlead:  {base:'cure', n:'DECON LEAD', intro:['DECON LEAD','ITS GAS MELTS YOUR HORDE'],
    look:{shirt:'#e8d030', pants:'#e8d030', gear:'mask', weapon:'nozzle', tank:true}},
  coastheli:  {base:'heli', n:'COAST GUARD CHOPPER', intro:['COAST GUARD INBOUND','DOWN IT TO TAKE THE PORT'], paint:{h:8, s:0.8, l:0.06}, drops:['marine','marine']},
  // ---- DEAD END: raiders, lawmen and road warriors ----
  raider:     {base:'beat', n:'RAIDERS', sub:'MACHETES - FAST AND RECKLESS', hp:18, sp:100, mcd:0.75,
    look:{shirt:['#5a3a2a','#3a3a3a','#8a6a4a'], pants:'#4a3a2a', bandana:['#a83a2a','#2a2a30','#c8a050'], weapon:'machete'}},
  coyote:     {base:'dog', n:'COYOTES', sub:'THEY RUN IN PACKS', hp:8, sp:170, pack:3, bite:0.7,
    look:{fur:['#b8945c','#a08050'], collar:null}},
  deputy:     {base:'cop', n:'DEPUTIES', sub:'REVOLVERS - THEY FAN THE HAMMER', fan:3, spread:0.18,
    look:{shirt:'#c8a870', pants:'#5a4a3a', gear:'cowboy', hat:'#5a3a24', weapon:'pistol', badge:true}},
  nomad:      {base:'medic', n:'WATER BEARERS', sub:'THEY HEAL THE LIVING - KILL THEM FIRST', heal:1.1,
    look:{shirt:'#c8b890', pants:'#a89870', gear:'hood', hat:'#a89870', medic:false, bandana:'#c8b890'}},
  scrapper:   {base:'riot', n:'SCRAP KNIGHTS', sub:'SCRAP SHIELDS HALVE YOUR SPIT', hp:100,
    look:{shirt:'#4a3a2a', pants:'#3a2e24', gear:'welder', shieldCol:'#9a5a2a'}},
  bandit:     {base:'soldier', n:'BANDITS', sub:'LEVER-ACTION VOLLEYS', burst:3,
    look:{shirt:'#6a4a3a', pants:'#3a3a42', gear:'cowboy', hat:'#2a2420', weapon:'rifle', bandana:'#a83a2a'}},
  bomber:     {base:'grenadier', n:'MOLOTOV THROWERS', sub:'THEIR FIREBOMBS LEAVE THE GROUND BURNING', molotov:true, hp:38,
    look:{shirt:'#3a3a3a', pants:'#4a3a2a', bandana:'#e8c050', weapon:'bottle'}},
  biker:      {base:'beat', ai:'biker', n:'DIRT BIKERS', sub:'THEY RUN DOWN THE DEAD', hp:42, sp:120, r:12, xp:6,
    look:{shirt:'#2a2a30', pants:'#2a2a30', gear:'hardhat', hat:'#c83a2a', bandana:'#2a2a30', weapon:null}},
  marksman:   {base:'sniper', n:'RIDGE SHOOTERS', sub:'LONG GUNS - WATCH FOR THE LASER',
    look:{shirt:'#a88a5a', pants:'#5a4a3a', gear:'cowboy', hat:'#8a6a3a', weapon:'longrifle', bandana:'#a88a5a'}},
  scraprig:   {base:'apc', n:'SCRAP RIG', intro:['SCRAP RIG','A WELDED-UP WAR MACHINE'], paint:{h:22, s:0.55, l:-0.04}, hp:1700, molotov:true},
  warlord:    {base:'jugg', ai:'warlord', n:'THE WARLORD', intro:['THE WARLORD','HIS GANG ANSWERS THE WAR CRY'], hp:1300, sp:56,
    look:{shirt:'#3a2a24', pants:'#2a2420', skin:'#b9825a', gear:'welder', weapon:'bottle', vest:true, vestCol:'#5a3a2a'}},
  sheriff:    {base:'jugg', n:'THE SHERIFF', intro:['THE SHERIFF','LAW AND ORDER, WHOLE MAGAZINE'], hp:1300,
    look:{shirt:'#c8a870', pants:'#4a3a2a', skin:'#dda77c', gear:'cowboy', hat:'#e8e0d0', badge:true, weapon:'minigun', vest:true, vestCol:'#7a5a3a'}},
  dustheli:   {base:'heli', n:'DUST DEVIL', intro:['DUST DEVIL INBOUND','DOWN IT TO TAKE THE DESERT'], paint:{h:36, s:0.4, l:0.08}, drops:['bandit','raider'], firebomb:true},
};
const MAP_ROSTER = {
  city:   {tiers:THREAT_TIERS, bosses:BOSS_POOL, final:'heli', wave:['soldier','riot'], pack:'dog',
           elites:{armored:'ARMORED', swift:'SWIFT', regen:'REGEN', explosive:'VOLATILE', frenzied:'FRENZIED'}},
  forest: {tiers:[['lumberjack','hound','hunter','scout'], ['beekeeper','poacher','trapper'], ['smokejumper','deerhunter']],
           bosses:['harvester','headranger','hermit'], final:'rangerheli', wave:['poacher','beekeeper'], pack:'hound',
           elites:{camo:'CAMOUFLAGED', thorns:'BRAMBLE-SKINNED', pack:'PACK LEADER', regen:'HERBALIST', swift:'TRAILBLAZER'}},
  docks:  {tiers:[['docker','guarddog','security','hazmat'], ['welder','marine','harpooner'], ['cutter','lookout']],
           bosses:['straddle','foreman','deconlead'], final:'coastheli', wave:['marine','welder'], pack:'guarddog',
           elites:{heavy:'HEAVY-SET', shock:'LIVE WIRE', oily:'FUEL-SOAKED', armored:'IRONCLAD', frenzied:'HOPPED-UP'}},
  desert: {tiers:[['raider','coyote','deputy','nomad'], ['scrapper','bandit','bomber'], ['biker','marksman']],
           bosses:['scraprig','warlord','sheriff'], final:'dustheli', wave:['bandit','biker'], pack:'coyote',
           elites:{scorch:'SCORCHED', blink:'MIRAGE', swift:'ROADRUNNER', explosive:'BOOBY-TRAPPED', armored:'SCRAP-PLATED'}},
};
const roster = () => MAP_ROSTER[MAP_ID] || MAP_ROSTER.city;
const baseOf = k => VARIANTS[k] ? VARIANTS[k].base : k;
const threatName = k => VARIANTS[k] ? VARIANTS[k].n : THREAT_NAME[k];
const threatSub = k => VARIANTS[k] ? VARIANTS[k].sub : THREAT_SUB[k];
// display name for any enemy (boss bars, kill banners, damage breakdown)
const enemyName = h => (h.V && h.V.n) || BOSS_NAME[h.type] || THREAT_NAME[h.type] || h.type.toUpperCase();
// looks: a few per variant, built from the variant's look spec (array values pick one at random)
function variantLook(V){
  const L = baseLook(V.base), spec = V.look || {};
  for (const k in spec){ let v = spec[k]; if (Array.isArray(v)) v = pick(v);
    L[k] = (k === 'shirt' || k === 'pants' || k === 'skin' || k === 'hair' || k === 'fur') && v ? shades(v) : v; }
  if (spec.weapon === null) L.weapon = null;
  return L;
}
const BOSS_LOOKS = {jugg:JUGG_LOOK, cure:CURE_LOOK};
for (const k in VARIANTS){ const V = VARIANTS[k];
  if (HT[V.base].boss){ if (V.look) BOSS_LOOKS[k] = Object.assign(variantLook(V), {pose:'aim'}); }
  else LOOKS[k] = [0,1,2].map(() => variantLook(V)); }

// bear traps (Trappers, the Head Ranger): armed on the ground, they snap shut on the first zombie to step in
function placeTrap(x, y){ (S.traps = S.traps || []).push({x, y, arm:0.7, t:30, shut:0}); }
function updateTraps(dt, p){
  if (!S.traps) return;
  for (const t of S.traps){ t.t -= dt; if (t.shut > 0){ t.shut -= dt; if (t.shut <= 0) t.t = 0; continue; } if (t.arm > 0){ t.arm -= dt; continue; }
    if (d2(t,p) < 14*14){ t.shut = 0.8; hurtPlayer(14, 'trap'); p.snared = 0.9; SFX.at('snap', t.x, t.y); FX.blood(t.x, t.y, 4, true); continue; }
    for (const m of S.minions) if (m.rise <= 0 && d2(t,m) < 13*13){ t.shut = 0.8; hurtMinion(m, 35); m.snared = 1.6; SFX.at('snap', t.x, t.y); break; } }
  S.traps = S.traps.filter(t => t.t > 0);
}

// ---------- AI for map-unique enemies and bosses; returns a movement vector ----------
function aiMap(h, z, zd, ang, dt, p, rangeMul){
  const dm = h.dmgMul || 1, to = [Math.cos(ang), Math.sin(ang)], away = [-to[0], -to[1]], pd = pd2(h,p), pa = Math.atan2(p.y-h.y, p.x-h.x);
  switch (h.V.ai){
    case 'trapper': {   // sets bear traps between itself and the horde, then backs off
      h.face = ang;
      if (h.cd <= 0 && zd < 260){ h.cd = rand(3.5,4.5); const d = Math.min(zd*0.55, 90); placeTrap(h.x+Math.cos(ang)*d, h.y+Math.sin(ang)*d*0.8); }
      if (zd < 150) return away; if (zd > 230) return [to[0]*0.7, to[1]*0.7]; return [Math.cos(ang+Math.PI/2*h.strafe)*0.4, Math.sin(ang+Math.PI/2*h.strafe)*0.4]; }
    case 'harpooner': {   // aims, fires a harpoon on a line, and reels whatever it hits
      h.face = h.reel ? Math.atan2(h.reel.tg.y-h.y, h.reel.tg.x-h.x) : ang;
      if (h.reel){ const tg = h.reel.tg; h.reel.t -= dt;
        if (h.reel.t <= 0 || (tg !== p && tg.hp <= 0)){ h.reel = null; return [0,0]; }
        const d = Math.max(1, pd2(h,tg)); if (d > h.r+tg.r+4){ const k = Math.min(d-h.r-tg.r, 210*dt); tg.x -= (tg.x-h.x)/d*k; tg.y -= (tg.y-h.y)/d*k; }
        return [0,0]; }
      if (h.aimT > 0){ h.aimT -= dt; if (h.aimT <= 0){ h.cd = rand(3.5,4.5); hfire(h, ang, 300, 12, {r:4, harpoon:true, owner:h, t:0.9}); SFX.at('harpoon', h.x, h.y); } return [0,0]; }
      if (h.cd <= 0 && zd < 220*rangeMul){ h.aimT = 0.5; return [0,0]; }
      if (zd > 190) return to; if (zd < 110) return away; return [0,0]; }
    case 'biker': {   // circles at range, revs, then tears straight through the nearest zombie
      if (h.dash > 0){ h.dash -= dt; h.face = h.dAng;
        for (const m of S.minions) if (m.rise <= 0 && d2(h,m) < (h.r+m.r+4)**2 && !(m.hitBy === h && m.hitT > S.t)){ hurtMinion(m, 16*dm); m.x += Math.cos(h.dAng)*16; m.y += Math.sin(h.dAng)*16; m.hitBy = h; m.hitT = S.t + 0.5; }
        if (d2(h,p) < (h.r+p.r+4)**2 && h.cd3 <= 0){ h.cd3 = 0.8; hurtPlayer(10*dm, 'biker'); }
        if (Math.random() < 0.5) S.parts.push({k:'dirt', x:h.x+rand(-4,4), y:h.y+rand(-2,2), vx:-Math.cos(h.dAng)*60+rand(-20,20), vy:-Math.sin(h.dAng)*40-20, t:.4, max:.4, col:'#b8945c'});
        return [Math.cos(h.dAng)*2.6, Math.sin(h.dAng)*2.6]; }
      if (h.cd <= 0 && zd < 230){ h.cd = rand(2.6,3.4); h.dash = 0.9; h.dAng = ang; SFX.at('rev', h.x, h.y); return [0,0]; }
      h.face = ang + Math.PI/2*h.strafe;
      if (zd > 200) return to; if (zd < 120) return [away[0]*0.6 + Math.cos(h.face)*0.6, away[1]*0.6 + Math.sin(h.face)*0.6];
      return [Math.cos(h.face), Math.sin(h.face)]; }
    case 'headranger': {   // whistles up hound packs, rings you with traps, and fires aimed three-round volleys
      h.face = pa; h.turret = pa;
      if (h.cd2 <= 0){ h.cd2 = 9; SFX.at('whistle', h.x, h.y); floatText(h.x, h.y-34, 'SIC EM!', '#e8a040');
        for (let i=0;i<4;i++) spawnHuman('hound', h.x+rand(-40,40), h.y+rand(-30,30), true); }
      h.trapT = (h.trapT === undefined ? 5 : h.trapT) - dt;
      if (h.trapT <= 0){ h.trapT = 8; for (let i=0;i<6;i++){ const a = i/6*TAU + rand(-.2,.2); placeTrap(p.x+Math.cos(a)*rand(60,85), p.y+Math.sin(a)*rand(42,60)); } }
      if (h.cd <= 0 && pd < 380){ h.cd = 3.2; h.burst = 3; h.bt = 0.5; h.aimT = 0.5; }
      if (h.burst > 0){ h.bt -= dt; if (h.bt <= 0){ h.bt = 0.16; h.burst--; hfire(h, pa+rand(-.04,.04), 520, 11); SFX.at('snipe', h.x, h.y); } return [0,0]; }
      if (pd < 180) return [-Math.cos(pa), -Math.sin(pa)]; if (pd > 280) return [Math.cos(pa)*0.8, Math.sin(pa)*0.8];
      return [Math.cos(pa+Math.PI/2)*0.5, Math.sin(pa+Math.PI/2)*0.5]; }
    case 'foreman': {   // hurls fuel drums and slams the ground when you get close
      h.face = pa; h.turret = pa;
      if (h.slam > 0){ h.slam -= dt; if (h.slam <= 0){ S.shake = 12; SFX.at('boom', h.x, h.y);
          S.parts.push({k:'shock', x:h.x, y:h.y, r:6, max:110, t:.4, max2:.4, col:'#e8c030'});
          for (const m of S.minions){ const d = pd2(m,h); if (d < 110){ hurtMinion(m, 30); m.x += (m.x-h.x)/(d||1)*40; m.y += (m.y-h.y)/(d||1)*40; } }
          if (pd < 110) hurtPlayer(16, 'foreman'); }
        return [0,0]; }
      if (h.cd2 <= 0 && pd < 110){ h.cd2 = 5; h.slam = 0.6; floatText(h.x, h.y-34, 'SLAM!', '#e8c030'); return [0,0]; }
      if (h.cd <= 0){ h.cd = 2.8;
        for (let i=0;i<2;i++){ const tg = i ? z : p, tx = tg.x+rand(-25,25), ty = tg.y+rand(-18,18), a = Math.atan2(ty-h.y, tx-h.x), d = Math.hypot(tx-h.x, ty-h.y);
          hfire(h, a, 170, 20, {t:Math.min(2.8, d/170), r:7, shell:true, rad:66, drum:true, molotov:i===0}); } }
      return pd > 70 ? to : [0,0]; }
    case 'warlord': {   // firebomb fans, and a war cry that summons the gang and enrages everyone nearby
      h.face = pa; h.turret = pa;
      if (h.cd <= 0){ h.cd = 4.5;
        for (let i=-2;i<=2;i++){ const a = pa + i*0.32, d = Math.min(pd, 220), tx = h.x+Math.cos(a)*d, ty = h.y+Math.sin(a)*d;
          hfire(h, a, 180, 12, {t:Math.min(2.6, d/180), r:6, shell:true, rad:46, molotov:true}); } }
      if (h.cd2 <= 0){ h.cd2 = 11; S.shake = 8; SFX.at('roar', h.x, h.y); floatText(h.x, h.y-34, 'WAR CRY!', '#ff7a2a');
        for (let i=0;i<2;i++){ spawnHuman('biker', h.x+rand(-50,50), h.y+rand(-30,30), true); spawnHuman('raider', h.x+rand(-50,50), h.y+rand(-30,30), true); }
        for (const o of S.humans) if (!o.dead && !o.boss && isTarget(o) && d2(o,h) < 260*260) o.rage = 5; }
      if (pd < 170) return away; if (pd > 260) return to; return [Math.cos(pa+Math.PI/2*h.strafe)*0.6, Math.sin(pa+Math.PI/2*h.strafe)*0.6]; }
  }
  return [0,0];
}
