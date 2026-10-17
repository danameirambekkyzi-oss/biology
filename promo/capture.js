const { chromium } = require('playwright');
const OUT = process.argv[2];
const BASE = 'http://localhost:8765/';
const now = Date.now(), day = 864e5;
const dk = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const activity = {}; [2,3,1,4,2,3,5].forEach((v,i)=>{const d=new Date(now-(6-i)*day); activity[dk(d)]=v;});
const hist = [];
[[31,40],[34,40],[38,40],[36,40],[41,50],[44,50]].forEach(([s,m],i)=>hist.push({date:now-(6-i)*day,mode:i%2?'mock':'chapter',title:i%2?'ҰБТ сынамасы':'Генетика',score:s,max:m,scaled:Math.round(s/m*50),pct:Math.round(s/m*100),wrong:[]}));
const user = { id:'77011234567', name:'Айгерім Нұрланқызы', phone:'+7 (701) 123-45-67', email:'', pass:'x', target:45, city:'Алматы', school:'', month:'Мамыр–Маусым',
  xp:1240, premiumUntil: now+200*day, mocks:3, history:hist, solved:{}, mistakes:{}, fixed:4, activity, modulesTried:{genetics:1,botany:1,anatomy:1},
  badges:['first','streak3'], notifications:[], created: now-30*day, role:'student' };
const pages = ['', 'app/dashboard','app/chapters','app/chapter/genetics','app/mock','app/mistakes','app/real','app/plants','app/leaderboard'];
(async () => {
  const b = await chromium.launch();
  for (const [tag, vp, dpr, mobile] of [['m',{width:400,height:711},2.7,true],['d',{width:1440,height:900},1.5,false]]) {
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile, locale:'kk-KZ' });
    await ctx.route(/js\/config\.js/, async r => { const res = await r.fetch(); let t = await res.text(); t += '\n;window.CONFIG.firebase.enabled=false;'; r.fulfill({ response: res, body: t }); });
    await ctx.addInitScript(u => { if (location.hash !== '#/' && location.hash !== '') { localStorage.setItem('bioubt_db_v1', JSON.stringify({users:{[u.id]:u}})); localStorage.setItem('bioubt_session', u.id);} }, user);
    const p = await ctx.newPage();
    for (const pg of pages) {
      const name = (pg||'home').replace(/\//g,'_');
      if (pg) { await p.goto(BASE+'#/login'); await p.evaluate(u=>{localStorage.setItem('bioubt_db_v1', JSON.stringify({users:{[u.id]:u}})); localStorage.setItem('bioubt_session', u.id);}, user); }
      else { await p.goto(BASE); await p.evaluate(()=>{localStorage.removeItem('bioubt_session')}); }
      await p.goto(BASE+'#/'+pg); await p.reload(); await p.waitForTimeout(1500);
      await p.screenshot({ path: `${OUT}/${tag}_${name}.png` });
      await p.screenshot({ path: `${OUT}/${tag}_${name}_full.png`, fullPage: true });
    }
    await ctx.close();
  }
  await b.close();
})();
