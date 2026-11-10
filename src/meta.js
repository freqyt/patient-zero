"use strict";
// ---------- DNA Lab: persistent upgrades bought with DNA earned each run ----------
const META = (() => {
  const KEY = 'pz-meta-v1';
  // runs: recent run log (newest first); ach: feat id -> date earned; seen: codex discoveries {cat:{key:count}};
  // heat: highest Heat unlocked; life: lifetime totals
  let data = {dna:0, up:{}, best:{t:0, kills:0, wins:0}, chars:['zero'], runs:[], ach:{}, seen:{}, heat:0, heatSel:0, winsBy:{}, life:{kills:0, runs:0, time:0}};
  try { const s = localStorage.getItem(KEY); if (s) data = Object.assign(data, JSON.parse(s)); } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} };
  const UPS = {
    wslot:    {n:'WEAPON RACK',    d:'+1 weapon slot (base 3, max 6)',   max:3, cost:80, ic:'⚔️'},
    islot:    {n:'ORGAN SPACE',    d:'+1 item slot (base 3, max 6)',     max:3, cost:70, ic:'🫁'},
    flesh:    {n:'THICK FLESH',    d:'+10 max HP',                       max:5, cost:30, ic:'🫀'},
    origin:   {n:'PATIENT ORIGIN', d:'Start each run with +2 minions',   max:3, cost:60, ic:'🧟'},
    reroll:   {n:'MUTAGEN',        d:'+1 starting reroll (base 3)',       max:3, cost:50, ic:'🎲'},
    appetite: {n:'APPETITE',       d:'+6% XP from brains',               max:5, cost:40, ic:'🧠'},
    scent:    {n:'SCENT',          d:'+20% brain pickup range',          max:3, cost:35, ic:'👃'},
    lucky:    {n:'LUCKY STRAIN',   d:'+1 luck every run',                max:3, cost:55, ic:'🍀'},
    virulence:{n:'VIRULENCE',      d:'+3% chance the slain rise',        max:5, cost:45, ic:'🦠'},
  };
  const rank = k => data.up[k] || 0;
  const cost = k => UPS[k].cost * (rank(k) + 1);
  return {
    UPS, rank, cost,
    hasChar: id => data.chars.includes(id),
    // save codes: every pz-* setting, JSON, base64, prefixed so we can recognise and version them
    exportCode(){ const o = {}; for (const k of ['pz-meta-v1','pz-char','pz-muted','pz-settings']){ try { const v = localStorage.getItem(k); if (v !== null) o[k] = v; } catch (e) {} }
      if (!o['pz-meta-v1']) o['pz-meta-v1'] = JSON.stringify(data);
      return 'PZ1:' + btoa(unescape(encodeURIComponent(JSON.stringify(o)))); },
    importCode(code){ code = (code || '').trim();
      if (!code.startsWith('PZ1:')) throw new Error('That is not a Patient Zero save code.');
      let o; try { o = JSON.parse(decodeURIComponent(escape(atob(code.slice(4))))); } catch (e) { throw new Error('The save code is damaged or incomplete.'); }
      if (!o['pz-meta-v1']) throw new Error('The save code has no progress in it.');
      const d = JSON.parse(o['pz-meta-v1']); if (typeof d.dna !== 'number') throw new Error('The save code has no progress in it.');
      for (const k in o) if (k.startsWith('pz-')) localStorage.setItem(k, o[k]); },
    unlockChar(id){ if (data.chars.includes(id)) return false; data.chars.push(id); save(); return true; },
    get dna(){ return data.dna; }, get best(){ return data.best; },
    buy(k){ if (rank(k) >= UPS[k].max || data.dna < cost(k)) return false; data.dna -= cost(k); data.up[k] = rank(k) + 1; save(); return true; },
    // DNA for a run: kills, level reached and time survived; big bonus for a win
    runReward(kills, level, t, win){ return Math.floor(kills/8 + level*2 + t/20) + (win ? 100 : 0); },
    addDna(n){ data.dna += n; save(); },
    // ---- run history, feats, codex, heat ----
    get runs(){ return data.runs; },
    recordRun(r){ data.runs = [r, ...data.runs].slice(0, 25); data.life.runs++; data.life.kills += r.kills; data.life.time += r.t;
      if (r.win){ data.winsBy[r.cid] = (data.winsBy[r.cid] || 0) + 1; data.heat = Math.min(HEAT_MAX, Math.max(data.heat, r.heat + 1)); } save(); },
    patchLastRun(o){ const r = data.runs[0]; if (!r) return; data.life.kills += (o.kills ?? r.kills) - r.kills; data.life.time += (o.t ?? r.t) - r.t; Object.assign(r, o); save(); },
    get life(){ return data.life; }, get winsBy(){ return data.winsBy; },
    hasFeat: id => !!data.ach[id], featCount: () => Object.keys(data.ach).length,
    grantFeat(id, dna){ if (data.ach[id]) return false; data.ach[id] = Date.now(); data.dna += dna; save(); return true; },
    seen: (cat, k) => (data.seen[cat] || {})[k] || 0,
    mergeSeen(s){ for (const c in s){ const D = data.seen[c] = data.seen[c] || {}; for (const k in s[c]) D[k] = (D[k] || 0) + s[c][k]; } save(); },
    // wins from before Heat existed still unlock Heat 1
    get heatMax(){ return Math.max(data.heat, data.best.wins > 0 ? 1 : 0); },
    get heatSel(){ return Math.min(data.heatSel, this.heatMax); }, set heatSel(v){ data.heatSel = v; save(); },
    award(n, t, kills, win){ data.dna += n; data.best.t = Math.max(data.best.t, t); data.best.kills = Math.max(data.best.kills, kills); if (win) data.best.wins++; save(); },
  };
})();

// shop overlay
let shopReturn = 'title';
function openShop(from){
  shopReturn = from; SFX.init(); MUSIC.start(); MUSIC.setMode('title');
  for (const id of ['title','over']) $(id).classList.remove('show');
  $('shop').classList.add('show'); renderShop();
}
// the title shows the current DNA bank; refresh it whenever a menu hands back to the title
function refreshTitleDna(){ $('titleDna').textContent = META.dna ? `DNA BANK: ${META.dna}` : ''; }
function closeShop(){
  $('shop').classList.remove('show'); refreshTitleDna();
  $(shopReturn).classList.add('show');
  if (shopReturn === 'over') $('overDna').textContent = `DNA BANK: ${META.dna}`;
}
function renderShop(){
  $('shopDna').textContent = META.dna;
  const el = $('shopGrid'); el.innerHTML = '';
  for (const k in META.UPS){
    const U = META.UPS[k], r = META.rank(k), maxed = r >= U.max, c = META.cost(k), afford = META.dna >= c;
    const b = document.createElement('button'); b.className = 'card' + (maxed ? ' maxed' : afford ? '' : ' poor');
    b.innerHTML = `<img class="ic" src="${emojiIcon(U.ic).toDataURL()}" alt=""><div class="nm">${U.n}</div>
      <div class="pips">${'<i class="on"></i>'.repeat(r)}${'<i></i>'.repeat(U.max-r)}</div>
      <div class="ds">${U.d}</div><div class="lv">${maxed ? 'MAXED' : c + ' DNA'}</div>`;
    b.onclick = () => { if (META.buy(k)){ SFX.play('select'); renderShop(); } else SFX.play('click'); };
    el.appendChild(b);
  }
}

// save data overlay (export / import)
let saveReturn = 'title';
function openSave(from){
  saveReturn = from; for (const id of ['title','shop']) $(id).classList.remove('show');
  $('saveio').classList.add('show'); $('saveOut').value = META.exportCode(); $('saveIn').value = ''; $('saveMsg').textContent = '';
}
function closeSave(){ $('saveio').classList.remove('show'); $(saveReturn).classList.add('show'); if (saveReturn === 'shop') renderShop(); refreshTitleDna(); }
$('saveBtn').onclick = () => openSave('title');
$('saveBtn2').onclick = () => openSave('shop');
$('saveBack').onclick = closeSave;
$('saveCopy').onclick = async () => {
  const t = $('saveOut'); t.select();
  try { await navigator.clipboard.writeText(t.value); $('saveMsg').textContent = 'COPIED! KEEP IT SOMEWHERE SAFE.'; }
  catch (e) { try { document.execCommand('copy'); $('saveMsg').textContent = 'COPIED!'; } catch (e2) { $('saveMsg').textContent = 'SELECT THE CODE AND COPY IT MANUALLY.'; } }
};
$('saveLoad').onclick = () => {
  const code = $('saveIn').value;
  if (!code.trim()){ $('saveMsg').textContent = 'PASTE A SAVE CODE FIRST.'; return; }
  if (!confirm('Replace your current progress (DNA, upgrades, characters) with this save?')) return;
  try { META.importCode(code); $('saveMsg').textContent = 'LOADED! RESTARTING...'; setTimeout(() => location.reload(), 700); }
  catch (e) { $('saveMsg').textContent = e.message.toUpperCase(); }
};
