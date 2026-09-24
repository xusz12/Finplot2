// Synthetic fixtures only. Run against app/server.py with Playwright via NODE_PATH.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const rows=Array.from({length:10},(_,i)=>({id:i,category_id:i,category:i===7?'测试一个很长的分类名称是否保持布局':'分类'+(i+1),nature:'日常',direction:'支出',amount_cents:(10-i)*10000,occurred_at:'2026-09-20 12:00:00',note:'测试交易',category_group:'测试'}));
rows.push({...rows[0],id:20,category_id:20,category:'工资',direction:'收入',amount_cents:300000}, {...rows[0],id:21,occurred_at:'2026-01-10 12:00:00',amount_cents:12345});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/ledger',r=>r.fulfill({json:rows}));await page.goto('http://127.0.0.1:8765');await page.locator('#overview-composition').waitFor();
  for(const width of [1440,1000,850,390,320,1440]){
   await page.setViewportSize({width,height:1000});await page.waitForTimeout(100);
   const panel=page.locator('#overview-composition'),trend=page.locator('.f-overview-trend');
   const a=await panel.boundingBox(),b=await trend.boundingBox();
   assert.equal(a.height,620);assert.equal(b.height,620);
   if(width>850)assert.equal(a.y,b.y);
   assert.equal(await panel.locator('[data-category]').count(),8);
   assert.equal(await panel.locator('.f-legend').count(),0);
   assert.equal(await trend.locator('.f-legend').count(),1);
   const metrics=await page.locator('.f-overview-charts .f-chart-wrap').evaluateAll(es=>es.map(el=>{
    const svg=el.querySelector('svg'),text=svg.querySelector('text');return {width:el.clientWidth,height:el.clientHeight,view:svg.viewBox.baseVal.height,svgHeight:svg.getBoundingClientRect().height,font:text?parseFloat(getComputedStyle(text).fontSize)*el.clientWidth/600:null};
   }));
   assert(metrics[0].height/metrics[1].height>3.4);
   for(const m of metrics){assert(Math.abs(m.svgHeight-m.height)<1);assert(Math.abs(m.view-600*m.height/m.width)<2);if(m.font)assert(Math.abs(m.font-12)<0.1);}
   assert(await panel.evaluate(el=>el.scrollHeight<=el.clientHeight));
   const last=panel.locator('[data-category]').last();assert((await last.boundingBox()).y+(await last.boundingBox()).height<a.y+a.height);
   await last.click();await page.waitForTimeout(400);assert.equal((await panel.boundingBox()).height,620);
   await panel.locator('[data-category]').click();await page.waitForTimeout(400);
   if([1440,390].includes(width))await page.locator('.f-overview-grid').screenshot({path:`/tmp/finplot-overview-layout-${width}.png`});
   await panel.locator('[data-direction="收入"]').click();assert.equal(await panel.locator('[data-category]').count(),1);assert.equal((await panel.boundingBox()).height,620);
   await panel.locator('[data-direction="支出"]').click();
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: top 8 categories, fixed 620px panels, equal desktop bounds, 3.5:1 charts, resize-aware geometry and readable text, 8th-category return, 1440/1000/850/390/320px.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
