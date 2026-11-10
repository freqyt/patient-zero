"use strict";

// ---------- item pickups ----------
function itemSpr(rows, pal){ const c = mk(rows[0].length+2, rows.length+2); c.getContext('2d').drawImage(pixIcon(rows, pal), 1, 1); return outline(c); }
function rot90(c, dir){ const o = mk(c.height, c.width), g = o.getContext('2d');
  g.translate(o.width/2, o.height/2); g.rotate(dir*Math.PI/2); g.drawImage(c, -c.width/2, -c.height/2); return o; }
const SAW_PAL = {F:'#5a2a2a', M:'#c06060', L:'#e89090', B:'#ece4c8', K:'#8a8070', W:'#fff4c0'};
// Bone Gatling: a fleshy grip feeding a bundle of bone barrels; frames swap barrel shading to "spin"
const SAW_ROWS = f => {
  const rows = ['..FFFF..........', '.FMMMMFBBBBBBBB.', 'FMLMMFKKKKKKKKKW', 'FMMMMFBBBBBBBBB.', 'FMMMMFKKKKKKKKKW', '.FMMFFBBBBBBBBB.', '..FF............'];
  return f ? rows.map(r => r.replace(/[BK]/g, ch => ch === 'B' ? 'K' : 'B')) : rows;
};
const SAWF = [0,1].map(f => itemSpr(SAW_ROWS(f), SAW_PAL));
const SAWD = SAWF.map(c => rot90(c, 1)), SAWU = SAWF.map(c => rot90(c, -1));
const ITEM_SPR = {
  heart: itemSpr([
    '...VV.A....',
    '.RRR.V.RRR.',
    'RLLRR.RRRRD',
    'RLRRRRRRRRD',
    'RRRRRRRRRRD',
    '.RRRRRRRRD.',
    '..RRRRRRD..',
    '...RRRRD...',
    '....RRD....',
    '.....D.....'], {R:'#c81c34', L:'#ff7a8a', D:'#801020', V:'#7a5ab0', A:'#d84a5a'}),
  magnet: itemSpr([
    '..RRRRRRR..',
    '.RRLLLLLRR.',
    'RRL.....RRD',
    'RL.......RD',
    'RL.......RD',
    'RL.......RD',
    'RL.......RD',
    'SW.......SD',
    'SW.......SD',
    'SS.......SD'], {R:'#d82838', L:'#ff7080', D:'#8a1420', S:'#c8ccd4', W:'#ffffff'}),
  saw: SAWF[0],
  chest: itemSpr([
    '..GGGGGGGGGGGG..',
    '.GYYYYYYYYYYYYG.',
    'GYLLLLLLLLLLLLYG',
    'GYYYYYYYYYYYYYYG',
    'GBBBBBBKKBBBBBBG',
    'GWWWWWWKKWWWWWWG',
    'GBBBBBBYYBBBBBBG',
    'GBRBBBBYYBBBBRBG',
    'GBBBBBBBBBBBBBBG',
    'GBRBBBBBBBBBBRBG',
    'GBBBBBBBBBBBBBBG',
    '.GGGGGGGGGGGGGG.'], {G:'#a87a18', Y:'#e8c040', L:'#fff0a0', B:'#6a3e1a', W:'#8a5a2a', K:'#2a1a0a', R:'#c8a050'}),
  clover: itemSpr([
    '..LL...LL..',
    '.LGGL.LGGL.',
    '.LGGGLGGGL.',
    '..LGGDGGL..',
    '.LLGDDDGLL.',
    'LGGGDDDGGGL',
    'LGGGLDLGGGL',
    '.LGGL.LGGL.',
    '..LL.S.LL..',
    '.....S.....',
    '....S......'], {L:'#2e7a1e', G:'#5ad03a', D:'#9aff6a', S:'#6a5a2a'}),
  dice: itemSpr([
    '.WWWWWWW.',
    'WWWWWWWWS',
    'WKWWWWKWS',
    'WWWWWWWWS',
    'WWWWKWWWS',
    'WWWWWWWWS',
    'WKWWWWKWS',
    'WWWWWWWWS',
    '.SSSSSSS.'], {W:'#f0ecf4', S:'#a8a0b8', K:'#c81c34'}),
  bomb: itemSpr([
    '.CCCCCCCCC.',
    'YYYYYYYYYYY',
    'YLYYYKYYYYD',
    'YLYYKKKYYYD',
    'YLYKYKYKYYD',
    'YLKKYYYKKYD',
    'YLYYYKYYYYD',
    'YLYYYYYYYYD',
    'YYYYYYYYYYD',
    '.CCCCCCCCC.',
    '..GG...G...'], {C:'#8a8e96', Y:'#e8c830', L:'#fff080', D:'#a08010', K:'#1a1a1a', G:'#8ae03a'}),
};
const ITEM_COL = {clover:'#7aff7a', chest:'#ffe070', heart:'#ff6a7a', magnet:'#ff9ccc', saw:'#ffb040', bomb:'#9be03a', dice:'#c8d8ff'};
const ITEM_BAND = {clover:'toxic', chest:'yellow', heart:'red', magnet:'pink', saw:'orange', bomb:'toxic', dice:'blue'};
function drawItem(it){
  if (it.k==='chest' && Math.random() < 0.3) S.parts.push({k:'spark', x:it.x+rand(-14,14), y:it.y-rand(0,10), vx:0, vy:-40, t:.4, max:.4, col:'#ffe070'});
  const s = ITEM_SPR[it.k], x = sx(it.x), y = sy(it.y), bob = Math.round(Math.sin(S.t*4 + it.seed*6)*1.5) - (it.pop > 0 ? Math.round(Math.sin(it.pop/0.4*Math.PI)*14) : 0);
  // pulsing pixel ring on the ground so pickups read at a glance
  const pr = 8 + ((S.t*10 + it.seed*10) % 4 | 0), n = 22;
  lg.fillStyle = ITEM_COL[it.k];
  for (let i=0;i<n;i++){ const a = i/n*TAU + S.t; if (i%2) continue; lg.fillRect(Math.round(x+Math.cos(a)*pr), Math.round(y+Math.sin(a)*pr*0.45), 1, 1); }
  lg.fillStyle = 'rgba(12,6,18,.4)'; pell(lg, x, y, 5, 2);
  lg.drawImage(s, x - (s.width>>1), y - s.height - 4 + bob);
}
function drawSaw(pl){
  const d = dirOf(pl.face), f = (S.t*30|0)%2, x = sx(pl.x), y = sy(pl.y) - 12;
  if (d===2) lg.drawImage(SAWF[f], x+1, y-4);
  else if (d===3){ lg.save(); lg.translate(x,0); lg.scale(-1,1); lg.drawImage(SAWF[f], 1, y-4); lg.restore(); }
  else if (d===0){ const v = SAWD[f]; lg.drawImage(v, x - (v.width>>1) + 3, y - 2); }
  else { const v = SAWU[f]; lg.drawImage(v, x - (v.width>>1) + 3, y - 18); }
}

// ---------- loot crates ----------
function crateSpr(stage){ return propCanvas(22,24,(P) => {
  P(2,2,18,7,'#b88a50'); P(2,2,18,1,'#dcb078'); P(2,4,18,1,'#8a6436'); P(2,6,18,1,'#8a6436');      // lid planks
  P(2,9,18,13,'#9a6e3c'); P(2,9,18,1,'#5e4020'); P(2,21,18,1,'#4e3418');                            // front face
  P(8,10,1,11,'#7a5630'); P(14,10,1,11,'#7a5630');
  for (let i=0;i<11;i++){ P(3+Math.round(i*1.45),10+i,2,1,'#c8a068'); P(17-Math.round(i*1.45),10+i,2,1,'#c8a068'); }  // X brace
  for (const [x,y] of [[2,9],[18,9],[2,20],[18,20]]) P(x,y,2,2,'#8a8e96');                            // iron corners
  P(10,12,2,4,'#ffd860'); P(10,17,2,1,'#ffd860');                                                     // stencilled "!"
  if (stage >= 1){ P(5,11,1,3,'#3a2410'); P(6,14,1,2,'#3a2410'); P(13,3,3,1,'#3a2410'); }
  if (stage >= 2){ P(12,13,1,4,'#3a2410'); P(13,16,2,1,'#3a2410'); P(4,5,4,1,'#3a2410'); P(16,17,1,3,'#3a2410'); P(9,19,3,1,'#3a2410'); }
}); }
const CRATE = [0,1,2].map(crateSpr), CRATE_W = CRATE.map(c => tinted(c, '#ffffff'));
function drawCrate(h){
  const stage = h.hp/h.maxHp > 0.66 ? 0 : h.hp/h.maxHp > 0.33 ? 1 : 2;
  const s = (h.flash > 0 ? CRATE_W : CRATE)[stage], jit = h.flash > 0 ? ((S.t*60|0)%2 ? 1 : -1) : 0;
  const x = sx(h.x) + jit, y = sy(h.y);
  lg.drawImage(s, x - (s.width>>1), y - s.height + 3);
  // bobbing marker so crates are easy to spot
  const my = y - s.height - 3 + Math.round(Math.sin(S.t*5 + h.seed*6)*1.5);
  lg.fillStyle = '#170d1c'; lg.fillRect(x-3, my-1, 7, 5);
  lg.fillStyle = '#ffd860'; lg.fillRect(x-2, my, 5, 1); lg.fillRect(x-1, my+1, 3, 1); lg.fillRect(x, my+2, 1, 1);
  if (h.hp < h.maxHp) miniBar(x, y - s.height - 6, 14, h.hp/h.maxHp, '#ffd860');
}
FX.splinter = (x, y, n) => { const cols = ['#b88a50','#9a6e3c','#dcb078','#6a4a24'];
  for (let i=0;i<n;i++){ const a = rand(0,TAU), s = rand(40,160);
    S.parts.push({k:'dirt', x, y, vx:Math.cos(a)*s, vy:Math.sin(a)*s*0.7, z:14, vz:rand(60,180), t:rand(.5,.9), max:.9, col:pick(cols)}); } };
FX.dust = (x, y) => { for (let i=0;i<6;i++) S.parts.push({k:'smoke', x:x+rand(-10,10), y, vx:rand(-20,20), vy:rand(-10,0), t:.6, max:.6, r:rand(3,5), grow:6}); };

// ---------- gunship (final boss) ----------
const HELI = (() => propCanvas(80,38,(P) => {
  P(0,5,6,11,'#4a5240'); P(0,5,6,1,'#6a7458');                                   // tail fin
  P(4,13,28,5,'#3e4636'); P(4,13,28,1,'#5a6450'); P(4,17,28,1,'#2a3024');        // tail boom
  P(28,9,36,20,'#4a5240'); P(28,9,36,1,'#6a7458'); P(28,25,36,4,'#363d2e');     // fuselage
  P(64,13,10,14,'#4a5240'); P(72,16,4,9,'#4a5240'); P(64,13,10,1,'#6a7458');    // nose
  P(58,11,15,8,'#5aa0c8'); P(60,12,6,2,'#c8ecff'); P(58,18,15,1,'#2a4a5a');      // cockpit glass
  P(40,13,11,11,'#161a14'); P(43,16,3,3,'#3a4030'); P(46,18,6,2,'#2a2a2a');      // open door + gunner
  P(32,16,6,6,'#d8d8c8'); P(34,15,2,8,'#d8d8c8'); P(31,18,8,2,'#d8d8c8');       // star insignia
  P(38,4,22,6,'#3e4636'); P(38,4,22,1,'#5a6450'); P(48,1,4,4,'#22262a');        // engine + mast
  P(44,29,16,4,'#2e3426'); P(60,29,2,4,'#c02020');                               // rocket pod
  P(32,35,40,2,'#22262a'); P(38,30,2,5,'#22262a'); P(62,30,2,5,'#22262a');      // skids
}))();
const HELI_W = tinted(HELI, '#ffffff');
function drawHeli(h){
  const x = sx(h.x), y = sy(h.y) - 48, flip = Math.cos(h.face) < 0, s = h.flash > 0 ? HELI_W : HELI;
  const bob = Math.round(Math.sin(S.t*3)*1.5);
  lg.save(); lg.translate(x, 0); if (flip) lg.scale(-1,1);
  lg.drawImage(s, -40, y - 19 + bob);
  // main rotor: blurred disc plus a sweeping blade, tail rotor flicker
  const f = (S.t*24|0)%3;
  lg.globalAlpha = 0.25; lg.fillStyle = '#c8ccd4'; lg.fillRect(-46, y - 20 + bob, 92, 1); lg.globalAlpha = 1;
  lg.fillStyle = '#1a1c20'; const bl = [44, 26, 8][f]; lg.fillRect(10 - bl, y - 20 + bob, bl*2, 2);
  lg.fillStyle = '#5a5e66'; if (f !== 2) lg.fillRect(-42, y - 15 + bob + (f ? 2 : -2), 2, 5);
  lg.restore();
  if (h.hp < h.maxHp*0.5 && Math.random() < 0.35) FX.smoke(h.x + rand(-20,20), h.y - 90, 1, 1);
}

// ---------- explosive street hazards ----------
function drawHazard(h){
  const base = SPR[h.sub](), s = h.flash > 0 ? propSprite(h.sub+'W', () => tinted(base, '#ffffff')) : base;
  const jit = h.flash > 0 ? ((S.t*60|0)%2 ? 1 : -1) : 0, x = sx(h.x) + jit, y = sy(h.y);
  lg.fillStyle = 'rgba(12,6,18,.35)'; pell(lg, x+1, y, 6, 2);
  lg.drawImage(s, x - (s.width>>1), y - s.height + 1);
  if (h.hp < h.maxHp){ miniBar(x, y - s.height - 3, 12, h.hp/h.maxHp, '#ff8a3a');
    if (Math.random() < 0.2) S.parts.push({k:'spark', x:h.x+rand(-6,6), y:h.y-20, vx:rand(-40,40), vy:rand(-60,0), t:.2, max:.2, col:'#ffb040'}); }
}
