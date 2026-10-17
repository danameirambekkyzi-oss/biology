// Renders walk.html frame-by-frame (deterministic) → H.264. Needs: python3 -m http.server 8765 (repo root).
// usage: node walk_render.js video out.mp4 [fps]   |   node walk_render.js preview dir fps t1,t2,...
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const [,, mode, out, fpsArg = 30, dumpArg = '', seedArg = '11'] = process.argv;
const fps = +fpsArg, DUR = +(process.env.DUR || 40), SEED = +seedArg, PAGE = process.env.PAGE || 'walk.html';
const now = Date.now(), day = 864e5;
const dk = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const activity = {}; [2, 3, 1, 4, 2, 3, 5].forEach((v, i) => { activity[dk(new Date(now - (6 - i) * day))] = v; });
const hist = [[31, 40], [34, 40], [38, 40], [36, 40], [41, 50], [44, 50]].map(([s, m], i) => ({ date: now - (6 - i) * day, mode: i % 2 ? 'mock' : 'chapter', title: i % 2 ? 'ҰБТ сынамасы' : 'Генетика', score: s, max: m, scaled: Math.round(s / m * 50), pct: Math.round(s / m * 100), wrong: [] }));
const user = { id: '77011234567', name: 'Айгерім Нұрланқызы', phone: '+7 (701) 123-45-67', email: '', pass: 'x', target: 45, city: 'Алматы', school: '', month: 'Мамыр–Маусым',
  xp: 1240, premiumUntil: now + 200 * day, mocks: 3, history: hist, solved: {}, mistakes: {}, fixed: 4, activity, modulesTried: { genetics: 1, botany: 1, anatomy: 1 },
  badges: ['first', 'streak3'], notifications: [], created: now - 30 * day, role: 'student' };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await ctx.route(/js\/config\.js/, async r => { const res = await r.fetch(); r.fulfill({ response: res, body: (await res.text()) + '\n;window.CONFIG.firebase.enabled=false;' }); });
  await ctx.addInitScript(([u, seed, PQ]) => {
    let s = seed >>> 0; Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    if (location.host === 'localhost:8765') { localStorage.setItem('bioubt_db_v1', JSON.stringify({ users: { [u.id]: u } })); localStorage.setItem('bioubt_session', u.id); }
    if (location.host === '127.0.0.1:8765') { localStorage.removeItem('bioubt_session'); }
    window.PQ_RIGHT = PQ; window.__sync = t => { for (const a of document.getAnimations()) { if (a.__t0 == null) a.__t0 = t; a.pause(); a.currentTime = Math.max(0, (t - a.__t0) * 1000); } };
  }, [user, SEED, +(process.env.PQ || 0)]);
  const p = await ctx.newPage();
  await p.goto('http://localhost:8765/promo/' + PAGE);
  await p.evaluate(() => window.ready);
  const land = () => p.frames().find(f => f.url().startsWith('http://127.0.0.1'));
  const frameAt = async t => {
    const acted = await p.evaluate(t => step(t), t);
    if (acted) { await p.waitForTimeout(350); await p.evaluate(t => step(t), t); }
    const lf = land(); if (lf) await lf.evaluate(t => window.__sync && window.__sync(t), t).catch(() => {});
  };
  const N = Math.round(DUR * fps);
  if (mode === 'preview') {
    fs.mkdirSync(out, { recursive: true });
    const dumps = dumpArg.split(',').filter(Boolean).map(Number);
    for (let i = 0; i < N; i++) { const t = i / fps; await frameAt(t);
      if (dumps.some(d => Math.abs(d - t) < .5 / fps)) await p.screenshot({ path: `${out}/p_${t.toFixed(1).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 80 }); }
  } else {
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let i = 0; i < N; i++) { await frameAt(i / fps); const buf = await p.screenshot({ type: 'jpeg', quality: 95 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r)); if (i % 150 === 0) console.error('frame', i, '/', N); }
    ff.stdin.end(); await new Promise(r => ff.on('close', r));
  }
  await b.close();
})();
