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
function makeSpawnPlan(){ return THREAT_TIERS.flatMap(t => shuffle(t.slice())).map((k,i) => ({k, at:THREAT_TIMES[i], told:false})); }
function planPick(){
  const t = S.t, w = {civ: Math.max(0.3, 1 - t/420)};
  for (const e of S.plan) if (t > e.at) w[e.k] = Math.min(THREAT_CAP[e.k], (t-e.at)/140);
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
  banner(...BOSS_INTRO[k]); SFX.play('alarm'); if (k === 'swat') SFX.play('siren');
}

// ---------- elites: rare, tougher enemies with a random affix ----------
const ELITE = {armored:{c:'#a8c0d8', n:'ARMORED'}, swift:{c:'#7ad0ff', n:'SWIFT'}, regen:{c:'#7aff7a', n:'REGEN'},
  explosive:{c:'#ff8a3a', n:'VOLATILE'}, frenzied:{c:'#ff4a6a', n:'FRENZIED'}};
function maybeElite(h){
  if (S.t < 50 || h.type === 'civ') return;
  if (Math.random() > Math.min(0.1, 0.02 + S.t/600*0.08)) return;
  const a = pick(Object.keys(ELITE)); h.elite = a;
  h.hp = h.maxHp = h.maxHp*3.5; h.xp *= 5; h.r = Math.round(h.r*1.15); h.dmgMul = 1.5;
  if (a === 'swift') h.sp *= 1.6;
}
function eliteDeath(h){
  S.st.elites = (S.st.elites||0) + 1;
  if (Math.random() < 0.35){ spawnItem(pickItemType(), h.x, h.y); S.items[S.items.length-1].pop = 0.4; }
  if (h.elite === 'explosive') explode(h.x, h.y, 70, 18, 'human', null, 'elite');
}

// ---------- AI for the new enemies & bosses; returns a movement vector ----------
function aiNew(h, z, zd, ang, dt, p, rangeMul){
  const dm = h.dmgMul || 1, to = [Math.cos(ang), Math.sin(ang)], away = [-to[0], -to[1]];
  const side = k => [Math.cos(ang+Math.PI/2*h.strafe)*k, Math.sin(ang+Math.PI/2*h.strafe)*k];
  switch (h.type){
    case 'dog': {   // zig-zagging sprint, quick bites
      h.face = ang; h.swing = (h.swing||0) - dt;
      if (zd < h.r+z.r+5 && h.cd <= 0){ h.cd = 0.7; h.swing = 0.12; SFX.at('bark', h.x, h.y);
        if (z === p) hurtPlayer(4*dm, 'dog'); else hurtMinion(z, 8*dm); }
      const zig = Math.sin(S.t*9 + h.wa)*0.35; return [Math.cos(ang+zig), Math.sin(ang+zig)]; }
    case 'medic': {   // hangs back and pulses heals into nearby humans
      h.face = ang;
      if (h.cd <= 0){ h.cd = 2.2; let healed = 0;
        for (const o of S.humans) if (!o.dead && o !== h && isTarget(o) && !o.air && o.hp < o.maxHp && d2(o,h) < 95*95){ o.hp = Math.min(o.maxHp, o.hp + 12 + o.maxHp*0.08); healed++; }
        if (healed){ S.parts.push({k:'shock', x:h.x, y:h.y, r:4, max:95, t:.4, max2:.4, col:'#a0ffb0'}); SFX.at('healpulse', h.x, h.y); } }
      if (zd < 170) return away; if (zd > 240) return [to[0]*0.6, to[1]*0.6]; return side(0.4); }
    case 'grenadier': {   // lobs arcing grenades at whatever zombie is closest (usually your horde)
      const R = 240*rangeMul; h.face = ang;
      if (h.cd <= 0 && zd < R){ h.cd = rand(3.2,4.2);
        const tx = z.x + rand(-20,20), ty = z.y + rand(-15,15), a = Math.atan2(ty-h.y, tx-h.x), d = Math.hypot(tx-h.x, ty-h.y);
        hfire(h, a, 190, 16, {t:Math.min(2.6, d/190), r:6, shell:true, rad:58}); }
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
      if (h.cd2 <= 0){ h.cd2 = 8; for (let i=0;i<4;i++) spawnHuman(i === 0 ? 'riot' : pick(['beat','beat','dog']), h.x+rand(-30,30), h.y+rand(-25,25));
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
  for (const e of S.plan) if (!e.told && S.t > e.at){ e.told = true; if (!S.banner || S.banner.t < 1.5) banner('NEW THREAT: ' + THREAT_NAME[e.k], THREAT_SUB[e.k]); }
  const vis = h => !h.dead && isTarget(h) && !h.air && Math.abs(h.x-p.x) < VW/2-8 && Math.abs(h.y-p.y) < VH/2-8;
  const rng = 1 + 0.12*L('eyes');
  // Lash Tendrils: whip the nearest humans and drag them toward you
  let l = L('lash');
  if (l){ S.wt.lash = Math.max(0, (S.wt.lash||0) - dt);
    if (S.wt.lash <= 0){ const R = (150 + 15*l)*rng, n = 1 + Math.floor(l/2) + (E('lash') ? 1 : 0);
      const tg = S.humans.filter(h => vis(h) && d2(h,p) < R*R).sort((a,b) => d2(a,p)-d2(b,p)).slice(0,n);
      if (tg.length){ S.wt.lash = Math.max(0.9, 2.0 - 0.2*l)*(E('lash') ? 0.85 : 1); SFX.play('lash');
        for (const t of tg){ dmgHuman(t, crit(t, (12 + 6*l)*(E('lash') ? 1.4 : 1)), 'lash');
          if (!t.boss){ const d = pd2(t,p) || 1; t.kx = (p.x-t.x)/d*260; t.ky = (p.y-t.y)/d*260; }
          if (E('lash')) heal(2, 'lash');
          S.parts.push({k:'lash', x:p.x, y:p.y, x2:t.x, y2:t.y, t:.2, max:.2}); } } } }
  // Spore Pods: drop mines that burst on contact
  l = L('spores');
  if (l){ S.wt.spores = (S.wt.spores ?? 2) - dt;
    if (S.wt.spores <= 0){ S.wt.spores = Math.max(1.4, 4.2 - 0.45*l);
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
    if (S.gatT <= 0){ S.gatT = 0.075;
      const tg = S.humans.filter(h => vis(h) && d2(h,p) < 360*360).sort((a,b) => d2(a,p)-d2(b,p)).slice(0,3);
      if (tg.length){ const t = tg[(S.gatI = ((S.gatI||0)+1) % tg.length)], a = Math.atan2(t.y-p.y, t.x-p.x) + rand(-.05,.05);
        p.face = a; SFX.play('gatling', 0.6);
        S.pb.push({x:p.x+Math.cos(a)*10, y:p.y+Math.sin(a)*10, vx:Math.cos(a)*520*GS, vy:Math.sin(a)*520*GS, dmg:22 + S.level*0.8, t:0.8/GS, r:5, pierce:2, hit:new Set(), k:'gat'});
        S.parts.push({k:'flash', x:p.x+Math.cos(a)*12, y:p.y+Math.sin(a)*12, a, t:.05, max:.05, big:false});
        S.parts.push({k:'casing', x:p.x, y:p.y, vx:Math.cos(a+1.6)*rand(40,80), vy:Math.sin(a+1.6)*rand(40,80), z:10, vz:rand(60,120), t:.6, max:.6}); } } }
}

// Chitin Shell: chance to shrug off a bullet; Mirror Carapace fires it back
function deflect(b){
  const l = L('chitin'); if (!l) return false;
  if (Math.random() >= 0.08*l + (E('chitin') ? 0.15 : 0)) return false;
  const p = S.player; SFX.play('clang');
  S.parts.push({k:'spark', x:p.x, y:p.y, vx:-b.vx*0.3, vy:-b.vy*0.3, t:.25, max:.25, col:'#e0e8ff'});
  if (E('chitin')) S.pb.push({x:p.x, y:p.y, vx:-b.vx*1.3, vy:-b.vy*1.3, dmg:b.dmg*3, t:1.4, r:5, pierce:2, hit:new Set(), k:'mirror'});
  stat('heal', 'chitin', b.dmg);   // shown in the healing table as damage prevented
  return true;
}
