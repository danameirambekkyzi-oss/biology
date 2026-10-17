const { chromium } = require('playwright');
const OUT = process.argv[2], BASE='http://localhost:8765/';
const now=Date.now();
const user={id:'77011234567',name:'Айгерім Нұрланқызы',phone:'+7 (701) 123-45-67',email:'',pass:'x',target:45,city:'Алматы',school:'',month:'Мамыр–Маусым',xp:1240,premiumUntil:now+2e10,mocks:3,history:[],solved:{},mistakes:{},fixed:0,activity:{},modulesTried:{},badges:[],notifications:[],created:now,role:'student'};
(async()=>{
 const b=await chromium.launch();
 for (const [tag,vp,dpr,mobile] of [['m',{width:400,height:711},2.7,true],['d',{width:1440,height:900},1.5,false]]) {
  const ctx=await b.newContext({viewport:vp,deviceScaleFactor:dpr,isMobile:mobile,hasTouch:mobile});
  await ctx.route(/js\/config\.js/, async r=>{const res=await r.fetch();r.fulfill({response:res,body:(await res.text())+'\n;window.CONFIG.firebase.enabled=false;'});});
  const p=await ctx.newPage();
  await p.goto(BASE+'#/login'); await p.evaluate(u=>{localStorage.setItem('bioubt_db_v1',JSON.stringify({users:{[u.id]:u}}));localStorage.setItem('bioubt_session',u.id);},user);
  await p.reload(); await p.waitForTimeout(800); await p.evaluate(()=>location.hash='#/app/mock'); await p.waitForTimeout(800);
  const cards = await p.$$('[data-act]'); const acts = await Promise.all(cards.map(c=>c.getAttribute('data-act'))); console.log([...new Set(acts)].join(' '));
  await p.locator('.card, a, button').filter({hasText:'2026 жылғы'}).first().click(); await p.waitForTimeout(800);
  await p.screenshot({path:`${OUT}/${tag}_mock_folder.png`});
  await p.locator('[data-act="start-test"]').first().click(); await p.waitForTimeout(1000);
  await p.screenshot({path:`${OUT}/${tag}_test_q1.png`});
  // select an option
  const opt = p.locator('.opt, .option, [data-act="pick"], [data-act="opt"]').first();
  if (await opt.count()) { await opt.click(); await p.waitForTimeout(500); }
  await p.screenshot({path:`${OUT}/${tag}_test_q1_sel.png`});
  console.log(tag, p.url(), await p.$$eval('[data-act]', e=>[...new Set(e.map(x=>x.dataset.act))].join(' ')));
  await ctx.close();
 }
 await b.close();
})();
