"use strict";

// ---------- level up ----------
function openLevel(reroll){
  const owned = Object.keys(S.mods), ownW = owned.filter(isWeapon), ownI = owned.filter(k => !isWeapon(k));
  const fullW = ownW.length >= slotsW(), fullI = ownI.length >= slotsI();
  // offer upgrades to anything owned, and new weapons / items only while that kind still has a free slot
  const pool = Object.keys(MUTS).filter(k => L(k) < maxLv(k) && (L(k) > 0 || (isWeapon(k) ? !fullW : !fullI))), opts = [];
  const evos = Object.keys(EVOS).filter(k => L(k) >= maxLv(k) && L(EVOS[k].w) > 0 && !E(k));
  // fully mutated: nothing left to choose, so don't interrupt - level-ups just heal and pay a little DNA
  if (!pool.length && !evos.length){
    const n = S.pendingLv, p = S.player; S.pendingLv = 0; heal(20*n, 'feast'); S.bonusDna += 2*n;
    // still announce it: chime, golden ring burst, sparkles and a pop-up
    SFX.play('lvlmax');
    floatText(p.x, p.y, `LEVEL ${S.level}! +${20*n} HP`, '#ffe070', true);
    S.parts.push({k:'shock', x:p.x, y:p.y, r:6, max:70, t:.45, max2:.45, col:'#ffe070'});
    S.parts.push({k:'shock', x:p.x, y:p.y, r:2, max:40, t:.35, max2:.35, col:'#fff4c0'});
    for (let i=0;i<14;i++) S.parts.push({k:'spark', x:p.x, y:p.y, vx:rand(-160,160), vy:rand(-200,20), t:rand(.3,.6), max:.6, col: Math.random()<.5 ? '#ffe070' : '#ff9ccc'});
    S.lights.push({x:p.x, y:p.y, r:90, spr:BAND.yellow, t:.35, max:.35, a:1});
    if (S.state === 'level') setState('play');
    return;
  }
  if (S.state !== 'level' && !reroll) SFX.play('levelup');
  setState('level');
  // a ready evolution always takes the first card
  if (evos.length) opts.push('evo:' + pick(evos));
  $('slots').textContent = `WEAPONS ${ownW.length}/${slotsW()}${fullW ? ' FULL' : ''}  -  ITEMS ${ownI.length}/${slotsI()}${fullI ? ' FULL' : ''}`;
  let nCards = 3; const lk = luck();
  if (Math.random() < lk*0.15) nCards++;
  if (lk >= 7 && Math.random() < (lk-6)*0.15) nCards++;
  if (nCards > 3 && pool.length + opts.length > 3) $('slots').textContent += '  -  LUCKY! +' + (nCards-3) + ' CHOICE' + (nCards > 4 ? 'S' : '');
  while (opts.length < nCards && pool.length) opts.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
  if (!opts.length) opts.push('_heal');
  const el = $('cards'); el.innerHTML = '';
  opts.forEach((k,i) => {
    const c = document.createElement('button'); c.className = 'card';
    if (k==='_heal') c.innerHTML = `<div class="k">${i+1}</div><div class="nm">FEAST</div><div class="lv">FULLY EVOLVED</div><div class="ds">Heal 50 HP.</div>`;
    else if (k.startsWith('evo:')){ const b = k.slice(4), V = EVOS[b]; c.className = 'card evo';
      c.innerHTML = `<div class="k">${i+1}</div><img class="ic" src="${emojiIcon(V.ic,'#7a5208').toDataURL()}" alt=""><div class="nm">${V.n}</div>
        <div class="lv">EVOLUTION: ${MUTS[b].n.toUpperCase()} + ${MUTS[V.w].n.toUpperCase()}</div><div class="ds">${V.d}</div>`; }
    else { const M = MUTS[k], l = L(k), src = mutIcon(k).toDataURL(), ev = evoHint(k);
      c.className = 'card ' + (isWeapon(k) ? 'weapon' : 'item');
      c.innerHTML = `<div class="k">${i+1}</div><img class="ic" src="${src}" alt=""><div class="tag">${isWeapon(k) ? 'WEAPON' : 'ITEM'}</div><div class="nm">${M.n}</div>
        <div class="lv ${l?'':'new'}">${l ? 'LV '+l+' &gt; '+(l+1)+' / '+maxLv(k) : 'NEW!'}</div><div class="ds">${l?M.u:M.b}</div>${ev}`; }
    c.onclick = () => choose(k);
    el.appendChild(c);
  });
  const rb = $('reroll'); rb.style.display = S.rerolls > 0 ? '' : 'none'; rb.textContent = `REROLL (${S.rerolls})`;
}
// evolution hint, shown only when this card pairs with a mutation you already own:
// "WITH [icon] PARTNER" then "> [icon] EVOLUTION NAME"
function evoHint(k){
  let base = null, partner = null;
  if (EVOS[k] && !E(k) && L(EVOS[k].w) > 0){ base = k; partner = EVOS[k].w; }
  else for (const b in EVOS) if (EVOS[b].w === k && L(b) > 0 && !E(b)){ base = b; partner = b; break; }
  if (!base) return '';
  const img = c => `<img src="${c.toDataURL()}" alt="">`, V = EVOS[base];
  const need = base === k ? 'MAX THIS' : `MAX ${MUTS[base].n.toUpperCase()}`;
  return `<div class="hint"><div class="ln">WITH ${img(emojiIcon(MUTS[partner].ic))} ${MUTS[partner].n.toUpperCase()}</div>
    <div class="ln evo-to">&gt; ${img(emojiIcon(V.ic, '#7a5208'))} ${V.n.toUpperCase()}</div><div class="ln need">${need} TO EVOLVE</div></div>`;
}
function choose(k){
  if (S.state!=='level') return;
  SFX.play('select');
  const p = S.player;
  if (k==='_heal') heal(50, 'feast');
  else if (k.startsWith('evo:')){ const b = k.slice(4); S.evo[b] = true; seen('v', b); S.gotAt['evo:'+b] = S.t; SFX.play('evolve'); banner('EVOLVED!', EVOS[b].n.toUpperCase()); S.flashT = 0.3; }
  else { if (!S.mods[k]){ S.gotAt[k] = S.t; seen('m', k); } S.mods[k] = L(k) + 1; if (k==='hide'){ p.maxHp += 25; heal(25, 'hide'); } }
  S.pendingLv--;
  if (S.pendingLv > 0) openLevel(); else setState('play');
}
function rerollLevel(){ if (S.state==='level' && S.rerolls > 0){ S.rerolls--; SFX.play('click'); openLevel(true); } }
