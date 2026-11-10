"use strict";

// ---------- HUD (pixel) ----------
function win(x,y,w,h){
  lg.fillStyle = 'rgba(18,10,26,.84)'; lg.fillRect(x+1,y+1,w-2,h-2);
  lg.fillStyle = '#7a6a8a'; lg.fillRect(x+1,y,w-2,1); lg.fillRect(x,y+1,1,h-2);
  lg.fillStyle = '#2e2238'; lg.fillRect(x+1,y+h-1,w-2,1); lg.fillRect(x+w-1,y+1,1,h-2);
}
function pbar(x,y,w,h,f,c0,c1){
  lg.fillStyle = '#0c0810'; lg.fillRect(x-1,y-1,w+2,h+2); lg.fillStyle = '#2e2236'; lg.fillRect(x,y,w,h);
  const fw = Math.round(w*clamp(f,0,1)); lg.fillStyle = c1; lg.fillRect(x,y,fw,h); lg.fillStyle = c0; lg.fillRect(x,y,fw,1);
}
function edgeArrow(tx,ty,col,size=6){
  const x = sx(tx), y = sy(ty) - 8; if (x > 6 && x < LW-6 && y > 6 && y < LH-6) return;
  const cxs = LW/2, cys = LH/2, a = Math.atan2(y-cys, x-cxs), m = 12;
  const k = Math.min((LW/2-m)/Math.abs(Math.cos(a)||1e-6), (LH/2-m)/Math.abs(Math.sin(a)||1e-6));
  const ax = Math.round(cxs + Math.cos(a)*k), ay = Math.round(cys + Math.sin(a)*k);
  lg.fillStyle = col;
  for (let i=0;i<size;i++){ const bx = ax - Math.round(Math.cos(a)*i), by = ay - Math.round(Math.sin(a)*i), w = Math.floor(i*0.8);
    for (let j=-w;j<=w;j++) lg.fillRect(bx + Math.round(-Math.sin(a)*j), by + Math.round(Math.cos(a)*j), 1, 1); }
}
function drawHUD(nt){
  const p = S.player;
  lg.fillStyle = '#0c0810'; lg.fillRect(0,0,LW,3);
  lg.fillStyle = '#c84a8a'; lg.fillRect(0,0,Math.round(LW*clamp(S.xp/S.xpNext,0,1)),2); lg.fillStyle = '#ff9ccc'; lg.fillRect(0,0,Math.round(LW*clamp(S.xp/S.xpNext,0,1)),1);

  win(3,6,104,38);
  lg.drawImage(ICON.heart, 7, 11); pbar(17,12,54,4,p.hp/p.maxHp,'#ff7a7a','#c8283a');
  ptext(lg, Math.ceil(p.hp), 75, 10, '#f0e8e0');
  lg.drawImage(ICON.zed, 7, 21); const cap = hordeCap(); pbar(17,22,54,4,S.minions.length/cap,'#c8ff7a','#4e9a16');
  ptext(lg, `${S.minions.length}/${cap}`, 75, 20, '#c8ff7a');
  const dr = p.devourCd <= 0;
  ptext(lg, 'EAT', 7, 32, dr ? '#ff7a7a' : '#6a5a6a'); pbar(28,34,74,3, dr ? 1 : 1-p.devourCd/5, '#ff9a9a', dr?'#e03a4a':'#6a3a44');

  const narrow = LW < 300, tcx = narrow ? 55 : Math.round(LW/2), tcy = narrow ? 48 : 6;
  const rem = Math.max(0, GAME_LEN - S.t), mm = Math.floor(rem/60), ss = String(Math.floor(rem%60)).padStart(2,'0');
  if (S.overtime) { if ((S.t*3|0)%2) ptext(lg, 'KILL IT', tcx, tcy, '#ff5a4a', {align:'center', scale:2, shadow:'#170d1c'}); }
  else ptext(lg, `${mm}:${ss}`, tcx, tcy, '#f6f0e0', {align:'center', scale:2, shadow:'#170d1c'});
  const sw = 44, sx0 = tcx - sw/2, sy0 = tcy + 18, ph = (S.t % 100)/100;
  lg.fillStyle = '#0c0810'; lg.fillRect(sx0-1, sy0-1, sw+2, 4);
  lg.fillStyle = '#c89a3a'; lg.fillRect(sx0, sy0, Math.round(sw*0.62), 2);
  lg.fillStyle = '#3e5aa8'; lg.fillRect(sx0+Math.round(sw*0.62), sy0, sw-Math.round(sw*0.62), 2);
  const night = nt > 0.5;
  pcirc(lg, Math.round(sx0 + sw*ph), sy0+1, 2, '#170d1c'); pcirc(lg, Math.round(sx0 + sw*ph), sy0+1, 1, night ? '#c8d8ff' : '#ffd860');
  if (night && (S.t*2|0)%2) ptext(lg, 'NIGHT', tcx, sy0+5, '#9ab0ff', {align:'center', shadow:'#170d1c'});

  // top-right: minimap, kill counter under it, pause button to the left (other stats live in the pause screen)
  drawMinimap(LW-50, 6, 47, 38);
  win(LW-50, 46, 47, 14); lg.drawImage(ICON.skull, LW-46, 49); ptext(lg, S.kills, LW-7, 49, '#f0e8e0', {align:'right'});
  { const b = PAUSE_BTN(); win(b.x, b.y, b.w, b.h); lg.fillStyle = '#e8e0d0'; lg.fillRect(b.x+4, b.y+3, 2, b.h-6); lg.fillRect(b.x+b.w-6, b.y+3, 2, b.h-6); }

  const boss = S.humans.find(h => h.boss);
  if (boss){ const bw = Math.min(160, LW-24), bx = Math.round(LW/2 - bw/2), by = narrow ? 70 : 38;
    ptext(lg, BOSS_NAME[boss.type], LW/2, by-9, '#ff8a7a', {align:'center', shadow:'#170d1c'});
    pbar(bx, by, bw, 3, boss.hp/boss.maxHp, '#ffa080', '#d02828'); }

  // mutation slots: owned icons with level pips, then empty frames up to the cap
  // two rows: weapons (red frames) along the bottom, items (blue frames) above them
  const own = Object.keys(S.mods);
  slotRow(own.filter(isWeapon), slotsW(), LH - 27, '#a85a5a', '#4a2a30');
  slotRow(own.filter(k => !isWeapon(k)), slotsI(), LH - 52, '#5a7aa8', '#2a3048');

  if (S.banner && S.state !== 'over'){ const b = S.banner, el = 3.2 - b.t;
    if (el > 0.08 || (S.t*20|0)%2){ const y = Math.round(LH*0.28), sc = textW(b.text,2) < LW-16 ? 2 : 1;
      lg.fillStyle = 'rgba(10,4,16,.7)'; lg.fillRect(0, y-6, LW, sc===2?32:24);
      lg.fillStyle = '#5a8a2a'; lg.fillRect(0, y-6, LW, 1); lg.fillRect(0, y+(sc===2?25:17), LW, 1);
      const shown = b.text.slice(0, Math.ceil(el*40));
      ptext(lg, shown, LW/2 - textW(b.text,sc)/2, y-2, '#c8ff7a', {shadow:'#170d1c', scale:sc});
      if (el > 0.6) ptext(lg, b.sub, LW/2, y+(sc===2?15:8), '#e8e0d0', {align:'center', shadow:'#170d1c'}); } }

  if (p.saw > 0){ win(3,46,104,12); ptext(lg, 'GAT', 7, 49, (S.t*8|0)%2 ? '#ece4c8' : '#fff4c0'); pbar(28,51,74,3,p.saw/8,'#fff4c0','#b0a688'); }
  // boss chests get a big blinking gold arrow; other pickups a small coloured one
  for (const it of S.items){ if (it.k === 'chest') edgeArrow(it.x, it.y, (S.t*4|0)%2 ? '#ffe070' : '#ff9a20', 11); else edgeArrow(it.x, it.y, ITEM_COL[it.k]); }
  for (const h of S.humans) if (h.type==='crate') edgeArrow(h.x, h.y, '#d8a860');
  if (S.crowd) edgeArrow(S.crowd.x, S.crowd.y, (S.t*6|0)%2 ? '#ff9ccc' : '#c84a8a');
  if (boss) edgeArrow(boss.x, boss.y, '#ff4a3a');

  const low = p.hp/p.maxHp < 0.3;
  if (p.flash > 0 || (low && (S.t*3|0)%2)){ lg.globalAlpha = p.flash > 0 ? 0.9 : 0.5; lg.drawImage(tintedVig(),0,0); lg.globalAlpha = 1; }
  drawTouchUI();
}
let tvCache = null, tvKey = '';
function tintedVig(){ const key = LW+'x'+LH; if (tvKey !== key){ tvCache = tinted(vig, '#c81030'); tvKey = key; } return tvCache; }

// ---------- minimap ----------
function drawMinimap(x0, y0, w, h){
  win(x0, y0, w, h);
  const p = S.player, cx = x0 + (w>>1), cy = y0 + (h>>1), sc = 1/24;
  const dot = (wx, wy, col, sz=1) => { const x = Math.round(cx + (wx-p.x)*sc), y = Math.round(cy + (wy-p.y)*sc);
    if (x <= x0+1 || x+sz > x0+w-1 || y <= y0+1 || y+sz > y0+h-1) return; lg.fillStyle = col; lg.fillRect(x, y, sz, sz); };
  lg.fillStyle = 'rgba(255,255,255,.07)'; lg.fillRect(Math.round(cx - VW*sc/2), Math.round(cy - VH*sc/2), Math.round(VW*sc), Math.round(VH*sc));
  for (const o of S.humans){ if (o.boss || o.type==='crate') continue; dot(o.x, o.y, o.type==='hazard' ? '#ff8a3a' : '#8a4a52'); }
  for (const m of S.minions) dot(m.x, m.y, '#5a9a3a');
  for (const it of S.items) dot(it.x, it.y, ITEM_COL[it.k], it.k === 'chest' ? 3 : 2);
  for (const o of S.humans) if (o.type==='crate') dot(o.x, o.y, '#ffd860', 2);
  if (S.crowd) dot(S.crowd.x, S.crowd.y, '#ff9ccc', 2);
  for (const o of S.humans) if (o.boss && (S.t*4|0)%2) dot(o.x, o.y, '#ff3a2a', 3);
  lg.fillStyle = '#ffffff'; lg.fillRect(cx-1, cy-1, 2, 2);
}


const PAUSE_BTN = () => ({x: LW-66, y: 6, w: 13, h: 13});
