"use strict";
// ---------- low-res pixel pipeline ----------
// Everything is drawn at ~384x216 into `lo`, then blown up with nearest-neighbour by an integer SCALE.
const cv = $('c'), ctx = cv.getContext('2d');
const lo = mk(1,1), lg = lo.getContext('2d');
const dark = mk(1,1), dg = dark.getContext('2d');
const slu = mk(1,1), sg = slu.getContext('2d');
let LW = 384, LH = 216, SCALE = 1, DPR = 1, VW = 768, VH = 432, vig = null, scanPat = null;
let W = 768, H = 432;   // world-unit view size (used by game logic for spawn rings)
const cam = {x:0, y:0};
let cpx = 0, cpy = 0;
const sx = x => Math.round(x/2) - cpx, sy = y => Math.round(y/2) - cpy;

function resize(){
  DPR = window.devicePixelRatio || 1;
  const dw = Math.max(1, Math.round(innerWidth*DPR)), dh = Math.max(1, Math.round(innerHeight*DPR));
  cv.width = dw; cv.height = dh; cv.style.width = innerWidth+'px'; cv.style.height = innerHeight+'px';
  SCALE = Math.max(1, Math.floor(Math.min(Math.max(dw,dh)/384, Math.min(dw,dh)/216)));
  LW = Math.ceil(dw/SCALE); LH = Math.ceil(dh/SCALE);
  for (const c of [lo, dark, slu]){ c.width = LW; c.height = LH; }
  VW = W = LW*2; VH = H = LH*2;
  // stepped vignette
  vig = mk(LW,LH); { const g = vig.getContext('2d'), id = g.createImageData(LW,LH), d = id.data;
    for (let y=0;y<LH;y++) for (let x=0;x<LW;x++){ const dx = (x-LW/2)/(LW/2), dy = (y-LH/2)/(LH/2), dd = Math.sqrt(dx*dx*0.8+dy*dy*0.9);
      const lv = Math.floor(clamp((dd-0.62)/0.5,0,1)*4)/4; d[(y*LW+x)*4+3] = Math.round(lv*150); }
    g.putImageData(id,0,0); }
  // CRT-ish scanlines on the upscaled image
  scanPat = null;
  if (SCALE >= 3){ const p = mk(1,SCALE), g = p.getContext('2d'); g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(0,SCALE-1,1,1); scanPat = ctx.createPattern(p,'repeat'); }
}
addEventListener('resize', resize); resize();

const BAND = {white:bandSprite(255,255,255,5), warm:bandSprite(255,190,110,5), toxic:bandSprite(120,220,60,5), orange:bandSprite(255,130,40,5),
  yellow:bandSprite(255,236,150,4), red:bandSprite(255,60,50,4), pink:bandSprite(255,130,190,4), blue:bandSprite(110,160,255,4), smoke:bandSprite(70,66,74,4)};
function band(g,spr,x,y,r,a){ if (a<=0 || r<1) return; g.globalAlpha = Math.min(1,a); g.drawImage(spr, Math.round(x-r), Math.round(y-r), Math.round(r*2), Math.round(r*2)); }

// small sprites
const SPIT = outline((() => { const c = mk(7,7), g = c.getContext('2d'); g.fillStyle='#7acc2a'; g.fillRect(2,1,3,5); g.fillRect(1,2,5,3); g.fillStyle='#c4ff6a'; g.fillRect(2,2,2,1); return c; })(), '#1e3a0a');
const BONES = [0,1,2,3].map(i => outline((() => { const c = mk(9,9), g = c.getContext('2d'); g.fillStyle = '#ece4c8';
  if (i===0){ g.fillRect(2,4,5,1); g.fillRect(1,3,1,3); g.fillRect(7,3,1,3); }
  if (i===1){ for (let k=0;k<4;k++) g.fillRect(2+k,6-k,1,1); g.fillRect(1,6,2,1); g.fillRect(6,2,2,1); g.fillRect(1,5,1,1); g.fillRect(7,3,1,1); }
  if (i===2){ g.fillRect(4,2,1,5); g.fillRect(3,1,3,1); g.fillRect(3,7,3,1); }
  if (i===3){ for (let k=0;k<4;k++) g.fillRect(2+k,2+k,1,1); g.fillRect(1,2,2,1); g.fillRect(6,6,2,1); g.fillRect(1,1,1,1); g.fillRect(7,7,1,1); }
  return c; })(), '#3a2e24'));
// side-view brains: wrinkled cerebrum, cerebellum tucked under the back, a stub of brain stem
const BRAIN_PAL = {L:'#ffd0e2', M:'#f08ab4', m:'#d8709c', D:'#b04878', F:'#7a2450', C:'#c85a88', S:'#e0909a'};
function brainSpr(rows){ const c = mk(rows[0].length+2, rows.length+2); c.getContext('2d').drawImage(pixIcon(rows, BRAIN_PAL), 1, 1); return outline(c, '#3e1028'); }
const BRAIN_S = brainSpr([
  '..MMMMMM..',
  '.MLLMFMMM.',
  'MLMFMMFMMm',
  'MMFMMFMFMm',
  'mMMFMmMMFD',
  '.DmMMDCCD.',
  '..DD.SCC..',
  '.....S....']);
const BRAIN_L = brainSpr([
  '...MMMMMMM...',
  '.MMLLMMFMMMM.',
  'MLLMFFMMFFMMm',
  'MLMMMMFMMMFMm',
  'MMFFMFMMFMMmD',
  'MMMMFMMFFMMFD',
  'mMFMMmMMMmMDD',
  '.DmMMDmDCCCD.',
  '..DDD..SCCC..',
  '.......SS....']);
// living details on Patient Zero that a static sprite can't show
function drawPlayerFx(p){
  const x = sx(p.x), y = sy(p.y), t = S.t;
  if (L('aura')){ lg.fillStyle = '#100810';   // flies buzzing around the rot
    for (let i=0;i<2+L('aura');i++){ const a = t*(3+i*0.7) + i*2.1, r = 7 + (i%3)*3;
      lg.fillRect(x + Math.round(Math.cos(a)*r), y - 14 + Math.round(Math.sin(a*1.3)*r*0.6), 1, 1); } }
  if (L('trail') && p.moving && Math.random() < 0.3 + 0.1*L('trail'))
    S.parts.push({k:'drop', x:p.x+rand(-6,6), y:p.y, vx:0, vy:0, z:6, vz:0, t:.3, max:.3, col:'#6abf1f'});
  if (L('spit') >= 3 && Math.random() < 0.05*L('spit'))
    S.parts.push({k:'drop', x:p.x+Math.cos(p.face)*4, y:p.y, vx:0, vy:0, z:22, vz:0, t:.4, max:.4, col:'#9be03a'});
  if (Object.keys(S.evo).length && Math.random() < 0.25){ lg.fillStyle = '#ffe070'; lg.fillRect(x + (rand(-9,9)|0), y - (rand(4,26)|0), 1, 1); }   // evolved sparkle
  if (L('boom') >= 2 && (t*4|0)%3===0){ lg.fillStyle = '#ffd060'; lg.fillRect(x + ((t*13|0)%5) - 2, y - 13 - ((t*7|0)%4), 1, 1); }
}
const ICON = {};
function pixIcon(rows, cols){ const h = rows.length, w = rows[0].length, c = mk(w,h), g = c.getContext('2d');
  rows.forEach((r,y) => { for (let x=0;x<w;x++){ const ch = r[x]; if (ch!=='.'){ g.fillStyle = cols[ch]; g.fillRect(x,y,1,1); } } }); return c; }
ICON.clover = pixIcon(['.#.#.','#####','.###.','#####','.#.#.','..s..'], {'#':'#5ad03a', s:'#8a7a3a'});
ICON.heart = pixIcon(['.##.##.','#######','#a#####','.#####.','..###..','...#...'], {'#':'#e83a4a', a:'#ffb0b8'});
ICON.skull = pixIcon(['.#####.','#######','#..#..#','#######','.##.##.','.#.#.#.'], {'#':'#ece4d0'});
ICON.zed = pixIcon(['.#####.','#######','#y##y##','#######','##rrr##','.#####.'], {'#':'#9cc05a', y:'#eaff60', r:'#6a1424'});

// ---------- APC sprites ----------
function apcSide(){ return propSprite('apcS', () => propCanvas(70,42,(P,g) => {
  for (let i=0;i<4;i++){ P(6+i*15,31,11,9,'#16141a'); P(9+i*15,33,5,4,'#4a4a52'); }
  P(2,18,64,14,'#55603f'); P(2,18,64,1,'#7a8858'); P(2,30,64,2,'#3a422a');
  P(4,8,58,10,'#6a7650'); P(4,8,58,1,'#8a9868'); P(14,10,9,5,'#4a5438'); P(30,10,9,5,'#4a5438');
  P(62,10,5,9,'#5e6a46'); P(62,10,1,9,'#7a8858'); P(66,19,1,4,'#fff2b0');
  P(10,22,9,4,'#46502f'); P(36,24,11,3,'#46502f'); P(50,21,7,2,'#1a1a1a');
  P(26,21,5,5,'#d8d8c8'); P(28,20,1,7,'#d8d8c8'); P(25,23,7,1,'#d8d8c8');
})); }
function apcFront(back){ return propSprite('apcF'+(back?1:0), () => propCanvas(46,44,(P) => {
  P(1,26,6,14,'#16141a'); P(39,26,6,14,'#16141a');
  P(6,16,34,22,'#55603f'); P(6,16,34,1,'#7a8858'); P(6,36,34,2,'#3a422a');
  P(7,5,32,11,'#6a7650'); P(7,5,32,1,'#8a9868'); P(17,7,12,6,'#4a5438');
  const l = back ? '#d02020' : '#fff2b0'; P(9,20,6,3,l); P(31,20,6,3,l);
  P(17,24,12,6,'#3a422a'); for (let i=0;i<4;i++) P(18,25+i*1.5|0,10,1,'#2a3020');
})); }

// ---------- effects ----------
const FX = {
  blood(x,y,n,green){
    const cols = green ? ['#4e8a1e','#3a6a16','#78b830'] : ['#a01828','#7a1020','#c83040'];
    for (let i=0;i<n;i++){ const a = Math.random()*TAU, s = rand(30,130);
      S.parts.push({k:'drop',x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s*0.7,z:10,vz:rand(40,160),t:rand(.4,.9),max:.9,col:pick(cols)}); }
    if (n >= 3) FX.splat(x,y,3+n*0.35,green);
  },
  splat(x,y,size,green){
    const c0 = green ? '#2e5212' : '#5e0c18', c1 = green ? '#3e6a18' : '#7a1020';
    const blobs = []; for (let i=0;i<3;i++) blobs.push([rand(-size,size)*.5, rand(-size,size)*.35, rand(size*.4,size*.8)]);
    const drops = []; for (let i=0;i<8;i++){ const a = rand(0,TAU), d = rand(size,size*2.4); drops.push([Math.cos(a)*d, Math.sin(a)*d*0.7, Math.random()<.3?2:1]); }
    paintDecal(x,y,size*6, g => { const px = Math.round(x/2), py = Math.round(y/2);
      for (const [bx,by,br] of blobs) pell(g, px+Math.round(bx), py+Math.round(by), br, br*0.6, c0);
      g.fillStyle = c1; for (const [bx,by,br] of blobs) g.fillRect(px+Math.round(bx)-1, py+Math.round(by)-1, 2, 1);
      g.fillStyle = c0; for (const [dx,dy,s] of drops) g.fillRect(px+Math.round(dx), py+Math.round(dy), s, s); });
  },
  // bodies are short-lived entities (not painted into the ground) so the street never clogs up
  corpse(h){
    S.bodies.push({x:h.x, y:h.y, look:h.look, flip:Math.random()<.5, t:BODY_LIFE, px:rand(-3,3)|0});
    if (S.bodies.length > 120) S.bodies.shift();
  },
  scorch(x,y,r){
    const pts = []; for (let i=0;i<r*6;i++){ const a = rand(0,TAU), d = Math.sqrt(Math.random())*r/2; pts.push([Math.cos(a)*d, Math.sin(a)*d*0.7]); }
    paintDecal(x,y,r, g => { const px = Math.round(x/2), py = Math.round(y/2); g.fillStyle = 'rgba(12,8,12,.6)';
      for (const [dx,dy] of pts) g.fillRect(px+Math.round(dx), py+Math.round(dy), 1, 1); });
  },
  muzzle(x,y,a,big){
    S.parts.push({k:'flash',x,y,a,t:.06,max:.06,big});
    S.lights.push({x,y,r:big?60:36,spr:BAND.yellow,t:.06,max:.06,a:1});
    if (!big) S.parts.push({k:'casing',x,y,vx:Math.cos(a+1.6)*rand(40,80),vy:Math.sin(a+1.6)*rand(40,80),z:10,vz:rand(60,120),t:.7,max:.7});
  },
  smoke(x,y,n,s){ for (let i=0;i<n;i++) S.parts.push({k:'smoke',x:x+rand(-6,6),y:y+rand(-6,6),vx:rand(-10,10),vy:rand(-30,-10),t:rand(.7,1.4),max:1.4,r:rand(3,6)*(s||1),grow:rand(5,10)*(s||1)}); },
  fire(x,y,n,spread){ for (let i=0;i<n;i++){ const a = rand(0,TAU), s = rand(20,spread||120);
    S.parts.push({k:'fire',x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s*0.7,t:rand(.25,.6),max:.6,r:rand(3,7),grow:6}); } },
  explosion(x,y,r,col){
    const green = col==='green';
    S.lights.push({x,y,r:r*1.6,spr:green?BAND.toxic:BAND.orange,t:.3,max:.3,a:1});
    S.parts.push({k:'shock',x,y,r:r*0.2,max:r*0.6,t:.3,max2:.3,col: green ? '#b7ff4a' : '#ffd27a'});
    S.parts.push({k:'boom',x,y,t:.35,max:.35,r:r*0.35,green});
    if (green){ FX.blood(x,y,10,true); for (let i=0;i<8;i++){ const a = rand(0,TAU), s = rand(30,110);
      S.parts.push({k:'gas',x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s*0.7,t:rand(.4,.8),max:.8,r:rand(4,8),grow:12}); } }
    else { FX.fire(x,y,14,r*1.6); FX.smoke(x,y,8,1.3); FX.scorch(x,y,r*0.9); }
    for (let i=0;i<10;i++){ const a = rand(0,TAU), s = rand(120,300);
      S.parts.push({k:'spark',x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s*0.7,t:rand(.15,.35),max:.35,col: green?'#d8ff8a':'#ffe08a'}); }
  },
  splash(x,y){ for (let i=0;i<6;i++){ const a = rand(0,TAU), s = rand(30,100);
    S.parts.push({k:'drop',x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s*0.7,z:20,vz:rand(20,90),t:rand(.2,.45),max:.45,col:'#9be03a'}); } },
  rise(x,y){ for (let i=0;i<8;i++) S.parts.push({k:'dirt',x:x+rand(-8,8),y:y+rand(-3,3),vx:rand(-30,30),vy:rand(-10,10),z:0,vz:rand(60,140),t:.6,max:.6});
    for (let i=0;i<4;i++) S.parts.push({k:'gas',x:x+rand(-8,8),y,vx:rand(-10,10),vy:rand(-20,0),t:.7,max:.7,r:rand(3,5),grow:8}); },
  bubble(x,y){ S.parts.push({k:'bubble',x,y,vx:rand(-6,6),vy:rand(-24,-10),t:rand(.4,.7),max:.7}); },
  text(x,y,txt,col){ S.texts.push({x,y,txt,col,t:0.9}); },
};
function updateFx(dt){
  for (const q of S.parts){
    q.t -= dt;
    if (q.vx !== undefined){ q.x += q.vx*dt; q.y += q.vy*dt; }
    switch (q.k){
      case 'drop': case 'casing': case 'dirt':
        if (q.z > 0 || q.vz > 0){ q.z += q.vz*dt; q.vz -= 520*dt; if (q.z <= 0){ q.z = 0; q.vz = 0; q.vx *= 0.2; q.vy *= 0.2; } }
        else { q.vx *= Math.pow(.01,dt); q.vy *= Math.pow(.01,dt); } break;
      case 'spark': q.vx *= Math.pow(.05,dt); q.vy *= Math.pow(.05,dt); break;
      case 'smoke': case 'gas': case 'fire': q.vx *= Math.pow(.2,dt); q.vy *= Math.pow(.2,dt); q.r += q.grow*dt; break;
      case 'shock': q.r += (q.max - q.r)*Math.min(1,dt*14); break;
    }
  }
  S.parts = S.parts.filter(q => q.t > 0);
  if (S.parts.length > 900) S.parts.splice(0, S.parts.length-900);
  for (const l of S.lights) l.t -= dt;
  S.lights = S.lights.filter(l => l.t > 0);
}

// ---------- characters ----------
function dirOf(a){ const c = Math.cos(a), s = Math.sin(a); if (Math.abs(c) > Math.abs(s)*0.85) return c > 0 ? 2 : 3; return s > 0 ? 0 : 1; }
function trackWalk(e){
  if (e._lx !== undefined){ const dd = Math.hypot(e.x-e._lx, e.y-e._ly); e.walk = (e.walk||0) + dd/2; e.moving = dd > 0.08; }
  e._lx = e.x; e._ly = e.y;
}
function drawChar(e, L, pose, flash, rise){
  const d = dirOf(e.face), step = e.moving ? [0,1,0,2][((e.walk||0)/5|0)%4] : 0;
  const spr = charSprite(L, d===3 ? 2 : d, step, pose, flash);
  const x = sx(e.x), y = sy(e.y), w = spr.width, hw = w >> 1;
  // sprites are anchored 2 rows above their bottom edge (feet); rising corpses reveal from the top down
  let h = spr.height, top = y - spr.height + 2;
  if (rise !== undefined && rise < 1){ h = Math.max(1, Math.round((spr.height-2)*rise)); top = y - h; }
  if (d===3){ lg.save(); lg.translate(x,0); lg.scale(-1,1); lg.drawImage(spr, 0, 0, w, h, -hw, top, w, h); lg.restore(); }
  else lg.drawImage(spr, 0, 0, w, h, x-hw, top, w, h);
}
function humanPose(h){ return h.type==='civ' ? (h.panic>0 ? 'panic' : 'walk') : h.type==='riot' ? 'shield' : (h.type==='beat' || h.type==='medic' || h.type==='dog') ? 'walk' : 'aim'; }
function drawAPC(h){
  const d = dirOf(h.face), fl = h.flash > 0;
  let s = d>=2 ? apcSide() : apcFront(d===1); if (fl) s = propSprite((d>=2?'apcSw':'apcFw'+(d===1?1:0)), () => tinted(s,'#ffffff'));
  const x = sx(h.x), y = sy(h.y) + 10;
  if (d===3){ lg.save(); lg.translate(x,0); lg.scale(-1,1); lg.drawImage(s, -Math.floor(s.width/2), y-s.height); lg.restore(); }
  else lg.drawImage(s, x-Math.floor(s.width/2), y-s.height);
  // turret + barrel aimed at its target
  const tx = x, ty = y - s.height + (d>=2 ? 12 : 10);
  h.recoil = Math.max(0, (h.recoil||0) - 0.05);
  const ca = Math.cos(h.turret), sa = Math.sin(h.turret)*0.7, back = h.recoil*5;
  lg.fillStyle = '#170d1c';
  for (let i=4;i<20;i++) lg.fillRect(Math.round(tx+ca*(i-back))-1, Math.round(ty+sa*(i-back))-1, 4, 4);
  lg.fillStyle = fl ? '#fff' : '#3a4430';
  for (let i=4;i<20;i++) lg.fillRect(Math.round(tx+ca*(i-back)), Math.round(ty+sa*(i-back)), 2, 2);
  pell(lg, tx, ty, 9, 6, '#170d1c'); pell(lg, tx, ty, 8, 5, fl?'#fff':'#5c6845'); pell(lg, tx-1, ty-1, 5, 3, fl?'#fff':'#6e7c52');
  lg.fillStyle = '#3a4430'; lg.fillRect(tx-2, ty-2, 4, 3);
  if (h.hp < h.maxHp*0.5 && Math.random() < 0.25) FX.smoke(h.x+rand(-20,20), h.y-30, 1, 0.8);
}
function miniBar(x,y,w,f,col){ lg.fillStyle = '#170d1c'; lg.fillRect(x-Math.floor(w/2)-1, y-1, w+2, 3); lg.fillStyle = col; lg.fillRect(x-Math.floor(w/2), y, Math.round(w*clamp(f,0,1)), 1); }

// ---------- main render ----------
let titleT = 0, lastR = performance.now();
const drawList = [];
function render(){
  const now = performance.now(), rdt = Math.min(0.05,(now-lastR)/1000); lastR = now;
  lg.imageSmoothingEnabled = false; dg.imageSmoothingEnabled = false;
  lg.setTransform(1,0,0,1,0,0); lg.globalAlpha = 1; lg.globalCompositeOperation = 'source-over';
  if (!S){
    titleT += rdt; cam.x = titleT*30 - VW/2 + 320; cam.y = titleT*14 - VH/2 + 320;
    cpx = Math.round(cam.x/2); cpy = Math.round(cam.y/2);
    const props = drawGround(); drawList.length = 0;
    for (const p of props) drawList.push(p.y, 1, p);
    drawSorted();
    lighting(0.95); post(0.95); blit(); return;
  }
  const p = S.player, nt = nightAmt(), sk = S.shake*SET.shake, shk = Math.round(rand(-sk,sk)/2);
  cam.x = p.x - VW/2; cam.y = p.y - VH/2;
  cpx = Math.round(cam.x/2) + shk; cpy = Math.round(cam.y/2) + Math.round(rand(-sk,sk)/2);
  const props = drawGround();

  // toxic sludge trail: merged blobs on their own layer
  if (S.pools.length){
    sg.setTransform(1,0,0,1,0,0); sg.clearRect(0,0,LW,LH);
    for (const q of S.pools){ const k = Math.min(1,q.t/0.6), r = q.r*k/2; pell(sg, sx(q.x), sy(q.y), r+1, (r+1)*0.7, '#1c3a08'); }
    for (const q of S.pools){ const k = Math.min(1,q.t/0.6), r = q.r*k/2; pell(sg, sx(q.x), sy(q.y), r, r*0.7, '#4e9a16'); }
    for (const q of S.pools){ const k = Math.min(1,q.t/0.6), r = q.r*k/2; if (r > 2) pell(sg, sx(q.x)-1, sy(q.y)-1, r*0.45, r*0.3, '#86d42c'); }
    sg.fillStyle = '#e0ffa0';
    for (const q of S.pools){ if (q.t > 0.5 && ((S.t*2 + q.seed) % 1) < 0.5) sg.fillRect(sx(q.x+q.bx), sy(q.y+q.by), 1, 1); }
    lg.globalAlpha = 0.85; lg.drawImage(slu,0,0); lg.globalAlpha = 1;
  }
  // rot cloud on the ground
  const la = L('aura');
  if (la){ const R = (55+13*la)/2, px = sx(p.x), py = sy(p.y);
    lg.fillStyle = 'rgba(140,230,60,.5)';
    const n = Math.round(R*3);
    for (let i=0;i<n;i++){ const a = i/n*TAU + S.t*0.5; if ((i + (S.t*8|0)) % 3) continue; lg.fillRect(Math.round(px+Math.cos(a)*R), Math.round(py+Math.sin(a)*R*0.7), 1, 1); }
    for (let i=0;i<10;i++){ const a = i/10*TAU + S.t*0.8*(i%2?1:-1), d = R*(0.3+0.6*((i*37)%10)/10);
      band(lg, BAND.toxic, px+Math.cos(a)*d, py+Math.sin(a)*d*0.7 - 4, R*0.35, 0.25); }
    lg.globalAlpha = 1; }
  // dead bodies: stepped fade-out for a retro dissolve
  for (const b of S.bodies){ const a = Math.ceil(clamp(b.t/1.2,0,1)*4)/4; if (a <= 0) continue;
    lg.globalAlpha = a; const x = sx(b.x), y = sy(b.y);
    pell(lg, x+b.px, y-2, 9, 4, '#5a0c18');
    const s = corpseSprite(b.look); if (b.flip){ lg.save(); lg.translate(x,0); lg.scale(-1,1); lg.drawImage(s, -14, y-14); lg.restore(); } else lg.drawImage(s, x-14, y-14); }
  lg.globalAlpha = 1;
  drawGroundFx();
  // brains
  // three sizes by value: small (<4), big (4-14), mega (15+, drawn 2x with a glow); a pulse when brains fuse
  for (const g of S.gems){ const mega = g.v >= 15, B = g.v >= 4 ? BRAIN_L : BRAIN_S, sc = mega ? 2 : 1;
    const bob = Math.round(Math.sin(S.t*5 + g.x*0.05)), x = sx(g.x), y = sy(g.y), w = B.width*sc, h = B.height*sc;
    lg.fillStyle = 'rgba(10,4,16,.3)'; lg.fillRect(x - (w>>1) + 1, y + 1, w - 2, 1);
    if (mega){ lg.globalCompositeOperation = 'lighter'; band(lg, BAND.pink, x, y - h/2, 14 + Math.sin(S.t*4)*2, 0.35); lg.globalCompositeOperation = 'source-over'; lg.globalAlpha = 1; }
    lg.drawImage(B, x - (w>>1), y - h + bob, w, h);
    if (g.pulse > 0){ lg.fillStyle = '#ffd0e2'; const r = Math.round((0.3 - g.pulse)*40) + 3;
      for (let i=0;i<8;i++){ const a = i/8*TAU; lg.fillRect(Math.round(x + Math.cos(a)*r), Math.round(y - h/2 + Math.sin(a)*r*0.7), 1, 1); } } }
  // shadows
  lg.fillStyle = 'rgba(12,6,18,.38)';
  const shadow = (e, rx, ry) => { pell(lg, sx(e.x), sy(e.y), rx, ry); };
  for (const h of S.humans) if (!h.boss) shadow(h, 5, 2);
  for (const m of S.minions) if (m.rise <= 0) shadow(m, 5, 2);
  shadow(p, 6, 2);
  for (const h of S.humans) if (h.boss){ lg.fillRect(sx(h.x)-30, sy(h.y)+4, 60, 8); }

  // depth-sorted sprites
  drawList.length = 0;
  for (const pr of props) drawList.push(pr.y, 1, pr);
  for (const h of S.humans){ trackWalk(h); if (!h.air) drawList.push(h.y, h.boss?3:2, h); }
  for (const m of S.minions){ trackWalk(m); drawList.push(m.y, 4, m); }
  for (const c of S.corpses) drawList.push(c.y-1, 5, c);
  for (const it of S.items) drawList.push(it.y, 7, it);
  trackWalk(p); drawList.push(p.y, 6, p);
  drawSorted();
  drawContentFx();
  for (const h of S.humans) if (h.air) drawHeli(h);   // airborne: always on top

  // projectiles (drawn lifted off the ground for the 2.5D read)
  for (const b of S.pb){
    lg.fillStyle = 'rgba(12,6,18,.35)'; lg.fillRect(sx(b.x)-1, sy(b.y), 3, 1);
    if (b.k==='spit') lg.drawImage(SPIT, sx(b.x)-3, sy(b.y)-13);
    else if (b.k==='gat' || b.k==='mirror'){ const a = Math.atan2(b.vy,b.vx), x = sx(b.x), y = sy(b.y)-12; lg.fillStyle = b.k==='gat' ? '#b0a688' : '#c08030';
      lg.fillRect(x-Math.round(Math.cos(a)*4), y-Math.round(Math.sin(a)*3), 2, 2); lg.fillStyle = b.k==='gat' ? '#f6f0dc' : '#fff2a0'; lg.fillRect(x-1, y-1, 3, 2); }
    else lg.drawImage(BONES[(S.t*16|0)%4], sx(b.x)-4, sy(b.y)-12);
  }
  for (const b of S.hb){
    if (b.shell){ const z = Math.sin(clamp(1 - b.t/b.t0,0,1)*Math.PI)*28;
      lg.fillStyle = 'rgba(12,6,18,.35)'; lg.fillRect(sx(b.x)-2, sy(b.y), 4, 1);
      lg.fillStyle = '#170d1c'; lg.fillRect(sx(b.x)-2, sy(b.y)-12-z, 5, 5); lg.fillStyle = '#4a4a3a'; lg.fillRect(sx(b.x)-1, sy(b.y)-11-z, 3, 3);
      if (Math.random()<0.4) FX.smoke(b.x, b.y-24-z*2, 1, 0.5); }
  }
  // particles (normal blend)
  for (const q of S.parts){
    const f = clamp(q.t/q.max,0,1), x = sx(q.x), y = sy(q.y) - Math.round((q.z||0)/2);
    switch (q.k){
      case 'drop': lg.fillStyle = q.col; lg.fillRect(x, y, 1, 1); break;
      case 'dirt': lg.fillStyle = q.col || '#5c4834'; lg.fillRect(x, y, 2, 2); break;
      case 'casing': lg.fillStyle = '#e0b84a'; lg.fillRect(x, y, 1, 1); break;
      case 'smoke': band(lg, BAND.smoke, x, y - 8, q.r, 0.55*f); lg.globalAlpha = 1; break;
      case 'gas': band(lg, BAND.toxic, x, y - 6, q.r, 0.5*f); lg.globalAlpha = 1; break;
      case 'bubble': lg.fillStyle = '#c8ff7a'; lg.fillRect(x, y-2, 1, 1); if (f > 0.5){ lg.fillRect(x-1, y-1, 1, 1); lg.fillRect(x+1, y-1, 1, 1); lg.fillRect(x, y, 1, 1); } break;
      case 'shock': { lg.fillStyle = q.col; const r = q.r/2, n = Math.max(8, Math.round(r*4));
        for (let i=0;i<n;i++){ const a = i/n*TAU; lg.fillRect(Math.round(x+Math.cos(a)*r), Math.round(y+Math.sin(a)*r*0.7), f>0.5?2:1, 1); } break; }
    }
  }
  lighting(nt);
  // floating text
  for (const t of S.texts){ if (t.num && !SET.numbers) continue; if (t.t < 0.15 && (S.t*30|0)%2) continue; ptext(lg, t.txt, sx(t.x), sy(t.y)-(t.crit ? 24 : 30), t.col, {align:'center', shadow: t.crit ? '#5a1a00' : '#170d1c'}); }
  post(nt);
  if (S.flashT > 0 && SET.flash > 0){ lg.globalAlpha = Math.min(1, S.flashT/0.7)*0.85*SET.flash; lg.fillStyle = '#d8ffb0'; lg.fillRect(0,0,LW,LH); lg.globalAlpha = 1; }
  drawHUD(nt);
  blit();
}
function drawSorted(){
  // drawList is a flat [y, kind, obj, ...] array; sort indices by y
  const n = drawList.length/3, idx = new Array(n);
  for (let i=0;i<n;i++) idx[i] = i;
  idx.sort((a,b) => drawList[a*3] - drawList[b*3]);
  for (const i of idx){
    const kind = drawList[i*3+1], o = drawList[i*3+2];
    if (kind===1){ if (o.live) continue; const sh = PROP_SHADOW[o.k]; const x = sx(o.x), y = sy(o.y);
      if (x < -60 || x > LW+60 || y < -10 || y > LH+80) continue;
      if (sh){ lg.fillStyle = 'rgba(12,6,18,.35)'; pell(lg, x+1, y, sh[0], sh[1]); }
      drawProp(lg, o, x, y); }
    else if (kind===2 && o.type==='crate') drawCrate(o);
    else if (kind===2 && o.type==='hazard') drawHazard(o);
    else if (kind===2){ if (o.elite) drawEliteUnder(o); drawChar(o, o.look, humanPose(o), o.flash > 0);
      if (o.stun > 0 && (S.t*6|0)%2===0){ lg.fillStyle = '#ffe96b'; const a = S.t*6; lg.fillRect(sx(o.x)+Math.round(Math.cos(a)*5), sy(o.y)-29, 1, 1); lg.fillRect(sx(o.x)+Math.round(Math.cos(a+3)*5), sy(o.y)-29, 1, 1); }
      if ((o.type==='riot'||o.type==='flamer') && o.hp < o.maxHp) miniBar(sx(o.x), sy(o.y)-30, 12, o.hp/o.maxHp, '#ff4a4a'); }
    else if (kind===3) drawBoss(o);
    if (kind===2 && o.swing > 0){ const x = sx(o.x), y = sy(o.y) - 12; lg.fillStyle = '#f0ecdc';
      for (let i=-3;i<=3;i++){ const a = o.face + i*0.25; lg.fillRect(Math.round(x+Math.cos(a)*11), Math.round(y+Math.sin(a)*7), 1, 1); } }
    else if (kind===4){ const r = o.rise > 0 ? 1 - o.rise/0.45 : 1; if (o.husk && o.life) lg.globalAlpha = 0.65 + 0.2*Math.sin(S.t*8); drawChar(o, o.look, 'reach', o.flash > 0, r); lg.globalAlpha = 1;
      if (o.hp < o.maxHp && o.rise <= 0) miniBar(sx(o.x), sy(o.y)-29, 8, o.hp/o.maxHp, '#9be03a'); }
    else if (kind===5){ const k = 1 - o.t/o.max, x = sx(o.x) + ((S.t*40|0)%2 ? Math.round(k) : 0), y = sy(o.y);
      const s = corpseSprite(o.look); lg.drawImage(s, x-14, y-14);
      if ((S.t*10|0)%2) { lg.fillStyle = '#b7ff4a'; lg.fillRect(x+rand(-6,6)|0, y-2-(k*6|0), 1, 1); }
      if (Math.random() < 0.15) FX.bubble(o.x+rand(-10,10), o.y); }
    else if (kind===7) drawItem(o);
    else if (kind===6){ const pl = o;
      const sawBehind = pl.saw > 0 && dirOf(pl.face)===1;
      if (sawBehind) drawSaw(pl);
      drawChar(pl, playerLook(S.mods, S.cid), 'reach', pl.flash > 0);
      if (pl.saw > 0 && !sawBehind) drawSaw(pl);
      drawPlayerFx(pl);
      if (pl.biteT > 0){ const a = pl.biteA, x = sx(pl.x) + Math.round(Math.cos(a)*10), y = sy(pl.y) - 14 + Math.round(Math.sin(a)*6);
        lg.fillStyle = '#f0ecdc'; for (let i=-2;i<=2;i++){ lg.fillRect(x+i*2, y-3, 1, 2); lg.fillRect(x+i*2, y+2, 1, 2); } } }
  }
}
function drawGround(){
  const x0 = Math.floor(cpx/CPX), y0 = Math.floor(cpy/CPX), x1 = Math.floor((cpx+LW)/CPX), y1 = Math.floor((cpy+LH)/CPX);
  const props = [];
  for (let cy=y0; cy<=y1+1; cy++) for (let cx=x0; cx<=x1; cx++){
    const ch = getChunk(cx,cy);
    if (cy <= y1) lg.drawImage(ch.c, cx*CPX - cpx, cy*CPX - cpy);
    for (const p of ch.props) props.push(p);
  }
  for (let cy=y0-1; cy<=y1+2; cy++) for (let cx=x0-1; cx<=x1+1; cx++) if (!peekChunk(cx,cy)){ getChunk(cx,cy); break; }
  return props;
}
function visibleLamps(){
  const out = [], x0 = Math.floor((cpx-100)/CPX), y0 = Math.floor((cpy-100)/CPX), x1 = Math.floor((cpx+LW+100)/CPX), y1 = Math.floor((cpy+LH+100)/CPX);
  for (let cy=y0; cy<=y1; cy++) for (let cx=x0; cx<=x1; cx++){ const ch = peekChunk(cx,cy); if (ch) for (const l of ch.lamps) out.push(l); }
  return out;
}

// ---------- lighting ----------
function lighting(nt){
  const T = S ? S.t : titleT, Ls = [], cones = [];
  for (const l of visibleLamps()){
    if (l.broken) continue;
    let a = 1; if (l.flick){ const v = Math.sin(T*23+l.ph)*Math.sin(T*7.3+l.ph*2); a = v > 0.55 ? 0.1 : 1; }
    Ls.push({x:sx(l.x), y:sy(l.y)+2, r:58, spr:BAND.warm, a, amb:true, hx:sx(l.x), hy:sy(l.y)-52});
  }
  if (S){
    const p = S.player;
    Ls.push({x:sx(p.x), y:sy(p.y)-8, r:70, spr:BAND.toxic, a:0.9, amb:true});
    for (const h of S.humans){
      const x = sx(h.x), y = sy(h.y);
      if (x < -150 || x > LW+150 || y < -150 || y > LH+150) continue;
      if (h.type==='cop' || h.type==='soldier') cones.push({x, y:y-12, a:h.face, sp:0.36, r:95});
      else if (h.type==='flamer') Ls.push({x:x+Math.round(Math.cos(h.face)*8), y:y-10, r:18, spr:BAND.blue, a:0.6, amb:true});
      else if (h.type==='heli') cones.push({x, y:y-6, a:Math.atan2(sy(S.player.y)-y, sx(S.player.x)-x), sp:0.2, r:230});
      else if (h.type==='apc' || h.type==='swat'){ for (const s of [-1,1]) cones.push({x:x + Math.round(Math.cos(h.face)*28 - Math.sin(h.face)*6*s), y:y-14 + Math.round(Math.sin(h.face)*14), a:h.face, sp:0.3, r:140}); }
    }
    for (const b of S.hb) if (b.fire) Ls.push({x:sx(b.x), y:sy(b.y)-8, r:16, spr:BAND.orange, a:0.8*b.t/0.5});
    for (const h of S.humans) if (h.type==='crate') Ls.push({x:sx(h.x), y:sy(h.y)-10, r:20, spr:BAND.warm, a:0.6});
    for (const it of S.items) Ls.push({x:sx(it.x), y:sy(it.y)-8, r: it.k==='chest' ? 40 : 22, spr:BAND[ITEM_BAND[it.k]], a:0.7});
    if (S.player.saw > 0) Ls.push({x:sx(S.player.x), y:sy(S.player.y)-12, r:26, spr:BAND.orange, a:0.5});
    for (const b of S.pb) if (b.k==='spit') Ls.push({x:sx(b.x), y:sy(b.y)-12, r:12, spr:BAND.toxic, a:0.7});
    for (const l of S.lights) Ls.push({x:sx(l.x), y:sy(l.y)-10, r:l.r/2, spr:l.spr, a:l.a*l.t/l.max});
    for (const q of S.parts) if (q.k==='fire') Ls.push({x:sx(q.x), y:sy(q.y)-6, r:q.r*2.2, spr:BAND.orange, a:0.5*q.t/q.max});
  }
  if (nt > 0.01){
    dg.globalCompositeOperation = 'source-over'; dg.globalAlpha = 1; dg.clearRect(0,0,LW,LH);
    dg.fillStyle = `rgba(6,4,20,${0.86*nt})`; dg.fillRect(0,0,LW,LH);
    dg.globalCompositeOperation = 'destination-out';
    for (const l of Ls) band(dg, BAND.white, l.x, l.y, l.r, l.a);
    for (const c of cones){ dg.save(); dg.beginPath(); dg.moveTo(c.x,c.y); dg.arc(c.x,c.y,c.r,c.a-c.sp,c.a+c.sp); dg.closePath(); dg.clip();
      band(dg, BAND.white, c.x, c.y, c.r, 0.95); dg.restore(); band(dg, BAND.white, c.x, c.y+6, 14, 0.8); }
    dg.globalAlpha = 1; dg.globalCompositeOperation = 'source-over';
    lg.drawImage(dark,0,0);
  }
  lg.globalCompositeOperation = 'lighter';
  for (const l of Ls){ band(lg, l.spr, l.x, l.y, l.r*0.8, l.amb ? l.a*0.2*(0.2+nt) : l.a*0.55);
    if (l.hx !== undefined) band(lg, BAND.warm, l.hx, l.hy, 10, l.a*(0.3+0.5*nt)); }
  for (const c of cones){ lg.save(); lg.beginPath(); lg.moveTo(c.x,c.y); lg.arc(c.x,c.y,c.r,c.a-c.sp,c.a+c.sp); lg.closePath(); lg.clip();
    band(lg, BAND.warm, c.x, c.y, c.r, 0.14*nt); lg.restore(); }
  if (S){
    for (const q of S.parts){
      const f = clamp(q.t/q.max,0,1), x = sx(q.x), y = sy(q.y);
      if (q.k==='fire'){ lg.globalAlpha = 1; const col = f>0.75 ? '#fff4b0' : f>0.5 ? '#ffc040' : f>0.25 ? '#f06020' : '#802018';
        pcirc(lg, x, y-6-Math.round((1-f)*6), q.r/2*(0.6+f*0.6), col); }
      else if (q.k==='boom'){ lg.globalAlpha = 1; const r = q.r*(1.4-f)/1.0, col = q.green ? (f>0.5?'#e8ffb0':'#7acc2a') : (f>0.66?'#ffffff':f>0.33?'#ffd040':'#f05020');
        pcirc(lg, x, y-6, r/2, col); }
      else if (q.k==='spark'){ lg.globalAlpha = f; lg.fillStyle = q.col; lg.fillRect(x, y-8, 1, 1); lg.fillRect(x-Math.sign(q.vx), y-8-Math.sign(q.vy), 1, 1); }
      else if (q.k==='flash'){ lg.globalAlpha = 1; const fx = x + Math.round(Math.cos(q.a)*7), fy = y - 12 + Math.round(Math.sin(q.a)*4);
        lg.fillStyle = '#fff4c0'; lg.fillRect(fx-1, fy-1, 3, 3); lg.fillStyle = '#ffc040'; lg.fillRect(fx+Math.round(Math.cos(q.a)*3)-1, fy+Math.round(Math.sin(q.a)*2), 2, 1); }
    }
    lg.globalAlpha = 1;
    for (const b of S.hb){
      const x = sx(b.x), y = sy(b.y);
      if (b.fire){ const k = b.t/0.5; pcirc(lg, x, y-8, 1+ (1-k)*3, k>0.6?'#fff0a0':k>0.3?'#ffa030':'#d04020'); }
      else if (!b.shell){ lg.fillStyle = '#fff2a0'; lg.fillRect(x, y-12, 2, 1); lg.fillStyle = '#c08030';
        lg.fillRect(x-Math.round(b.vx/b.spd*2), y-12-Math.round(b.vy/b.spd*1.4), 1, 1); }
    }
    if (nt > 0.05){
      const eyes = (e, col, big) => { const d = dirOf(e.face); if (d===1) return; const x = sx(e.x), y = sy(e.y) - (big ? 22 : 17);
        band(lg, col, x + (d===2?2:d===3?-2:0), y, big?6:3, nt*0.8); };
      for (const m of S.minions) if (m.rise <= 0) eyes(m, BAND.yellow, false);
      eyes(S.player, BAND.toxic, true);
      if (L('horde') >= 4) band(lg, BAND.pink, sx(S.player.x), sy(S.player.y) - 30, 9, 0.35 + 0.15*Math.sin(S.t*4));
    }
  }
  lg.globalAlpha = 1; lg.globalCompositeOperation = 'source-over';
}
function post(nt){
  lg.globalCompositeOperation = 'multiply';
  lg.fillStyle = nt > 0.5 ? '#b8bce4' : '#dcd4cc'; lg.fillRect(0,0,LW,LH);
  lg.globalCompositeOperation = 'source-over';
  const dusk = Math.sin(clamp(nt,0,1)*Math.PI);
  if (dusk > 0.02){ lg.fillStyle = `rgba(255,100,40,${0.1*dusk})`; lg.fillRect(0,0,LW,LH); }
  lg.drawImage(vig,0,0);
}
function blit(){
  ctx.setTransform(1,0,0,1,0,0); ctx.imageSmoothingEnabled = false;
  ctx.drawImage(lo, 0, 0, LW*SCALE, LH*SCALE);
  if (scanPat){ ctx.fillStyle = scanPat; ctx.fillRect(0,0,cv.width,cv.height); }
}

// ---------- new content visuals ----------
// spore mines and The Cure's gas, drawn on the ground layer
function drawGroundFx(){
  for (const m of S.mines){ const x = sx(m.x), y = sy(m.y), lit = m.arm <= 0 && ((S.t*4 + m.seed*4)|0) % 2;
    lg.fillStyle = 'rgba(12,6,18,.35)'; lg.fillRect(x-3, y+1, 6, 1);
    pell(lg, x, y-2, 3, 2, lit ? '#9be03a' : '#4e8a1e'); lg.fillStyle = '#c4ff6a'; lg.fillRect(x-1, y-4, 1, 1); }
  for (const c of S.cures){ const a = Math.min(1, c.t/1.5)*0.5;
    band(lg, BAND.blue, sx(c.x), sy(c.y)-4, c.r/2, a); band(lg, BAND.white, sx(c.x), sy(c.y)-4, c.r/4, a*0.5);
    if (Math.random() < 0.3) S.parts.push({k:'smoke', x:c.x+rand(-c.r,c.r)*0.7, y:c.y+rand(-c.r,c.r)*0.5, vx:0, vy:-10, t:.7, max:.7, r:3, grow:6}); }
  lg.globalAlpha = 1;
}
// tendril lashes and sniper laser sights, drawn above the sprites
function drawContentFx(){
  // Brain Wave rings and Grave Wisps
  for (const w of S.waves || []){ const x = sx(w.x), y = sy(w.y), r = w.r/2, f = 1 - w.r/w.max, nn = Math.max(12, r*3|0);
    lg.fillStyle = E('wave') ? '#e0a0ff' : '#a0c8ff';
    for (let i=0;i<nn;i++){ if ((i + (S.t*20|0)) % 3 === 0) continue; const a = i/nn*TAU; lg.globalAlpha = 0.4 + 0.6*f; lg.fillRect(Math.round(x+Math.cos(a)*r), Math.round(y-6+Math.sin(a)*r*0.7), 1, 1); }
    lg.globalAlpha = 1; }
  for (const w of S.wisps || []){ const x = sx(w.x), y = sy(w.y) - 10;
    lg.globalCompositeOperation = 'lighter'; band(lg, BAND.blue, x, y, 7, 0.6); lg.globalCompositeOperation = 'source-over'; lg.globalAlpha = 1;
    pcirc(lg, x, y, 2, '#d8d0ff'); lg.fillStyle = '#5a4a8a'; lg.fillRect(x-1, y-1, 1, 1); lg.fillRect(x+1, y-1, 1, 1);
    if (Math.random() < 0.3) S.parts.push({k:'spark', x:w.x, y:w.y, vx:rand(-20,20), vy:rand(-30,0), t:.25, max:.25, col:'#b0a0ff'}); }
  for (const q of S.parts) if (q.k === 'beam'){
    const f = q.t/q.max, x1 = sx(q.x), y1 = sy(q.y)-14, x2 = sx(q.x2), y2 = sy(q.y2)-14, n = Math.hypot(x2-x1, y2-y1)|0;
    for (let i=0;i<n;i++){ const t = i/n, x = Math.round(x1+(x2-x1)*t), y = Math.round(y1+(y2-y1)*t);
      lg.fillStyle = f > 0.5 ? '#ff9a3a' : '#c84a1a'; lg.fillRect(x, y-1, 1, 3); lg.fillStyle = '#fff4c0'; lg.fillRect(x, y, 1, 1); }
    lg.globalCompositeOperation = 'lighter'; band(lg, BAND.orange, x2, y2, 10*f, 0.6); band(lg, BAND.yellow, x1, y1, 8*f, 0.7); lg.globalCompositeOperation = 'source-over'; lg.globalAlpha = 1; }
  for (const q of S.parts) if (q.k === 'lash'){
    const f = q.t/q.max, x1 = sx(q.x), y1 = sy(q.y)-14, x2 = sx(q.x2), y2 = sy(q.y2)-12, n = Math.max(4, Math.hypot(x2-x1, y2-y1)/2|0);
    lg.fillStyle = f > 0.5 ? '#d08af0' : '#8a3aa0';
    for (let i=0;i<=n;i++){ const t = i/n; lg.fillRect(Math.round(x1+(x2-x1)*t + Math.sin(t*9+S.t*40)*2*f), Math.round(y1+(y2-y1)*t + Math.cos(t*7)*1.5), 1, 1); } }
  for (const h of S.humans) if (h.type === 'sniper' && h.aimT > 0){
    const x1 = sx(h.x), y1 = sy(h.y)-13, x2 = sx(h.aimX), y2 = sy(h.aimY)-12, n = Math.hypot(x2-x1, y2-y1)|0;
    lg.fillStyle = (S.t*20|0)%2 || h.aimT < 0.4 ? '#ff3030' : '#a01010';
    for (let i=0;i<n;i+=2){ const t = i/n; lg.fillRect(Math.round(x1+(x2-x1)*t), Math.round(y1+(y2-y1)*t), 1, 1); }
    lg.fillStyle = '#ff6060'; lg.fillRect(x2-1, y2-1, 3, 3); }
}
// elites: spinning ring in the affix colour, a soft glow, a skull marker and an always-on health bar
function drawEliteUnder(o){
  const A = ELITE[o.elite], x = sx(o.x), y = sy(o.y), r = 8 + ((S.t*6|0)%2), n = 18;
  lg.fillStyle = A.c; for (let i=0;i<n;i+=2){ const a = i/n*TAU + S.t*2; lg.fillRect(Math.round(x+Math.cos(a)*r), Math.round(y+Math.sin(a)*r*0.45), 1, 1); }
  lg.globalCompositeOperation = 'lighter'; band(lg, BAND.white, x, y-12, 14, 0.12); lg.globalCompositeOperation = 'source-over'; lg.globalAlpha = 1;
  const my = y - 36;
  lg.fillStyle = '#170d1c'; lg.fillRect(x-3, my-1, 7, 6);
  lg.fillStyle = A.c; lg.fillRect(x-2, my, 5, 3); lg.fillRect(x-1, my+3, 3, 1);
  lg.fillStyle = '#170d1c'; lg.fillRect(x-1, my+1, 1, 1); lg.fillRect(x+1, my+1, 1, 1);
  miniBar(x, my-4, 16, o.hp/o.maxHp, A.c);
}
// bosses
function drawBoss(h){
  if (h.type === 'apc') return drawAPC(h);
  if (h.type === 'swat') return drawVan(h);
  drawBigChar(h);
}
function drawBigChar(h){   // Juggernaut & The Cure: regular character art at 2x
  const d = dirOf(h.face), step = h.moving ? [0,1,0,2][((h.walk||0)/5|0)%4] : 0;
  const spr = charSprite(h.look, d===3 ? 2 : d, step, 'aim', h.flash > 0), w = spr.width*2, hh = spr.height*2, x = sx(h.x), y = sy(h.y);
  if (d === 3){ lg.save(); lg.translate(x,0); lg.scale(-1,1); lg.drawImage(spr, -w/2, y-hh+4, w, hh); lg.restore(); }
  else lg.drawImage(spr, x-w/2, y-hh+4, w, hh);
  if (h.type === 'jugg' && h.charge > 0 && Math.random() < 0.6) FX.smoke(h.x, h.y, 1, 0.6);
  if (h.type === 'cure' && Math.random() < 0.15) S.parts.push({k:'smoke', x:h.x+rand(-10,10), y:h.y-30, vx:0, vy:-12, t:.6, max:.6, r:3, grow:5});
}
function vanSide(){ return propSprite('vanS', () => propCanvas(66,40,(P) => {
  for (const wx of [10,46]){ P(wx,30,11,9,'#141418'); P(wx+3,32,5,4,'#5a5a62'); }
  P(2,10,60,22,'#1e2230'); P(2,10,60,1,'#3a4058'); P(2,30,60,2,'#12141c');
  P(48,12,12,8,'#4a6a8a'); P(50,13,4,2,'#9ac0e0'); P(36,13,10,7,'#2a3a4a');
  P(4,22,40,4,'#e8e8e0'); for (const lx of [8,16,24,32]) P(lx,22,3,4,'#1e2230');
  P(60,22,2,3,'#fff2b0'); P(2,22,2,3,'#d02020'); P(18,6,26,4,'#2a2e3a');
})); }
function vanFront(back){ return propSprite('vanF'+(back?1:0), () => propCanvas(46,44,(P) => {
  P(1,28,6,12,'#141418'); P(39,28,6,12,'#141418');
  P(6,8,34,30,'#1e2230'); P(6,8,34,1,'#3a4058'); P(6,36,34,2,'#12141c');
  if (!back){ P(9,12,28,9,'#4a6a8a'); P(11,13,8,2,'#9ac0e0'); } else { P(10,12,26,9,'#1a1e2a'); P(22,12,1,9,'#3a4058'); }
  const l = back ? '#d02020' : '#fff2b0'; P(9,26,6,3,l); P(31,26,6,3,l); P(16,30,14,3,'#e8e8e0');
})); }
function drawVan(h){
  const d = dirOf(h.face), fl = h.flash > 0;
  let s = d >= 2 ? vanSide() : vanFront(d === 1); if (fl) s = propSprite((d>=2 ? 'vanSw' : 'vanFw'+(d===1?1:0)), () => tinted(s, '#ffffff'));
  const x = sx(h.x), y = sy(h.y) + 10;
  if (d === 3){ lg.save(); lg.translate(x,0); lg.scale(-1,1); lg.drawImage(s, -Math.floor(s.width/2), y-s.height); lg.restore(); }
  else lg.drawImage(s, x-Math.floor(s.width/2), y-s.height);
  const on = (S.t*8|0)%2, ty = y - s.height + 1;   // flashing light bar
  lg.fillStyle = on ? '#ff3030' : '#3050ff'; lg.fillRect(x-7, ty, 6, 2);
  lg.fillStyle = on ? '#3050ff' : '#ff3030'; lg.fillRect(x+1, ty, 6, 2);
  if (h.hp < h.maxHp*0.5 && Math.random() < 0.25) FX.smoke(h.x+rand(-20,20), h.y-30, 1, 0.8);
}

function slotRow(ks, cap, y, on, off){
  const gap = 21, tot = cap*gap - 3;
  for (let i=0;i<cap;i++){ const x = Math.round(LW/2 - tot/2 + i*gap);
    lg.fillStyle = 'rgba(18,10,26,.7)'; lg.fillRect(x, y, 18, 18); lg.fillStyle = i < ks.length ? on : off;
    lg.fillRect(x, y, 18, 1); lg.fillRect(x, y+17, 18, 1); lg.fillRect(x, y, 1, 18); lg.fillRect(x+17, y, 1, 18);
    if (i >= ks.length) continue;
    const k = ks[i]; lg.drawImage(mutIcon(k), x, y);
    if (S.evo[k]){ lg.fillStyle = (S.t*4|0)%2 ? '#ffe070' : '#c89a30'; lg.fillRect(x, y, 18, 1); lg.fillRect(x, y+17, 18, 1); lg.fillRect(x, y, 1, 18); lg.fillRect(x+17, y, 1, 18); }
    const mx = maxLv(k), pw = mx > 6 ? 1 : 2, ps = mx > 6 ? 2 : 3;   // 8 thin pips for weapons, 6 for items
    for (let j=0;j<mx;j++){ lg.fillStyle = j < S.mods[k] ? '#9be03a' : '#3a2e44'; lg.fillRect(x+1+j*ps, y+20, pw, 2); } }
}
