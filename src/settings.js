"use strict";
// ---------- player options: volumes and comfort settings (saved per device, included in save codes) ----------
const SET = (() => {
  const s = {music:100, sfx:100, shake:1, flash:1, numbers:true};
  try { Object.assign(s, JSON.parse(localStorage.getItem('pz-settings') || '{}')); } catch (e) {}
  return s;
})();
const saveSettings = () => { try { localStorage.setItem('pz-settings', JSON.stringify(SET)); } catch (e) {} };
// three-way comfort levels for shake and flashes
const LEVELS = [[1, 'FULL'], [0.4, 'LOW'], [0, 'OFF']];
const levelName = v => (LEVELS.find(l => l[0] === v) || LEVELS[0])[1];
const nextLevel = v => LEVELS[(LEVELS.findIndex(l => l[0] === v) + 1) % LEVELS.length][0];

let optReturn = 'title';
function openOptions(from){
  optReturn = from; SFX.init();
  for (const id of ['title','pause']) $(id).classList.remove('show');
  $('options').classList.add('show'); renderOptions();
}
function closeOptions(){ $('options').classList.remove('show'); $(optReturn).classList.add('show'); if (optReturn === 'pause') renderPause(); }
const optionsOpen = () => $('options').classList.contains('show');
function renderOptions(){
  $('optMusic').value = SET.music; $('optMusicV').textContent = SET.music + '%';
  $('optSfx').value = SET.sfx; $('optSfxV').textContent = SET.sfx + '%';
  $('optShake').textContent = levelName(SET.shake);
  $('optFlash').textContent = levelName(SET.flash);
  $('optNums').textContent = SET.numbers ? 'ON' : 'OFF';
}
$('optMusic').oninput = e => { SET.music = +e.target.value; saveSettings(); SFX.volumes(); renderOptions(); };
$('optSfx').oninput = e => { SET.sfx = +e.target.value; saveSettings(); SFX.volumes(); renderOptions(); };
$('optSfx').onchange = () => SFX.play('pickup');   // a sample at the new volume
$('optShake').onclick = () => { SET.shake = nextLevel(SET.shake); saveSettings(); SFX.play('click'); renderOptions(); };
$('optFlash').onclick = () => { SET.flash = nextLevel(SET.flash); saveSettings(); SFX.play('click'); renderOptions(); };
$('optNums').onclick = () => { SET.numbers = !SET.numbers; saveSettings(); SFX.play('click'); renderOptions(); };
$('optBack').onclick = closeOptions;
$('optBtn').onclick = () => openOptions('title');
$('optBtn2').onclick = () => openOptions('pause');
