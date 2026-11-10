"use strict";
// ---------- human & horde AI (called every frame from update) ----------
function updateHumans(dt, p, nt){
  const viewR = Math.hypot(VW,VH)/2;
  // humans move at half pace, creeping up to +25% faster by the end of the run
  const hsp = GS * (1 + 0.25*Math.min(S.t, GAME_LEN)/GAME_LEN) * (1 + 0.04*curse()) * S.H.speed;
  for (const h of S.humans){
    if (h.dead) continue;
    const fz = h.elite==='frenzied' ? 1.8 : 1; h.flash -= dt; h.cd -= dt*0.75*fz; h.cd2 -= dt*0.75*fz; h.cd3 -= dt;
    if (h.elite==='regen') h.hp = Math.min(h.maxHp, h.hp + h.maxHp*0.03*dt);
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
          if (z===p) hurtPlayer(6*(h.dmgMul||1), 'beat'); else { hurtMinion(z, 10); z.x += Math.cos(ang)*6; z.y += Math.sin(ang)*6; } }
        break;
      case 'riot':
        h.face = ang; vx = Math.cos(ang); vy = Math.sin(ang);
        if (zd < h.r+z.r+4 && h.cd<=0){ h.cd = 0.9;
          if (z===p) hurtPlayer(10*(h.dmgMul||1), 'riot'); else { hurtMinion(z, 14); z.x += Math.cos(ang)*12; z.y += Math.sin(ang)*12; } }
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
        if (h.cd2<=0){ h.cd2 = 3; h.recoil = 1; const pd2 = Math.sqrt(d2(h,p)); hfire(h, pa, 200, 22, {t:Math.min(2.5,pd2/200), r:7, shell:true}); }
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
            hfire(h, a, 200, 18, {t:Math.min(3, d/200), r:7, shell:true}); } }
        h.drop = (h.drop === undefined ? 8 : h.drop) - dt;
        if (h.drop <= 0){ h.drop = 14; for (let i=0;i<2;i++) spawnHuman('soldier', h.x+rand(-20,20), h.y+rand(-10,10)); }
        break; }
    }
    h.x += vx*sp*hsp*dt; h.y += vy*sp*hsp*dt;
  }

}

function updateMinions(dt, p, nt){
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
    if (dl > 4 && !holdRange){ const s = Math.min(spd*dt, dl); m.x += dx/dl*s; m.y += dy/dl*s; m.face = Math.atan2(dy,dx); }
    let md = HORDE_DMG*V.dmg*am*(1+0.4*nt); if (HS.crit && Math.random() < HS.crit + 0.03*luck()) md *= 2;
    if (HS.ranged && m.target && dl < 140 && dl > m.r + m.target.r + 5 && m.atkCd <= 0){ m.atkCd = 1.1; m.face = Math.atan2(dy,dx);
      S.pb.push({x:m.x, y:m.y, vx:dx/dl*230*GS, vy:dy/dl*230*GS, dmg:md*0.8, t:1.4/GS, r:4, pierce:1, hit:new Set(), k:'hbone'}); }
    else if (m.target && dl < m.r + m.target.r + 5 && m.atkCd <= 0){ m.atkCd = 0.7;
      dmgHuman(m.target, md, m.husk ? 'bloom' : 'minion'); if (L('leech')) heal(md*0.012*L('leech'), 'leech');
      if (HS.lifesteal) m.hp = Math.min(m.maxHp, m.hp + md*HS.lifesteal); }
  });
  S.minions = S.minions.filter(m => m.hp > 0);
  S.maxHorde = Math.max(S.maxHorde, S.minions.length);

}
