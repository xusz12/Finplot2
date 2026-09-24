const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  for(const width of [1440,390,320]){
   const page=await browser.newPage({viewport:{width,height:850}}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/api/ledger',r=>r.fulfill({json:[]}));
   let checks=0,applies=0,status='idle';
   await page.route('**/api/update/status',r=>r.fulfill({json:{state:status,message:status==='failed'?'检测到本地代码修改，已停止更新。':''}}));
   await page.route('**/api/update/check',r=>{checks++;return r.fulfill({json:{current:'v0.1.7',latest:'v0.1.8',commit:'a'.repeat(40),available:true,managed:true}})});
   await page.route('**/api/update/apply',r=>{applies++;assert.equal(r.request().postDataJSON().tag,'v0.1.8');status='failed';return r.fulfill({status:202,json:{state:'running'}})});
   await page.goto('http://127.0.0.1:8765');await page.waitForSelector('.f-stat');
   await page.locator('.f-settings').click();assert.equal(checks,0);
   await page.locator('[data-update-check]').focus();await page.keyboard.press('Enter');
   await page.waitForSelector('[data-update-apply]');
   assert.equal(checks,1);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.screenshot({path:`/tmp/finplot-updates-${width}.png`});
   page.once('dialog',d=>d.dismiss());await page.locator('[data-update-apply]').click();assert.equal(applies,0);
   page.once('dialog',d=>d.accept());await page.locator('[data-update-apply]').click();
   await page.waitForFunction(()=>document.querySelector('.f-update-message').textContent.includes('本地代码修改'));
   assert.equal(applies,1);assert.equal(await page.locator('[data-update-check]').isEnabled(),true);
   await page.route('**/api/update/check',r=>r.fulfill({status:504,json:{error:'连接 GitHub 超时。'}}));
   await page.locator('[data-update-check]').click();await page.waitForFunction(()=>document.querySelector('.f-update-message').textContent.includes('超时'));
   assert.deepEqual(errors,[]);await page.close();console.log(`updates ${width}: passed`);
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
