const { chromium } = require('playwright');
const { spawn } = require('child_process');
const [,, mode, out, fps = 30, dur = 19.5] = process.argv;
(async () => {
  const b = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.goto('file://' + __dirname + '/comp.html'); await p.evaluate(() => window.ready); await p.waitForTimeout(300);
  if (mode === 'preview') {
    const ts = process.argv.slice(6).length ? process.argv.slice(6).map(Number) : [];
    for (const t of out.split(',').map(Number)) { await p.evaluate(t => render(t), t); await p.screenshot({ path: `prev/f_${t.toFixed(2)}.jpg`, type: 'jpeg', quality: 85 }); }
  } else {
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const N = Math.round(dur * fps);
    for (let i = 0; i < N; i++) { await p.evaluate(t => render(t), i / fps); const buf = await p.screenshot({ type: 'jpeg', quality: 95 }); if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r)); if (i % 60 === 0) console.error('frame', i, '/', N); }
    ff.stdin.end(); await new Promise(r => ff.on('close', r));
  }
  await b.close();
})();
