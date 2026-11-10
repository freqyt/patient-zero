"use strict";
// ---------- pixel-art toolkit: palette helpers, bitmap font, procedural sprites ----------
const OUTC = '#170d1c';
function mk(w,h){ const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function hexRgb(h){ const n = parseInt(h.slice(1),16); return [n>>16, (n>>8)&255, n&255]; }
const shades = hex => [shadeHex(hex,0.25), hex, shadeHex(hex,-0.32)];

// 1px outline around every opaque pixel (classic 16-bit sprite edge)
function outline(c, col){
  const g = c.getContext('2d'), w = c.width, h = c.height, id = g.getImageData(0,0,w,h), d = id.data;
  const mark = new Uint8Array(w*h), [r,gg,b] = hexRgb(col||OUTC);
  for (let y=0;y<h;y++) for (let x=0;x<w;x++){
    const i = y*w+x; if (d[i*4+3]) continue;
    if ((x>0 && d[(i-1)*4+3]) || (x<w-1 && d[(i+1)*4+3]) || (y>0 && d[(i-w)*4+3]) || (y<h-1 && d[(i+w)*4+3])) mark[i] = 1;
  }
  for (let i=0;i<w*h;i++) if (mark[i]){ d[i*4]=r; d[i*4+1]=gg; d[i*4+2]=b; d[i*4+3]=255; }
  g.putImageData(id,0,0); return c;
}
function tinted(c, col){ const w = mk(c.width,c.height), g = w.getContext('2d'); g.drawImage(c,0,0);
  g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0,0,w.width,w.height); return w; }
function pcirc(g,cx,cy,r,col){ if (col) g.fillStyle = col; const R = Math.max(0,Math.round(r));
  for (let y=-R;y<=R;y++){ const w = Math.floor(Math.sqrt(R*R-y*y)+0.5); g.fillRect(cx-w,cy+y,w*2+1,1); } }
function pell(g,cx,cy,rx,ry,col){ if (col) g.fillStyle = col; rx = Math.round(rx); ry = Math.max(1,Math.round(ry));
  for (let y=-ry;y<=ry;y++){ const w = Math.round(rx*Math.sqrt(Math.max(0,1-(y*y)/(ry*ry)))); g.fillRect(cx-w,cy+y,w*2+1,1); } }
// banded (stepped) radial sprite: crisp retro light pools
function bandSprite(r,g,b,bands){
  const S = 64, c = mk(S,S), x = c.getContext('2d'), id = x.createImageData(S,S), d = id.data;
  for (let y=0;y<S;y++) for (let xx=0;xx<S;xx++){
    const dist = Math.hypot(xx-S/2+0.5, y-S/2+0.5)/(S/2); if (dist >= 1) continue;
    const lvl = Math.ceil((1-dist)*bands)/bands, i = (y*S+xx)*4;
    d[i]=r; d[i+1]=g; d[i+2]=b; d[i+3] = Math.round(255*Math.pow(lvl,1.3));
  }
  x.putImageData(id,0,0); return c;
}

// ---------- bitmap font (5x7) ----------
const GLYPH = {
  A:'01110100011000111111100011000110001',B:'11110100011000111110100011000111110',C:'01110100011000010000100001000101110',
  D:'11110100011000110001100011000111110',E:'11111100001000011110100001000011111',F:'11111100001000011110100001000010000',
  G:'01110100011000010111100011000101111',H:'10001100011000111111100011000110001',I:'01110001000010000100001000010001110',
  J:'00111000100001000010000101001001100',K:'10001100101010011000101001001010001',L:'10000100001000010000100001000011111',
  M:'10001110111010110101100011000110001',N:'10001100011100110101100111000110001',O:'01110100011000110001100011000101110',
  P:'11110100011000111110100001000010000',Q:'01110100011000110001101011001001101',R:'11110100011000111110101001001010001',
  S:'01111100001000001110000010000111110',T:'11111001000010000100001000010000100',U:'10001100011000110001100011000101110',
  V:'10001100011000110001100010101000100',W:'10001100011000110101101011010101010',X:'10001100010101000100010101000110001',
  Y:'10001100010101000100001000010000100',Z:'11111000010001000100010001000011111',
  0:'01110100011001110101110011000101110',1:'00100011000010000100001000010001110',2:'01110100010000100010001000100011111',
  3:'11111000100010000010000011000101110',4:'00010001100101010010111110001000010',5:'11111100001111000001000011000101110',
  6:'00110010001000011110100011000101110',7:'11111000010001000100010000100001000',8:'01110100011000101110100011000101110',
  9:'01110100011000101111000010001001100',
  ':':'00000011000110000000011000110000000','.':'00000000000000000000000000110001100','/':'00001000100001000100010000100010000',
  '%':'11001110100001000100010000101110011','!':'00100001000010000100001000000000100','-':'00000000000000011111000000000000000',
  '+':'00000001000010011111001000010000000','?':'01110100010000100010001000000000100',',':'00000000000000000000011000010001000',
  "'":'00100001000100000000000000000000000','(':'00010001000100001000010000010000010',')':'01000001000001000010000100010001000',
  '>':'01000001000001000001000100010001000','<':'00010001000100010000010000010000010','=':'00000000001111100000111110000000000',
  ' ':'00000000000000000000000000000000000','*':'00000101010111011111011101010100000','#':'01010010101111101010111110101001010',
};
const GKEYS = Object.keys(GLYPH), GIDX = {}; GKEYS.forEach((k,i) => GIDX[k] = i);
const fontCache = {};
function fontAtlas(col){
  let c = fontCache[col]; if (c) return c;
  c = mk(GKEYS.length*6, 7); const g = c.getContext('2d'); g.fillStyle = col;
  GKEYS.forEach((k,i) => { const s = GLYPH[k]; for (let p=0;p<35;p++) if (s[p]==='1') g.fillRect(i*6+(p%5), (p/5)|0, 1, 1); });
  return fontCache[col] = c;
}
const textW = (s,sc=1) => Math.max(0, String(s).length*6*sc - sc);
function ptext(g, str, x, y, col, o={}){
  str = String(str).toUpperCase(); const sc = o.scale||1, w = textW(str,sc);
  if (o.align==='center') x -= Math.floor(w/2); else if (o.align==='right') x -= w;
  x = Math.round(x); y = Math.round(y);
  if (o.shadow) ptext(g, str, x+sc, y+sc, o.shadow, {scale:sc});
  const A = fontAtlas(col);
  for (let i=0;i<str.length;i++){ const gi = GIDX[str[i]]; if (gi===undefined) continue;
    g.drawImage(A, gi*6, 0, 5, 7, x+i*6*sc, y, 5*sc, 7*sc); }
  return w;
}

// ---------- character looks ----------
const SKINS = ['#f2c9a0','#dda77c','#b9825a','#8a5a3c','#5e3c28'];
const HAIRS = ['#2a1a14','#4a2e1e','#8a5a2a','#d8b46a','#1a1418','#7a2a1a','#9a9aa0','#3a2a4a'];
const SHIRTS = ['#b0303a','#3a5aa8','#d8b048','#4e8a46','#8a4aa0','#d87a30','#e0dccc','#46464e','#2a8a8a','#c85a8a','#7a5a3a','#5a7ab8'];
const PANTS = ['#2e3a5a','#4a3a2a','#2a2a30','#5a5a64','#3a4a36','#6a5a44'];
// horde: grey-teal corpse pallor, clearly duller than Patient Zero's toxic green
const ZSKINS = ['#8c9c94','#7e928c','#98a49a','#86948e','#7a8a90'];
let LOOKID = 0;
function baseLook(type){
  const L = {id: ++LOOKID, type, skin: shades(pick(SKINS)), hair: shades(pick(HAIRS)), style: Math.random()*3|0,
    shirt: shades(pick(SHIRTS)), pants: shades(pick(PANTS)), shoe: '#2a2026', gear: null};
  if (type==='beat'){ L.shirt = shades('#4a6ab8'); L.pants = shades('#1e2a50'); L.gear = 'cap'; L.weapon = 'baton'; }
  if (type==='cop'){ L.shirt = shades('#2c3e78'); L.pants = shades('#1e2a50'); L.gear = 'cap'; L.weapon = 'pistol'; L.pose = 'aim'; }
  if (type==='soldier'){ L.shirt = shades('#5a6b3a'); L.pants = shades('#4a5530'); L.gear = 'helmet'; L.weapon = 'rifle'; L.pose = 'aim'; L.vest = true; L.shoe = '#2a2418'; }
  if (type==='riot'){ L.shirt = shades('#2b3242'); L.pants = shades('#222838'); L.gear = 'riot'; L.shield = true; L.shoe = '#141418'; }
  if (type==='dog'){ L.fur = shades(pick(['#6a4a2a','#2a2420','#8a6a3a'])); L.collar = '#2c3e78'; }
  if (type==='medic'){ L.shirt = shades('#e8e8e0'); L.pants = shades('#3a4a6a'); L.gear = 'medic'; L.medic = true; }
  if (type==='grenadier'){ L.shirt = shades('#4a5a3a'); L.pants = shades('#3a4430'); L.gear = 'helmet'; L.weapon = 'launcher'; L.pose = 'aim'; L.vest = true; L.shoe = '#2a2418'; }
  if (type==='sniper'){ L.shirt = shades('#3a4a2a'); L.pants = shades('#2e3a24'); L.gear = 'beret'; L.weapon = 'longrifle'; L.pose = 'aim'; L.shoe = '#2a2418'; }
  if (type==='flamer'){ L.shirt = shades('#d07a22'); L.pants = shades('#b0661c'); L.gear = 'mask'; L.weapon = 'nozzle'; L.pose = 'aim'; L.tank = true; L.shoe = '#2a2a2a'; }
  return L;
}
// fixed pools keep the sprite cache bounded
const LOOKS = {dog:[], medic:[], grenadier:[], sniper:[], civ:[], beat:[], cop:[], soldier:[], riot:[], flamer:[]};
for (let i=0;i<16;i++) LOOKS.civ.push(baseLook('civ'));
for (const t of ['dog','medic','grenadier','sniper','beat','cop','soldier','riot','flamer']) for (let i=0;i<3;i++) LOOKS[t].push(baseLook(t));
const ZLOOK = new Map();
function zombieLook(L){
  let Z = ZLOOK.get(L.id); if (Z) return Z;
  Z = Object.assign({}, L, {id: ++LOOKID, zombie:true, skin: shades(pick(ZSKINS)), shirt: shades(shadeHex(L.shirt[1],-0.25)),
    pants: shades(shadeHex(L.pants[1],-0.2)), hair: shades(shadeHex(L.hair[1],-0.2)), pose:'reach', shield:false, weapon:null,
    bloat: L.type==='flamer', tank:false,
    blood: [[rand(-3,2)|0, rand(0,5)|0],[rand(-3,2)|0, rand(0,5)|0],[rand(-3,2)|0, rand(0,5)|0]],
    rowOps: {del:[20,25], delCol:12}});   // horde is 2px shorter and 1px narrower than the player
  if (L.type==='dog'){ Z.rowOps = null; Z.fur = shades(pick(['#6e7a6a','#7a8478','#5e6a5e'])); Z.pose = 'walk'; }
  ZLOOK.set(L.id, Z); return Z;
}
const PLAYER_BASE = {type:'player', player:true, zombie:true, skin: shades('#9ccc48'), hair: shades('#2a1a14'), style:2,
  shirt: shades('#c4d8e0'), pants: shades('#9ccc48'), shoe:'#6a9a30', gear:'brain', gown:true, pose:'reach',
  blood: [[1,3],[-2,5],[2,6]]};
// the player's sprite is rebuilt whenever the mutation set changes, so every mutation shows on the body
const PL_CACHE = new Map();
function playerLook(mods){
  const sig = Object.keys(mods).sort().map(k => k+mods[k]).join(','); let L = PL_CACHE.get(sig); if (L) return L;
  const lg = mods.legs || 0;
  L = Object.assign({}, PLAYER_BASE, {id: ++LOOKID, muts: Object.assign({}, mods),
    rowOps: {dup: [20,25].concat(lg>=2 ? [24] : [], lg>=4 ? [26] : []), dupCol: 12}});
  PL_CACHE.set(sig, L); return L;
}
const PLAYER_LOOK = playerLook({});
// stretch/shrink a sprite by duplicating or dropping whole pixel rows/columns (keeps pixels crisp)
function reshape(c, ops){
  if (!ops) return c;
  const rows = [], cols = [];
  for (let y=0;y<c.height;y++){ if (ops.del && ops.del.includes(y)) continue; rows.push(y); if (ops.dup && ops.dup.includes(y)) rows.push(y); }
  for (let x=0;x<c.width;x++){ if (ops.delCol===x) continue; cols.push(x); if (ops.dupCol===x) cols.push(x); }
  const t = mk(c.width, rows.length), tg = t.getContext('2d');
  rows.forEach((sy,dy) => tg.drawImage(c, 0, sy, c.width, 1, 0, dy, c.width, 1));
  const o = mk(cols.length, rows.length), og = o.getContext('2d');
  cols.forEach((sx,dx) => og.drawImage(t, sx, 0, 1, t.height, dx, 0, 1, t.height));
  return o;
}
// mutation overlays drawn onto Patient Zero (coords match buildChar's local space)
function drawMuts(P, M, dir, X, hy){
  const front = dir===0, back = dir===1, side = dir===2, hx = side ? 1 : 0, lv = k => M[k] || 0;
  const BONE = '#ece4c8', BONED = '#b0a688', TOOTH = '#f0ecdc';
  let v;
  if ((v = lv('hide'))){ const pl = '#6e5e5c', ph = '#9a8a84';
    if (!side){ P(X-7,11,3,2,pl); P(X+4,11,3,2,pl); P(X-7,11,3,1,ph); P(X+4,11,3,1,ph);
      if (v>=2){ P(X-3,13,2,2,pl); P(X+1,13,2,2,pl); P(X-3,13,2,1,ph); P(X+1,13,2,1,ph); }
      if (v>=3){ P(X-7,13,1,3,pl); P(X+6,13,1,3,pl); }
      if (v>=4){ P(X-3,16,6,2,pl); P(X-3,16,6,1,ph); }
      if (v>=5 && front) P(X-4,hy+1,8,1,pl); }
    else { P(X-4,11,3,2,pl); P(X-4,11,3,1,ph); if (v>=2) P(X-3,14,2,3,pl); if (v>=4) P(X-4,16,2,3,pl); if (v>=5) P(X-2+hx,hy+1,6,1,pl); } }
  if ((v = lv('aura'))){ const s = front ? [[X+2,hy+1],[X-3,hy+5],[X-6,14],[X+4,15],[X-2,18],[X+1,13]]
      : side ? [[X+hx,hy+2],[X+1,15],[X-2,13],[X-1,18],[X+2+hx,hy+6],[X,20]] : [[X-2,hy+3],[X+2,14],[X-3,17],[X+1,19],[X,hy+6],[X-3,13]];
    for (let i=0;i<Math.min(s.length,v+1);i++){ const [x,y] = s[i]; P(x,y,2,1,'#5a3a52'); P(x,y+1,1,1,'#3a2234'); } }
  if ((v = lv('contagion'))){ const s = front ? [[X-3,hy+1],[X-6,15],[X+2,14],[X+4,16],[X-2,17],[X+2,hy+5],[X-4,hy+4],[X+1,19],[X-6,13],[X+3,hy+2]]
      : side ? [[X-1+hx,hy+2],[X+1,14],[X-2,17],[X+3+hx,hy+5],[X,19],[X-3,13],[X+2+hx,hy+1],[X-1,16],[X+1,20],[X-2,hy+5]]
      : [[X-3,13],[X+2,15],[X-2,18],[X+1,hy+2],[X-3,hy+4],[X+2,17],[X,13],[X-1,20],[X+3,hy+5],[X-4,16]];
    for (let i=0;i<Math.min(s.length,v*2);i++){ const [x,y] = s[i]; P(x,y,1,1,'#f0f060'); } }
  if ((v = lv('boom'))){ const o = '#ff9a2a';
    if (front){ P(X-2,14,1,2,o); if (v>=2) P(X+1,15,1,3,o); if (v>=3) P(X-1,16,2,2,'#ffd060'); if (v>=4){ P(X-6,13,1,1,o); P(X+5,14,1,1,o); } if (v>=5){ P(X-3,hy+2,1,2,o); P(X+2,hy+3,1,1,o); } }
    else if (side){ P(X-1,14,1,2,o); if (v>=3) P(X,16,2,2,'#ffd060'); if (v>=5) P(X+hx,hy+2,1,2,o); }
    else { P(X-2,14,1,3,o); if (v>=3) P(X+1,16,1,2,o); } }
  if ((v = lv('trail'))){ const g1 = '#6abf1f';
    if (!side){ P(X-4,23,3,1,g1); P(X+1,23,3,1,g1); if (v>=2){ P(X-3,22,1,1,g1); P(X+2,22,1,1,g1); } if (v>=4){ P(X-4,20,1,2,g1); P(X+3,21,1,2,g1); } }
    else { P(X-2,23,4,1,g1); if (v>=3) P(X-1,21,1,2,g1); } }
  if ((v = lv('legs'))){ const r = '#c8404a';
    if (!side){ P(X-3,21,1,2,r); P(X+2,21,1,2,r); if (v>=3){ P(X-4,25,1,1,TOOTH); P(X+3,25,1,1,TOOTH); } }
    else { P(X-1,21,1,2,r); if (v>=3) P(X+2,25,1,1,TOOTH); } }
  if ((v = lv('hunger'))){ const b = '#b01828';
    if (front){ P(X-3,hy+6,1,1,b); P(X+2,hy+6,1,1,b); if (v>=2){ P(X-6,15,2,1,b); P(X+3,15,2,1,b); } if (v>=3){ P(X-3,17,2,2,b); P(X+1,13,2,1,b); } if (v>=4) P(X-1,19,3,2,b); if (v>=5) P(X-4,hy+7,8,1,b); }
    else if (side){ P(X+2+hx,hy+6,2,1,b); if (v>=2) P(X+6,14,2,1,b); if (v>=3) P(X-2,16,2,2,b); }
    else if (v>=3) P(X-2,15,3,2,b); }
  if ((v = lv('spikes'))){
    if (!side){ P(X-6,9,1,2,BONE); P(X+5,9,1,2,BONE);
      if (v>=2){ P(X-7,8,1,2,BONE); P(X+6,8,1,2,BONE); }
      if (v>=3){ P(X-8,13,2,1,BONE); P(X+6,13,2,1,BONE); }
      if (v>=4){ P(X-6,hy+1,1,1,BONE); P(X+5,hy+1,1,1,BONE); }
      if (back) for (let i=0;i<Math.min(4,v);i++){ P(X-1,13+i*2,2,1,BONE); P(X-2,13+i*2,1,1,BONED); P(X+1,13+i*2,1,1,BONED); }
      if (front && v>=5) P(X-1,13,2,1,BONE); }
    else { for (let i=0;i<Math.min(5,v+1);i++) P(X-5-(i%2),12+i*2,2,1,BONE); if (v>=3) P(X-1,9,1,2,BONE); } }
  if ((v = lv('spit'))){ const G = '#9be03a';
    if (front){ P(X,hy+7,1,Math.min(1+v,4),G); if (v>=2) P(X-2,hy+6,1,1,'#5aa01a'); if (v>=3){ P(X-2,14,2,1,G); P(X+1,16,1,2,G); } if (v>=5){ P(X-2,12,4,2,'#7acc2a'); P(X-1,12,2,1,'#c4ff6a'); } }
    else if (side){ P(X+3+hx,hy+7,1,Math.min(1+v,4),G); if (v>=5) P(X+1+hx,12,3,2,'#7acc2a'); } }
  if ((v = lv('screech'))){ const m = '#2a0a14';
    if (front){ P(X-2,hy+5,4,2+(v>=3?1:0),m); P(X-2,hy+5,1,1,TOOTH); P(X+1,hy+5,1,1,TOOTH); if (v>=2){ P(X-3,12,1,2,'#c84a6a'); P(X+2,12,1,2,'#c84a6a'); } }
    else if (side){ P(X+2+hx,hy+5,2,2+(v>=3?1:0),m); P(X+3+hx,hy+5,1,1,TOOTH); } }
  if ((v = lv('jaws'))){ const n = 1+Math.ceil(v/2);
    if (front){ P(X-2,hy+7,4,n,'#7a1a2a'); P(X-2,hy+7,1,1,TOOTH); P(X+1,hy+7,1,1,TOOTH); if (v>=3){ P(X-2,hy+6+n,1,1,TOOTH); P(X+1,hy+6+n,1,1,TOOTH); } }
    else if (side){ P(X+1+hx,hy+7,3,n,'#7a1a2a'); P(X+3+hx,hy+7,1,1,TOOTH); } }
  const ext = lv('horde') ? Math.ceil(lv('horde')/2) : 0;
  if (ext){ const w = side ? 7 : (lv('horde')>=3 ? 10 : 8), x0 = side ? X-3+hx : X-w/2;
    P(x0, hy-2-ext, w, ext+1, '#e88aaa'); P(x0+1, hy-2-ext, w-2, 1, '#ffc4d8');
    for (let i=1;i<w-1;i+=3) P(x0+i, hy-1-ext+(i%2), 1, ext, '#a8486e');
    if (lv('horde')>=4) P(x0+2, hy-2-ext, 2, 1, '#ffffff'); }
  if ((v = lv('alpha'))){ const top = hy-3-ext, cr = v>=5 ? '#fff0a0' : '#e8c860';
    const xs = side ? [X-2+hx,X+hx,X+2+hx] : [X-3,X-1,X+1,X+3,X-5,X+4], n = side ? Math.min(3,1+Math.floor(v/2)) : Math.min(6,v+1);
    for (let i=0;i<n;i++){ const hgt = (i<2?2:1) + (v>=5?1:0); P(xs[i], top-hgt+1, 1, hgt, cr); }
    P(side ? X-2+hx : X-4, top+1, side ? 6 : 8, 1, '#a08030'); }
  // newer mutations
  if ((v = lv('chitin'))){ const c1 = '#5a3a2a', c2 = '#8a5a3a', hgt = Math.min(8, 3+v);
    if (back){ P(X-4,12,8,hgt,c1); P(X-4,12,8,1,c2); P(X-1,12,1,hgt,'#2a1a10'); }
    else if (side){ P(X-4,12,2,hgt,c1); P(X-4,12,1,hgt,c2); }
    else { P(X-6,11,2,2,c1); P(X+4,11,2,2,c1); if (v>=3){ P(X-6,13,1,3,c1); P(X+5,13,1,3,c1); } } }
  if ((v = lv('leech'))){ const r = '#c0283a';
    if (front){ P(X-5,14,1,2,r); if (v>=2) P(X+4,15,1,2,r); if (v>=3) P(X-2,hy+2,1,2,r); if (v>=4) P(X+1,17,1,2,r); if (v>=5) P(X-3,18,2,1,r); }
    else if (side){ P(X,15,1,2,r); if (v>=3) P(X+1+hx,hy+2,1,2,r); } }
  if ((v = lv('spores'))){ const s = side ? [[X-5,11],[X-4,15],[X-5,18]] : [[X-6,10],[X+4,10],[X-2,19],[X+2,18],[X-5,16]];
    for (let i=0;i<Math.min(s.length,v);i++){ const [x,y] = s[i]; P(x,y,2,2,'#7acc2a'); P(x,y,1,1,'#c4ff6a'); } }
  if ((v = lv('lash'))){ const t = '#8a3aa0';
    if (!side){ for (let i=0;i<Math.min(3,1+Math.floor(v/2));i++){ P(X-7-i,15+i*2,1,3,t); P(X+6+i,15+i*2,1,3,t); } P(X-7,15,1,1,'#b05ac8'); }
    else for (let i=0;i<Math.min(4,v);i++) P(X-5-i,13+i*2,2,1,t); }
  if ((v = lv('eyes'))){ const s = front ? [[X-3,hy+1],[X+2,hy+1],[X-1,hy],[X-4,hy+5],[X+3,hy+5]] : side ? [[X+1+hx,hy+1],[X+3+hx,hy+1],[X+hx,hy+5]] : [];
    for (let i=0;i<Math.min(s.length,v);i++){ const [x,y] = s[i]; P(x,y,1,1,'#ffe060'); } }
  if ((v = lv('haste'))){ const y1 = '#ffe84a';   // crackling yellow nerve-lines on the limbs
    if (!side){ P(X-6,13,1,1,y1); P(X+5,14,1,1,y1); if (v>=2){ P(X-3,21,1,2,y1); P(X+2,22,1,1,y1); } if (v>=4){ P(X-6,15,1,1,y1); P(X+5,12,1,1,y1); } }
    else { P(X+1,13,1,1,y1); if (v>=2) P(X,22,1,2,y1); if (v>=4) P(X-2,15,1,1,y1); } }
  if ((v = lv('luck'))){   // a sprouting clover on the shoulder, more leaves with level
    const cx = side ? X-3 : X+3, cy = 10; P(cx, cy, 1, 1, '#5ad03a'); if (v>=2) P(cx+1, cy-1, 1, 1, '#5ad03a'); if (v>=3) P(cx-1, cy-1, 1, 1, '#5ad03a'); if (v>=4) P(cx, cy-2, 1, 1, '#9aff6a'); }
  if ((v = lv('might'))){ const m1 = '#7aa83a';   // swollen arms
    if (front){ P(X-7,12,1,3+Math.min(2,v>>1),m1); P(X+6,12,1,3+Math.min(2,v>>1),m1); }
    else if (back){ P(X-7,12,1,3,m1); P(X+6,12,1,3,m1); }
    else P(X-2,12,1,3+Math.min(2,v>>1),m1); }
}

// ---------- character sprite builder (24x28, feet at row 25, centre x 12) ----------
// dir: 0 = facing camera, 1 = facing away, 2 = facing right (left is mirrored)
function buildChar(L, dir, step, pose){
  const c = mk(24,32), g = c.getContext('2d'), X = 12;
  g.translate(0,4);   // 4px headroom for crowns / big brains
  const P = (x,y,w,h,col) => { g.fillStyle = col; g.fillRect(x,y,w,h); };
  const sk = L.skin, sh = L.shirt, pa = L.pants, hr = L.hair, shoe = L.shoe;
  const Z = !!L.zombie, hun = Z ? 1 : 0, hy = 4 + hun;
  const eye = L.player ? '#c6ff4a' : Z ? '#ffc040' : '#1a0f1f';
  const front = dir===0, back = dir===1, side = dir===2;
  const aS = step===1 ? 1 : step===2 ? -1 : 0;
  const lY = step===1 ? -1 : 0, rY = step===2 ? -1 : 0;
  const TANK = ['#b4bac0','#8a9096','#5e646a'];

  // legs
  if (side){
    const f = step===1 ? 2 : step===2 ? -2 : 0;
    P(X-2-f,19,3,5,pa[2]); P(X-2-f,24,4,2,shoe);
    P(X-2+f,19,3,5,pa[1]); P(X-1+f,24,4,2,shoe);
  } else {
    P(X-4,19+lY,3,5,pa[1]); P(X-4,19+lY,1,5,pa[0]); P(X-4,24+lY,3,2,shoe);
    P(X+1,19+rY,3,5,pa[1]); P(X+3,19+rY,1,5,pa[2]); P(X+1,24+rY,3,2,shoe);
  }
  // behind-body items
  if (L.tank && side){ P(X-7,11,3,9,TANK[1]); P(X-7,11,1,9,TANK[0]); P(X-7,11,3,1,TANK[0]); }
  if (side){
    if (pose==='reach'){ P(X,12+aS,6,2,sh[2]); P(X+6,12+aS,2,2,sk[2]); }
    else if (pose==='walk' || pose==='shield'){ P(X-1-aS*2,12,2,4,sh[2]); P(X-1-aS*2,16,2,2,sk[2]); }
  }
  // torso
  if (L.bloat && !side){ P(X-6,11,12,10,sh[1]); P(X-6,11,2,10,sh[0]); P(X+4,11,2,10,sh[2]); P(X-6,20,12,1,sh[2]); }
  else if (L.bloat){ P(X-4,11,9,10,sh[1]); P(X-4,11,2,10,sh[0]); P(X+3,11,2,10,sh[2]); }
  else if (side){ P(X-3,12,6,8,sh[1]); P(X-3,12,1,8,sh[0]); P(X+2,12,1,8,sh[2]); P(X-3,19,6,1,sh[2]); }
  else { P(X-4,12,8,8,sh[1]); P(X-4,12,1,8,sh[0]); P(X+3,12,1,8,sh[2]); P(X-4,19,8,1,sh[2]); }
  if (L.gown){
    if (side){ P(X-3,19,6,2,sh[1]); P(X+2,19,1,2,sh[2]); }
    else { P(X-4,19,8,2,sh[1]); P(X-4,20,8,1,sh[2]); }
    if (back){ P(X-1,12,2,8,sk[1]); P(X-2,14,4,1,'#e8f0f4'); P(X-2,17,4,1,'#e8f0f4'); }
    else if (front){ P(X-2,14,1,1,sh[2]); P(X+1,16,1,1,sh[2]); P(X-2,18,1,1,sh[2]); P(X+2,13,1,1,sh[2]); }
  }
  if (L.vest){ if (side) P(X-2,13,4,5,'#3d4a2a'); else { P(X-3,13,6,5,'#3d4a2a'); if (front){ P(X-3,16,2,2,'#2c361e'); P(X+1,16,2,2,'#2c361e'); } } }
  if (L.type==='soldier' && !L.vest){}
  if (L.type==='soldier' && !side){ P(X-4,13,1,1,'#3e4a28'); P(X+2,18,1,1,'#3e4a28'); }
  if (L.type==='cop' && front){ P(X+1,13,1,1,'#f0d050'); P(X-4,18,8,1,'#141420'); }
  if (L.medic && !side){ P(X-1,14,3,1,'#d02020'); P(X,13,1,3,'#d02020'); }
  if (Z && L.blood && !back) for (const [bx,by] of L.blood) P(X+bx,13+by,side?1:2,1,'#8a1424');
  if (Z && !L.gown && !side){ g.clearRect(X-3,19,1,1); g.clearRect(X,19,1,1); g.clearRect(X+2,19,1,1); }
  if (L.bloat){ const pu = '#b4f04a';
    if (side){ P(X-1,13,2,2,pu); P(X+1,17,2,2,pu); }
    else if (front){ P(X-4,14,2,2,pu); P(X+2,13,2,2,pu); P(X,17,2,2,pu); P(X-3,14,1,1,'#f0ffc0'); P(X+2,13,1,1,'#f0ffc0'); } }
  if (L.tank && back){ P(X-4,11,3,9,TANK[1]); P(X+1,11,3,9,TANK[1]); P(X-4,11,1,9,TANK[0]); P(X+1,11,1,9,TANK[0]); P(X-4,11,7,1,TANK[0]); }
  if (L.tank && front){ P(X-6,10,2,3,TANK[1]); P(X+4,10,2,3,TANK[1]); }

  // arms
  const armsWalk = () => {
    if (side){ P(X-1+aS*2,12,2,4,sh[1]); P(X-1+aS*2,16,2,2,sk[1]); return; }
    P(X-6,12+aS,2,4,sh[1]); P(X-6,12+aS,1,4,sh[0]); P(X-6,16+aS,2,2,sk[1]);
    P(X+4,12-aS,2,4,sh[1]); P(X+5,12-aS,1,4,sh[2]); P(X+4,16-aS,2,2,sk[2]);
  };
  switch (pose){
    case 'walk': armsWalk();
      if (L.weapon==='baton'){   // nightstick in the right hand
        if (side){ P(X+aS*2,13,1,6,'#1a1a20'); P(X+aS*2,13,1,1,'#4a4a55'); }
        else if (front){ P(X+5,15-aS,1,6,'#1a1a20'); P(X+5,15-aS,1,1,'#4a4a55'); }
        else P(X-6,13+aS,1,5,'#1a1a20'); }
      break;
    case 'shield': armsWalk(); if (front) P(X+5,16-aS,1,4,'#222'); break;
    case 'panic':
      if (side){ P(X-1,6,2,6,sh[1]); P(X-1,4,2,2,sk[1]); }
      else { P(X-6,6,2,6,sh[1]); P(X-6,4,2,2,sk[1]); P(X+4,6,2,6,sh[1]); P(X+4,4,2,2,sk[1]); }
      break;
    case 'aim':
      if (side){
        P(X,14,4,2,sh[1]); P(X+4,14,2,2,sk[1]);
        if (L.weapon==='pistol'){ P(X+5,13,4,2,'#2b2b33'); P(X+5,13,4,1,'#4a4a55'); }
        if (L.weapon==='rifle'){ P(X-3,15,3,3,'#4a3a26'); P(X-1,15,12,2,'#33332a'); P(X-1,15,12,1,'#55553f'); P(X+4,17,2,2,'#2a2a22'); }
        if (L.weapon==='nozzle'){ P(X+2,16,8,2,'#6a6a70'); P(X+2,16,8,1,'#8a8a90'); P(X+10,16,1,2,'#7ab8ff'); }
        if (L.weapon==='launcher'){ P(X,13,9,4,'#3a3a2a'); P(X,13,9,1,'#5a5a44'); P(X+8,12,2,6,'#2a2a20'); }
        if (L.weapon==='longrifle'){ P(X-3,15,16,2,'#2a2a22'); P(X-3,15,16,1,'#4a4a3a'); P(X+6,13,4,2,'#1a1a14'); }
        if (L.weapon==='minigun'){ P(X-1,14,13,5,'#2a2a2e'); P(X-1,14,13,1,'#4a4a52'); P(X+11,14,2,5,'#5a5a62'); P(X+1,18,4,3,'#3a3020'); }
      } else if (front){
        P(X-6,12,2,3,sh[1]); P(X+4,12,2,3,sh[1]); P(X-5,14,3,2,sh[2]); P(X+2,14,3,2,sh[2]); P(X-2,15,4,2,sk[1]);
        if (L.weapon==='pistol'){ P(X-1,16,2,3,'#2b2b33'); }
        if (L.weapon==='rifle'){ P(X-1,13,2,9,'#33332a'); P(X-1,13,1,9,'#55553f'); }
        if (L.weapon==='nozzle'){ P(X-1,15,2,7,'#6a6a70'); P(X-1,22,2,1,'#7ab8ff'); }
        if (L.weapon==='launcher'){ P(X-2,13,4,7,'#3a3a2a'); P(X-1,19,2,1,'#1a1a14'); }
        if (L.weapon==='longrifle'){ P(X-1,12,2,11,'#2a2a22'); P(X-1,12,1,11,'#4a4a3a'); }
        if (L.weapon==='minigun'){ P(X-3,14,6,7,'#2a2a2e'); P(X-2,20,1,1,'#5a5a62'); P(X,20,1,1,'#5a5a62'); }
      } else { P(X-6,12,2,3,sh[2]); P(X+4,12,2,3,sh[2]); if (L.weapon==='rifle') P(X+3,8,2,5,'#33332a'); }
      break;
    case 'reach':
      if (side){ P(X,14+aS,6,2,sh[1]); P(X,14+aS,6,1,sh[0]); P(X+6,14+aS,2,2,sk[1]); P(X+8,14+aS,1,1,sk[2]); }
      else if (front){ P(X-6,12,2,3,sh[2]); P(X+4,12,2,3,sh[2]); P(X-6,14+aS,3,2,sk[1]); P(X+3,14-aS,3,2,sk[1]); P(X-6,16+aS,1,1,sk[2]); P(X+5,16-aS,1,1,sk[2]); }
      else { P(X-6,12,2,3,sh[2]); P(X+4,12,2,3,sh[2]); }
      break;
  }

  // head
  if (side){
    const hx = hun;
    P(X-3+hx,hy,7,8,sk[1]); P(X-3+hx,hy,1,8,sk[0]); P(X-3+hx,hy+7,7,1,sk[2]); P(X+4+hx,hy+4,1,2,sk[1]);
    P(X+2+hx,hy+3,1,2,eye); P(X-1+hx,hy+4,1,2,sk[2]);
    if (Z) P(X+2+hx,hy+6,2,1,'#5a1424');
    if (!L.gear){
      if (L.style!==2){ P(X-3+hx,hy-1,7,3,hr[1]); P(X-3+hx,hy-1,7,1,hr[0]); P(X-3+hx,hy+2,3,3,hr[1]); }
      if (L.style===1) P(X-4+hx,hy+2,3,6,hr[1]);
    }
  } else if (front){
    P(X-4,hy,8,8,sk[1]); P(X-4,hy,1,8,sk[0]); P(X+3,hy,1,8,sk[2]); P(X-4,hy+7,8,1,sk[2]);
    P(X-2,hy+3,1,2,eye); P(X+1,hy+3,1,2,eye);
    if (Z) P(X-1,hy+6,3,1,'#5a1424');
    if (!L.gear){
      if (L.style===0){ P(X-4,hy-1,8,3,hr[1]); P(X-4,hy-1,8,1,hr[0]); P(X-4,hy+2,1,2,hr[1]); P(X+3,hy+2,1,2,hr[2]); }
      if (L.style===1){ P(X-5,hy-1,10,3,hr[1]); P(X-5,hy-1,10,1,hr[0]); P(X-5,hy+2,2,6,hr[1]); P(X+3,hy+2,2,6,hr[2]); }
      if (L.style===2) P(X-2,hy,3,1,sk[0]);
    }
  } else {
    P(X-4,hy,8,8,sk[2]); P(X-4,hy,1,8,sk[1]);
    if (!L.gear){
      if (L.style===0){ P(X-4,hy-1,8,7,hr[1]); P(X-4,hy-1,8,1,hr[0]); P(X+3,hy,1,6,hr[2]); }
      if (L.style===1){ P(X-5,hy-1,10,10,hr[1]); P(X-5,hy-1,10,1,hr[0]); P(X+4,hy,1,9,hr[2]); }
      if (L.style===2) P(X-2,hy,3,1,sk[1]);
    }
  }
  // headgear
  const hx = side ? hun : 0;
  switch (L.gear){
    case 'cap':
      if (side){ P(X-3+hx,hy-1,7,3,'#2c3e78'); P(X-3+hx,hy-1,7,1,'#4a5ea0'); P(X+3+hx,hy+1,3,1,'#141c38'); }
      else { P(X-4,hy-1,8,3,'#2c3e78'); P(X-4,hy-1,8,1,'#4a5ea0'); if (front){ P(X-4,hy+2,8,1,'#141c38'); P(X-1,hy,2,1,'#f0d050'); } }
      break;
    case 'helmet':
      if (side){ P(X-4+hx,hy-2,9,5,'#5d6e3c'); P(X-4+hx,hy-2,9,1,'#7d9050'); P(X-4+hx,hy+2,9,1,'#3e4a28'); }
      else { P(X-5,hy-2,10,5,'#5d6e3c'); P(X-5,hy-2,10,1,'#7d9050'); P(X-5,hy+2,10,1,'#3e4a28'); if (front){ P(X-4,hy+3,1,4,'#2a2a22'); P(X+3,hy+3,1,4,'#2a2a22'); } }
      break;
    case 'riot':
      if (side){ P(X-4+hx,hy-2,9,7,'#2b3242'); P(X-4+hx,hy-2,9,1,'#4a5672'); P(X+1+hx,hy+2,4,3,'#8fc4ec'); P(X+1+hx,hy+2,4,1,'#d4ecff'); }
      else if (front){ P(X-5,hy-2,10,7,'#2b3242'); P(X-5,hy-2,10,1,'#4a5672'); P(X-4,hy+2,8,3,'#8fc4ec'); P(X-4,hy+2,8,1,'#d4ecff'); }
      else { P(X-5,hy-2,10,9,'#2b3242'); P(X-5,hy-2,10,1,'#4a5672'); }
      break;
    case 'mask':
      if (side){ P(X-4+hx,hy-1,9,9,'#d07a22'); P(X-4+hx,hy-1,9,1,'#f09a42'); P(X+1+hx,hy+2,4,4,'#2e2e2e'); P(X+2+hx,hy+2,2,2,'#9fe0f8'); }
      else if (front){ P(X-5,hy-1,10,9,'#d07a22'); P(X-5,hy-1,10,1,'#f09a42'); P(X-3,hy+2,6,4,'#2e2e2e'); P(X-3,hy+2,2,2,'#9fe0f8'); P(X+1,hy+2,2,2,'#9fe0f8'); P(X-1,hy+5,2,2,'#5a5a5a'); }
      else { P(X-5,hy-1,10,9,'#d07a22'); P(X-5,hy-1,10,1,'#f09a42'); }
      break;
    case 'medic':
      if (side){ P(X-3+hx,hy-1,7,3,'#f0f0e8'); P(X+3+hx,hy+1,3,1,'#c8c8c0'); }
      else { P(X-4,hy-1,8,3,'#f0f0e8'); if (front){ P(X-4,hy+2,8,1,'#c8c8c0'); P(X-1,hy-1,2,1,'#d02020'); P(X-2,hy,4,1,'#d02020'); } }
      break;
    case 'beret':
      if (side){ P(X-3+hx,hy-1,7,2,'#2a3a1a'); P(X-4+hx,hy,2,2,'#2a3a1a'); }
      else { P(X-4,hy-1,8,2,'#2a3a1a'); P(X-5,hy,2,2,'#2a3a1a'); if (front) P(X+1,hy-1,2,1,'#c8a040'); }
      break;
    case 'brain':
      if (side){ P(X-3+hx,hy-2,7,4,'#e88aaa'); P(X-2+hx,hy-2,5,1,'#ffc4d8'); P(X+hx,hy-1,1,2,'#a8486e'); for (let i=0;i<7;i+=2) P(X-3+hx+i,hy+2,1,1,'#3a1a22'); }
      else { P(X-4,hy-2,8,4,'#e88aaa'); P(X-3,hy-2,6,1,'#ffc4d8'); P(X-1,hy-1,1,3,'#a8486e'); P(X+2,hy-1,1,2,'#a8486e');
        if (front) for (let i=0;i<8;i+=2) P(X-4+i,hy+2,1,1,'#3a1a22'); }
      break;
  }
  // front items
  if (L.shield){
    const S0 = '#7d90a6', S1 = '#a8bccf', S2 = '#55657a';
    if (front){ P(X-8,11,7,12,S0); P(X-8,11,7,1,S1); P(X-8,11,1,12,S1); P(X-2,11,1,12,S2); P(X-7,15,5,1,'#e8eef4'); }
    else if (side){ P(X+4,10,3,13,S0); P(X+4,10,1,13,S1); P(X+6,10,1,13,S2); }
    else { P(X+4,12,2,10,S2); }
  }
  if (L.muts) drawMuts(P, L.muts, dir, X, hy);
  return outline(reshape(c, L.rowOps));
}
const spriteCache = new Map();
function charSprite(L, dir, step, pose, flash){
  const key = L.id*1000 + dir*100 + step*10 + (['walk','aim','reach','panic','shield'].indexOf(pose)) + (flash ? 0.5 : 0);
  let s = spriteCache.get(key); if (s) return s;
  if (flash){ s = tinted(charSprite(L,dir,step,pose,false), '#ffffff'); }
  else s = L.type==='dog' ? buildDog(L, dir, step) : buildChar(L, dir, step, pose);
  spriteCache.set(key, s); return s;
}
function corpseSprite(L){
  const key = 'c'+L.id; let s = spriteCache.get(key); if (s) return s;
  const src = charSprite(L, 0, 0, 'walk', false);
  s = mk(28,24); const g = s.getContext('2d');
  g.translate(14,12); g.rotate(-Math.PI/2); g.drawImage(src,-Math.floor(src.width/2),-Math.floor(src.height*0.58)); g.setTransform(1,0,0,1,0,0);
  g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(30,10,30,.28)'; g.fillRect(0,0,28,24);
  spriteCache.set(key, s); return s;
}

// ---------- props (3/4 view sprites, anchored bottom-centre) ----------
function propCanvas(w,h,fn){ const c = mk(w,h), g = c.getContext('2d'); fn((x,y,ww,hh,col) => { g.fillStyle = col; g.fillRect(x,y,ww,hh); }, g); return outline(c); }
const propCache2 = new Map();
function propSprite(key, make){ let s = propCache2.get(key); if (!s){ s = make(); propCache2.set(key,s); } return s; }

function carSideSprite(col, kind){
  return propSprite('cs'+col+kind, () => propCanvas(46,26,(P) => {
    const burned = kind==='burned', police = kind==='police';
    const b = burned ? ['#4a403c','#3a322e','#2a2420'] : police ? ['#f0f0ec','#d8d8d2','#a8a8a2'] : shades(col);
    P(6,19,8,5,'#18161c'); P(31,19,8,5,'#18161c'); if (!burned){ P(8,20,3,2,'#6a6a72'); P(33,20,3,2,'#6a6a72'); }
    P(2,12,42,9,b[1]); P(2,12,42,1,b[0]); P(2,19,42,2,b[2]);
    if (police){ P(14,13,17,6,'#1a1a22'); P(19,14,6,2,'#f0f0ec'); }
    P(2,9,11,4,b[0]); P(31,9,13,4,b[0]);
    P(12,6,20,7, burned ? '#141010' : '#33475a'); P(21,6,1,7,b[2]); P(12,6,1,7,b[2]); P(31,6,1,7,b[2]);
    if (!burned){ P(14,7,4,1,'#7a98b4'); P(24,7,3,1,'#7a98b4'); }
    P(13,3,18,4,b[0]); P(14,3,16,1,shadeHex(b[0],0.2));
    if (police){ P(18,1,4,2,'#e02828'); P(22,1,4,2,'#2848e8'); }
    if (!burned){ P(43,13,1,2,'#fff2b0'); P(2,13,1,2,'#d02020'); }
    else { P(8,14,2,2,'#7a3a1a'); P(27,16,3,1,'#7a3a1a'); P(36,13,2,1,'#7a3a1a'); P(18,4,3,1,'#5a2a14'); }
  }));
}
function carFrontSprite(col, kind, back){
  return propSprite('cf'+col+kind+(back?1:0), () => propCanvas(28,32,(P) => {
    const burned = kind==='burned', police = kind==='police';
    const b = burned ? ['#4a403c','#3a322e','#2a2420'] : police ? ['#f0f0ec','#d8d8d2','#a8a8a2'] : shades(col);
    P(1,22,3,7,'#18161c'); P(24,22,3,7,'#18161c');
    P(4,2,20,5,b[0]); P(6,7,16,5,b[0]); P(7,7,14,1,shadeHex(b[0],0.2));
    P(5,12,18,5, burned ? '#141010' : '#33475a'); if (!burned) P(7,13,4,1,'#7a98b4');
    P(3,17,22,6,b[0]); P(3,17,22,1,shadeHex(b[0],0.15));
    P(2,23,24,5,b[1]); P(2,27,24,1,b[2]);
    if (!burned){ const l = back ? '#d02020' : '#fff2b0'; P(3,24,4,2,l); P(21,24,4,2,l); }
    P(10,24,8,2,'#1a1a22');
    if (police){ P(9,6,5,2,'#e02828'); P(14,6,5,2,'#2848e8'); }
    if (burned){ P(6,19,2,2,'#7a3a1a'); P(18,25,3,1,'#7a3a1a'); }
  }));
}
function treeSprite(v){
  return propSprite('tree'+v, () => { const r = mulberry(v*977+13); return propCanvas(40,52,(P,g) => {
    P(18,34,5,15,'#5a3a24'); P(18,34,1,15,'#7a5434'); P(22,34,1,15,'#3a2414'); P(16,47,9,2,'#4a3020');
    if (v===3){ // dead tree
      P(20,14,2,20,'#4a3424'); P(12,18,8,2,'#4a3424'); P(10,14,2,5,'#4a3424'); P(22,22,9,2,'#4a3424'); P(29,16,2,7,'#4a3424'); P(16,10,2,6,'#4a3424');
      return; }
    pell(g,20,20,17,15,'#1f3a26'); pell(g,18,17,14,12,'#2c5232'); pell(g,15,13,8,7,'#3e6e3a');
    for (let i=0;i<70;i++){ const a = r()*TAU, d = Math.sqrt(r())*14;
      P(Math.round(20+Math.cos(a)*d*1.15), Math.round(20+Math.sin(a)*d), 1, 1, r()<0.5 ? '#4f8442' : '#17301e'); }
    for (let i=0;i<5;i++) P(Math.round(10+r()*20), Math.round(8+r()*22), 2, 1, '#6aa050');
  }); });
}
const LAMP_SPR = () => propSprite('lamp', () => propCanvas(14,60,(P) => {
  P(6,10,2,46,'#3c3c48'); P(6,10,1,46,'#5a5a6a'); P(4,54,6,4,'#2c2c36'); P(5,54,4,1,'#4a4a58');
  P(2,5,10,4,'#4a4a58'); P(2,5,10,1,'#6a6a7a'); P(3,9,8,1,'#ffe6a0');
}));
const LAMP_BROKEN = () => propSprite('lampb', () => propCanvas(14,60,(P) => {
  P(6,10,2,46,'#3c3c48'); P(6,10,1,46,'#5a5a6a'); P(4,54,6,4,'#2c2c36'); P(2,5,10,4,'#4a4a58'); P(3,9,8,1,'#2a2a30');
}));
const SPR = {
  bench: () => propSprite('bench', () => propCanvas(28,16,(P) => { P(2,2,24,5,'#7a5434'); P(2,2,24,1,'#9a7048'); P(2,5,24,1,'#5a3a24');
    P(2,8,24,4,'#8a6040'); P(2,8,24,1,'#aa8058'); P(3,12,2,3,'#2a2a30'); P(23,12,2,3,'#2a2a30'); })),
  dumpster: () => propSprite('dump', () => propCanvas(34,26,(P) => { P(2,2,30,8,'#3e7a4e'); P(2,2,30,1,'#5a9a6a'); P(16,2,1,8,'#2a5a3a');
    P(2,10,30,12,'#2e5e3e'); P(2,10,30,1,'#4a8a5a'); P(2,20,30,2,'#1e4a2e'); P(5,13,6,1,'#1e4a2e'); P(23,13,6,1,'#1e4a2e');
    P(4,22,3,3,'#18161c'); P(27,22,3,3,'#18161c'); P(12,14,4,3,'#c8c0a0'); })),
  barrel: () => propSprite('barrel', () => propCanvas(14,18,(P) => { P(2,2,10,3,'#8a4a22'); P(3,2,8,1,'#b06a3a'); P(4,3,6,1,'#4a2410');
    P(2,5,10,11,'#7a3e1c'); P(2,5,2,11,'#9a5a2c'); P(10,5,2,11,'#5a2a12'); P(2,8,10,1,'#4a2410'); P(2,13,10,1,'#4a2410'); })),
  toxic: () => propSprite('toxic', () => propCanvas(14,18,(P) => { P(2,2,10,3,'#c8b030'); P(3,3,8,1,'#7ad030');
    P(2,5,10,11,'#b8a020'); P(2,5,2,11,'#d8c040'); P(10,5,2,11,'#8a7410'); P(5,8,4,4,'#1a1a1a'); P(6,9,2,2,'#c8b030');
    P(3,15,4,2,'#8ae03a'); P(9,14,2,3,'#8ae03a'); })),
  crate: () => propSprite('crate', () => propCanvas(18,18,(P) => { P(2,2,14,5,'#a07a48'); P(2,2,14,1,'#c09a60'); P(2,7,14,9,'#7a5a32');
    P(2,7,14,1,'#5a4024'); P(2,15,14,1,'#5a4024'); P(8,7,2,9,'#5a4024'); P(3,8,1,7,'#9a7444'); })),
  sandbags: () => propSprite('sand', () => propCanvas(44,16,(P) => { for (let row=0;row<2;row++) for (let i=0;i<4-row;i++){
    const x = 2+i*10+row*5, y = 8-row*5; P(x,y,10,6,'#9a8a60'); P(x,y,10,1,'#bcae80'); P(x,y+5,10,1,'#6a5a3a'); P(x+9,y,1,6,'#6a5a3a'); } })),
  cone: () => propSprite('cone', () => propCanvas(10,12,(P) => { P(4,2,2,2,'#f07a2a'); P(3,4,4,2,'#f0ecdc'); P(3,6,4,2,'#f07a2a'); P(2,8,6,2,'#e06a1a'); P(1,10,8,1,'#a04a10'); })),
  hydrant: () => propSprite('hyd', () => propCanvas(12,16,(P) => { P(4,2,4,2,'#d03030'); P(3,4,6,9,'#c02828'); P(3,4,1,9,'#e05050'); P(1,7,10,2,'#a01818'); P(2,13,8,2,'#801010'); })),
  fountain: () => propSprite('fount', () => propCanvas(70,44,(P,g) => {
    pell(g,35,26,32,15,'#6a6458'); pell(g,35,25,32,14,'#8a8274'); pell(g,35,26,27,11,'#2c5a2a'); pell(g,35,27,24,9,'#3a7a2e');
    for (let i=0;i<10;i++) P(14+i*4, 24+(i%3), 2, 1, '#7ad040');
    P(32,8,6,18,'#7a7468'); P(32,8,2,18,'#9a9488'); P(29,6,12,3,'#8a8478'); P(29,6,12,1,'#aaa498');
    P(33,2,4,4,'#9a9488'); P(26,28,3,2,'#a6f04a'); P(43,22,2,2,'#a6f04a');
  })),
  planter: () => propSprite('plant', () => propCanvas(30,26,(P,g) => { P(2,12,26,12,'#7a7264'); P(2,12,26,1,'#9a9284'); P(2,22,26,2,'#5a5246');
    pell(g,15,11,12,8,'#2c5232'); pell(g,13,9,8,5,'#3e6e3a'); P(8,6,2,1,'#e0a0c0'); P(18,9,2,1,'#e0d060'); P(12,13,2,1,'#e0a0c0'); })),
  mailbox: () => propSprite('mail', () => propCanvas(14,20,(P) => { P(2,2,10,4,'#3a5ab8'); P(3,2,8,1,'#5a7ad8'); P(2,6,10,8,'#2a4aa0'); P(2,6,2,8,'#4a6ac8');
    P(4,7,6,1,'#141c38'); P(5,14,4,4,'#2a2a30'); })),
};
// 16x16 icons from emoji, crushed to pixels with an outline
const iconCache = {};
const mutIcon = k => S && S.evo && S.evo[k] ? emojiIcon(EVOS[k].ic, '#7a5208') : emojiIcon(MUTS[k].ic);
function emojiIcon(str, rim){
  const key = str + (rim||''); if (iconCache[key]) return iconCache[key];
  const c = mk(18,18), g = c.getContext('2d');
  g.font = '13px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(str, 9, 10);
  const id = g.getImageData(0,0,18,18), d = id.data;
  for (let i=0;i<d.length;i+=4){ if (d[i+3] < 110) d[i+3] = 0; else { d[i+3] = 255; for (let j=0;j<3;j++) d[i+j] = Math.round(d[i+j]/32)*32; } }
  g.putImageData(id,0,0); outline(c, rim);
  return iconCache[key] = c;
}

// ---------- gas station props (pumps & fuel barrels become explosive targets in play) ----------
SPR.pump = () => propSprite('pump', () => propCanvas(16,28,(P) => {
  P(2,24,12,3,'#5a5a62');                                            // island base
  P(3,4,10,20,'#c82830'); P(3,4,2,20,'#e84a50'); P(11,4,2,20,'#8a1418'); // body
  P(4,6,8,5,'#f0ecdc'); P(5,7,6,3,'#2a3a2a'); P(6,8,3,1,'#7aff7a');   // display
  P(5,13,6,2,'#f0ecdc');                                             // brand stripe
  P(12,12,3,2,'#2a2a2a'); P(14,12,1,8,'#2a2a2a'); P(12,19,3,2,'#3a3a3a'); // hose & nozzle
  P(3,2,10,2,'#e8e4d4');                                             // cap
}));
SPR.fuel = () => propSprite('fuel', () => propCanvas(14,18,(P) => {
  P(2,2,10,3,'#c82830'); P(3,2,8,1,'#f05050'); P(4,3,6,1,'#5a0a10');
  P(2,5,10,11,'#b01e28'); P(2,5,2,11,'#e04048'); P(10,5,2,11,'#7a0e14');
  P(2,8,10,1,'#5a0a10'); P(2,13,10,1,'#5a0a10');
  P(5,9,4,3,'#ffd860'); P(6,10,2,1,'#c82830');                       // flame label
}));
SPR.pumpWreck = () => propSprite('pumpWr', () => propCanvas(16,14,(P) => {
  P(2,10,12,3,'#3a3a40'); P(4,5,8,6,'#2a2220'); P(5,4,3,2,'#4a2a1a'); P(9,6,2,1,'#7a3a1a'); }));
SPR.fuelWreck = () => propSprite('fuelWr', () => propCanvas(14,10,(P) => {
  P(2,4,10,4,'#3a1a14'); P(3,3,3,2,'#5a2a1a'); P(8,2,3,3,'#2a1610'); }));
SPR.kiosk = () => propSprite('kiosk', () => propCanvas(76,52,(P) => {
  P(2,6,72,8,'#c82830'); P(2,6,72,1,'#e84a50'); P(2,13,72,1,'#8a1418');          // roof band
  P(26,8,24,4,'#f0ecdc'); P(30,9,16,2,'#c82830');                                // sign
  P(4,14,68,34,'#d8d0bc'); P(4,14,2,34,'#ece4d0'); P(70,14,2,34,'#a89e8a');      // wall
  P(8,18,24,16,'#2a4a5a'); P(10,19,8,3,'#6a9ab4'); P(44,18,24,16,'#2a4a5a'); P(46,19,8,3,'#6a9ab4'); // windows
  P(34,22,8,26,'#3a2e24'); P(40,34,1,2,'#d8b048');                               // door
  P(9,30,6,4,'#c8a83a'); P(52,28,10,6,'#a8e060');                                // shelf goods
  P(4,46,68,2,'#8a8270'); P(14,36,1,1,'#1a1a1a');
}));

// ---------- K9 dog (4 facings like the people; zombie dogs get grey fur and red eyes) ----------
function buildDog(L, dir, step){
  const c = mk(24,32), g = c.getContext('2d'), X = 12; g.translate(0,4);
  const P = (x,y,w,h,col) => { g.fillStyle = col; g.fillRect(x,y,w,h); };
  const f = L.fur, Z = !!L.zombie, eye = Z ? '#ff4040' : '#1a0f1f', s = step===1 ? 1 : step===2 ? -1 : 0;
  if (dir === 2){
    P(X-10,15,3,1,f[2]); P(X-11,14,1,1,f[2]);                                   // tail
    P(X-6+s,21,2,4,f[2]); P(X+3-s,21,2,4,f[2]); P(X-4-s,21,2,4,f[1]); P(X+5+s,21,2,4,f[1]);   // legs
    P(X-7,16,13,6,f[1]); P(X-7,16,13,1,f[0]); P(X-7,21,13,1,f[2]);              // body
    P(X+4,12,6,6,f[1]); P(X+4,12,6,1,f[0]); P(X+9,15,3,3,f[1]); P(X+11,15,1,1,'#1a0f1f');   // head + snout
    P(X+5,10,2,3,f[2]); P(X+7,14,1,1,eye);
    if (L.collar && !Z) P(X+3,16,2,3,L.collar);
    if (Z){ P(X-2,17,2,2,'#8a1424'); P(X+9,17,2,1,'#e0d8c8'); }
  } else {
    const back = dir === 1;
    P(X-4,20+(step===1?-1:0),2,5,f[2]); P(X+2,20+(step===2?-1:0),2,5,f[2]);   // legs
    P(X-4,16,8,6,f[1]); P(X-4,16,8,1,f[0]);                                      // body
    P(X-3,10,6,7,back ? f[2] : f[1]); P(X-3,10,6,1,f[0]); P(X-4,9,2,3,f[2]); P(X+2,9,2,3,f[2]);   // head + ears
    if (!back){ P(X-1,14,2,2,f[0]); P(X-1,15,2,1,'#1a0f1f'); P(X-2,12,1,1,eye); P(X+1,12,1,1,eye);
      if (L.collar && !Z) P(X-3,17,6,1,L.collar); if (Z) P(X-1,16,2,1,'#8a1424'); }
    else P(X,14,1,3,f[2]);
  }
  return outline(c);
}
// boss looks (drawn at 2x)
const JUGG_LOOK = Object.assign(baseLook('riot'), {id: ++LOOKID, shirt: shades('#3a3e46'), pants: shades('#2a2e36'), gear:'riot', weapon:'minigun', pose:'aim', vest:true, shield:false});
const CURE_LOOK = Object.assign(baseLook('flamer'), {id: ++LOOKID, shirt: shades('#e8e0a0'), pants: shades('#d8d090'), gear:'mask', weapon:'nozzle', tank:true, medic:true});
