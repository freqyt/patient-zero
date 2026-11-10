"use strict";
// ---------- map bosses with their own mechanics (Pine Hollow, The Docks, Dead End) ----------
// The Head Ranger, The Foreman and The Warlord live in content.js (aiMap). This file adds the other nine:
// each has its own AI (BOSS_AI), and the vehicles and aircraft have their own art (V.draw).
// Shared helpers: ground telegraphs (S.marks), rolling logs, landed containers, dust devils.

const angTo = (a, b) => Math.atan2(b.y-a.y, b.x-a.x);
function turnTo(h, a, rate, dt){ h.face += clamp(((a-h.face+Math.PI*3)%TAU)-Math.PI, -rate*dt, rate*dt); }
// running over things: steady damage to the horde, a hit on Patient Zero every 0.7s
function ram(h, p, dt, pdmg, mdps){
  for (const m of S.minions) if (m.rise <= 0 && d2(h,m) < (h.r+m.r)**2) hurtMinion(m, mdps*dt);
  if (d2(h,p) < (h.r+p.r+4)**2 && h.cd3 <= 0){ h.cd3 = 0.7; hurtPlayer(pdmg, h.kind); }
}
// telegraphs: kind 'circle' {x,y,r} | 'line' {x,y,ang,len,w} | 'rect' {x,y,w,h}; fire(m) runs when the timer ends
function mark(o){ const m = Object.assign({t:1, col:'#ff4a3a'}, o); m.max = m.t; (S.marks = S.marks || []).push(m); return m; }
function inMark(o, m, pad){ pad = pad || 0;
  if (m.kind === 'circle'){ const dx = (o.x-m.x)/(m.r+pad), dy = (o.y-m.y)/((m.r+pad)*0.7); return dx*dx + dy*dy < 1; }
  if (m.kind === 'rect') return Math.abs(o.x-m.x) < m.w/2+pad && Math.abs(o.y-m.y) < m.h/2+pad;
  const dx = o.x-m.x, dy = o.y-m.y, c = Math.cos(m.ang), s = Math.sin(m.ang), u = dx*c+dy*s, v = -dx*s+dy*c;
  return u > -pad && u < m.len+pad && Math.abs(v) < m.w/2+pad; }
// hit everything under a telegraph
function slam(m, pdmg, mdmg, src){ const p = S.player;
  if (inMark(p, m, p.r*0.5)) hurtPlayer(pdmg, src);
  for (const mm of S.minions) if (mm.rise <= 0 && inMark(mm, m, mm.r*0.5)) hurtMinion(mm, mdmg); }

function updateBossFx(dt, p){
  if (S.marks){ for (const m of S.marks){ m.t -= dt; if (m.t <= 0 && !m.done){ m.done = true; if (m.fire) m.fire(m); } } S.marks = S.marks.filter(m => !m.done); }
  if (S.logs){   // rolling logs from the Timber Harvester
    for (const l of S.logs){ l.x += l.vx*dt; l.y += l.vy*dt; l.t -= dt; l.rot += dt*12;
      if (d2(l,p) < 18*18 && !l.hit.has(p)){ l.hit.add(p); hurtPlayer(12, 'harvester'); }
      for (const m of S.minions) if (m.rise <= 0 && !l.hit.has(m) && d2(l,m) < (14+m.r)**2){ l.hit.add(m); hurtMinion(m, 28); m.x += l.vx*0.15; m.y += l.vy*0.15; } }
    S.logs = S.logs.filter(l => l.t > 0); }
  if (S.fells){ for (const f of S.fells) f.t -= dt; S.fells = S.fells.filter(f => f.t > 0); }
  if (S.boxes){ for (const b of S.boxes){ b.t -= dt;   // landed containers; some burst open with a fresh crew
      if (b.crew && b.t < 4.2){ b.crew = false; FX.smoke(b.x, b.y, 3, 0.8); for (let i=0;i<3;i++) spawnHuman('docker', b.x+rand(-30,30), b.y+rand(18,30), true); } }
    S.boxes = S.boxes.filter(b => b.t > 0); }
  if (S.devils){   // dust devils: wander after Patient Zero, swallow and fling the horde
    for (const d of S.devils){ d.t -= dt; d.ph += dt*6; const a = angTo(d,p) + Math.sin(d.ph*0.3)*0.9;
      d.x += Math.cos(a)*48*GS*2*dt; d.y += Math.sin(a)*48*GS*2*dt;
      for (const m of S.minions){ if (m.rise > 0) continue; const dd = Math.sqrt(d2(d,m)); if (dd > 60) continue;
        const ta = angTo(d,m) + 1.2; m.x += (Math.cos(ta)*90 - (m.x-d.x)*1.2)*dt; m.y += (Math.sin(ta)*60 - (m.y-d.y)*1.2)*dt; hurtMinion(m, 14*dt); }
      d.hitT = (d.hitT || 0) - dt;
      if (d.hitT <= 0 && d2(d,p) < 36*36){ d.hitT = 0.5; hurtPlayer(7, 'dustheli'); const ta = angTo(d,p) + 1.4; p.x += Math.cos(ta)*14; p.y += Math.sin(ta)*10; }
      if (Math.random() < 0.3) S.parts.push({k:'dirt', x:d.x+rand(-14,14), y:d.y+rand(-6,6), vx:rand(-40,40), vy:rand(-50,-10), t:.5, max:.5, col:'#c8a46a'}); }
    S.devils = S.devils.filter(d => d.t > 0); }
}

// ---------- the bosses ----------
const BOSS_AI = {
  // TIMBER HARVESTER: a saw head that shreds whatever is in front, felled trees across your path, rolling logs
  harvester(h, z, zd, ang, dt, p){
    const pa = angTo(h,p), pd = pd2(h,p); turnTo(h, pa, 1.1, dt); h.turret = h.face;
    const hx = h.x + Math.cos(h.face)*46, hy = h.y + Math.sin(h.face)*32;
    h.sawT = (h.sawT || 0) - dt;
    if (h.sawT <= 0){ h.sawT = 0.15;
      for (const m of S.minions) if (m.rise <= 0 && Math.hypot(m.x-hx, m.y-hy) < 36){ hurtMinion(m, 10); if (Math.random() < 0.4) FX.blood(m.x, m.y, 2, true); }
      if (Math.hypot(p.x-hx, p.y-hy) < 32 && h.cd3 <= 0){ h.cd3 = 0.5; hurtPlayer(9, h.kind); }
      if (Math.random() < 0.5) SFX.at('sawbuzz', hx, hy); }
    if (h.cd2 <= 0){ h.cd2 = 6.5;   // a tree comes down across the player's spot
      const a = rand(0,TAU), L = 260; mark({kind:'line', x:p.x - Math.cos(a)*L/2, y:p.y - Math.sin(a)*L/2, ang:a, len:L, w:30, t:1.4, col:'#e8c030',
        fire: m => { slam(m, 24, 55, h.kind); S.shake = 10; SFX.at('crateBreak', p.x, p.y); (S.fells = S.fells || []).push({x:m.x, y:m.y, ang:m.ang, len:m.len, t:1.2});
          for (let i=0;i<14;i++){ const k = Math.random()*m.len; S.parts.push({k:'dirt', x:m.x+Math.cos(m.ang)*k, y:m.y+Math.sin(m.ang)*k, vx:rand(-40,40), vy:rand(-60,-10), t:.5, max:.5, col:'#3e6e40'}); } } });
      floatText(h.x, h.y-50, 'TIMBER!', '#e8c030'); }
    if (h.cd <= 0){ h.cd = 4.2;   // shoves a pair of logs rolling at you
      for (const s of [-1,1]){ const a = pa + s*0.22; (S.logs = S.logs || []).push({x:hx, y:hy, vx:Math.cos(a)*170*GS*2, vy:Math.sin(a)*170*GS*2, t:2.6, rot:0, hit:new Set()}); }
      SFX.at('crack', hx, hy); }
    ram(h, p, dt, 10, 50);
    return pd > 70 ? [Math.cos(h.face), Math.sin(h.face)] : [Math.cos(h.face)*0.25, Math.sin(h.face)*0.25];
  },
  // THE MOONSHINER: lobs flaming jugs, a double-barrel blast up close, and stops to drink himself back to health
  moonshiner(h, z, zd, ang, dt, p){
    const pa = angTo(h,p), pd = pd2(h,p); h.face = pa; h.turret = pa;
    if (h.drink > 0){ h.drink -= dt; h.hp = Math.min(h.maxHp, h.hp + h.maxHp*0.035*dt);
      if (Math.random() < 0.2) S.parts.push({k:'spark', x:h.x+rand(-6,6), y:h.y-40, vx:rand(-10,10), vy:-30, t:.4, max:.4, col:'#e8e0a0'});
      if (h.hp < h.drinkHp - h.maxHp*0.07){ h.drink = 0; h.stun = 2.4; floatText(h.x, h.y-46, 'SPILLED IT!', '#ffe070'); SFX.at('clang', h.x, h.y); }
      return [0,0]; }
    h.drinks = h.drinks || 0;
    if (h.drinks < 2 && h.hp < h.maxHp*(h.drinks ? 0.3 : 0.6)){ h.drinks++; h.drink = 3.2; h.drinkHp = h.hp; floatText(h.x, h.y-46, 'GLUG GLUG - HIT HIM!', '#ffe070'); return [0,0]; }
    if (h.cd <= 0){ h.cd = 2.8;
      for (let i=0;i<3;i++){ const tx = p.x+rand(-60,60), ty = p.y+rand(-40,40), a = Math.atan2(ty-h.y, tx-h.x), d = Math.hypot(tx-h.x, ty-h.y);
        hfire(h, a, 170, 10, {t:Math.min(2.6, d/170), r:6, shell:true, rad:44, molotov:true, jug:true}); } }
    h.sgT = (h.sgT || 1) - dt;
    if (h.sgT <= 0 && pd < 140){ h.sgT = 3; S.shake = 7; SFX.at('cannon', h.x, h.y);
      for (let i=0;i<8;i++) hfire(h, pa+rand(-.4,.4), 320, 6, {t:0.45});
      for (const m of S.minions) if (pd2(m,h) < 150 && Math.abs(((angTo(h,m)-pa+Math.PI*3)%TAU)-Math.PI) < 0.5){ m.x += Math.cos(pa)*40; m.y += Math.sin(pa)*40; hurtMinion(m, 15); } }
    if (pd < 150) return [-Math.cos(pa)*0.7, -Math.sin(pa)*0.7]; if (pd > 230) return [Math.cos(pa), Math.sin(pa)];
    return [Math.cos(pa+Math.PI/2*h.strafe)*0.5, Math.sin(pa+Math.PI/2*h.strafe)*0.5];
  },
  // FIRE BOMBER (Pine Hollow finale): circles wide, then makes low passes that lay walls of fire; drops smokejumpers
  firebomber(h, z, zd, ang, dt, p){
    if (!h.st){ h.st = 'circle'; h.stT = 4; h.orb = Math.atan2(h.y-p.y, h.x-p.x); }
    if (h.st === 'circle'){ h.orb += dt*0.45; const tx = p.x + Math.cos(h.orb)*300, ty = p.y + Math.sin(h.orb)*210;
      const ox = h.x, oy = h.y; h.x += (tx-h.x)*Math.min(1, dt*1.4); h.y += (ty-h.y)*Math.min(1, dt*1.4); if (Math.hypot(h.x-ox, h.y-oy) > 0.1) h.face = Math.atan2(h.y-oy, h.x-ox);
      if ((h.stT -= dt) <= 0){ h.st = 'pass'; h.stT = 2.4; h.pa = angTo(h,p); h.dropT = 0; h.n = 0; floatText(h.x, h.y-60, 'BOMBS AWAY!', '#ff7a2a'); SFX.at('alarm', h.x, h.y); } }
    else { h.face = h.pa; h.x += Math.cos(h.pa)*260*dt; h.y += Math.sin(h.pa)*260*dt;
      if ((h.dropT -= dt) <= 0){ h.dropT = 0.1; firePatch(h.x+rand(-6,6), h.y+rand(-4,4), 5.5); if (++h.n % 4 === 0) explode(h.x, h.y, 40, 10, 'human', 'fire', h.kind); }
      if ((h.stT -= dt) <= 0){ h.st = 'circle'; h.stT = rand(4,5.5); h.orb = Math.atan2(h.y-p.y, h.x-p.x); } }
    h.drop = (h.drop === undefined ? 9 : h.drop) - dt;
    if (h.drop <= 0){ h.drop = 13; for (let i=0;i<3;i++) spawnHuman(i ? 'smokejumper' : 'poacher', p.x+rand(-200,200), p.y+rand(-150,150), true); floatText(p.x, p.y-60, 'SMOKEJUMPERS!', '#ff7a2a'); }
    return [0,0];
  },
  // THE STACKER (straddle carrier): drops shipping containers on you; some burst open with a crew inside
  stacker(h, z, zd, ang, dt, p){
    const pa = angTo(h,p), pd = pd2(h,p); turnTo(h, pa, 1.0, dt);
    if (h.cd2 <= 0){ h.cd2 = 3.6; const v = rand(0,7)|0, crew = Math.random() < 0.45, tx = p.x + rand(-20,20), ty = p.y + rand(-14,14);
      mark({kind:'rect', x:tx, y:ty, w:124, h:56, t:1.5, col:'#ffb020', box:v,
        fire: m => { slam(m, 26, 90, h.kind); S.shake = 11; SFX.at('boom', m.x, m.y); for (let i=0;i<10;i++) S.parts.push({k:'dirt', x:m.x+rand(-60,60), y:m.y+rand(-28,28), vx:rand(-60,60), vy:rand(-50,-10), t:.5, max:.5, col:'#8a8a92'});
          (S.boxes = S.boxes || []).push({k:'cont', x:m.x, y:m.y+18, v:m.box, t:6, crew}); } });
      SFX.at('clang', h.x, h.y); }
    ram(h, p, dt, 12, 60);
    return pd > 90 ? [Math.cos(h.face), Math.sin(h.face)] : [0,0];
  },
  // THE SMUGGLER: knife fans, smoke-bomb vanishing acts, and decoys that look just like him
  smuggler(h, z, zd, ang, dt, p){
    const pa = angTo(h,p), pd = pd2(h,p); h.face = pa; h.turret = pa;
    if (h.hidden > 0){ h.hidden -= dt;
      if (h.hidden <= 0){ const a = p.face + Math.PI + rand(-.6,.6); h.x = p.x + Math.cos(a)*120; h.y = p.y + Math.sin(a)*90;
        FX.smoke(h.x, h.y, 6, 1.2); floatText(h.x, h.y-46, 'BEHIND YOU', '#c8b8ff'); h.cd = 0.4; }
      return [0,0]; }
    if (h.cd2 <= 0){ h.cd2 = 8.5; FX.smoke(h.x, h.y, 10, 1.6); SFX.at('spore', h.x, h.y); h.hidden = 1.5;
      for (let i=0;i<2;i++) spawnHuman('decoy', h.x+rand(-40,40), h.y+rand(-30,30), true);
      return [0,0]; }
    if (h.cd <= 0){ h.cd = 2.2; for (let i=-2;i<=2;i++) hfire(h, pa + i*0.16, 300, 7, {r:3, knife:true}); SFX.at('lash', h.x, h.y); }
    if (pd < 150) return [-Math.cos(pa), -Math.sin(pa)]; if (pd > 240) return [Math.cos(pa), Math.sin(pa)];
    return [Math.cos(pa+Math.PI/2*h.strafe)*0.7, Math.sin(pa+Math.PI/2*h.strafe)*0.7];
  },
  // HARBOR BLIMP (Docks finale): a searchlight hunts you; stay in it too long and the barrage lands. Depth charges and marines too.
  blimp(h, z, zd, ang, dt, p){
    h.orb = (h.orb === undefined ? 0 : h.orb) + dt*0.2;
    const tx = p.x + Math.cos(h.orb)*110, ty = p.y - 140 + Math.sin(h.orb)*40, ox = h.x;
    h.x += (tx-h.x)*Math.min(1, dt*0.45); h.y += (ty-h.y)*Math.min(1, dt*0.45); h.face = h.x >= ox ? 0 : Math.PI;
    if (h.spx === undefined){ h.spx = p.x; h.spy = p.y; h.lock = 0; }
    const sd = Math.hypot(p.x-h.spx, p.y-h.spy), sk = Math.min(sd, 95*dt); if (sd > 0.1){ h.spx += (p.x-h.spx)/sd*sk; h.spy += (p.y-h.spy)/sd*sk; }
    const lit = inMark(p, {kind:'circle', x:h.spx, y:h.spy, r:46});
    h.lock = clamp(h.lock + (lit ? dt/1.5 : -dt/2), 0, 1);
    S.lights.push({x:h.spx, y:h.spy, r:96, spr:BAND.white, t:0.04, max:0.04, a:0.9});
    if (h.lock >= 1){ h.lock = 0; floatText(p.x, p.y-40, 'TARGET LOCKED', '#ff4a3a'); SFX.play('alarm');
      for (let i=0;i<6;i++) mark({kind:'circle', x:h.spx+rand(-55,55), y:h.spy+rand(-40,40), r:44, t:0.9+i*0.14, fire: m => explode(m.x, m.y, 44, 22, 'human', null, h.kind)}); }
    if (h.cd2 <= 0){ h.cd2 = 3.4; const dx = h.x + rand(-20,20), dy = h.y + 140 + rand(-20,20);
      mark({kind:'circle', x:dx, y:dy, r:58, t:1.3, col:'#ffb020', drum:true, fire: m => { explode(m.x, m.y, 58, 18, 'human', 'fire', h.kind); for (let i=0;i<3;i++) firePatch(m.x+rand(-30,30), m.y+rand(-20,20), 3); } }); }
    h.drop = (h.drop === undefined ? 8 : h.drop) - dt;
    if (h.drop <= 0){ h.drop = 13; for (let i=0;i<3;i++) spawnHuman('marine', h.x+rand(-30,30), h.y+140+rand(-20,20), true); floatText(h.x, h.y+100, 'MARINES!', '#7ad0ff'); }
    return [0,0];
  },
  // THE BEHEMOTH (monster truck): leaps onto you, burnouts that spray gravel, and it runs over anything in the way
  behemoth(h, z, zd, ang, dt, p){
    const pa = angTo(h,p), pd = pd2(h,p);
    if (h.jump){ const J = h.jump; J.t += dt; const k = Math.min(1, J.t/J.max);
      h.x = J.x0 + (J.x1-J.x0)*k; h.y = J.y0 + (J.y1-J.y0)*k; h.z = Math.sin(k*Math.PI)*70;
      if (k >= 1){ h.jump = null; h.z = 0; } return [0,0]; }
    if (h.spin > 0){ h.spin -= dt; h.face += dt*9; h.gT = (h.gT || 0) - dt;
      if (h.gT <= 0){ h.gT = 0.06; hfire(h, h.face + Math.PI, 230, 4, {r:3, gravel:true, t:0.8}); }
      if (Math.random() < 0.6) S.parts.push({k:'dirt', x:h.x+rand(-20,20), y:h.y+rand(-8,8), vx:rand(-60,60), vy:rand(-60,-10), t:.5, max:.5, col:'#b8945c'});
      ram(h, p, dt, 10, 60); return [0,0]; }
    if (h.cd2 <= 0){ h.cd2 = 7; const tx = p.x, ty = p.y;
      h.jump = {t:0, max:1.3, x0:h.x, y0:h.y, x1:tx, y1:ty}; SFX.at('rev', h.x, h.y);
      mark({kind:'circle', x:tx, y:ty, r:84, t:1.3, fire: m => { S.shake = 14; SFX.at('boom', m.x, m.y); S.parts.push({k:'shock', x:m.x, y:m.y, r:6, max:90, t:.4, max2:.4, col:'#e8c890'});
        if (inMark(p, m)) hurtPlayer(22, h.kind);
        for (const mm of S.minions){ if (mm.rise > 0 || !inMark(mm, m, mm.r)) continue; hurtMinion(mm, 45); const a = angTo(m,mm); mm.x += Math.cos(a)*44; mm.y += Math.sin(a)*32; } } });
      return [0,0]; }
    if (h.cd <= 0){ h.cd = 5.5; h.spin = 1.6; SFX.at('rev', h.x, h.y); return [0,0]; }
    turnTo(h, pa, 1.6, dt); ram(h, p, dt, 14, 80);
    return [Math.cos(h.face)*1.2, Math.sin(h.face)*1.2];
  },
  // THE SHERIFF: telegraphed quickdraws, a lasso that drags you in for a point-blank shot, and a posse when wounded
  sheriff(h, z, zd, ang, dt, p){
    const pa = angTo(h,p), pd = pd2(h,p); h.face = h.reel ? angTo(h, h.reel.tg) : pa; h.turret = h.face;
    if (h.reel){ const tg = h.reel.tg; h.reel.t -= dt; const d = Math.max(1, pd2(h,tg));
      if (d > h.r+tg.r+10){ const k = Math.min(d-h.r-tg.r-10, 230*dt); tg.x -= (tg.x-h.x)/d*k; tg.y -= (tg.y-h.y)/d*k; }
      if (h.reel.t <= 0 || (tg !== p && tg.hp <= 0)){ if (tg === p){ for (let i=0;i<3;i++) hfire(h, pa+rand(-.1,.1), 420, 9); SFX.at('snipe', h.x, h.y); } h.reel = null; }
      return [0,0]; }
    h.posse = h.posse || 0;
    if (h.hp < h.maxHp*(h.posse ? 0.33 : 0.66) && h.posse < 2){ h.posse++; banner('POSSE!', 'THE SHERIFF CALLED FOR BACKUP'); SFX.play('alarm');
      for (let i=0;i<4;i++) spawnHuman(i < 3 ? 'deputy' : 'bandit', h.x+rand(-60,60), h.y+rand(-40,40), true); }
    if (h.qd > 0){ h.qd -= dt; return [0,0]; }
    if (h.cd2 <= 0){ h.cd2 = 5.5; h.qd = 1.25; floatText(h.x, h.y-46, 'DRAW!', '#ff4a3a');
      for (const o of [-0.32, 0, 0.32]){ const a = pa + o; mark({kind:'line', x:h.x, y:h.y, ang:a, len:440, w:16, t:1.1,
        fire: () => { if (!h.dead){ hfire(h, a, 760, 18, {r:4}); SFX.at('snipe', h.x, h.y); } } }); }
      return [0,0]; }
    if (h.cd <= 0 && pd < 270){ h.cd = 8; hfire(h, pa, 280, 4, {r:5, harpoon:true, lasso:true, owner:h, t:1}); SFX.at('lash', h.x, h.y); }
    if (pd < 170) return [-Math.cos(pa), -Math.sin(pa)]; if (pd > 250) return [Math.cos(pa), Math.sin(pa)];
    return [Math.cos(pa+Math.PI/2*h.strafe)*0.5, Math.sin(pa+Math.PI/2*h.strafe)*0.5];
  },
  // THE DUST DEVIL (Dead End finale): a gyrocopter that darts and fires homing rockets, whips up a sandstorm and spins off dust devils
  dustdevil(h, z, zd, ang, dt, p){
    if (!h.goal || h.hov <= -99){ const a = rand(0,TAU); h.goal = {x:p.x+Math.cos(a)*180, y:p.y+Math.sin(a)*130}; h.hov = 1.9; h.fired = 0; }
    const d = Math.hypot(h.goal.x-h.x, h.goal.y-h.y);
    if (d > 8){ const k = Math.min(d, 230*dt); h.face = Math.atan2(h.goal.y-h.y, h.goal.x-h.x); h.x += (h.goal.x-h.x)/d*k; h.y += (h.goal.y-h.y)/d*k; }
    else { h.hov -= dt; h.face = angTo(h,p);
      if (h.fired < 2 && h.hov < 1.6 - h.fired*0.6){ h.fired++; hfire(h, angTo(h,p) + rand(-.5,.5), 150, 14, {r:5, rocket:true, t:3}); SFX.at('cannon', h.x, h.y); }
      if (h.hov <= 0) h.hov = -100; }
    if (h.cd2 <= 0){ h.cd2 = 7; if (!S.devils || S.devils.length < 3){ (S.devils = S.devils || []).push({x:h.x, y:h.y+60, t:16, ph:rand(0,10)}); floatText(h.x, h.y, 'DUST DEVIL!', '#e8c890'); } }
    h.drop = (h.drop === undefined ? 10 : h.drop) - dt;
    if (h.drop <= 0){ h.drop = 14; for (let i=0;i<2;i++) spawnHuman('biker', p.x+rand(-220,220), p.y+rand(-160,160), true); }
    return [0,0];
  },
};

// ---------- boss definitions (replace the reskins in VARIANTS) ----------
Object.assign(VARIANTS, {
  harvester:  {base:'apc', ai:'harvester', n:'TIMBER HARVESTER', intro:['TIMBER HARVESTER','STAY OUT OF FRONT OF THE SAW'], hp:1700, sp:42, r:30, draw:h => drawHarvester(h)},
  hermit:     {base:'jugg', ai:'moonshiner', n:'THE MOONSHINER', intro:['THE MOONSHINER','HIT HIM WHILE HE DRINKS'], hp:1300, sp:50,
    look:{shirt:'#7a3a2a', pants:'#3a4a6a', skin:'#c89a70', hair:'#d8d8d0', style:1, plaid:true, gear:'hat', hat:'#4a3a2a', weapon:'rifle'}},
  rangerheli: {base:'heli', ai:'firebomber', n:'FIRE BOMBER', intro:['FIRE BOMBER INBOUND','DOWN IT TO TAKE THE WOODS'], hp:3000, draw:h => drawPlane(h)},
  straddle:   {base:'apc', ai:'stacker', n:'THE STACKER', intro:['THE STACKER','WATCH FOR FALLING CONTAINERS'], hp:1800, sp:48, r:32, draw:h => drawStacker(h)},
  deconlead:  {base:'jugg', ai:'smuggler', n:'THE SMUGGLER', intro:['THE SMUGGLER','NOW YOU SEE HIM...'], hp:1150, sp:70,
    look:{shirt:'#2a2a30', pants:'#2a2a30', skin:'#b9825a', gear:'beanie', hat:'#a83a2a', bandana:'#2a2a30', weapon:'pistol', vest:true, vestCol:'#4a3a2a'}},
  coastheli:  {base:'heli', ai:'blimp', n:'HARBOR BLIMP', intro:['HARBOR BLIMP INBOUND','STAY OUT OF THE SEARCHLIGHT'], hp:3600, draw:h => drawBlimp(h)},
  scraprig:   {base:'apc', ai:'behemoth', n:'THE BEHEMOTH', intro:['THE BEHEMOTH','IT JUMPS'], hp:1700, sp:62, r:30, draw:h => drawTruck(h)},
  sheriff:    {base:'jugg', ai:'sheriff', n:'THE SHERIFF', intro:['THE SHERIFF','DODGE THE DRAW'], hp:1300, sp:50,
    look:{shirt:'#c8a870', pants:'#4a3a2a', skin:'#dda77c', gear:'cowboy', hat:'#e8e0d0', badge:true, weapon:'pistol', vest:true, vestCol:'#7a5a3a'}},
  dustheli:   {base:'heli', ai:'dustdevil', n:'THE DUST DEVIL', intro:['THE DUST DEVIL INBOUND','A SANDSTORM ROLLS IN'], hp:2900, storm:true, draw:h => drawGyro(h)},
  // the Smuggler's decoys: identical at a glance, fragile, and they vanish in smoke
  decoy:      {base:'cop', n:'THE SMUGGLER?', hp:55, xp:1, sp:70, poof:true, big:true, noElite:true, bdmg:4, range:200},
});
for (const k of ['hermit','deconlead','sheriff']) BOSS_LOOKS[k] = Object.assign(variantLook(VARIANTS[k]), {pose:'aim'});
LOOKS.decoy = [BOSS_LOOKS.deconlead];
for (const k of ['harvester','rangerheli','straddle','coastheli','scraprig','dustheli']) delete BOSS_LOOKS[k];

// ---------- art ----------
const SAW_SPOKES = (g, x, y, r, t) => { g.fillStyle = '#d8d8e0'; for (let i=0;i<6;i++){ const a = t*14 + i/6*TAU; g.fillRect(Math.round(x+Math.cos(a)*r), Math.round(y+Math.sin(a)*r*0.8), 2, 2); } };
const HARV_S = () => propSprite('harvS', () => propCanvas(84,48,(P,g) => {
  P(6,36,46,10,'#1e1c20'); for (let x=8;x<50;x+=5) P(x,38,3,6,'#3a3a42');                    // tracks
  P(6,20,46,16,'#d8a020'); P(6,20,46,2,'#f0c848'); P(6,34,46,2,'#8a6410');                   // body
  P(10,6,18,15,'#d8a020'); P(12,8,14,9,'#2a3a48'); P(13,9,5,3,'#6a8aa4'); P(10,6,18,2,'#f0c848'); // cab
  P(32,14,10,6,'#5a5a62'); P(40,16,26,4,'#d8a020'); P(40,16,26,1,'#f0c848'); P(64,14,4,10,'#5a5a62'); // boom
  pell(g,72,24,10,10,'#5a5a62'); pell(g,72,24,8,8,'#9a9aa2'); pell(g,72,24,3,3,'#3a3a42');    // saw disc
  for (let i=0;i<12;i++){ const a = i/12*TAU; P(Math.round(72+Math.cos(a)*11), Math.round(24+Math.sin(a)*11), 1, 1, '#e8e8f0'); }
  P(8,24,8,2,'#2a2a2a'); P(30,26,16,2,'#2a2a2a');
}));
const HARV_F = back => propSprite('harvF'+(back?1:0), () => propCanvas(52,56,(P,g) => {
  P(2,40,10,14,'#1e1c20'); P(40,40,10,14,'#1e1c20'); P(8,22,36,22,'#d8a020'); P(8,22,36,2,'#f0c848'); P(8,42,36,2,'#8a6410');
  P(14,8,24,15,'#d8a020'); P(16,10,20,9, back ? '#3a3020' : '#2a3a48'); if (!back) P(17,11,6,3,'#6a8aa4');
  if (!back){ pell(g,26,36,14,12,'#5a5a62'); pell(g,26,36,11,9,'#9a9aa2'); pell(g,26,36,3,3,'#3a3a42'); }
}));
function drawHarvester(h){
  const d = dirOf(h.face), x = sx(h.x), y = sy(h.y) + 10, fl = h.flash > 0;
  let s = d >= 2 ? HARV_S() : HARV_F(d === 1); if (fl) s = propSprite('harvW'+(d>=2?'s':d), () => tinted(s, '#ffffff'));
  lg.fillStyle = 'rgba(12,6,18,.35)'; pell(lg, x, y-2, 36, 6);
  if (d === 3){ lg.save(); lg.translate(x,0); lg.scale(-1,1); lg.drawImage(s, -42, y-s.height); SAW_SPOKES(lg, 30, y-s.height+24, 6, S.t); lg.restore(); }
  else if (d === 2){ lg.drawImage(s, x-42, y-s.height); SAW_SPOKES(lg, x+30, y-s.height+24, 6, S.t); }
  else { lg.drawImage(s, x-26, y-s.height); if (d === 0) SAW_SPOKES(lg, x, y-s.height+36, 7, S.t); }
  if (Math.random() < 0.3) FX.smoke(h.x - Math.cos(h.face)*20, h.y - 70, 1, 0.6);
}
const STACK_S = () => propSprite('stackS', () => propCanvas(80,74,(P) => {
  for (const x of [6,64]){ P(x,10,8,56,'#e8a020'); P(x,10,2,56,'#f8c850'); P(x+6,10,2,56,'#a06810'); P(x-2,62,12,10,'#1e1c20'); P(x,64,8,6,'#5a5a62'); }
  P(6,4,66,8,'#e8a020'); P(6,4,66,2,'#f8c850'); P(30,0,20,6,'#2a3a48'); P(32,1,6,2,'#6a8aa4');   // top beam + cab
  P(16,12,1,22,'#2a2a2a'); P(62,12,1,22,'#2a2a2a');                                             // cables
}));
const STACK_F = () => propSprite('stackF', () => propCanvas(56,74,(P) => {
  for (const x of [4,44]){ P(x,10,8,56,'#e8a020'); P(x,10,2,56,'#f8c850'); P(x-1,62,10,10,'#1e1c20'); }
  P(4,4,48,8,'#e8a020'); P(4,4,48,2,'#f8c850'); P(18,0,20,6,'#2a3a48'); P(20,1,6,2,'#6a8aa4'); P(16,12,1,22,'#2a2a2a'); P(39,12,1,22,'#2a2a2a');
}));
function drawStacker(h){
  const d = dirOf(h.face), x = sx(h.x), y = sy(h.y) + 10, fl = h.flash > 0, side = d >= 2;
  let s = side ? STACK_S() : STACK_F(); if (fl) s = propSprite('stackW'+(side?1:0), () => tinted(s, '#ffffff'));
  lg.fillStyle = 'rgba(12,6,18,.35)'; pell(lg, x, y-2, side ? 38 : 26, 6);
  const c = SPRV.cont(h.cargo === undefined ? (h.cargo = rand(0,7)|0) : h.cargo);   // the container it is carrying
  if (side) lg.drawImage(c, x-32, y-s.height+30); else lg.drawImage(c, x-32, y-s.height+30, 64, 32);
  lg.drawImage(s, x - (s.width>>1), y - s.height);
}
const TRUCK_S = () => propSprite('truckS', () => propCanvas(70,50,(P,g) => {
  for (const wx of [14,54]){ pell(g,wx,38,11,10,'#18161c'); pell(g,wx,38,5,5,'#7a7a82'); for (let i=0;i<8;i++){ const a = i/8*TAU; P(Math.round(wx+Math.cos(a)*10), Math.round(38+Math.sin(a)*9), 2, 2, '#2a2a30'); } }
  P(6,16,58,12,'#b03a2a'); P(6,16,58,2,'#d85a3a'); P(6,26,58,2,'#6a1a10');
  P(22,4,24,13,'#b03a2a'); P(24,6,20,8,'#2a3a48'); P(25,7,6,2,'#6a8aa4'); P(22,4,24,2,'#d85a3a');
  P(8,18,10,2,'#e8c050'); P(50,18,10,2,'#e8c050'); P(62,18,2,3,'#fff2b0'); P(4,8,3,10,'#5a5a62'); P(4,6,5,2,'#3a3a42');
  P(30,20,12,3,'#e8e0c0'); P(32,21,2,1,'#2a2a2a'); P(37,21,2,1,'#2a2a2a');   // skull decal
}));
const TRUCK_F = back => propSprite('truckF'+(back?1:0), () => propCanvas(56,52,(P,g) => {
  for (const wx of [2,42]){ P(wx,30,12,20,'#18161c'); P(wx+3,34,6,10,'#3a3a42'); }
  P(10,18,36,14,'#b03a2a'); P(10,18,36,2,'#d85a3a'); P(14,6,28,13,'#b03a2a'); P(16,8,24,9, back ? '#3a2020' : '#2a3a48');
  if (!back){ P(17,9,6,2,'#6a8aa4'); P(12,24,6,3,'#fff2b0'); P(38,24,6,3,'#fff2b0'); P(20,26,16,4,'#5a5a62'); for (let x=21;x<36;x+=3) P(x,26,1,4,'#2a2a30'); }
  else { P(12,24,6,3,'#d02020'); P(38,24,6,3,'#d02020'); }
}));
function drawTruck(h){
  const d = dirOf(h.face), x = sx(h.x), y = sy(h.y) + 10, fl = h.flash > 0, z = Math.round((h.z || 0)/2);
  let s = d >= 2 ? TRUCK_S() : TRUCK_F(d === 1); if (fl) s = propSprite('truckW'+(d>=2?'s':d), () => tinted(s, '#ffffff'));
  lg.fillStyle = 'rgba(12,6,18,.35)'; pell(lg, x, y-2, Math.max(14, 34 - z/2), Math.max(3, 6 - z/8));
  if (d === 3){ lg.save(); lg.translate(x,0); lg.scale(-1,1); lg.drawImage(s, -35, y-s.height-z); lg.restore(); }
  else lg.drawImage(s, x-(s.width>>1), y-s.height-z);
}
const PLANE = (() => propCanvas(96,34,(P) => {
  P(2,6,8,12,'#c82a2a'); P(2,6,8,2,'#e84a4a');                                            // tail fin
  P(8,14,70,10,'#e8c030'); P(8,14,70,2,'#f8e070'); P(8,22,70,2,'#a88410');                // fuselage
  P(76,15,10,8,'#e8c030'); P(84,17,4,4,'#c82a2a');                                         // nose
  P(66,12,10,4,'#5aa0c8'); P(67,12,4,1,'#c8ecff');                                          // cockpit
  P(30,10,40,4,'#c82a2a'); P(30,10,40,1,'#e84a4a');                                         // wing
  for (const x of [40,58]){ P(x,6,6,6,'#3a3a42'); }                                          // engines
  P(14,18,60,1,'#c82a2a'); P(34,24,24,5,'#c82a2a'); P(36,28,20,1,'#801a1a');                // stripe + water tank
  P(18,12,8,2,'#a88410');
}))();
const PLANE_W = tinted(PLANE, '#ffffff');
function drawAir(h, spr, sprW, w, alt, rotor){
  const x = sx(h.x), y = sy(h.y), flip = Math.cos(h.face) < 0, bob = Math.round(Math.sin(S.t*3)*1.5), s = h.flash > 0 ? sprW : spr;
  lg.fillStyle = 'rgba(12,6,18,.28)'; pell(lg, x, y, w*0.4, 4);
  lg.save(); lg.translate(x, 0); if (flip) lg.scale(-1,1); lg.drawImage(s, -(s.width>>1), y - alt - (s.height>>1) + bob); if (rotor) rotor(y - alt + bob, s); lg.restore();
  if (h.hp < h.maxHp*0.5 && Math.random() < 0.35) FX.smoke(h.x + rand(-20,20), h.y - alt*2, 1, 1);
}
function drawPlane(h){ drawAir(h, PLANE, PLANE_W, 96, 52, (yy) => { const f = (S.t*30|0)%2; lg.fillStyle = '#1a1c20';
  for (const ex of [-5, 13]) lg.fillRect(ex, yy - 12 + (f ? 0 : 2), 1, f ? 8 : 4); }); }
const BLIMP = (() => propCanvas(120,56,(P,g) => {
  pell(g,58,22,52,18,'#8a8e96'); pell(g,58,20,50,15,'#a8acb4'); pell(g,52,14,36,6,'#c8ccd4');   // envelope
  P(8,20,100,4,'#c82a2a'); P(2,10,10,8,'#8a8e96'); P(2,26,10,8,'#8a8e96'); P(2,10,10,2,'#c82a2a');   // stripe + fins
  P(46,40,26,10,'#4a4e56'); P(46,40,26,2,'#6a6e76'); P(50,43,4,3,'#ffe6a0'); P(58,43,4,3,'#ffe6a0'); P(66,43,4,3,'#ffe6a0');   // gondola
  P(50,36,1,5,'#2a2a30'); P(68,36,1,5,'#2a2a30'); P(58,50,6,4,'#f8f4d8');                    // struts + searchlight
  for (let i=0;i<5;i++) P(30+i*14,28,8,2,'#e8e8f0');                                          // lettering
}))();
const BLIMP_W = tinted(BLIMP, '#ffffff');
function drawBlimp(h){
  const x = sx(h.x), y = sy(h.y), alt = 72, bob = Math.round(Math.sin(S.t*1.5)*2), lx = sx(h.spx), ly = sy(h.spy);
  lg.globalCompositeOperation = 'lighter'; lg.globalAlpha = 0.12; lg.fillStyle = '#fff4c0';   // searchlight beam
  lg.beginPath(); lg.moveTo(x-2, y-alt+24+bob); lg.lineTo(x+4, y-alt+24+bob); lg.lineTo(lx+24, ly); lg.lineTo(lx-24, ly); lg.closePath(); lg.fill();
  lg.globalAlpha = 1; lg.globalCompositeOperation = 'source-over';
  drawAir(h, BLIMP, BLIMP_W, 110, alt, (yy) => { const f = (S.t*20|0)%2; lg.fillStyle = '#2a2a30'; lg.fillRect(-58, yy - 4 + (f?0:3), 2, f ? 8 : 3); });
}
const GYRO = (() => propCanvas(62,36,(P) => {
  P(6,18,10,3,'#5a4a3a'); P(2,12,6,10,'#a88a5a'); P(2,12,6,2,'#c8a870');                      // tail boom + fin
  P(16,16,30,10,'#a88a5a'); P(16,16,30,2,'#c8a870'); P(16,24,30,2,'#6a5a3a');                // pod
  P(36,12,10,6,'#5aa0c8'); P(37,12,4,1,'#c8ecff'); P(44,18,8,6,'#a88a5a');                    // canopy + nose
  P(28,6,2,10,'#3a3a42'); P(24,30,22,2,'#2a2a30'); P(26,26,2,4,'#2a2a30'); P(42,26,2,4,'#2a2a30');   // mast + skids
  P(20,26,6,4,'#5a5a62'); P(46,26,6,3,'#c83a2a');                                              // rocket pods
}))();
const GYRO_W = tinted(GYRO, '#ffffff');
function drawGyro(h){ drawAir(h, GYRO, GYRO_W, 60, 46, (yy) => { const f = (S.t*26|0)%3, bl = [32, 18, 6][f];
  lg.fillStyle = '#1a1c20'; lg.fillRect(-1 - bl, yy - 17, bl*2, 2); lg.fillStyle = '#5a5e66'; if (f !== 2) lg.fillRect(-30, yy - 4 + (f ? 2 : -2), 2, 6); }); }

// ground layer: telegraphs, rolling logs, felled trees, the blimp's spotlight
function drawBossGround(){
  for (const m of S.marks || []){ const k = 1 - m.t/m.max, on = k > 0.7 ? (S.t*16|0)%2 : 1; lg.fillStyle = m.col; lg.globalAlpha = 0.35 + 0.5*k*on;
    if (m.kind === 'circle'){ const x = sx(m.x), y = sy(m.y), r = m.r/2, n = Math.max(16, r*3|0);
      for (let i=0;i<n;i++){ const a = i/n*TAU; lg.fillRect(Math.round(x+Math.cos(a)*r), Math.round(y+Math.sin(a)*r*0.7), 1, 1); }
      lg.globalAlpha = 0.15 + 0.2*k; pell(lg, x, y, r*k, r*k*0.7); }
    else if (m.kind === 'rect'){ const x = sx(m.x - m.w/2), y = sy(m.y - m.h/2), w = m.w/2, hh = m.h/2;
      lg.fillRect(x, y, w, 1); lg.fillRect(x, y+hh, w, 1); lg.fillRect(x, y, 1, hh); lg.fillRect(x+w, y, 1, hh+1);
      lg.globalAlpha = 0.12 + 0.25*k; lg.fillStyle = '#0a0610'; lg.fillRect(x+1, y+1, w-1, hh-1); }
    else { const x1 = sx(m.x), y1 = sy(m.y), c = Math.cos(m.ang), s = Math.sin(m.ang), n = m.len/2|0, hw = m.w/4;
      for (let i=0;i<n;i+=2) for (const o of [-hw, hw]) lg.fillRect(Math.round(x1 + c*i - s*o), Math.round(y1 + s*i + c*o), 1, 1);
      lg.globalAlpha = 0.12 + 0.2*k; for (let i=0;i<n;i++) lg.fillRect(Math.round(x1 + c*i), Math.round(y1 + s*i), 1, 1); }
    lg.globalAlpha = 1; }
  for (const f of S.fells || []){ const a = Math.min(1, f.t/0.4), x1 = sx(f.x), y1 = sy(f.y), c = Math.cos(f.ang), s = Math.sin(f.ang), n = f.len/2|0;   // the felled tree
    lg.globalAlpha = a; for (let i=0;i<n;i++){ const x = Math.round(x1+c*i), y = Math.round(y1+s*i); lg.fillStyle = '#4a3020'; lg.fillRect(x, y-3, 1, 4);
      if (i > n*0.35 && i % 3 === 0){ lg.fillStyle = i % 2 ? '#2c5434' : '#1e3a26'; lg.fillRect(x-2, y-6, 4, 4); } } lg.globalAlpha = 1; }
  for (const l of S.logs || []){ const s = SPR.log(), x = sx(l.x), y = sy(l.y) + ((l.rot|0) % 2);
    lg.fillStyle = 'rgba(12,6,18,.35)'; pell(lg, x, y, 15, 3); lg.drawImage(s, x - (s.width>>1), y - s.height + 1); }
  for (const h of S.humans) if (h.V && h.V.ai === 'blimp' && h.spx !== undefined){ const x = sx(h.spx), y = sy(h.spy), r = 23;
    lg.globalCompositeOperation = 'lighter'; band(lg, BAND.white, x, y, r+4, 0.25); lg.globalCompositeOperation = 'source-over'; lg.globalAlpha = 1;
    lg.fillStyle = h.lock > 0.6 && (S.t*12|0)%2 ? '#ff4a3a' : '#fff4c0'; const n = 40, lk = Math.round(n*h.lock);
    for (let i=0;i<n;i++){ if (i > lk && i % 2) continue; const a = -Math.PI/2 + i/n*TAU; lg.fillRect(Math.round(x+Math.cos(a)*r), Math.round(y+Math.sin(a)*r*0.7), 1, 1); } }
}
// drawn above the sprites: falling containers, dust devils
function drawBossAbove(){
  for (const m of S.marks || []) if (m.box !== undefined && m.t < 0.35){ const s = SPRV.cont(m.box), drop = Math.round(m.t/0.35*120);
    lg.drawImage(s, sx(m.x) - (s.width>>1), sy(m.y) + 9 - s.height - drop); }
  for (const m of S.marks || []) if (m.drum && m.t < 0.5){ const drop = Math.round(m.t/0.5*90), x = sx(m.x), y = sy(m.y) - drop;
    lg.fillStyle = '#170d1c'; lg.fillRect(x-4, y-10, 9, 10); lg.fillStyle = '#b01e28'; lg.fillRect(x-3, y-9, 7, 8); }
  for (const d of S.devils || []){ const x = sx(d.x), y = sy(d.y), fade = Math.min(1, d.t/1.5);
    lg.globalAlpha = 0.95*fade; lg.fillStyle = 'rgba(12,6,18,.35)'; pell(lg, x, y, 12, 4);
    for (let i=0;i<80;i++){ const hgt = i/80, a = d.ph*2.2 + i*0.7, r = 3 + hgt*15; lg.fillStyle = i % 4 === 0 ? '#8a6a3a' : i % 3 ? '#c8a46a' : '#f0d8a0';
      lg.fillRect(Math.round(x + Math.cos(a)*r), Math.round(y - hgt*50 + Math.sin(a)*r*0.3), 3, 2); }
    lg.globalAlpha = 1; }
}
// full-screen: the Dust Devil's sandstorm
function drawBossOverlay(){
  if (!S || !S.humans.some(h => !h.dead && h.V && h.V.storm)) return;
  lg.fillStyle = 'rgba(170,120,60,.32)'; lg.fillRect(0, 0, LW, LH);
  lg.fillStyle = 'rgba(240,210,150,.55)';
  for (let i=0;i<140;i++){ const y = (i*37 + (S.t*20|0)) % LH, x = ((i*97) + S.t*260) % (LW+40) - 20; lg.fillRect(x|0, y, 6 + (i%4)*3, 1); }
}
