"use strict";
// ---------- procedural pixel city ----------
// World units are 2x render pixels. A chunk is 20x20 tiles of 16px (= 640 world units)
// with a road intersection in the middle (tiles 8..11). The four corner pieces of
// neighbouring chunks join into one "lot": parking, park, plaza or ruin.
const TILE = 16, CT = 20, CPX = TILE*CT, CH = CPX*2;   // CH = chunk size in world units
const chunkCache = new Map(), propCache = new Map();
const MAX_CHUNKS = 40;

function mulberry(seed){ let a = seed>>>0; return () => { a = (a + 0x6D2B79F5)>>>0; let t = a;
  t = Math.imul(t ^ (t>>>15), t|1); t ^= t + Math.imul(t ^ (t>>>7), t|61); return ((t ^ (t>>>14))>>>0) / 4294967296; }; }
const seedOf = (x,y,s) => ((Math.imul(x|0,73856093) ^ Math.imul(y|0,19349663) ^ Math.imul(s|0,83492791)) >>> 0);

function lotType(lx,ly){
  if (lx===0 && ly===0) return 'plaza';
  const v = mulberry(seedOf(lx,ly,1))();
  return v<0.3 ? 'parking' : v<0.55 ? 'park' : v<0.72 ? 'plaza' : 'ruin';
}

// ---------- tile textures ----------
function noiseTile(base, specks, seed, extra){
  const c = mk(TILE,TILE), g = c.getContext('2d'), r = mulberry(seed);
  g.fillStyle = base; g.fillRect(0,0,TILE,TILE);
  for (const [col, n] of specks) { g.fillStyle = col; for (let i=0;i<n;i++) g.fillRect(r()*TILE|0, r()*TILE|0, 1, 1); }
  if (extra) extra(g, r);
  return c;
}
const TILES = {};
(function buildTiles(){
  const asph = (s) => noiseTile('#34323f', [['#2c2a36',30],['#3e3c4a',22],['#46445a',5],['#24222c',6]], s);
  TILES.asphalt = [asph(1),asph(2),asph(3),asph(4)];
  TILES.lot = [1,2].map(s => noiseTile('#3a3946', [['#32313e',26],['#44434f',18],['#2a2934',5]], 50+s));
  TILES.side = [1,2,3].map(s => noiseTile('#78706a', [['#6e665f',30],['#847c74',20],['#5e5650',4]], 80+s, (g,r) => {
    g.fillStyle = '#5a524b'; g.fillRect(15,0,1,16); g.fillRect(0,15,16,1);
    g.fillStyle = '#8c847c'; g.fillRect(0,0,15,1); g.fillRect(0,0,1,15);
    if (s===3){ g.fillStyle = '#5a524b'; let x = 3, y = 2; for (let i=0;i<8;i++){ g.fillRect(x,y,1,1); x += r()<.5?1:0; y++; } }
  }));
  TILES.grass = [1,2,3,4].map(s => noiseTile('#3a6232', [['#2f5229',40],['#4a7a3c',30],['#24421f',10]], 100+s, (g,r) => {
    for (let i=0;i<6;i++){ const x = r()*15|0, y = 1+(r()*14|0); g.fillStyle = '#5a8c44'; g.fillRect(x,y,1,1); g.fillStyle = '#2a4a24'; g.fillRect(x,y+1,1,1); }
    if (s===4){ g.fillStyle = r()<.5 ? '#e8d860' : '#e0a0c8'; g.fillRect(5,6,1,1); g.fillRect(11,11,1,1); }
  }));
  TILES.dirt = [1,2,3].map(s => noiseTile('#5c4834', [['#4e3c2a',34],['#6c5640',22],['#7a6a58',6],['#3e2e20',6]], 130+s));
  TILES.path = [1,2].map(s => noiseTile('#7a6248', [['#6a5440',30],['#8a7258',20],['#5a4634',5]], 150+s));
  TILES.plaza = [1,2].map(s => noiseTile('#867a68', [['#7c7060',20],['#90846f',14]], 170+s, (g) => {
    g.fillStyle = '#6a5f50'; g.fillRect(0,7,16,1); g.fillRect(0,15,16,1); g.fillRect(7,0,1,8); g.fillRect(15,8,1,8);
    g.fillStyle = '#9a8e78'; g.fillRect(0,0,7,1); g.fillRect(8,8,7,1);
    if (s===2){ g.fillStyle = '#76695a'; g.fillRect(1,1,6,6); }
  }));
})();
const tileOf = (arr, x, y) => arr[(seedOf(x,y,9) >>> 3) % arr.length];

// ---------- props ----------
const CAR_COLS = ['#a83038','#3a5aa8','#9a9a92','#4e7a46','#c8b890','#5a5a62','#8a4a7a','#c8862a','#d8d8d0','#2f7a7a'];
// props: k, x, y (world units, bottom-centre anchor)
function lotProps(lx,ly){
  const key = lx+','+ly; let P = propCache.get(key); if (P) return P; P = [];
  const r = mulberry(seedOf(lx,ly,7)), X = lx*CH, Y = ly*CH, type = lotType(lx,ly);
  const R = (a,b) => a + r()*(b-a), col = () => CAR_COLS[r()*CAR_COLS.length|0];
  const I = 7*32 - 16; // interior half-extent in world units
  if (type==='parking'){
    for (const ry of [-150, 50]) for (let i=0;i<7;i++) if (r()<0.5)
      P.push({k:'carF', x:X-180+i*60, y:Y+ry+r()*6, c:col(), v:r()<0.12?'burned':r()<0.08?'police':'car', back:r()<.5});
    for (let i=0;i<1+(r()*2|0);i++) P.push({k:'carS', x:X+R(-150,150), y:Y+R(-60,10), c:col(), v:r()<0.2?'burned':'car', flip:r()<.5});
    if (r()<0.6) P.push({k:'cone', x:X+R(-150,150), y:Y+R(-40,40)});
  } else if (type==='park'){
    const n = 5 + (r()*6|0);
    for (let i=0;i<n;i++){ let x, y, t = 0;
      do { x = R(-I+20,I-20); y = R(-I+40,I-10); } while ((Math.abs(x)<56 || Math.abs(y+10)<56) && ++t<20);
      P.push({k:'tree', x:X+x, y:Y+y, v:r()*3|0}); }
    for (let i=0;i<3;i++){ const s = r()<.5?1:-1; P.push({k:'bench', x:X+R(-150,150), y:Y+s*56}); }
    if (r()<0.5) P.push({k:'mailbox', x:X+R(-150,150), y:Y-4});
  } else if (type==='plaza'){
    P.push(r()<0.65 ? {k:'fountain', x:X, y:Y+28} : {k:'planter', x:X, y:Y+20});
    for (const sx of [-1,1]) for (const sy of [-1,1]) P.push({k:'planter', x:X+sx*140, y:Y+sy*130+10});
    for (let i=0;i<3;i++) P.push({k:'bench', x:X+R(-120,120), y:Y+(r()<.5?-80:110)});
    if (r()<0.5) P.push({k:'sandbags', x:X+R(-150,150), y:Y+R(-150,150)});
    if (r()<0.4) P.push({k:'carS', x:X+R(-150,150), y:Y+R(-170,170), c:'#ffffff', v:'police', flip:r()<.5});
  } else { // ruin
    for (let i=0;i<1+(r()*3|0);i++) P.push({k: r()<.5?'carS':'carF', x:X+R(-170,170), y:Y+R(-170,170), c:'#000000', v:'burned', flip:r()<.5, back:r()<.5});
    for (let i=0;i<2+(r()*4|0);i++) P.push({k: r()<0.35?'toxic':'barrel', x:X+R(-190,190), y:Y+R(-190,190)});
    for (let i=0;i<r()*4;i++) P.push({k:'crate', x:X+R(-190,190), y:Y+R(-190,190)});
    if (r()<0.7) P.push({k:'sandbags', x:X+R(-150,150), y:Y+R(-150,150)});
    if (r()<0.5) P.push({k:'tree', x:X+R(-170,170), y:Y+R(-170,170), v:3});
  }
  if (r()<0.35) P.push({k:'dumpster', x:X+(r()<.5?-1:1)*R(150,190), y:Y-222});
  if (r()<0.3) P.push({k:'hydrant', x:X+R(-200,200), y:Y+236});
  propCache.set(key, P); return P;
}
function drawProp(g, p, sx, sy){
  // sx, sy: screen pixel position of the anchor
  let s, ox = 0;
  switch (p.k){
    case 'carS': s = carSideSprite(p.c, p.v); break;
    case 'carF': s = carFrontSprite(p.c, p.v, p.back); break;
    case 'tree': s = treeSprite(p.v); break;
    case 'lamp': s = p.broken ? LAMP_BROKEN() : LAMP_SPR(); break;
    default: s = SPR[p.k] && SPR[p.k](); break;
  }
  if (!s) return;
  if (p.flip){ g.save(); g.translate(sx, 0); g.scale(-1,1); g.drawImage(s, -Math.floor(s.width/2), sy - s.height + 1); g.restore(); }
  else g.drawImage(s, sx - Math.floor(s.width/2) + ox, sy - s.height + 1);
}
const PROP_SHADOW = {carS:[22,5], carF:[13,5], tree:[14,4], dumpster:[16,3], fountain:[32,6], planter:[14,3], bench:[13,2], barrel:[6,2], toxic:[6,2], crate:[8,2], sandbags:[20,3], lamp:[5,2], mailbox:[6,2], hydrant:[5,2], cone:[4,1]};

// ---------- chunk build ----------
function genChunk(cx,cy){
  const c = mk(CPX,CPX), g = c.getContext('2d'), r = mulberry(seedOf(cx,cy,5));
  const R = (a,b) => a + r()*(b-a);
  const P = (x,y,w,h,col) => { g.fillStyle = col; g.fillRect(x,y,w,h); };
  const props = [];
  // tiles
  for (let ty=0; ty<CT; ty++) for (let tx=0; tx<CT; tx++){
    const wx = cx*CT+tx, wy = cy*CT+ty;
    const road = (tx>=8 && tx<=11) || (ty>=8 && ty<=11);
    let t;
    if (road) t = tileOf(TILES.asphalt, wx, wy);
    else {
      const lx = cx + (tx>=12?1:0), ly = cy + (ty>=12?1:0), ltx = wx - lx*CT, lty = wy - ly*CT;
      if (ltx===-8 || ltx===7 || lty===-8 || lty===7) t = tileOf(TILES.side, wx, wy);
      else switch (lotType(lx,ly)){
        case 'parking': t = tileOf(TILES.lot, wx, wy); break;
        case 'park': t = (ltx===-1||ltx===0||lty===-1||lty===0) ? tileOf(TILES.path, wx, wy) : tileOf(TILES.grass, wx, wy); break;
        case 'plaza': t = tileOf(TILES.plaza, wx, wy); break;
        default: t = tileOf(TILES.dirt, wx, wy);
      }
    }
    g.drawImage(t, tx*TILE, ty*TILE);
  }
  // curbs: lots are raised, so the road just south of a lot shows the curb face
  for (const [ox,oy,w,h] of [[0,0,128,128],[192,0,128,128],[0,192,128,128],[192,192,128,128]]){
    P(ox, oy+h, w, 2, '#4a4038'); P(ox, oy+h+2, w, 1, '#24222c');
    P(ox, oy, w, 1, '#9a928a');
    if (ox===0) P(ox+w, oy, 1, h+2, '#28262e'); else P(ox-1, oy, 1, h+2, '#28262e');
  }
  // lane dashes
  for (let t=0;t<CPX;t+=16){
    if (t < 104 || t > 208){ P(t+2,159,9,2,'#c8a83a'); P(159,t+2,2,9,'#c8a83a'); }
  }
  // crosswalks
  for (let t=132;t<188;t+=6){ P(102,t,22,3,'#bdb8a8'); P(196,t,22,3,'#bdb8a8'); P(t,102,3,22,'#bdb8a8'); P(t,196,3,22,'#bdb8a8'); }
  // parking stall lines
  for (const [lx,ly,ox,oy] of [[cx,cy,0,0],[cx+1,cy,CPX,0],[cx,cy+1,0,CPX],[cx+1,cy+1,CPX,CPX]]){
    if (lotType(lx,ly)!=='parking') continue;
    const bx = -ox + 0, by = -oy;   // lot centre is at the chunk corner (ox,oy) in px
    for (const ry of [-150, 50]){ const top = by + oy + (ry/2) - 22 - 0;
      for (let i=0;i<=7;i++){ const x = ox + (-180 + i*60 - 30)/2; P(x, oy + ry/2 - 26, 1, 28, '#9a968c'); }
      P(ox - 105, oy + ry/2 + 2, 210, 1, '#9a968c');
    }
  }
  // road wear
  for (let i=0;i<10;i++){ const h = r()<.5, along = R(0,CPX), across = R(132,188);
    const x = h?along:across, y = h?across:along; pell(g, x|0, y|0, R(3,9), R(1,4), 'rgba(20,18,26,.35)'); }
  for (let i=0;i<5;i++){ const h = r()<.5; let x = (h?R(0,CPX):R(130,190))|0, y = (h?R(130,190):R(0,CPX))|0;
    for (let k=0;k<10;k++){ P(x,y,1,1,'#22202a'); x += r()<.5?1:(r()<.5?-1:0); y += r()<.6?1:0; } }
  for (let i=0;i<3;i++){ const x = R(10,310)|0, y = R(136,184)|0; P(x,y,R(10,30)|0,1,'#26242e'); P(x+2,y+3,R(10,30)|0,1,'#26242e'); }
  { const mx = (r()<.5 ? R(134,186) : R(20,100))|0, my = (r()<.5 ? R(20,100) : R(134,186))|0;
    pcirc(g,mx,my,5,'#24222a'); pcirc(g,mx,my,4,'#3e3c48'); for (let k=-3;k<=3;k+=2) P(mx-3,my+k,7,1,'#2a2832'); }
  // ruin rubble & scorch baked into ground
  for (const [lx,ly,ox,oy] of [[cx,cy,0,0],[cx+1,cy,CPX,0],[cx,cy+1,0,CPX],[cx+1,cy+1,CPX,CPX]]){
    if (lotType(lx,ly)!=='ruin') continue;
    const rr = mulberry(seedOf(lx,ly,21));
    for (let i=0;i<6;i++){ const x = ox + (rr()-.5)*200, y = oy + (rr()-.5)*200;
      for (let k=0;k<26;k++){ const a = rr()*TAU, d = rr()*12; const s = 1+(rr()*3|0);
        P(Math.round(x+Math.cos(a)*d), Math.round(y+Math.sin(a)*d*0.7), s, s, ['#6a6258','#58504a','#7a7064','#4a4038'][rr()*4|0]); } }
    for (let i=0;i<2;i++){ const x = ox + (rr()-.5)*180, y = oy + (rr()-.5)*180;
      for (let k=0;k<180;k++){ const a = rr()*TAU, d = Math.sqrt(rr())*22; P(Math.round(x+Math.cos(a)*d), Math.round(y+Math.sin(a)*d*0.7), 1, 1, 'rgba(10,8,10,.55)'); } }
  }
  // paper litter
  for (let i=0;i<10;i++) P(R(0,CPX)|0, R(0,CPX)|0, 2, 1, r()<.5 ? '#c8c4b4' : '#a8a090');

  // props owned by this chunk
  const X0 = cx*CH, Y0 = cy*CH, inside = p => p.x >= X0 && p.x < X0+CH && p.y >= Y0 && p.y < Y0+CH;
  for (const [lx,ly] of [[cx,cy],[cx+1,cy],[cx,cy+1],[cx+1,cy+1]]) for (const p of lotProps(lx,ly)) if (inside(p)) props.push(p);
  const nw = r()*2.4|0;
  for (let i=0;i<nw;i++){ const h = r()<.5;
    let along = R(40,CH-40); if (along > 200 && along < 440) along = r()<.5 ? 150 : 490;
    const across = R(280,360);
    const v = r()<0.15 ? 'police' : r()<0.4 ? 'burned' : 'car';
    props.push(h ? {k:'carS', x:X0+along, y:Y0+across, c:CAR_COLS[r()*CAR_COLS.length|0], v, flip:r()<.5}
                 : {k:'carF', x:X0+across, y:Y0+along, c:CAR_COLS[r()*CAR_COLS.length|0], v, back:r()<.5}); }
  for (let i=0;i<(r()*3|0);i++) props.push({k:'cone', x:X0+R(270,370), y:Y0+R(200,440)});
  const lamps = [];
  const corners = r()<.5 ? [[236,236],[404,404]] : [[404,236],[236,404]];
  for (const [lx,ly] of corners){ const v = r();
    const lamp = {k:'lamp', x:X0+lx, y:Y0+ly, broken:v<0.18, flick:v>=0.18 && v<0.4, ph:r()*100};
    props.push(lamp); lamps.push(lamp); }
  return {c, g, props, lamps, cx, cy};
}
function getChunk(cx,cy){
  const key = cx*100003 + cy;
  let ch = chunkCache.get(key);
  if (ch){ chunkCache.delete(key); chunkCache.set(key, ch); return ch; }
  ch = genChunk(cx,cy); chunkCache.set(key, ch);
  while (chunkCache.size > MAX_CHUNKS) chunkCache.delete(chunkCache.keys().next().value);
  return ch;
}
const peekChunk = (cx,cy) => chunkCache.get(cx*100003 + cy);
// paint a permanent decal into the cached chunk canvases; fn draws in global pixel coords
function paintDecal(xw, yw, radW, fn){
  const x0 = Math.floor((xw-radW)/CH), x1 = Math.floor((xw+radW)/CH), y0 = Math.floor((yw-radW)/CH), y1 = Math.floor((yw+radW)/CH);
  for (let cx=x0; cx<=x1; cx++) for (let cy=y0; cy<=y1; cy++){
    const ch = peekChunk(cx,cy); if (!ch) continue;
    const g = ch.g; g.save(); g.setTransform(1,0,0,1,-cx*CPX,-cy*CPX); fn(g); g.restore();
  }
}
