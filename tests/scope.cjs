// Run against the local server: NODE_PATH=<playwright package directory> node tests/scope.cjs
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:8765');
    await page.waitForSelector('.f-stat');
    const rows=await page.evaluate(()=>fetch('/api/ledger').then(r=>r.json()));
    const month=rows.map(r=>r.occurred_at.slice(0,7)).sort().at(-1);
    const natures=['日常','投资','往来','调整'];
    const navigate=async name=>page.locator(`nav [data-page="${name}"]`).click();
    const open=async()=>{if(!await page.locator('#scope-panel').isVisible())await page.locator('#scope-trigger').click();};
    const choose=async list=>{
      await open();await page.locator('[data-scope="all"]').check();
      if(list!==null){
        if(!list.length){await page.locator('[data-scope="日常"]').check();await page.locator('[data-scope="日常"]').uncheck();}
        else for(const nature of list)await page.locator(`[data-scope="${nature}"]`).check();
      }
    };
    for(const view of ['overview','analysis','calendar']){
      await navigate(view);
      for(let mask=-1;mask<16;mask++){
        const chosen=mask===-1?null:natures.filter((_,i)=>mask&(1<<i));
        await choose(chosen);
        const expected=rows.filter(r=>r.occurred_at.startsWith(month)&&(chosen===null||chosen.includes(r.nature)));
        assert.match(await page.locator('#subtitle').innerText(),new RegExp(` · ${expected.length} 笔 · `));
        assert.equal(await page.locator('[data-scope="all"]').isChecked(),chosen===null);
        for(const nature of natures)assert.equal(await page.locator(`[data-scope="${nature}"]`).isChecked(),chosen?.includes(nature)||false);
        assert.equal(await page.locator('#scope-panel').isVisible(),true);
        const amounts=await page.locator(view==='calendar'?'.f-calendar-summary dd':'.f-stat .f-num').allTextContents();
        const inc=expected.filter(r=>r.direction==='收入').reduce((a,r)=>a+r.amount_cents,0);
        const out=expected.filter(r=>r.direction==='支出').reduce((a,r)=>a+r.amount_cents,0);
        const format=n=>(n<0?'−':'')+'¥ '+(Math.abs(n)/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
        assert.deepEqual(amounts,(view==='calendar'?[inc,out,inc-out]:[inc-out,inc,out]).map(format));
        if(view==='overview'){
          const points=await page.locator('[data-chart]').evaluateAll(nodes=>nodes.map(n=>JSON.parse(n.dataset.points)));
          for(let i=0;i<12;i++){
            const subset=rows.filter(r=>r.occurred_at.startsWith(month.slice(0,4))&&Number(r.occurred_at.slice(5,7))===i+1&&(chosen===null||chosen.includes(r.nature)));
            const income=subset.filter(r=>r.direction==='收入').reduce((a,r)=>a+r.amount_cents,0),expense=subset.filter(r=>r.direction==='支出').reduce((a,r)=>a+r.amount_cents,0);
            assert.equal(points[0][i].income,income);assert.equal(points[0][i].expense,expense);assert.equal(points[1][i].value,income-expense);
          }
        }
      }
    }
    await navigate('overview');await choose(['日常','往来']);
    await page.keyboard.press('Escape');await page.locator('[data-period="year"]').click();
    const yearRows=rows.filter(r=>r.occurred_at.startsWith(month.slice(0,4))&&['日常','往来'].includes(r.nature));
    assert.match(await page.locator('#subtitle').innerText(),new RegExp(` · ${yearRows.length} 笔 · `));
    const firstCategory=page.locator('[data-category]').first();
    if(await firstCategory.count()){
      const id=Number(await firstCategory.getAttribute('data-category'));await firstCategory.click();
      const expected=yearRows.filter(r=>r.category_id===id&&r.direction==='支出');
      assert.equal(await page.locator('.f-bottom').first().locator('tbody tr').count(),expected.length);
    }
    await page.locator('[data-period="month"]').click();
    await navigate('overview');await choose(['日常','投资']);
    await navigate('analysis');await choose(['往来']);
    await navigate('calendar');await choose(null);
    await page.reload();await page.waitForSelector('.f-stat');
    for(const [view,label] of [['overview','日常、投资'],['analysis','往来'],['calendar','全部']]){
      await navigate(view);assert.equal(await page.locator('#scope-trigger').innerText(),`范围：${label}`);
    }
    for(const view of ['transactions','invest']){
      await navigate(view);assert.equal(await page.locator('#scope-picker').isVisible(),false);
      if(view==='transactions'){
        assert.equal(await page.locator('.f-stat').count(),0);
        assert.equal(await page.locator('tbody tr').count(),rows.filter(r=>r.occurred_at.startsWith(month)).length);
      }else assert.match(await page.locator('#subtitle').innerText(),/ · 投资 · /);
    }
    for(const width of [1440,390]){
      await page.setViewportSize({width,height:1000});
      for(const view of ['overview','analysis','calendar','invest','transactions']){
        await navigate(view);
        if(['overview','analysis','calendar'].includes(view)){
          await choose(natures);
          const box=await page.locator('#scope-panel').boundingBox();assert(box.x>=0&&box.x+box.width<=width);
          assert(!await page.locator('#scope-trigger').innerText().then(t=>t.includes('自定义')));
          if(view==='overview')await page.screenshot({path:`/tmp/finplot-scope-${width}.png`,fullPage:true});
          await page.keyboard.press('Escape');assert.equal(await page.locator('#scope-panel').isVisible(),false);
          assert.equal(await page.locator('#scope-trigger').evaluate(e=>e===document.activeElement),true);
          await page.keyboard.press('Enter');await page.keyboard.press('Space');
          await page.locator('h1').click();assert.equal(await page.locator('#scope-panel').isVisible(),false);
          await open();await page.locator('#date-trigger').click();assert.equal(await page.locator('#scope-panel').isVisible(),false);
          await page.keyboard.press('Escape');
        }
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      }
    }
    await page.route('**/api/ledger',r=>r.fulfill({json:[]}));
    await page.reload();await page.waitForSelector('.f-stat');
    await choose([]);assert.match(await page.locator('#scope-trigger').innerText(),/未选择性质/);
    await navigate('calendar');await choose(null);assert.match(await page.locator('#subtitle').innerText(),/ · 0 笔 · /);
    assert.deepEqual(errors,[]);
    console.log('PASS: all 17 scopes × 3 pages, integer totals, annual charts, independent persistent memory, complete transactions, 1440/390 layouts, keyboard, date popup, empty ledger.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
