"use strict";
// ---------- extra maps: Pine Hollow (forest), The Docks (harbour), Dead End (desert) ----------
// Each map keeps the city's chunk grid (a 4-tile "street band" through the middle of every chunk,
// lots centred on chunk corners) but has its own ground, props, lights and colour grade.

// animated props pick a frame from wall-clock time
const animF = (n, fps, ph) => ((performance.now()/1000*fps + (ph||0))|0) % n;

// ---------- shared ground tiles ----------
(function buildMapTiles(){
  TILES.moss = [1,2,3,4].map(s => noiseTile('#2c4a2a', [['#24401f',40],['#365a30',30],['#1a3018',12]], 300+s, (g,r) => {
    for (let i=0;i<5;i++){ const x = r()*15|0, y = 1+(r()*14|0); g.fillStyle = '#44703a'; g.fillRect(x,y,1,1); g.fillStyle = '#1c341a'; g.fillRect(x,y+1,1,1); }
    if (s===4){ g.fillStyle = '#c8a0e0'; g.fillRect(4,9,1,1); g.fillStyle = '#f0e8a0'; g.fillRect(12,4,1,1); }
  }));
  TILES.needles = [1,2,3].map(s => noiseTile('#4a3a26', [['#3e301e',34],['#5a4630',26],['#2e4a26',16],['#6a5236',6]], 320+s, (g,r) => {
    g.fillStyle = '#6a5034'; for (let i=0;i<7;i++){ const x = r()*14|0, y = r()*15|0; g.fillRect(x,y,2,1); }
  }));
  TILES.trail = [1,2,3].map(s => noiseTile('#6a5438', [['#5c4830',30],['#7a6244',22],['#4a3a26',6],['#8a7458',4]], 340+s));
  TILES.dock = [1,2,3].map(s => noiseTile('#5e605e', [['#545654',26],['#686a68',18],['#4a4c4a',6]], 360+s, (g,r) => {
    g.fillStyle = '#4a4c4a'; g.fillRect(15,0,1,16); g.fillRect(0,15,16,1);
    if (s===3){ g.fillStyle = 'rgba(30,24,20,.45)'; for (let i=0;i<14;i++) g.fillRect(4+(r()*8|0), 4+(r()*8|0), 1, 1); }
  }));
  TILES.plate = [1,2].map(s => noiseTile('#4e5258', [['#464a50',16],['#585c62',10]], 380+s, (g) => {
    g.fillStyle = '#6a6e74'; for (let y=1;y<16;y+=4) for (let x=(y>>2)%2*2+1;x<16;x+=4){ g.fillRect(x,y,2,1); }
    g.fillStyle = '#383c42'; g.fillRect(0,15,16,1); g.fillRect(15,0,1,16);
  }));
  TILES.yardAsph = [1,2,3].map(s => noiseTile('#2e2e36', [['#26262e',30],['#383842',20],['#1e1e26',6]], 400+s));
  TILES.sand = [1,2,3,4].map(s => noiseTile('#c8a46a', [['#b8945c',36],['#d6b47c',28],['#a8844e',8],['#e4c890',6]], 420+s, (g,r) => {
    if (s>=3){ g.fillStyle = '#b08a52'; const y = 3+(r()*10|0); for (let x=0;x<16;x++) g.fillRect(x, y + (Math.sin(x*0.8+s)>0.3?1:0), 1, 1); }
  }));
  TILES.cracked = [1,2,3].map(s => noiseTile('#a88a5c', [['#9a7c50',28],['#b8986a',18]], 440+s, (g,r) => {
    g.fillStyle = '#7a6040'; let x = r()*16|0, y = 0; for (let i=0;i<18;i++){ g.fillRect(x,y,1,1); x += r()<.5?1:-1; y++; if (y>15) break; x = (x+16)%16; }
    x = 0; y = r()*16|0; for (let i=0;i<10;i++){ g.fillRect(x,y,1,1); x++; y += r()<.3?1:r()<.3?-1:0; }
  }));
  TILES.oldAsph = [1,2,3].map(s => noiseTile('#4a4440', [['#423c38',30],['#56504a',20],['#5e5448',8],['#36302c',6]], 460+s, (g,r) => {
    if (s===3){ g.fillStyle = '#2e2824'; let x = 2, y = 3; for (let i=0;i<9;i++){ g.fillRect(x,y,1,1); x += r()<.6?1:0; y++; } }
  }));
})();

// ---------- sprites ----------
// variant sprites: SPRV[k](v)
const SPRV = {};
const FLOOD_SPR = () => propSprite('flood', () => propCanvas(20,74,(P) => {
  P(9,12,3,58,'#5a5e66'); P(9,12,1,58,'#7a7e86'); P(6,68,9,4,'#3a3e46');
  P(2,4,16,8,'#3a3e46'); P(2,4,16,1,'#5a5e66'); for (let i=0;i<3;i++) P(3+i*5,8,4,3,'#f8f4d8');
}));
const FLOOD_BROKEN = () => propSprite('floodb', () => propCanvas(20,74,(P) => {
  P(9,12,3,58,'#5a5e66'); P(6,68,9,4,'#3a3e46'); P(2,4,16,8,'#3a3e46'); for (let i=0;i<3;i++) P(3+i*5,8,4,3,'#2a2a30');
}));

// pine trees (v 0..2 sizes, 3 = burnt)
SPRV.pine = v => propSprite('pine'+v, () => { const r = mulberry(v*131+7), H = [62,52,44,58][v];
  return propCanvas(36,H,(P,g) => {
    const cx = 18, base = H-3;
    P(cx-2,base-10,4,10,'#4a3020'); P(cx-2,base-10,1,10,'#6a4a30');
    if (v===3){ P(cx-1,4,2,base-10,'#2a2018'); for (let i=0;i<5;i++){ const y = 10+i*8, w = 4+i*2; P(cx-w,y,w,1,'#2a2018'); P(cx+1,y+2,w-1,1,'#2a2018'); } return; }
    const tiers = 4, top = 3;
    for (let t=0;t<tiers;t++){ const y0 = top + t*(base-14-top)/tiers, h = (base-10-top)/tiers + 6, w0 = 4 + t*3.4;
      for (let y=0;y<h;y++){ const w = Math.round(1 + (w0+1)*(y/h)); const yy = Math.round(y0+y);
        P(cx-w,yy,w*2,1,'#1e3a26'); P(cx-w,yy,Math.max(1,w-1),1,'#2c5434'); }
      P(cx-Math.round(w0),Math.round(y0+h-1),Math.round(w0)*2,1,'#14281a'); }
    for (let i=0;i<14;i++){ const y = top+4+r()*(base-20), w = 1+((y-top)/(base-top))*14; P(Math.round(cx-w*r()),Math.round(y),1,1,'#3e6e40'); }
  }); });
SPRV.tent = v => propSprite('tent'+v, () => propCanvas(40,28,(P) => {
  const c = shades(['#d8862a','#3a7ab8','#b83a3a','#4e8a3a'][v%4]);
  for (let y=0;y<20;y++){ const w = Math.round(2 + y*0.9); P(20-w,4+y,w*2,1,c[1]); P(20-w,4+y,Math.max(1,w>>1),1,c[0]); }
  for (let y=6;y<24;y++){ const w = Math.round((y-6)*0.33); P(20-w,y,w*2+1,1,'#1a1418'); }
  P(19,2,2,3,'#3a3030'); P(1,24,38,2,c[2]); P(0,25,2,1,'#6a6a6a'); P(38,25,2,1,'#6a6a6a');
}));
SPRV.cabin = v => propSprite('cabin'+v, () => propCanvas(88,64,(P) => {
  const log = ['#7a5232','#6a4428'][v%2];
  for (let y=0;y<24;y++){ const w = Math.round(14 + y*1.3); P(44-w,4+y,w*2,1,y%3===0?'#4a3a34':'#5a4840'); }
  P(2,26,84,2,'#3a2a24');
  for (let y=28;y<58;y+=4){ P(5,y,78,4,log); P(5,y,78,1,shadeHex(log,0.2)); P(5,y+3,78,1,shadeHex(log,-0.3)); P(3,y+1,2,2,'#8a6a48'); P(83,y+1,2,2,'#8a6a48'); }
  P(38,38,12,20,'#3a2418'); P(39,39,10,1,'#5a3a24'); P(47,48,1,2,'#d8b048');
  for (const x of [12,62]){ P(x,34,14,11,'#2a3a48'); P(x+1,35,5,3,'#6a8aa4'); P(x+6,34,1,11,log); P(x,39,14,1,log); }
  P(66,8,8,14,'#5a4a44'); P(66,8,8,1,'#7a6a64'); P(64,6,12,3,'#3a3030');
  P(2,58,84,3,'#4a3a2a');
}));
SPR.log = () => propSprite('log', () => propCanvas(34,14,(P) => {
  P(5,3,26,8,'#6a4428'); P(5,3,26,2,'#8a6040'); P(5,9,26,2,'#4a2c18'); pcircP(P,5,7,4,'#a0784c'); P(4,6,2,2,'#6a4a30');
  P(14,5,6,1,'#4a2c18'); P(22,7,5,1,'#4a2c18');
}));
SPR.stump = () => propSprite('stump', () => propCanvas(18,14,(P) => {
  P(3,5,12,7,'#5a3a24'); P(3,5,2,7,'#7a5434'); P(13,5,2,7,'#3a2414'); P(3,3,12,3,'#b08a5a'); P(6,4,6,1,'#8a6a40'); P(1,11,16,2,'#4a3020');
}));
SPR.woodpile = () => propSprite('wood', () => propCanvas(28,18,(P) => {
  for (let row=0;row<3;row++) for (let i=0;i<4-row;i++){ const x = 3+i*6+row*3, y = 11-row*4; P(x,y,6,5,'#6a4428'); P(x+1,y+1,4,3,'#b08a5a'); P(x+2,y+2,2,1,'#8a6a40'); }
}));
SPR.bush = () => propSprite('bush', () => propCanvas(24,16,(P,g) => {
  pell(g,12,9,10,6,'#1e3a22'); pell(g,10,8,7,4,'#2c5432'); P(7,6,2,1,'#4a7a40'); P(15,8,1,1,'#c84a4a'); P(9,10,1,1,'#c84a4a');
}));
// small rock (v 0 grey, 1 sandstone)
SPRV.rock = v => propSprite('rock'+v, () => propCanvas(22,16,(P,g) => {
  const c = shades(v ? '#a07a52' : '#6a6a6e');
  pell(g,11,10,9,5,c[2]); pell(g,10,9,8,4,c[1]); P(6,6,6,1,c[0]); P(5,7,3,1,c[0]);
}));
SPRV.boulder = v => propSprite('bould'+v, () => propCanvas(64,42,(P,g) => {
  const c = shades(v ? '#a8784a' : '#7a7068');
  pell(g,32,30,29,10,c[2]); P(10,10,44,22,c[1]); P(14,6,30,6,c[1]); P(14,6,30,2,c[0]); P(10,10,4,22,c[0]);
  P(48,12,6,20,c[2]); for (let y=16;y<30;y+=5) P(12,y,40,1,shadeHex(c[1],-0.15)); P(30,14,1,10,c[2]); pell(g,32,32,28,5,c[2]);
}));
// campfire: 3 flame frames; lit at night by its own light (see lamps with .fire)
SPR.campfire = () => { const f = animF(3, 9); return propSprite('cfire'+f, () => propCanvas(22,22,(P) => {
  for (const [x,y] of [[2,17],[6,18],[13,18],[17,17]]) P(x,y,4,3,'#6a6a6e');
  P(5,15,12,3,'#5a3a24'); P(7,14,8,2,'#6a4428');
  const h = [9,11,8][f], s = [0,1,-1][f];
  P(8+s,14-h,6,h,'#e85a1a'); P(9+s,15-h+2,4,h-2,'#f8a83a'); P(10,15-h+5,2,h-5,'#fff0a0'); P(7-s,11,2,3,'#e85a1a'); P(14,10+f,2,4,'#f8a83a');
})); };
// shipping containers (v colour; .stack draws two high)
const CONT_COL = ['#b83a2a','#2a6ab0','#d8a02a','#3a8a4a','#7a7a82','#c86a2a','#5a3a8a'];
function containerBody(P, y, col){
  const c = shades(col);
  P(2,y,60,6,c[0]); P(2,y,60,1,shadeHex(c[0],0.15));
  P(2,y+6,60,18,c[1]); for (let x=5;x<60;x+=4) P(x,y+7,1,16,c[2]);
  P(2,y+6,2,18,c[0]); P(60,y+6,2,18,c[2]); P(2,y+23,60,1,c[2]); P(2,y+6,60,1,c[2]);
}
SPRV.cont = v => propSprite('cont'+v, () => propCanvas(64,32,(P) => { containerBody(P, 3, CONT_COL[v % CONT_COL.length]); P(3,28,58,2,'#1e1e24'); }));
SPRV.cont2 = v => propSprite('cont2'+v, () => propCanvas(64,56,(P) => {
  containerBody(P, 27, CONT_COL[v % CONT_COL.length]); containerBody(P, 3, CONT_COL[(v*3+2) % CONT_COL.length]); P(3,52,58,2,'#1e1e24');
}));
SPR.warehouse = () => propSprite('wareh', () => propCanvas(110,72,(P) => {
  P(2,4,106,14,'#5a6068'); P(2,4,106,1,'#7a8088'); for (let x=4;x<106;x+=6) P(x,5,1,13,'#4a5058');
  P(4,18,102,48,'#8a8478'); for (let x=6;x<104;x+=5) P(x,18,1,48,'#7a7468'); P(4,18,2,48,'#9a9488'); P(104,18,2,48,'#6a6458');
  P(14,30,34,36,'#4a4c52'); for (let y=32;y<66;y+=3) P(14,y,34,1,'#3a3c42'); P(14,30,34,2,'#2a2c32');
  P(62,40,12,26,'#3a3c42'); P(72,52,1,2,'#d8b048'); P(80,26,20,8,'#2a3a48'); P(81,27,8,2,'#6a8aa4');
  P(60,22,44,4,'#d8b048'); P(62,23,8,2,'#2a2a2a'); P(74,23,8,2,'#2a2a2a'); P(86,23,8,2,'#2a2a2a');
  P(2,66,106,3,'#4a4a4e');
}));
SPR.tank = () => propSprite('tank', () => propCanvas(52,60,(P,g) => {
  pell(g,26,10,22,7,'#a8aaa8'); pell(g,26,10,20,5,'#c8cac8');
  P(4,10,44,44,'#b8bab8'); P(4,10,8,44,'#d8dad8'); P(40,10,8,44,'#8a8c8a'); pell(g,26,54,22,4,'#8a8c8a');
  for (let y=18;y<52;y+=11) P(4,y,44,1,'#9a9c9a'); P(12,28,28,10,'#c8382a'); P(14,30,24,1,'#e85a4a'); P(14,34,24,2,'#f0ecdc');
  for (let y=10;y<54;y+=3) P(44,y,1,2,'#5a5c5a'); P(43,8,3,2,'#5a5c5a');
}));
SPR.pallet = () => propSprite('pallet', () => propCanvas(22,12,(P) => {
  P(2,3,18,2,'#a08050'); P(2,7,18,2,'#a08050'); P(3,5,2,2,'#6a5030'); P(10,5,2,2,'#6a5030'); P(17,5,2,2,'#6a5030'); P(2,9,18,1,'#5a4024');
}));
SPR.bollard = () => propSprite('boll', () => propCanvas(10,12,(P) => { P(2,3,6,7,'#2a2a30'); P(2,3,2,7,'#4a4a52'); P(1,2,8,2,'#3a3a42'); P(3,6,4,1,'#d8a02a'); }));
SPR.forklift = () => propSprite('fork', () => propCanvas(30,28,(P) => {
  P(4,4,2,20,'#3a3a42'); P(20,4,2,20,'#3a3a42'); P(4,4,18,2,'#3a3a42');
  P(4,14,20,8,'#e0a020'); P(4,14,20,1,'#f8c850'); P(8,8,10,6,'#2a3a48'); P(24,8,2,18,'#5a5a62'); P(24,24,6,2,'#8a8a92');
  P(5,21,6,5,'#18161c'); P(17,21,6,5,'#18161c'); P(7,22,2,2,'#6a6a72'); P(19,22,2,2,'#6a6a72');
}));
// desert
SPRV.cactus = v => propSprite('cact'+v, () => propCanvas(28,[42,32,22][v%3]+4,(P0) => {
  const P = (x,y,w,h,c) => P0(Math.round(x),Math.round(y),Math.round(w),Math.round(h),c);
  const H = [42,32,22][v%3], base = H+1, c = ['#5a8a3a','#3e6a2a','#7aaa4a'];
  P(11,base-H+4,6,H-4,c[0]); P(11,base-H+4,2,H-4,c[2]); P(15,base-H+4,2,H-4,c[1]); P(12,base-H+2,4,2,c[0]);
  if (v%3 < 2){ P(4,base-H*0.7,4,H*0.35,c[0]); P(4,base-H*0.7,1,H*0.35,c[2]); P(4,base-H*0.4,8,4,c[0]); P(5,base-H*0.7-2,2,2,c[0]);
    P(20,base-H*0.85,4,H*0.4,c[0]); P(23,base-H*0.85,1,H*0.4,c[1]); P(16,base-H*0.5,8,4,c[0]); }
  for (let y=base-H+6;y<base-2;y+=4) P(13,y,1,1,'#e8e0b0');
  if (v===2){ P(13,base-H+1,2,2,'#e85a8a'); }
}));
SPR.skull = () => propSprite('skull', () => propCanvas(30,16,(P) => {
  P(18,5,8,6,'#e8e0c8'); P(18,5,8,1,'#fff8e0'); P(20,7,2,2,'#2a2018'); P(23,7,2,2,'#2a2018'); P(26,8,2,3,'#d8d0b8');
  P(2,9,14,2,'#d8d0b8'); P(4,7,1,6,'#d8d0b8'); P(8,7,1,6,'#d8d0b8'); P(12,7,1,6,'#d8d0b8'); P(14,11,4,2,'#2a2018');
}));
SPR.tires = () => propSprite('tires', () => propCanvas(22,18,(P,g) => {
  for (let i=0;i<3;i++){ const y = 13-i*4; pell(g,11,y,8,3,'#1e1c20'); pell(g,11,y,4,1,'#3a3640'); P(4,y-2,14,1,'#3a3640'); }
}));
SPR.tumble = () => propSprite('tumble', () => propCanvas(16,14,(P,g) => {
  const r = mulberry(77); for (let i=0;i<60;i++){ const a = r()*TAU, d = Math.sqrt(r())*6; P(Math.round(8+Math.cos(a)*d), Math.round(7+Math.sin(a)*d*0.85), 1, 1, r()<.5 ? '#8a6a3a' : '#a88a52'); }
}));
SPR.firebarrel = () => { const f = animF(3, 10); return propSprite('fbar'+f, () => propCanvas(16,26,(P) => {
  P(3,12,10,12,'#5a3a2a'); P(3,12,2,12,'#7a5a42'); P(11,12,2,12,'#3a2418'); P(3,15,10,1,'#3a2418'); P(3,20,10,1,'#3a2418'); P(4,17,2,2,'#e8582a');
  const h = [7,9,6][f], s = [0,1,-1][f];
  P(4+s,12-h,8,h,'#e85a1a'); P(5+s,13-h+2,6,h-2,'#f8a83a'); P(7,13-h+4,2,h-4,'#fff0a0'); P(3,10,10,2,'#3a2418');
})); };
SPR.wreckbus = () => propSprite('wbus', () => propCanvas(80,34,(P) => {
  P(2,6,76,22,'#8a5a2a'); P(2,6,76,2,'#a87a42'); P(2,26,76,2,'#4a2a14'); for (let x=8;x<72;x+=10) P(x,10,8,7,'#1a1410');
  P(12,24,10,8,'#18161c'); P(56,24,10,8,'#18161c'); P(30,18,6,4,'#5a2a14'); P(44,12,3,2,'#c8a050'); P(2,20,76,1,'#6a3a1a');
}));
// bake a pixel disk via P (for sprites drawn with the rect helper)
function pcircP(P, cx, cy, r, col){ for (let y=-r;y<=r;y++){ const w = Math.floor(Math.sqrt(r*r-y*y)+0.5); P(cx-w,cy+y,w*2+1,1,col); } }

Object.assign(PROP_SHADOW, {pine:[14,4], tent:[19,4], cabin:[42,5], log:[15,3], stump:[7,2], woodpile:[12,3], bush:[10,3], rock:[9,3], boulder:[30,6],
  campfire:[10,3], cont:[30,4], cont2:[30,5], warehouse:[52,5], tank:[22,5], pallet:[10,2], bollard:[4,1], forklift:[13,3], flood:[6,2],
  cactus:[8,2], skull:[12,2], tires:[9,2], tumble:[6,2], firebarrel:[6,2], wreckbus:[38,5]});

// ---------- themed chunk builder ----------
// M.lotType(lx,ly), M.tile(info) -> tile canvas, M.decorate(ctx), M.lotProps(ctx, P, type), M.street(ctx, props)
function genThemed(M, cx, cy){
  const c = mk(CPX,CPX), g = c.getContext('2d'), r = mulberry(seedOf(cx,cy,M.salt));
  const R = (a,b) => a + r()*(b-a), P = (x,y,w,h,col) => { g.fillStyle = col; g.fillRect(x,y,w,h); };
  for (let ty=0; ty<CT; ty++) for (let tx=0; tx<CT; tx++){
    const wx = cx*CT+tx, wy = cy*CT+ty, lx = cx + (tx>=12?1:0), ly = cy + (ty>=12?1:0);
    const band = (tx>=8 && tx<=11) || (ty>=8 && ty<=11);
    g.drawImage(M.tile({band, tx, ty, wx, wy, lx, ly, ltx: wx - lx*CT, lty: wy - ly*CT, type: band ? null : M.lotType(lx,ly)}), tx*TILE, ty*TILE);
  }
  const X0 = cx*CH, Y0 = cy*CH, ctx = {c, g, P, r, R, cx, cy, X0, Y0};
  if (M.decorate) M.decorate(ctx);
  const props = [], inside = p => p.x >= X0 && p.x < X0+CH && p.y >= Y0 && p.y < Y0+CH;
  for (const [lx,ly] of [[cx,cy],[cx+1,cy],[cx,cy+1],[cx+1,cy+1]]) for (const p of themedLotProps(M, lx, ly)) if (inside(p)) props.push(p);
  if (M.street) M.street(ctx, props);
  return {c, g, props, lamps: props.filter(p => p.lamp), cx, cy};
}
function themedLotProps(M, lx, ly){
  const key = MAP_ID+':'+lx+','+ly; let out = propCache.get(key); if (out) return out; out = [];
  const r = mulberry(seedOf(lx,ly,M.salt+7)), X = lx*CH, Y = ly*CH;
  M.lotProps({r, R: (a,b) => a + r()*(b-a), X, Y, lx, ly}, out, M.lotType(lx,ly));
  propCache.set(key, out); return out;
}
// lot-wide ground decals (ox, oy = lot centre in chunk pixels)
function forLots(ctx, fn){ const {cx, cy} = ctx; for (const [lx,ly,ox,oy] of [[cx,cy,0,0],[cx+1,cy,CPX,0],[cx,cy+1,0,CPX],[cx+1,cy+1,CPX,CPX]]) fn(lx, ly, ox, oy); }
// scatter n positions in a lot, avoiding a central cross of half-width gap
function scatter(L, n, half, gap, fn){ for (let i=0;i<n;i++){ let x, y, t = 0;
  do { x = L.R(-half, half); y = L.R(-half, half); } while (gap && (Math.abs(x) < gap || Math.abs(y) < gap) && ++t < 20);
  fn(L.X + x, L.Y + y); } }
const lampProp = (k, x, y, r, extra) => Object.assign({k, x, y, lamp:true, ph:r()*100}, extra);

// ---------- PINE HOLLOW ----------
MAPS.forest = {
  n:'PINE HOLLOW', d:'Dense pine woods and summer camps. No streetlights: only campfires break the dark.', place:'THE WOODS',
  day:'#c8d4bc', night:'#9aa8d8', salt:1101,
  lotType(lx,ly){ if (lx===0 && ly===0) return 'camp';
    const v = mulberry(seedOf(lx,ly,1101))(); return v<0.42 ? 'woods' : v<0.64 ? 'camp' : v<0.84 ? 'clearing' : 'cabin'; },
  tile(i){
    if (i.band){ const tr = (i.tx===9 || i.tx===10) || (i.ty===9 || i.ty===10);
      return tr ? tileOf(TILES.trail, i.wx, i.wy) : tileOf(TILES.needles, i.wx, i.wy); }
    switch (i.type){
      case 'woods': return tileOf((seedOf(i.wx,i.wy,3)>>>5)%3 ? TILES.needles : TILES.moss, i.wx, i.wy);
      case 'camp': return (Math.abs(i.ltx+0.5) + Math.abs(i.lty+0.5) < 7) ? tileOf(TILES.dirt, i.wx, i.wy) : tileOf(TILES.moss, i.wx, i.wy);
      case 'cabin': return (i.ltx===-1 || i.ltx===0) && i.lty > -2 ? tileOf(TILES.path, i.wx, i.wy) : tileOf(TILES.grass, i.wx, i.wy);
      default: return tileOf(TILES.grass, i.wx, i.wy);
    }
  },
  decorate(ctx){ const {P, r, R} = ctx;
    // trail edges and roots
    for (let t=0;t<CPX;t+=2){ if (r()<0.5) P(t, 143 + (r()*2|0), 1, 1, '#3e301e'); if (r()<0.5) P(t, 176 + (r()*2|0), 1, 1, '#3e301e');
      if (r()<0.5) P(143 + (r()*2|0), t, 1, 1, '#3e301e'); if (r()<0.5) P(176 + (r()*2|0), t, 1, 1, '#3e301e'); }
    for (let i=0;i<14;i++){ const h = r()<.5, a = R(0,CPX)|0, b = R(146,174)|0; P(h?a:b, h?b:a, 2, 1, r()<.5 ? '#4a3a26' : '#8a7458'); }
    // fallen leaves & mushrooms
    for (let i=0;i<24;i++) P(R(0,CPX)|0, R(0,CPX)|0, 1, 1, ['#a8622a','#c88a3a','#7a3a1a'][r()*3|0]);
    for (let i=0;i<3;i++){ const x = R(0,CPX)|0, y = R(0,CPX)|0; if (x>128&&x<192 || y>128&&y<192) continue; P(x,y,3,1,'#c83a2a'); P(x+1,y+1,1,1,'#e8e0c8'); }
  },
  lotProps(L, out, type){ const {r, R, X, Y} = L, I = 220;
    if (type==='woods'){
      scatter(L, 9 + (r()*5|0), I, 0, (x,y) => out.push({k:'pine', x, y, v: r()<0.08 ? 3 : r()*3|0}));
      for (let i=0;i<2+(r()*3|0);i++) out.push({k: r()<.5 ? 'bush' : r()<.5 ? 'stump' : 'log', x:X+R(-I,I), y:Y+R(-I,I)});
      if (r()<0.3) out.push({k:'rock', x:X+R(-I,I), y:Y+R(-I,I), v:0});
    } else if (type==='camp'){
      out.push(lampProp('campfire', X, Y+10, r, {light:'orange', lr:52, lh:12, fire:true}));
      for (const a of [0.3, 1.7, 3.1, 4.5].slice(0, 2 + (r()*3|0))){ const d = R(110,150);
        out.push({k:'tent', x:X+Math.cos(a+r()*0.4)*d, y:Y+Math.sin(a+r()*0.4)*d*0.8, v:r()*4|0}); }
      for (const s of [-1,1]) out.push({k:'log', x:X+s*48, y:Y+44});
      out.push({k:'bench', x:X+R(-60,60), y:Y-56});
      if (r()<0.7) out.push({k:'carS', x:X+R(-150,150), y:Y+R(170,210), c:CAR_COLS[r()*CAR_COLS.length|0], v:r()<0.3?'burned':'car', flip:r()<.5});
      if (r()<0.5) out.push({k:'crate', x:X+R(-180,180), y:Y+R(-200,-150)});
      scatter(L, 3 + (r()*3|0), I, 170, (x,y) => out.push({k:'pine', x, y, v:r()*3|0}));
    } else if (type==='cabin'){
      out.push({k:'cabin', x:X, y:Y-30, v:r()*2|0});
      out.push({k:'woodpile', x:X+R(70,110), y:Y-20});
      out.push({k:'stump', x:X-R(70,110), y:Y+10});
      if (r()<0.6) out.push(lampProp('campfire', X+R(-120,120), Y+R(90,150), r, {light:'orange', lr:46, lh:12, fire:true}));
      if (r()<0.5) out.push({k:'carF', x:X-R(110,170), y:Y+R(80,180), c:CAR_COLS[r()*CAR_COLS.length|0], v:'car', back:r()<.5});
      scatter(L, 4 + (r()*3|0), I, 120, (x,y) => out.push({k:'pine', x, y, v:r()*3|0}));
    } else { // clearing
      for (let i=0;i<2+(r()*3|0);i++) out.push({k: r()<.5 ? 'rock' : 'bush', x:X+R(-I,I), y:Y+R(-I,I), v:0});
      for (let i=0;i<2;i++) out.push({k:'log', x:X+R(-I,I), y:Y+R(-I,I)});
      scatter(L, 2 + (r()*3|0), I, 100, (x,y) => out.push({k:'pine', x, y, v:r()*3|0}));
      if (r()<0.4) out.push({k:'barrel', x:X+R(-I,I), y:Y+R(-I,I)});
    }
  },
  street(ctx, props){ const {r, R, X0, Y0} = ctx;
    // trees lining the trail and the odd abandoned car
    for (let i=0;i<4;i++){ const h = r()<.5, s = r()<.5 ? 1 : -1; let along = R(20, CH-20); if (along > 250 && along < 390) continue;
      const across = 320 + s*R(70,86); props.push({k: r()<0.8 ? 'pine' : 'bush', x:X0 + (h?along:across), y:Y0 + (h?across:along), v:r()*3|0}); }
    if (r()<0.25){ const h = r()<.5, along = r()<.5 ? 150 : 490;
      props.push(h ? {k:'carS', x:X0+along, y:Y0+R(300,340), c:CAR_COLS[r()*CAR_COLS.length|0], v:r()<0.5?'burned':'car', flip:r()<.5}
                   : {k:'carF', x:X0+R(300,340), y:Y0+along, c:CAR_COLS[r()*CAR_COLS.length|0], v:r()<0.5?'burned':'car', back:r()<.5}); }
  },
  gen(cx,cy){ return genThemed(this, cx, cy); },
};

// ---------- THE DOCKS ----------
MAPS.docks = {
  n:'THE DOCKS', d:'Container yards, fuel depots and floodlights. Fuel drums everywhere: light them up.', place:'THE PORT',
  day:'#ccd4dc', night:'#a8b4e4', salt:2203,
  lotType(lx,ly){ if (lx===0 && ly===0) return 'yard';
    const v = mulberry(seedOf(lx,ly,2203))(); return v<0.4 ? 'yard' : v<0.6 ? 'warehouse' : v<0.8 ? 'depot' : 'open'; },
  tile(i){
    if (i.band) return tileOf(TILES.yardAsph, i.wx, i.wy);
    if (i.ltx===-8 || i.ltx===7 || i.lty===-8 || i.lty===7) return tileOf(TILES.concrete, i.wx, i.wy);
    switch (i.type){
      case 'depot': return tileOf(TILES.plate, i.wx, i.wy);
      case 'warehouse': return tileOf(TILES.concrete, i.wx, i.wy);
      default: return tileOf(TILES.dock, i.wx, i.wy);
    }
  },
  decorate(ctx){ const {P, r, R, cx, cy} = ctx;
    // yellow edge lines on the haul roads and a rail spur along every other horizontal lane
    for (let t=0;t<CPX;t+=1){ if (t < 128 || t > 192){ P(t,130,1,1,'#c8a83a'); P(t,189,1,1,'#c8a83a'); P(130,t,1,1,'#c8a83a'); P(189,t,1,1,'#c8a83a'); } }
    if (((cy % 2) + 2) % 2 === 0){
      for (let t=0;t<CPX;t+=5) P(t,152,3,16,'#4a3a2a');
      P(0,154,CPX,2,'#8a8a92'); P(0,165,CPX,2,'#8a8a92'); P(0,154,CPX,1,'#b8b8c0'); P(0,165,CPX,1,'#b8b8c0');
    } else for (let t=0;t<CPX;t+=16) if (t < 104 || t > 208) P(t+2,159,9,2,'#c8a83a');
    for (let t=0;t<CPX;t+=16) if (t < 104 || t > 208) P(159,t+2,2,9,'#c8a83a');
    // oil stains and stencil numbers in the yards
    for (let i=0;i<5;i++){ const x = R(0,CPX)|0, y = R(0,CPX)|0; pell(ctx.g, x, y, R(4,10), R(2,5), 'rgba(16,14,20,.35)'); }
    forLots(ctx, (lx, ly, ox, oy) => { const t = this.lotType(lx,ly); if (t !== 'yard' && t !== 'open') return;
      const rr = mulberry(seedOf(lx,ly,2209));
      for (let i=0;i<4;i++){ const x = ox + ((rr()-.5)*200|0), y = oy + ((rr()-.5)*200|0); P(x,y,18,1,'#c8a83a'); P(x,y+8,18,1,'#c8a83a'); P(x,y,1,9,'#c8a83a'); P(x+17,y,1,9,'#c8a83a'); } });
  },
  lotProps(L, out, type){ const {r, R, X, Y} = L, I = 210;
    const cont = (x, y) => out.push({k: r()<0.45 ? 'cont2' : 'cont', x, y, v:r()*7|0});
    if (type==='yard'){
      // rows of containers with aisles between them
      for (const ry of [-150, -50, 70, 170]) for (const rx of [-150, 0, 150]) if (r() < 0.62 && !(Math.abs(rx) < 10 && Math.abs(ry) < 80)) cont(X+rx+R(-6,6), Y+ry);
      for (let i=0;i<2+(r()*3|0);i++) out.push({k: r()<.5 ? 'pallet' : 'crate', x:X+R(-I,I), y:Y+R(-I,I)});
      if (r()<0.5) out.push({k:'forklift', x:X+R(-120,120), y:Y+R(-20,20)});
      for (let i=0;i<1+(r()*2|0);i++) out.push({k:'fuel', x:X+R(-I,I), y:Y+R(-I,I)});
    } else if (type==='warehouse'){
      out.push({k:'warehouse', x:X+R(-20,20), y:Y-50});
      for (let i=0;i<3+(r()*3|0);i++) out.push({k: r()<.5 ? 'pallet' : 'crate', x:X+R(-I,I), y:Y+R(10,I)});
      if (r()<0.7) out.push({k:'forklift', x:X+R(-140,140), y:Y+R(40,120)});
      if (r()<0.6) out.push({k:'carS', x:X+R(-140,140), y:Y+R(150,200), c:'#e8e4d8', v:'car', flip:r()<.5});
      out.push(lampProp('flood', X+(r()<.5?-1:1)*R(150,190), Y+R(-160,-120), r, {light:'white', lr:70, lh:66, broken:r()<0.15}));
    } else if (type==='depot'){
      for (const [tx,ty] of [[-110,-80],[110,-80],[0,110]]) if (r()<0.85) out.push({k:'tank', x:X+tx+R(-10,10), y:Y+ty});
      for (let i=0;i<5+(r()*5|0);i++) out.push({k: r()<0.75 ? 'fuel' : 'toxic', x:X+R(-I,I), y:Y+R(-I,I)});
      for (let i=0;i<3;i++) out.push({k:'barrel', x:X+R(-I,I), y:Y+R(-I,I)});
      if (r()<0.6) out.push({k:'sandbags', x:X+R(-150,150), y:Y+R(-40,40)});
    } else { // open quay
      for (let i=0;i<4;i++) out.push({k:'bollard', x:X+R(-I,I), y:Y+R(-I,I)});
      for (let i=0;i<1+(r()*3|0);i++) cont(X+R(-150,150), Y+R(-150,150));
      for (let i=0;i<1+(r()*2|0);i++) out.push({k:'carF', x:X+R(-I,I), y:Y+R(-I,I), c:CAR_COLS[r()*CAR_COLS.length|0], v:r()<0.3?'burned':'car', back:r()<.5});
      for (let i=0;i<2+(r()*3|0);i++) out.push({k: r()<.5 ? 'fuel' : 'barrel', x:X+R(-I,I), y:Y+R(-I,I)});
      if (r()<0.5) out.push({k:'cone', x:X+R(-I,I), y:Y+R(-I,I)});
    }
  },
  street(ctx, props){ const {r, R, X0, Y0} = ctx;
    const corners = r()<.5 ? [[236,236],[404,404]] : [[404,236],[236,404]];
    for (const [lx,ly] of corners){ const v = r(); props.push(lampProp('flood', X0+lx, Y0+ly, r, {light:'white', lr:70, lh:66, broken:v<0.15, flick:v>=0.15 && v<0.3})); }
    if (r()<0.5){ const along = r()<.5 ? R(40,200) : R(440,600);
      props.push({k:'carS', x:X0+along, y:Y0+R(270,290), c:'#c8a83a', v:r()<0.3?'burned':'car', flip:r()<.5}); }
    for (let i=0;i<(r()*3|0);i++) props.push({k: r()<.5 ? 'cone' : 'pallet', x:X0+R(270,370), y:Y0+R(200,440)});
  },
  gen(cx,cy){ return genThemed(this, cx, cy); },
};

// ---------- DEAD END (desert) ----------
MAPS.desert = {
  n:'DEAD END', d:'A sun-bleached desert highway. Brutal glare by day; only burning barrels light the night.', place:'THE DESERT',
  day:'#f0dcc0', night:'#b4aed8', salt:3307,
  lotType(lx,ly){ if (lx===0 && ly===0) return 'outpost';
    const v = mulberry(seedOf(lx,ly,3307))(); return v<0.38 ? 'dunes' : v<0.58 ? 'junk' : v<0.74 ? 'outpost' : v<0.9 ? 'mesa' : 'camp'; },
  tile(i){
    if (i.band){ const hw = (i.tx===9 || i.tx===10) || (i.ty===9 || i.ty===10);
      return hw ? tileOf(TILES.oldAsph, i.wx, i.wy) : tileOf(TILES.sand, i.wx, i.wy); }
    switch (i.type){
      case 'outpost': return (Math.abs(i.ltx+0.5) < 6 && Math.abs(i.lty+0.5) < 6) ? tileOf(TILES.concrete, i.wx, i.wy) : tileOf(TILES.sand, i.wx, i.wy);
      case 'junk': return tileOf(TILES.cracked, i.wx, i.wy);
      case 'mesa': return tileOf((seedOf(i.wx,i.wy,4)>>>4)%3 ? TILES.cracked : TILES.sand, i.wx, i.wy);
      default: return tileOf(TILES.sand, i.wx, i.wy);
    }
  },
  decorate(ctx){ const {P, r, R} = ctx;
    // faded centre line, sand drifting over the tarmac
    for (let t=0;t<CPX;t+=20) if (t < 140 || t > 180){ P(t+3,159,10,2,'#d8c890'); P(159,t+3,2,10,'#d8c890'); }
    for (let i=0;i<10;i++){ const h = r()<.5, a = R(0,CPX)|0, b = R(144,176)|0; pell(ctx.g, h?a:b, h?b:a, R(3,9), R(1,3), 'rgba(200,164,106,.7)'); }
    for (let i=0;i<4;i++){ const h = r()<.5; let x = (h?R(0,CPX):R(146,174))|0, y = (h?R(146,174):R(0,CPX))|0;
      for (let k=0;k<12;k++){ P(x,y,1,1,'#2e2824'); x += h ? 1 : (r()<.5?1:-1); y += h ? (r()<.5?1:-1) : 1; } }
    // bleached bones, pebbles
    for (let i=0;i<16;i++) P(R(0,CPX)|0, R(0,CPX)|0, 1, 1, r()<.5 ? '#8a6a42' : '#e8dcc0');
    forLots(ctx, (lx, ly, ox, oy) => { if (this.lotType(lx,ly) !== 'junk') return;
      const rr = mulberry(seedOf(lx,ly,3311));
      for (let i=0;i<5;i++){ const x = ox + (rr()-.5)*200, y = oy + (rr()-.5)*200;
        for (let k=0;k<30;k++){ const a = rr()*TAU, d = rr()*14; P(Math.round(x+Math.cos(a)*d), Math.round(y+Math.sin(a)*d*0.7), 1+(rr()*2|0), 1, ['#6a5a4a','#4a3a2e','#8a7a62','#3a2e24'][rr()*4|0]); } } });
  },
  lotProps(L, out, type){ const {r, R, X, Y} = L, I = 220;
    const fire = (x, y) => out.push(lampProp('firebarrel', x, y, r, {light:'orange', lr:44, lh:20, fire:true}));
    if (type==='outpost'){
      out.push({k:'kiosk', x:X, y:Y-120});
      for (const ix of [-70, 70]) out.push({k:'pump', x:X+ix, y:Y+30});
      for (let i=0;i<2+(r()*3|0);i++) out.push({k:'fuel', x:X+R(-180,180), y:Y+R(70,180)});
      fire(X+R(-160,-100), Y+R(60,120));
      if (r()<0.7) out.push({k:'carS', x:X+R(-120,120), y:Y+R(90,170), c:CAR_COLS[r()*CAR_COLS.length|0], v:r()<0.4?'burned':'car', flip:r()<.5});
      for (let i=0;i<2;i++) out.push({k:'cactus', x:X+(r()<.5?-1:1)*R(190,230), y:Y+R(-I,I), v:r()*3|0});
    } else if (type==='junk'){
      for (let i=0;i<3+(r()*3|0);i++) out.push({k: r()<.5?'carS':'carF', x:X+R(-180,180), y:Y+R(-180,180), c:'#000000', v:'burned', flip:r()<.5, back:r()<.5});
      if (r()<0.5) out.push({k:'wreckbus', x:X+R(-80,80), y:Y+R(-60,60)});
      for (let i=0;i<2+(r()*3|0);i++) out.push({k:'tires', x:X+R(-I,I), y:Y+R(-I,I)});
      for (let i=0;i<1+(r()*3|0);i++) out.push({k: r()<0.5 ? 'fuel' : r()<0.5 ? 'toxic' : 'barrel', x:X+R(-I,I), y:Y+R(-I,I)});
      if (r()<0.7) fire(X+R(-150,150), Y+R(-150,150));
    } else if (type==='mesa'){
      out.push({k:'boulder', x:X+R(-60,60), y:Y+R(-60,20), v:1});
      for (let i=0;i<3+(r()*3|0);i++) out.push({k:'rock', x:X+R(-I,I), y:Y+R(-I,I), v:1});
      for (let i=0;i<2;i++) out.push({k:'cactus', x:X+R(-I,I), y:Y+R(-I,I), v:r()*3|0});
      if (r()<0.6) out.push({k:'skull', x:X+R(-I,I), y:Y+R(-I,I)});
    } else if (type==='camp'){
      for (let i=0;i<2+(r()*2|0);i++) out.push({k:'tent', x:X+R(-150,150), y:Y+R(-150,0), v:r()<.5 ? 0 : 3});
      fire(X, Y+30); out.push({k:'sandbags', x:X+R(-100,100), y:Y+R(100,160)});
      for (let i=0;i<2+(r()*3|0);i++) out.push({k: r()<.5 ? 'crate' : 'fuel', x:X+R(-I,I), y:Y+R(-I,I)});
      if (r()<0.6) out.push({k:'carS', x:X+R(-140,140), y:Y+R(170,210), c:'#8a7a52', v:r()<0.3?'burned':'car', flip:r()<.5});
    } else { // dunes
      for (let i=0;i<3+(r()*4|0);i++) out.push({k:'cactus', x:X+R(-I,I), y:Y+R(-I,I), v:r()*3|0});
      for (let i=0;i<1+(r()*3|0);i++) out.push({k: r()<.5 ? 'rock' : 'tumble', x:X+R(-I,I), y:Y+R(-I,I), v:1});
      if (r()<0.5) out.push({k:'skull', x:X+R(-I,I), y:Y+R(-I,I)});
      if (r()<0.3) fire(X+R(-150,150), Y+R(-150,150));
    }
  },
  street(ctx, props){ const {r, R, X0, Y0} = ctx;
    if (r()<0.45){ const h = r()<.5, along = r()<.5 ? R(40,200) : R(440,600), v = r()<0.6 ? 'burned' : 'car';
      props.push(h ? {k:'carS', x:X0+along, y:Y0+R(300,340), c:CAR_COLS[r()*CAR_COLS.length|0], v, flip:r()<.5}
                   : {k:'carF', x:X0+R(300,340), y:Y0+along, c:CAR_COLS[r()*CAR_COLS.length|0], v, back:r()<.5}); }
    for (let i=0;i<(r()*3|0);i++) props.push({k:'tumble', x:X0+R(40,CH-40), y:Y0+R(280,360)});
    if (r()<0.35) props.push({k:'cactus', x:X0 + (r()<.5 ? R(20,230) : R(410,620)), y:Y0 + (r()<.5 ? 262 : 382), v:2});
  },
  gen(cx,cy){ return genThemed(this, cx, cy); },
};
MAP_ORDER.push('forest', 'docks', 'desert');
// each map opens by doing something on the map before it (checked with the character tasks, twice a second)
MAPS.forest.task = {map:'city',   k:'time', n:300, txt:'Survive until 5:00 in Downtown'};
MAPS.docks.task  = {map:'forest', k:'boss', n:1,   txt:'Defeat a boss in Pine Hollow'};
MAPS.desert.task = {map:'docks',  k:'boss', n:1,   txt:'Defeat a boss in The Docks'};
if (!MAPS[MAP_ID]) MAP_ID = 'city';

// ---------- map select overlay ----------
// a small baked preview: the crossroads and one lot, with its props
function mapPreview(id){
  const prev = MAP_ID; MAP_ID = id;
  const M = curMap(), gen = (cx, cy) => M.gen ? M.gen(cx, cy) : genCity(cx, cy);
  // centre on the starting lot (it sits on the corner where four chunks meet)
  const W = 168, H = 104, ox = -W/2, oy = -H/2 - 10, c = mk(W, H), g = c.getContext('2d'), props = [];
  g.imageSmoothingEnabled = false;
  for (const [cx, cy] of [[-1,-1],[0,-1],[-1,0],[0,0]]){ const ch = gen(cx, cy); g.drawImage(ch.c, cx*CPX - ox, cy*CPX - oy); props.push(...ch.props); }
  props.sort((a,b) => a.y - b.y);
  for (const p of props){ const x = Math.round(p.x/2 - ox), y = Math.round(p.y/2 - oy); if (x < -60 || x > W+60 || y < -4 || y > H+80) continue;
    const sh = PROP_SHADOW[p.k]; if (sh){ g.fillStyle = 'rgba(12,6,18,.35)'; pell(g, x+1, y, sh[0], sh[1]); } drawProp(g, p, x, y); }
  g.globalCompositeOperation = 'multiply'; g.fillStyle = M.day; g.fillRect(0,0,W,H);
  MAP_ID = prev;
  return c;
}
let mapsReturn = 'chars', mapChar = null;
const mapPrevCache = {};
function openMaps(cid){
  if (!META.hasMap(MAP_ID)) setMap('city');
  mapChar = cid; $('chars').classList.remove('show'); $('maps').classList.add('show'); renderMaps();
}
function closeMaps(){ $('maps').classList.remove('show'); $('chars').classList.add('show'); }
function pickMap(id){ if (!META.hasMap(id)) return; setMap(id); $('maps').classList.remove('show'); startGame(mapChar); }
function renderMaps(){
  const el = $('mapGrid'); el.innerHTML = '';
  for (const id of MAP_ORDER){
    const M = MAPS[id], img = mapPrevCache[id] || (mapPrevCache[id] = mapPreview(id).toDataURL());
    const open = META.hasMap(id), b = document.createElement('button'); b.className = 'card map' + (id === MAP_ID ? ' sel' : '') + (open ? '' : ' locked');
    const R = MAP_ROSTER[id], foes = R.bosses.map(k => VARIANTS[k] ? VARIANTS[k].n : BOSS_NAME[k]).join(', ');
    b.innerHTML = `<img class="ic preview" src="${img}" alt=""><div class="nm">${M.n}</div>` + (open
      ? `<div class="ds">${M.d}</div><div class="ds hz">BOSSES: ${foes}</div>`
      : `<div class="ds">LOCKED</div><div class="lv lock">${M.task.txt.toUpperCase()}</div>`);
    b.onclick = () => { if (open){ SFX.play('select'); pickMap(id); } else SFX.play('click'); };
    el.appendChild(b);
  }
}
