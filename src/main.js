"use strict";

// ---------- boot ----------
$('startBtn').onclick = () => openChars('title');
$('againBtn').onclick = () => openChars('over');
$('charsBack').onclick = closeChars;
$('labBtn').onclick = () => openShop('title');
$('labBtn2').onclick = () => openShop('over');
$('shopBack').onclick = closeShop;
$('reroll').onclick = rerollLevel;
$('resumeBtn').onclick = () => { if (S && S.state==='pause') setState('play'); };
$('soundBtn').onclick = () => { SFX.toggle(); $('soundBtn').textContent = 'SOUND: ' + (SFX.muted ? 'OFF' : 'ON'); };
let giveUpArmed = false;
$('quitBtn').onclick = () => { if (!giveUpArmed){ giveUpArmed = true; $('quitBtn').textContent = 'TAP AGAIN'; return; } giveUpArmed = false; gameOver(false); };
refreshTitleDna();
let last = performance.now();
function frame(now){
  const dt = Math.min(0.05, (now-last)/1000); last = now;
  if (S && S.state==='play') update(dt);
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
