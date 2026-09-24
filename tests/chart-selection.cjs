// Run against app/server.py: NODE_PATH=<playwright package directory> node tests/chart-selection.cjs
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const rows=[
  ['2026-09-20','收入',90001,'日常'],['2026-09-19','支出',10002,'日常'],
  ['2026-08-20','收入',80003,'日常'],['2026-08-19','支出',20004,'日常'],
  ['2026-08-18','收入',70005,'投资'],['2026-01-20','支出',30006,'日常'],
  ['2025-12-20','收入',100007,'日常']
].map(([date,direction,amount_cents,nature],i)=>({id:i+1,occurred_at:`${date} 12:00:00`,direction,amount_cents,nature,category_id:direction==='收入'?1:2,category:direction==='收入'?'工资':'吃饭',category_group:'测试',note:'合成测试记录'}));
const money=n=>(n<0?'−':'')+'¥ '+(Math.abs(n)/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  for(const width of [1440,390,320]){
   const mobile=width<560;
   const context=await browser.newContext({viewport:{width,height:1000},isMobile:mobile,hasTouch:mobile});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/api/ledger',r=>r.fulfill({json:rows}));
   await page.goto('http://127.0.0.1:8765');await page.waitForSelector('.f-stat');
   const charts=page.locator('[data-month-chart]');
   const target=(i,chart=0)=>charts.nth(chart).locator(`.chart-month[data-index="${i}"]`);
   const activate=async(i,chart=0)=>mobile?target(i,chart).tap():target(i,chart).click();
   const check=async(prefix)=>{
    const year=prefix.length===4;
    assert.equal(await page.locator(`[data-period="${year?'year':'month'}"]`).getAttribute('aria-pressed'),'true');
    const rs=rows.filter(r=>r.occurred_at.startsWith(prefix)&&r.nature==='日常');
    const inc=rs.filter(r=>r.direction==='收入').reduce((n,r)=>n+r.amount_cents,0),out=rs.filter(r=>r.direction==='支出').reduce((n,r)=>n+r.amount_cents,0);
    assert.deepEqual(await page.locator('.f-stat .f-num').allTextContents(),[inc-out,inc,out].map(money));
    assert.match(await page.locator('#subtitle').innerText(),new RegExp(`^${prefix} · 日常 · ${rs.length} 笔`));
    assert.equal(await page.locator('.f-bottom tbody tr').count(),rs.length);
    assert.equal(await page.locator('.chart-guide.is-selected').count(),year?0:2);
    if(!year){
     const x=String((Number(prefix.slice(5))-1)*50+20);
     for(const guide of await charts.locator('.chart-guide').all())assert.equal(await guide.getAttribute('x1'),x);
    }
   };
   await check('2026-09');
   await activate(7);await check('2026-08');
   await activate(7);await check('2026');
   assert.deepEqual(await charts.locator('.chart-guide').evaluateAll(es=>es.map(e=>getComputedStyle(e).opacity)),['0','0']);
   await activate(7,1);await check('2026-08');
   await activate(7,1);await check('2026');
   // Out-of-bounds months must not silently change period or trigger clamping.
   await target(11).dispatchEvent('click');await check('2026');
   await activate(1);await check('2026-02'); // Valid, empty month within ledger bounds.
   await page.locator('#date-trigger').click();await page.locator('[data-date="9"]').click();await check('2026-09');
   await page.locator('[data-period="year"]').click();await check('2026');
   if(!mobile){
    await target(7).hover();
    assert.equal(await charts.first().locator('.f-chart-tooltip').isVisible(),true);
    assert.deepEqual(await charts.locator('.chart-guide').evaluateAll(es=>es.map(e=>e.getAttribute('x1'))),['370','370']);
    assert.equal(await charts.locator('.chart-guide.is-preview').count(),2);
    await target(6,1).hover();
    assert.deepEqual(await charts.locator('.chart-guide').evaluateAll(es=>es.map(e=>e.getAttribute('x1'))),['320','320']);
    assert.equal(await charts.first().locator('.f-chart-tooltip').isVisible(),false);
    assert.equal(await charts.nth(1).locator('.f-chart-tooltip').isVisible(),true);
    assert.equal(await page.locator('[data-period="year"]').getAttribute('aria-pressed'),'true');
    await page.mouse.move(0,0);await check('2026');
    assert.equal(await charts.first().locator('.f-chart-tooltip').isVisible(),false);
    await activate(8);await target(7).hover();
    assert.deepEqual(await charts.locator('.chart-guide').evaluateAll(es=>es.map(e=>e.getAttribute('x1'))),['370','370']);
    await page.screenshot({path:'/tmp/finplot-synced-hover.png',fullPage:true});
    assert.equal(await page.locator('#date-trigger').innerText(),'2026年9月');
    await page.mouse.move(0,0);await check('2026-09');
    await target(7).focus();await page.keyboard.press('Enter');await check('2026-08');
    assert.equal(await target(7).evaluate(e=>e===document.activeElement),true);
    const focusStyle=await target(7).evaluate(e=>{const s=getComputedStyle(e);return {outline:s.outlineStyle,stroke:s.strokeWidth,vector:s.vectorEffect}});
    assert.deepEqual(focusStyle,{outline:'none',stroke:'1px',vector:'non-scaling-stroke'});
    await page.screenshot({path:'/tmp/finplot-chart-focus.png',fullPage:true});
    await page.keyboard.press(' ');await check('2026');
   }else{
    await activate(8);await check('2026-09');
    assert.equal(await charts.first().locator('.f-chart-tooltip').isVisible(),false);
    const layout=await page.locator('.f-sidebar').evaluate(side=>{
     const nav=side.querySelector('nav'),logo=side.querySelector('.f-logo');
     return {tops:[...nav.children].map(e=>e.getBoundingClientRect().top),height:side.getBoundingClientRect().height,logoY:logo.getBoundingClientRect().top,navY:nav.getBoundingClientRect().top,scrolls:nav.scrollWidth>nav.clientWidth};
    });
    assert.equal(new Set(layout.tops).size,1);assert(layout.height<70);assert(layout.scrolls);
    await page.locator('nav [data-page="transactions"]').focus();
    assert(await page.locator('nav').evaluate(e=>e.scrollLeft>0));
    await page.keyboard.press('Enter');assert.equal(await page.locator('#crumb').innerText(),'全部交易');
    await page.locator('nav [data-page="overview"]').click();
   }
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.screenshot({path:`/tmp/finplot-chart-selection-${width}.png`,fullPage:true});
   // Year navigation, negative months, scope retention and stale detail cleanup.
   await page.locator('[data-period="year"]').click();
   await page.locator('[data-step="-1"]').click();await check('2025');
   await activate(11);await check('2025-12');
   await activate(11);await check('2025');
   await page.locator('[data-step="1"]').click();await activate(0);await check('2026-01');
   await page.locator('[data-category="2"]').click();
   assert.equal(await page.locator('#overview-composition .f-composition-selected').count(),1);
   await activate(7);await check('2026-08');
   assert.equal(await page.locator('#overview-composition .f-composition-selected').count(),0);
   await page.locator('#scope-trigger').click();await page.locator('[data-scope="all"]').check();
   await page.keyboard.press('Escape');await activate(7);
   assert.equal(await page.locator('#scope-trigger').innerText(),'范围：全部');
   await activate(7);
   assert.equal(await page.locator('.f-stat .f-num').nth(1).innerText(),money(150008));
   // Investment reuses month selection without changing its investment-only scope.
   await page.locator('nav [data-page="invest"]').click();await page.mouse.move(0,0);
   const investmentCheck=async(prefix)=>{
    const rs=rows.filter(r=>r.nature==='投资'&&r.occurred_at.startsWith(prefix));
    const inc=rs.filter(r=>r.direction==='收入').reduce((n,r)=>n+r.amount_cents,0),out=rs.filter(r=>r.direction==='支出').reduce((n,r)=>n+r.amount_cents,0);
    assert.deepEqual(await page.locator('.f-stat .f-num').allTextContents(),[inc-out,inc,out].map(money));
    assert.equal(await page.locator('.f-bottom tbody tr').count(),rs.length);
    assert.match(await page.locator('#subtitle').innerText(),new RegExp(`^${prefix} · 投资 · ${rs.length} 笔`));
    assert.equal(await page.locator('.chart-guide.is-selected').count(),prefix.length===4?0:1);
    if(prefix.length!==4)assert.equal(await charts.locator('.chart-guide').getAttribute('x1'),String((Number(prefix.slice(5))-1)*50+20));
   };
   await investmentCheck('2026-08');
   const investmentPoints=await charts.getAttribute('data-points');
   await activate(7);await investmentCheck('2026');
   await activate(8);await investmentCheck('2026-09');
   await activate(7);await investmentCheck('2026-08');
   assert.equal(await charts.getAttribute('data-points'),investmentPoints);
   if(!mobile){
    await target(8).hover();
    assert.equal(await charts.locator('.chart-guide').getAttribute('x1'),'420');
    assert.equal(await charts.locator('.chart-point.is-active').getAttribute('data-index'),'8');
    assert.match(await charts.locator('.f-chart-tooltip').innerText(),/累计盈亏/);
    assert.equal(await page.locator('#date-trigger').innerText(),'2026年8月');
    await page.mouse.move(0,0);await investmentCheck('2026-08');
    assert.equal(await charts.locator('.chart-point.is-active').count(),0);
    await target(7).focus();await page.keyboard.press('Enter');await investmentCheck('2026');
    await page.keyboard.press(' ');await investmentCheck('2026-08');
   }
   await page.locator('#date-trigger').click();await page.locator('[data-date="9"]').click();await investmentCheck('2026-09');
   await target(11).dispatchEvent('click');await investmentCheck('2026-09');
   await page.screenshot({path:`/tmp/finplot-investment-selection-${width}.png`,fullPage:true});
   await page.locator('[data-period="year"]').click();await investmentCheck('2026');
   await page.mouse.move(0,0);
   assert.equal(await charts.locator('.chart-guide.is-preview').count(),0);
   // Empty ledger has no selectable months and no period mutation on tap.
   await page.route('**/api/ledger',r=>r.fulfill({json:[]}));await page.reload();await page.waitForSelector('.f-stat');
   await page.locator('[data-period="year"]').click();await target(1).dispatchEvent('click');
   assert.equal(await page.locator('[data-period="year"]').getAttribute('aria-pressed'),'true');
   assert.equal(await page.locator('.chart-month[aria-disabled="false"]').count(),0);
   assert.deepEqual(errors,[]);await context.close();
   console.log(`PASS ${width}: month/year selection, amounts, guides, date picker, bounds, empty month/ledger, keyboard/hover/touch, navigation.`);
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
