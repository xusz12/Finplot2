// NODE_PATH=<playwright package directory> node tests/settings.cjs
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  for(const width of [1440,390,320]){
   const page=await browser.newPage({viewport:{width,height:850}}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/api/ledger',r=>r.fulfill({json:[]}));
   await page.goto('http://127.0.0.1:8765');
   await page.waitForSelector('.f-stat');
   const version=await page.locator('.f-version').innerText();
   assert.equal(version,'v0.1.7');
   const below=await page.locator('.f-logo').evaluate(el=>el.children[1].getBoundingClientRect().top>=el.children[0].getBoundingClientRect().bottom);
   assert.ok(below,'Version must be below product name');
   await page.locator('.f-settings').focus();await page.keyboard.press('Enter');
   assert.equal(await page.locator('#title').innerText(),'设置');
   assert.equal(await page.locator('.f-controls').isVisible(),false);
   await page.locator('[data-page="changelog"]').click();
   assert.equal(await page.locator('#title').innerText(),'更新日志');
   const text=await page.locator('.f-changelog').innerText();
   for(const line of fs.readFileSync('CHANGELOG.md','utf8').split('\n')){
    if(line.startsWith('- '))assert.ok(text.includes(line.slice(2).replaceAll('`','')),`Missing release note: ${line}`);
   }
   const before=await page.locator('.f-sidebar').boundingBox();
   await page.evaluate(()=>window.scrollTo(0,600));
   const after=await page.locator('.f-sidebar').boundingBox();
   assert.equal(after.y,before.y,'Navigation must stay fixed');
   const settings=await page.locator('.f-settings').boundingBox();
   assert.equal(await page.locator('.f-sidebar .f-settings').count(),1);
   assert.ok(settings.x>=after.x&&settings.x+settings.width<=after.x+after.width);
   assert.ok(settings.y>=after.y&&settings.y+settings.height<=after.y+after.height);
   if(width>560)assert.ok(settings.x<176&&settings.y>700,'Settings at sidebar bottom');
   else assert.ok(settings.y<80,'Mobile settings stays in top navigation');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.screenshot({path:`/tmp/finplot-settings-${width}.png`});
   await page.locator('.f-back').click();
   await page.locator('[data-page="overview"]').click();
   assert.equal(await page.locator('.f-controls').isVisible(),true);
   assert.equal(await page.locator('.f-stat').count(),3);
   assert.deepEqual(errors,[]);
   await page.close();console.log(`settings ${width}: passed`);
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
