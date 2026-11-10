// Headless smoke test: loads the game in Chromium, clicks through every menu, then fast-forwards a full
// run with every character (player kept alive, level-ups auto-picked), including endless mode and Heat 5.
// Fails on any page error, console error or a run that stops early.
//
//   node tools/smoke-test.js            full test (~2 min)
//   node tools/smoke-test.js --quick    two characters, shorter runs
//
// Needs Playwright with Chromium (npm i --no-save playwright && npx playwright install chromium).
// Set CHROMIUM_PATH to use an existing Chromium binary instead.
const path = require('path');
const { chromium } = require('playwright');

const QUICK = process.argv.includes('--quick');
const URL = 'file://' + path.join(__dirname, '..', 'index.html');

async function main(){
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {});
  const page = await browser.newPage({viewport: {width: 960, height: 600}});
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_INTERNET|ERR_NAME|net::/.test(m.text())) errors.push('console: ' + m.text()); });
  page.on('dialog', d => d.accept());
  await page.goto(URL);
  await page.waitForTimeout(300);
  const fail = msg => { console.error('FAIL', msg); errors.push(msg); };

  // ---- menus: every overlay opens and closes ----
  const shown = id => page.evaluate(i => document.getElementById(i).classList.contains('show'), id);
  const click = id => page.click('#' + id);
  for (const [open, overlay, back] of [['startBtn','chars','charsBack'], ['labBtn','shop','shopBack'], ['saveBtn','saveio','saveBack'],
                                       ['optBtn','options','optBack'], ['archBtn','archive','archBack']]){
    await click(open); if (!await shown(overlay)) fail(`${open} did not open #${overlay}`);
    await click(back); if (!await shown('title')) fail(`${back} did not return to the title`);
  }
  // archive tabs and options controls render
  await click('archBtn');
  for (const t of ['runs','feats','codex']) await page.click(`#archive .tab[data-tab="${t}"]`);
  await click('archBack');
  await click('optBtn'); await click('optShake'); await click('optFlash'); await click('optNums');
  await page.evaluate(() => { const s = document.getElementById('optMusic'); s.value = 40; s.dispatchEvent(new Event('input')); });
  if ((await page.evaluate(() => SET.music)) !== 40) fail('music volume did not apply');
  await click('optBack');

  // ---- save code round trip ----
  const roundTrip = await page.evaluate(() => { const c = META.exportCode(); META.importCode(c); return c.startsWith('PZ1:'); });
  if (!roundTrip) fail('save code export/import');

  // ---- full runs: unlock everything so every character and Heat 5 can be tested ----
  await page.evaluate(() => { for (const id of CHAR_ORDER) META.unlockChar(id); });
  const chars = QUICK ? ['zero','general'] : await page.evaluate(() => CHAR_ORDER);
  const secs = QUICK ? 200 : 620;
  for (const cid of chars){
    const heat = cid === 'general' ? 5 : 0;
    const r = await page.evaluate(async ({cid, secs, heat}) => {
      // unlock Heat the real way: a win on each tier unlocks the next
      for (let h = META.heatMax; h < heat; h++) META.recordRun({at:Date.now(), cid, win:true, t:600, kills:0, level:1, dna:0, heat:h, build:[], wave:0});
      META.heatSel = heat;
      startGame(cid);
      if (S.heat !== Math.min(heat, META.heatMax)) return {err: 'heat not applied'};
      const step = n => { for (let i=0;i<n;i++){
        if (S.state === 'level'){ const c = document.querySelector('#cards .card'); if (c) c.click(); }
        if (S.state === 'pause') S.state = 'play';
        if (S.state === 'over') return;
        S.player.hp = S.player.maxHp;
        update(1/30); if (i % 15 === 0) render();
      } };
      const t0 = performance.now(); step(secs*30);
      const out = {t: Math.floor(S.t), level: S.level, kills: S.kills, state: S.state, won: !!S.won, ms: Math.round(performance.now()-t0)};
      if (S.state === 'over' && S.won){   // endless mode: keep going for two waves
        document.getElementById('endlessBtn').click();
        if (!S.endless) return {...out, err: 'endless did not start'};
        step(140*30); out.wave = S.endless.wave;
        gameOver(false); out.endState = S.state;
      }
      if (S.state === 'play'){ gameOver(false); out.endState = S.state; }   // end it so history and codex get written
      render(); return out;
    }, {cid, secs, heat});
    console.log(cid.padEnd(8), heat ? `heat ${heat}` : '      ', JSON.stringify(r));
    if (r.err) fail(`${cid}: ${r.err}`);
    else if (!r.won && r.t < secs - 1) fail(`${cid}: run stopped early at ${r.t}s`);
    else if (r.wave !== undefined && r.wave < 2) fail(`${cid}: endless reached only wave ${r.wave}`);
  }
  // ---- every map: the map select, unlocks, and a full run (all mid bosses and the finale) on each new map ----
  await page.evaluate(() => { localStorage.removeItem('pz-map'); });
  const locked = await page.evaluate(() => ['forest','docks','desert'].filter(m => !META.hasMap(m)).length);
  await page.evaluate(() => openMaps('zero'));
  if (!await shown('maps')) fail('map select did not open');
  if (await page.evaluate(() => document.querySelectorAll('#mapGrid .card').length) !== 4) fail('map select should list 4 maps');
  await page.click('#mapsBack'); if (!await shown('chars')) fail('mapsBack did not return to character select');
  await page.evaluate(() => { document.getElementById('chars').classList.remove('show'); document.getElementById('title').classList.add('show'); });
  console.log('maps locked before runs:', locked);
  // earn each unlock the real way: reach 5:00 in Downtown, then beat a boss on each map in turn
  if (!await page.evaluate(() => META.hasMap('forest'))) await page.evaluate(() => { openMaps('zero'); pickMap('city');
    for (let i=0;i<310*30;i++){ if (S.state === 'level'){ const c = document.querySelector('#cards .card'); if (c) c.click(); } if (S.state === 'pause') S.state = 'play';
      S.player.hp = S.player.maxHp; update(1/30); } gameOver(false); });
  for (const map of ['forest','docks','desert']){
    const r = await page.evaluate(async ({map, secs}) => {
      if (!META.hasMap(map)) return {err: 'map not unlocked by the previous map\'s task'};
      openMaps('zero'); pickMap(map);
      if (MAP_ID !== map || !S) return {err: 'pickMap did not start a run on ' + map};
      const bosses = new Set();
      for (let i=0;i<secs*30;i++){
        if (S.state === 'level'){ const c = document.querySelector('#cards .card'); if (c) c.click(); }
        if (S.state === 'pause') S.state = 'play';
        if (S.state === 'over') break;
        S.player.hp = S.player.maxHp;
        for (const h of S.humans) if (h.boss){ bosses.add(h.kind); if (S.t > 250 && !h.air && i % 300 === 0) h.hp = 1; }   // keep runs moving: mid bosses die fast
        update(1/30); if (i % 15 === 0) render();
      }
      const out = {t: Math.floor(S.t), kills: S.kills, bosses: [...bosses], state: S.state};
      if (S.state === 'play') gameOver(false);
      return out;
    }, {map, secs: 620});
    console.log(map.padEnd(8), JSON.stringify(r));
    if (r.err) fail(`${map}: ${r.err}`);
    else if (r.bosses.length < 3) fail(`${map}: expected 2 bosses and a finale, saw ${r.bosses.join(',')}`);
  }

  // the game-over screen, archive and codex render with real run data
  await page.evaluate(() => { document.getElementById('over').classList.remove('show'); document.getElementById('title').classList.add('show'); });
  await click('archBtn');
  for (const t of ['runs','feats','codex']) await page.click(`#archive .tab[data-tab="${t}"]`);
  const runs = await page.evaluate(() => META.runs.length);
  if (runs < Math.min(25, chars.length)) fail(`expected ${chars.length} runs in history, found ${runs}`);
  const codex = await page.evaluate(() => codexProgress());
  console.log('history', runs, 'runs; codex', codex.join('/'), '; feats', await page.evaluate(() => META.featCount()));

  await browser.close();
  if (errors.length){ console.error('\n' + errors.length + ' problem(s):\n' + [...new Set(errors)].slice(0, 20).join('\n')); process.exit(1); }
  console.log('\nSMOKE TEST PASSED');
}
main().catch(e => { console.error(e); process.exit(1); });
