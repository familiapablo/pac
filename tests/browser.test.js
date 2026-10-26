/* Browser test: NODE_PATH=$(npm root -g) node tests/browser.test.js [shots-dir]   (PAGE=standalone.html for the single file)
   Plays every mode in Chromium; jsDelivr requests are blocked (fonts fall back) or served locally. */
'use strict';
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const OUT = process.argv[2] || path.join(ROOT, 'tests', 'shots');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  async function open(opts, label) {
    const page = await browser.newPage(opts);
    page.on('pageerror', e => errors.push(label + ' pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_/.test(m.text())) errors.push(label + ' console: ' + m.text()); });
    await page.route(/^https:\/\//, r => {
      const own = r.request().url().split(/\/gh\/[^/]+\/[^/@]+@[^/]+\//)[1];
      if (own) return r.fulfill({ path: path.join(ROOT, own.split('?')[0]), contentType: own.endsWith('.css') ? 'text/css' : 'application/javascript' });
      return r.abort();
    });
    await page.goto('file://' + path.join(ROOT, process.env.PAGE || 'index.html'));
    await page.waitForTimeout(800);
    return page;
  }
  const shot = (p, n) => p.screenshot({ path: path.join(OUT, n + '.png') });
  const noScroll = async (p, label) => {
    const r = await p.evaluate(() => [document.documentElement.scrollHeight, innerHeight, document.documentElement.scrollWidth, innerWidth,
      document.querySelector('.menu-main').scrollHeight, document.querySelector('.menu-main').clientHeight]);
    if (r[0] > r[1] || r[2] > r[3]) errors.push(label + ': page scrolls ' + r);
    if (!(await p.isHidden('#menu')) && r[4] > r[5] + 2) errors.push(label + ': menu does not fit ' + r[4] + '>' + r[5]);
  };

  const page = await open({ viewport: { width: 1280, height: 800 } }, 'desktop');
  await page.waitForTimeout(2000);
  await shot(page, '01-menu');
  await noScroll(page, 'desktop menu');

  // Classic: move, eat, energizer, eat a ghost
  await page.click('.mode[data-mode="classic"]');
  await page.click('#play');
  await page.waitForTimeout(4600);
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(1200);
  const s1 = await page.evaluate(() => PM.App.game.player.score);
  if (s1 <= 0) errors.push('classic: no points after moving');
  await page.evaluate(() => { const g = PM.App.game; g.energize(g.player); const gh = g.ghosts[0]; g.player.x = gh.x; g.player.y = gh.y; });
  await page.waitForTimeout(300);
  await shot(page, '02-classic');
  const eaten = await page.evaluate(() => PM.App.game.player.stats.ghosts);
  if (eaten < 1) errors.push('classic: ghost not eaten');
  // pause / resume
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(200);
  if (await page.isHidden('#pause')) errors.push('pause overlay missing');
  await shot(page, '03-pause');
  await page.click('#resume');
  // lose all lives -> results
  await page.evaluate(() => { const g = PM.App.game; g.lives = 0; g.killPac(g.player); });
  await page.waitForTimeout(4800);
  if (await page.isHidden('#modal')) errors.push('classic: results missing');
  await shot(page, '04-results');
  await page.click('#r-menu');
  await page.waitForTimeout(300);

  // 2027: power-ups, blackout event, level clear
  await page.click('.mode[data-mode="x27"]');
  await page.click('#play');
  await page.waitForTimeout(2600);
  await page.evaluate(() => {
    const g = PM.App.game, p = g.player;
    for (const t of ['turbo', 'magnet', 'shield', 'double']) g.applyPower(p, t);
    g.applyPower(p, 'shock');
  });
  await page.waitForTimeout(600);
  await shot(page, '05-x27-powers');
  await page.waitForTimeout(1400); // the first level opens with a 4.2 s READY! jingle
  await page.evaluate(() => { const g = PM.App.game; for (let i = 0; i < g.dots.length; i++) g.dots[i] = 0; g.dotsLeft = 0; });
  await page.waitForTimeout(3200);
  const lvl = await page.evaluate(() => PM.App.game.level);
  if (lvl !== 2) errors.push('x27: level did not advance (' + lvl + ')');
  await page.evaluate(() => { const g = PM.App.game; g.event = 'blackout'; });
  await page.waitForTimeout(2500);
  await shot(page, '06-x27-blackout');
  await page.evaluate(() => PM.App.toMenu());

  // Battle vs 3 hard bots
  await page.click('.mode[data-mode="battle"]');
  await page.click('#opts button[data-k="botSkill"][data-v="hard"]');
  await page.click('#play');
  await page.waitForTimeout(9000);
  await shot(page, '07-battle');
  const bs = await page.evaluate(() => PM.App.game.pacs.map(p => p.score));
  if (bs.slice(1).every(s => s === 0)) errors.push('battle: bots did not score ' + bs);
  await page.evaluate(() => { PM.App.game.battleT = 0.05; });
  await page.waitForTimeout(2000);
  await shot(page, '08-battle-results');
  if (await page.isHidden('#modal')) errors.push('battle: results missing');
  await page.click('#r-menu');

  // Daily + share + missions + garage + scores + help + settings
  await page.click('.mode[data-mode="daily"]');
  await page.click('#play');
  await page.waitForTimeout(2600);
  await page.evaluate(() => { const g = PM.App.game; g.player.score = 4321; g.lives = 0; g.killPac(g.player); });
  await page.waitForTimeout(4800);
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  await page.click('#r-share');
  await page.click('#r-menu');
  await page.waitForTimeout(200);
  const badge = await page.textContent('.mode[data-mode="daily"] .badge');
  if (!badge.includes('4,321')) errors.push('daily not recorded: ' + badge);
  await page.evaluate(() => { PM.App.p.coins = 2000; PM.App.save(); PM.App.renderProfile(); });
  await page.click('[data-open="garage"]');
  await page.waitForTimeout(200);
  await page.click('#g-items .item[data-id="cyan"]');
  await page.click('#g-tabs button[data-t="hat"]');
  await page.click('#g-items .item[data-id="party"]');
  await page.click('#g-tabs button[data-t="trail"]');
  await page.click('#g-items .item[data-id="rainbow"]');
  await page.waitForTimeout(250);
  await shot(page, '09-garage');
  const eq = await page.evaluate(() => PM.App.p.equip);
  if (eq.color !== 'cyan' || eq.hat !== 'party' || eq.trail !== 'rainbow') errors.push('garage: equip failed ' + JSON.stringify(eq));
  await page.click('#modal .close');
  for (const m of ['missions', 'scores', 'help', 'settings']) {
    await page.click(`.topbar [data-open="${m}"]`);
    await page.waitForTimeout(150);
    await shot(page, '10-' + m);
    await page.click('#modal .close');
  }
  await page.click('.topbar #profile');
  await page.waitForTimeout(150);
  await shot(page, '11-profile');
  await page.click('#modal .close');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pm2027.v1')).stats.games);
  if (saved < 3) errors.push('profile not saved: ' + saved);

  // short desktop window: menu must still fit without scrolling
  await page.setViewportSize({ width: 1366, height: 600 });
  await page.waitForTimeout(300);
  await shot(page, '12-menu-short');
  await noScroll(page, 'short desktop');

  // phones
  const mob = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, 'portrait');
  await mob.waitForTimeout(1200);
  await shot(mob, '13-mobile-menu');
  await noScroll(mob, 'portrait menu');
  await mob.tap('#play');
  await mob.waitForTimeout(3500);
  await shot(mob, '14-mobile-game');
  await noScroll(mob, 'portrait game');
  const land = await open({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }, 'landscape');
  await land.waitForTimeout(1200);
  await shot(land, '15-landscape-menu');
  await noScroll(land, 'landscape menu');
  await land.tap('#play');
  await land.waitForTimeout(3000);
  await shot(land, '16-landscape-game');

  await browser.close();
  if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(1); }
  console.log('Browser test passed (' + OUT + ')');
})().catch(e => { console.error(e); process.exit(1); });
