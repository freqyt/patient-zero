"use strict";

// ---------- input: keyboard ----------
addEventListener('keydown', e => {
  const k = e.key.toLowerCase(); K[k] = true;
  if (k==='m'){ SFX.toggle(); return; }
  if (k===' ' || k.startsWith('arrow')) e.preventDefault();
  if ($('shop').classList.contains('show')){ if (k==='escape') closeShop(); return; }
  if (optionsOpen()){ if (k==='escape') closeOptions(); return; }
  if (archiveOpen()){ if (k==='escape') closeArchive(); return; }
  if ($('saveio').classList.contains('show')){ if (k==='escape') closeSave(); return; }
  if ($('chars').classList.contains('show')){ if (k==='escape') closeChars(); if (k==='enter') pickChar(selChar); return; }
  if (!S){ if (k==='enter' || k===' ') openChars('title'); return; }
  if (S.state==='play'){
    if (k==='p' || k==='escape') setState('pause');
  } else if (S.state==='pause'){ if (k==='p' || k==='escape') setState('play'); }
  else if (S.state==='level'){ if (k>='1' && k<='5'){ const c = $('cards').children[+k-1]; if (c) c.click(); } if (k==='r') rerollLevel(); }
  else if (S.state==='over'){ if (k==='r') startGame(S.cid); if (k==='enter') openChars('over'); if (k==='e' && S.won && !S.endless) startEndless(); }
});
addEventListener('keyup', e => { K[e.key.toLowerCase()] = false; });
addEventListener('blur', () => { for (const k in K) K[k] = false; resetStick(); if (S && S.state==='play') setState('pause'); });

// ---------- input: touch (virtual stick + buttons) ----------
const touch = {used:false, stick:null, id:null, ox:0, oy:0};
function lowXY(e){ return [e.clientX*DPR/SCALE, e.clientY*DPR/SCALE]; }
cv.addEventListener('pointerdown', e => {
  // the pause button works for mouse and touch alike (generous hit area for thumbs)
  if (S && S.state === 'play'){ const [x, y] = lowXY(e), b = PAUSE_BTN();
    if (x > b.x-5 && x < b.x+b.w+5 && y > b.y-5 && y < b.y+b.h+5){ e.preventDefault(); setState('pause'); return; } }
  if (e.pointerType === 'mouse') return;
  touch.used = true; e.preventDefault();
  if (!S || S.state!=='play') return;
  const [x,y] = lowXY(e);
  // always hand the stick to the newest finger, so a lost "finger up" event can never leave it stuck
  touch.id = e.pointerId; touch.ox = x; touch.oy = y; touch.stick = {dx:0, dy:0};
  try { cv.setPointerCapture(e.pointerId); } catch (err) {}
});
cv.addEventListener('pointermove', e => {
  if (e.pointerId !== touch.id) return;
  const [x,y] = lowXY(e), dx = x-touch.ox, dy = y-touch.oy, d = Math.hypot(dx,dy), R = 22;
  if (d > R){ touch.ox = x - dx/d*R; touch.oy = y - dy/d*R; }
  touch.stick = {dx: clamp(dx/R,-1,1), dy: clamp(dy/R,-1,1)};
});
function resetStick(){ touch.id = null; touch.stick = null; }
const endTouch = e => { if (e.pointerId === touch.id) resetStick(); };
// belt and braces: any of these ending the active touch releases the stick
for (const ev of ['pointerup','pointercancel','lostpointercapture']) cv.addEventListener(ev, endTouch);
addEventListener('pointerup', endTouch); addEventListener('pointercancel', endTouch);
addEventListener('touchend', e => { if (e.touches.length === 0) resetStick(); }, {passive:true});
addEventListener('touchcancel', resetStick, {passive:true});
document.addEventListener('visibilitychange', resetStick);
function drawTouchUI(){
  if (!touch.used) return;
  if (touch.stick){ const x = Math.round(touch.ox), y = Math.round(touch.oy);
    lg.globalAlpha = 0.5; lg.fillStyle = '#e0d8f0';
    const n = 40; for (let i=0;i<n;i++){ const a = i/n*TAU; lg.fillRect(Math.round(x+Math.cos(a)*22), Math.round(y+Math.sin(a)*22), 1, 1); }
    pcirc(lg, Math.round(x+touch.stick.dx*22), Math.round(y+touch.stick.dy*22), 7, '#e0d8f0'); lg.globalAlpha = 1; }
}
