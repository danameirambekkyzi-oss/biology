// Нұсқаның қысқаша тізімі: нөмір, түр, нұсқа саны, дұрыс әріптер, сұрақ басы.  node brief.js js/tests/prob.js prob-8
global.window = {}; require(require('path').resolve(process.argv[2]));
const L = 'ABCDEFGH';
for (const F of window.TEST_FOLDERS) for (const t of F.tests) { if (process.argv[3] && t.id !== process.argv[3]) continue;
  t.questions.forEach((q, i) => { const its = (q.items || []).map(it => it.text.slice(0, 25) + '→' + L[it.answer]).join('; ');
    console.log(`${i + 1} ${q.type.slice(0, 2)} ${q.options.length}o ${(q.correct || []).map(j => L[j]).join('')} | ${q.q.replace(/<[^>]+>/g, '').slice(0, 55)}${its ? ' | ' + its : ''}${q.context != null ? ' |CTX' : ''}${q.img ? ' |IMG' : ''}`); }); }
