// ҰБТ сынамасы папкасындағы нұсқаларды барлық сұраққа ДҰРЫС жауап беріп тапсырады, балды шығарады.
// Қолданылуы (сайт localhost:8765-те ашық тұруы керек):  node e2e_folder.js <folderId> <from> <to>
//   мысалы: node e2e_folder.js prob 8 8      →  "8 50/50"  (толық балл болуы керек)
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const fs = require('fs'), path = require('path');
const [FID, A, B] = [process.argv[2], +process.argv[3] || 1, +process.argv[4] || +process.argv[3] || 1];
const REPO = path.resolve(__dirname, '../../../..');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = [], bad = [];
  p.setDefaultTimeout(10000); p.on('pageerror', e => errs.push(e.message)); p.on('response', r => { if (r.status() >= 400) bad.push(r.url()); });
  // МІНДЕТТІ: Firebase-ті өшіреміз, әйтпесе тест аккаунттары нағыз серверде жасалады
  await p.route('**/js/config.js*', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(REPO + '/js/config.js', 'utf8') + '\nwindow.CONFIG.firebase.enabled=false;' }));
  await p.goto('http://localhost:8765/#/register');
  await p.fill('#r-name', 'Тест'); await p.type('#r-phone', '7011234567'); await p.fill('#r-pass', 'Biology2027!');
  await p.click('#r-next'); await p.click('#r-next'); await p.check('#r-agree'); await p.click('#r-done'); await p.waitForSelector('.ring-card');
  await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('bioubt_db_v1')); Object.values(d.users).forEach(u => { u.premiumUntil = Date.now() + 864e5 * 30; u.role = 'teacher'; }); localStorage.setItem('bioubt_db_v1', JSON.stringify(d)); });
  const strip = s => s.replace(/<[^>]+>/g, '').trim();
  for (let n = A; n <= B; n++) {
    await p.goto(`http://localhost:8765/#/app/mock/${FID}`); await p.reload(); await p.waitForSelector(`[data-act=start-test][data-id="${FID}-${n}"]`);
    await p.click(`[data-act=start-test][data-id="${FID}-${n}"]`); await p.waitForSelector('.q-card');
    const T = await p.evaluate(([f, n]) => window.TEST_FOLDERS.find(x => x.id === f).tests[n - 1].questions, [FID, n]);
    for (let i = 0; i < T.length; i++) {
      if (i) await p.click(`.q-grid button >> nth=${i}`);
      const info = await p.evaluate(() => ({ q: document.querySelector('.q-text').innerText.trim(), opts: [...document.querySelectorAll('.opt span:last-child, .match-opts .mo span:last-child')].map(x => x.innerText.trim()), items: [...document.querySelectorAll('.mi-text')].map(x => x.innerText.replace(/^\d+\.\s*/, '').trim()) }));
      const q = T.find(q => q.options.map(strip).sort().join('|') === [...info.opts].sort().join('|') && (q.items || []).map(x => strip(x.text)).join('|') === info.items.join('|'));
      if (!q) { console.log('NOT FOUND', n, i + 1, info.q.slice(0, 50)); continue; }
      const idx = o => info.opts.indexOf(strip(q.options[o]));
      if (q.type === 'match') { for (let k = 0; k < q.items.length; k++) for (const a of (q.items[k].answers || [q.items[k].answer])) await p.click(`[data-act=pick-match][data-k="${k}"][data-i="${idx(a)}"]`); }
      else for (const c of q.correct) await p.click(`.opt[data-i="${idx(c)}"]`);
    }
    await p.click('.test-top [data-act=finish]'); const ok = await p.$('#m-ok'); if (ok) await ok.click(); await p.waitForSelector('.result-hero');
    console.log(n, (await p.textContent('.result-hero .big')).trim());
  }
  console.log('errors', errs, 'bad', bad); await b.close();
})();
