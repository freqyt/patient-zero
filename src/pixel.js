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
const ZSKINS = ['#a8c46a','#8fb05a','#9cb07a','#b4c080','#86a862'];
let LOOKID = 0;
function baseLook(type){
  const L = {id: ++LOOKID, type, skin: shades(pick(SKINS)), hair: shades(pick(HAIRS)), style: Math.random()*3|0,
    shirt: shades(pick(SHIRTS)), pants: shades(pick(PANTS)), shoe: '#2a2026', gear: null};
  if (type==='cop'){ L.shirt = shades('#2c3e78'); L.pants = shades('#1e2a50'); L.gear = 'cap'; L.weapon = 'pistol'; L.pose = 'aim'; }
  if (type==='soldier'){ L.shirt = shades('#5a6b3a'); L.pants = shades('#4a5530'); L.gear = 'helmet'; L.weapon = 'rifle'; L.pose = 'aim'; L.vest = true; L.shoe = '#2a2418'; }
  if (type==='riot'){ L.shirt = shades('#2b3242'); L.pants = shades('#222838'); L.gear = 'riot'; L.shield = true; L.shoe = '#141418'; }
  if (type==='flamer'){ L.shirt = shades('#d07a22'); L.pants = shades('#b0661c'); L.gear = 'mask'; L.weapon = 'nozzle'; L.pose = 'aim'; L.tank = true; L.shoe = '#2a2a2a'; }
  return L;
}
// fixed pools keep the sprite cache bounded
const LOOKS = {civ:[], cop:[], soldier:[], riot:[], flamer:[]};
for (let i=0;i<16;i++) LOOKS.civ.push(baseLook('civ'));
for (const t of ['cop','soldier','riot','flamer']) for (let i=0;i<3;i++) LOOKS[t].push(baseLook(t));
const ZLOOK = new Map();
function zombieLook(L){
  let Z = ZLOOK.get(L.id); if (Z) return Z;
  Z = Object.assign({}, L, {id: ++LOOKID, zombie:true, skin: shades(pick(ZSKINS)), shirt: shades(shadeHex(L.shirt[1],-0.25)),
    pants: shades(shadeHex(L.pants[1],-0.2)), hair: shades(shadeHex(L.hair[1],-0.2)), pose:'reach', shield:false, weapon:null,
    bloat: L.type==='flamer', tank:false,
    blood: [[rand(-3,2)|0, rand(0,5)|0],[rand(-3,2)|0, rand(0,5)|0],[rand(-3,2)|0, rand(0,5)|0]]});
  ZLOOK.set(L.id, Z); return Z;
}
const PLAYER_LOOK = {id: ++LOOKID, type:'player', player:true, zombie:true, skin: shades('#a6c072'), hair: shades('#2a1a14'), style:2,
  shirt: shades('#c4d8e0'), pants: shades('#a6c072'), shoe:'#7d9a4e', gear:'brain', gown:true, pose:'reach',
  blood: [[1,3],[-2,5],[2,6]]};

// ---------- character sprite builder (24x28, feet at row 25, centre x 12) ----------
// dir: 0 = facing camera, 1 = facing away, 2 = facing right (left is mirrored)
function buildChar(L, dir, step, pose){
  const c = mk(24,28), g = c.getContext('2d'), X = 12;
  const P = (x,y,w,h,col) => { g.fillStyle = col; g.fillRect(x,y,w,h); };
  const sk = L.skin, sh = L.shirt, pa = L.pants, hr = L.hair, shoe = L.shoe;
  const Z = !!L.zombie, hun = Z ? 1 : 0, hy = 4 + hun;
  const eye = L.player ? '#c6ff4a' : Z ? '#eaff60' : '#1a0f1f';
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
    case 'walk': armsWalk(); break;
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
      } else if (front){
        P(X-6,12,2,3,sh[1]); P(X+4,12,2,3,sh[1]); P(X-5,14,3,2,sh[2]); P(X+2,14,3,2,sh[2]); P(X-2,15,4,2,sk[1]);
        if (L.weapon==='pistol'){ P(X-1,16,2,3,'#2b2b33'); }
        if (L.weapon==='rifle'){ P(X-1,13,2,9,'#33332a'); P(X-1,13,1,9,'#55553f'); }
        if (L.weapon==='nozzle'){ P(X-1,15,2,7,'#6a6a70'); P(X-1,22,2,1,'#7ab8ff'); }
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
  return outline(c);
}
const spriteCache = new Map();
function charSprite(L, dir, step, pose, flash){
  const key = L.id*1000 + dir*100 + step*10 + (['walk','aim','reach','panic','shield'].indexOf(pose)) + (flash ? 0.5 : 0);
  let s = spriteCache.get(key); if (s) return s;
  if (flash){ s = tinted(charSprite(L,dir,step,pose,false), '#ffffff'); }
  else s = buildChar(L, dir, step, pose);
  spriteCache.set(key, s); return s;
}
function corpseSprite(L){
  const key = 'c'+L.id; let s = spriteCache.get(key); if (s) return s;
  const src = charSprite(L, 0, 0, 'walk', false);
  s = mk(28,24); const g = s.getContext('2d');
  g.translate(14,12); g.rotate(-Math.PI/2); g.drawImage(src,-12,-15); g.setTransform(1,0,0,1,0,0);
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
function mutIcon(k){
  if (iconCache[k]) return iconCache[k];
  const c = mk(18,18), g = c.getContext('2d');
  g.font = '13px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(MUTS[k].ic, 9, 10);
  const id = g.getImageData(0,0,18,18), d = id.data;
  for (let i=0;i<d.length;i+=4){ if (d[i+3] < 110) d[i+3] = 0; else { d[i+3] = 255; for (let j=0;j<3;j++) d[i+j] = Math.round(d[i+j]/32)*32; } }
  g.putImageData(id,0,0); outline(c);
  return iconCache[k] = c;
}
