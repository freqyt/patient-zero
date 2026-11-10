"use strict";

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
  const p = S.player; stat('items', it.k, 1); seen('i', it.k);
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
  if (evos.length){ const b = pick(evos); S.evo[b] = true; seen('v', b); S.gotAt['evo:'+b] = S.t; S.pendingLv += 2; msg = 'FREE EVOLUTION: ' + EVOS[b].n.toUpperCase(); }
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
