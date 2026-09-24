// Run against app/server.py with Playwright available via NODE_PATH. Synthetic data only.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const rows=Array.from({length:11},(_,i)=>({id:i+1,category_id:1,category:'住房',nature:'日常',direction:'支出',amount_cents:10001+i,occurred_at:`2026-09-${String(23-i).padStart(2,'0')} 12:00:00`,note:`房租明细 ${i+1} ${'长备注测试'.repeat(20)}`,category_group:'生活'}));
rows.push({ ...rows[0], id:12,category_id:2,category:'交通',amount_cents:200001,note:'交通费用'}, {...rows[0],id:13,category_id:3,category:'工资',direction:'收入',amount_cents:500000,note:'工资收入'}, {...rows[0],id:14,occurred_at:'2026-08-01 12:00:00',amount_cents:90000});
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  for(const width of [1440,390,320]){
   const page=await browser.newPage({viewport:{width,height:1000}}), errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/api/ledger',r=>r.fulfill({json:rows}));
   await page.goto('http://127.0.0.1:8765');
   const panel=page.locator('#overview-composition');await panel.waitFor();
   const bar=panel.locator('[data-category="1"]');await bar.scrollIntoViewIfNeeded();
   const height=(await panel.boundingBox()).height, scroll=await page.evaluate(()=>scrollY);
   await bar.focus();await page.keyboard.press('Enter');
   await page.waitForTimeout(500);
   assert.equal(await panel.locator('.f-composition-transactions li').count(),7);
   const lastRow=await panel.locator('.f-composition-transactions li').last().boundingBox(),footer=await panel.locator('.f-composition-footer').boundingBox();
   assert(lastRow.y+lastRow.height<=footer.y,'all seven transactions fit above pagination');
   assert.equal(await panel.locator('h2').innerText(),'分类明细');
   assert.equal(await page.locator('.f-bottom h2').first().innerText(),'最近收支');
   assert.equal((await panel.boundingBox()).height,height);
   assert.equal(await page.evaluate(()=>scrollY),scroll);
   assert.equal(await panel.locator('[data-composition-page="-1"]').isDisabled(),true);
   const notes=[];
   for(let i=0;i<2;i++){
    notes.push(...await panel.locator('.f-composition-note').allTextContents());
    if(i<1)await panel.locator('[data-composition-page="1"]').click();
   }
   assert.deepEqual(notes,rows.slice(0,11).map(r=>r.note));
   assert.equal(await panel.locator('[data-composition-page="1"]').isDisabled(),true);
   assert.equal(await panel.locator('.f-composition-transactions li').count(),4);
   await page.waitForTimeout(500);
   await panel.screenshot({path:`/tmp/finplot-composition-${width}.png`});
   await bar.click();await page.waitForTimeout(500);
   assert.equal(await panel.locator('[data-category]').count(),2);
   assert.equal(await panel.locator('[data-category="1"]').evaluate(el=>el===document.activeElement),true);
   await bar.click();assert.match(await panel.locator('[role="status"]').innerText(),/1 \/ 2/);
   await panel.locator('[data-direction="收入"]').click();
   await panel.locator('[data-category="3"]').click();
   assert.equal(await panel.locator('.f-composition-transactions li').count(),1);
   assert.equal(await panel.locator('[data-composition-page]').count(),0);
   assert.match(await panel.locator('.f-composition-row b').innerText(),/^\+/);
   await page.locator('[data-period="year"]').click();
   assert.equal(await panel.locator('h2').innerText(),'收入构成');
   await panel.locator('[data-direction="支出"]').click();await bar.click();
   assert.match(await panel.locator('[role="status"]').innerText(),/^12 笔/);
   await page.emulateMedia({reducedMotion:'reduce'});await bar.click();await bar.click();
   assert.equal(await panel.evaluate(el=>el.getAnimations({subtree:true}).length),0);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   assert(await panel.evaluate(el=>el.scrollHeight<=el.clientHeight));
   assert.deepEqual(errors,[]);await page.close();
  }
  const empty=await browser.newPage();await empty.route('**/api/ledger',r=>r.fulfill({json:[]}));await empty.goto('http://127.0.0.1:8765');
  await empty.locator('#overview-composition').waitFor();assert.match(await empty.locator('#overview-composition').innerText(),/暂无记录/);
  console.log('PASS: in-panel drill-down, exact pagination, return, directions, period, stable layout, keyboard, reduced motion, empty records at 1440/390/320px.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
