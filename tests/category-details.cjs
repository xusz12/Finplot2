// Run against app/server.py with Playwright available via NODE_PATH.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const rows=[
  {id:1,category_id:1,category:'工资',nature:'日常',direction:'收入',amount_cents:50001,occurred_at:'2026-09-20 12:00:00'},
  {id:2,category_id:1,category:'工资',nature:'日常',direction:'收入',amount_cents:15002,occurred_at:'2026-09-19 12:00:00'},
  {id:3,category_id:2,category:'吃饭',nature:'日常',direction:'支出',amount_cents:2003,occurred_at:'2026-09-18 12:00:00'},
  {id:4,category_id:3,category:'投资收益',nature:'投资',direction:'收入',amount_cents:304,occurred_at:'2026-09-17 12:00:00'},
  {id:5,category_id:1,category:'工资',nature:'日常',direction:'收入',amount_cents:80005,occurred_at:'2026-08-17 12:00:00'},
].map(r=>({...r,note:`记录${r.id}`,category_group:'测试'}));
const money=n=>'¥ '+(n/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/ledger',r=>r.fulfill({json:rows}));
  await page.goto('http://127.0.0.1:8765');await page.waitForSelector('.f-stat');
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000});
   await page.locator('nav [data-page="analysis"]').click();
   for(const period of ['month','year']){
    await page.locator(`[data-period="${period}"]`).click();
    for(const scope of ['all','日常']){
     await page.locator('#scope-trigger').click();await page.locator('[data-scope="all"]').check();
     if(scope!=='all')await page.locator(`[data-scope="${scope}"]`).check();
     await page.keyboard.press('Escape');
     // Alternate income/expense and return to income, including nested bar clicks.
     for(const id of scope==='all'?[1,2,3,1]:[1,2,1]){
      const button=page.locator(`[data-category="${id}"]`);
      await button.locator('.f-fill').click();
      const expected=rows.filter(r=>r.category_id===id&&(period==='year'||r.occurred_at.startsWith('2026-09')));
      const detail=page.locator('.f-bottom');
      assert.equal(await detail.locator('tbody tr').count(),expected.length,`income/expense details: ${width}, ${period}, ${scope}, ${id}`);
      assert.deepEqual(await detail.locator('tbody tr td:last-child').allTextContents(),expected.map(r=>(r.direction==='收入'?'+':'−')+money(r.amount_cents)));
      assert.match(await detail.locator('h2').innerText(),new RegExp(expected[0].category));
      await page.locator('[data-close]').click();assert.equal(await page.locator('.f-bottom').count(),0);
     }
    }
   }
   // Analysis drill-down must not change the overview's direction selection.
   await page.locator('nav [data-page="overview"]').click();
   assert.equal(await page.locator('[data-direction="支出"]').getAttribute('aria-pressed'),'true');
   for(const direction of ['收入','支出']){
    await page.locator(`[data-direction="${direction}"]`).click();
    await page.locator('[data-category]').first().focus();await page.keyboard.press('Enter');
    assert(await page.locator('#overview-composition .f-composition-transactions li').count()>0);
   }
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  assert.deepEqual(errors,[]);console.log('PASS: income/expense bar drill-down, scope and period filtering, amounts, repeated switching, overview independence, keyboard and desktop/mobile.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
