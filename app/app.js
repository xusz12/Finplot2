const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let records=[],page='overview',period='month',direction='支出',category=null;
let selectedDay=null;
const localMonth=()=>{const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`};
let selectedMonth=localMonth(),browseYear=Number(selectedMonth.slice(0,4)),dateBounds=null;
function updateDateBounds(){
  const months=records.map(r=>r.occurred_at.slice(0,7)).sort();
  dateBounds=months.length?{min:months[0],max:months[months.length-1]}:null;
}
function dateAllowed(value,monthly=period==='month'){
  return !!dateBounds&&value>=dateBounds.min.slice(0,monthly?7:4)&&value<=dateBounds.max.slice(0,monthly?7:4);
}
function clampMonth(value){return dateBounds?(value<dateBounds.min?dateBounds.min:value>dateBounds.max?dateBounds.max:value):value;}
const money=n=>(n<0?'−':'')+'¥ '+(Math.abs(n)/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
const directionClass=d=>d==='收入'?'f-income':'f-expense';
const displayDate=value=>String(value||'').replace('T',' ').slice(0,16);
const categoryIcons={'吃饭':'food','饮料':'drink','零食':'snack','烟酒':'drink','通讯':'phone','医疗':'health','理发':'scissors','住房':'home','房贷':'home','政务服务':'service','交通':'transit','汽车':'car','车贷':'car','育儿':'family','宠物':'pet','家庭':'family','按摩':'relax','电影':'film','酒吧':'drink','网吧':'game','游戏':'game','学习':'study','运动健身':'fitness','日用':'box','订阅':'subscribe','服饰':'clothes','玩具':'toy','电器数码':'device','装修':'home','旅游饮食':'food','旅游住宿':'home','旅游交通':'transit','门票':'ticket','旅游娱乐':'relax','旅游购物':'bag','礼物':'gift','红包支出':'envelope','投资亏损':'loss','借出':'lend','资金损失':'loss','其他':'more','工资':'work','奖金':'star','公积金':'fund','年终奖':'star','过节费':'gift','副业收入':'work','闲置出售':'bag','投资收益':'gain','红包收入':'envelope','借款收回':'lend','退款':'refund'};
const groupIcons={'生活支出':'home','出行用车':'transit','家庭支出':'family','休闲娱乐':'relax','学习健康':'fitness','购物消费':'bag','旅行支出':'travel','人情支出':'gift','投资支出':'loss','往来损失':'lend','其他支出':'more','工作收入':'work','经营与处置':'work','投资收入':'gain','人情往来':'gift','退款':'refund','其他收入':'more'};
const iconPaths={food:'<path d="M4 3v8m0-4h3M7 3v8M4 11v10M7 11v10M14 3v18m0-12c3 0 5-2 5-5"/>',drink:'<path d="M6 3h12l-1 18H7L6 3Zm3 4h6M9 12h6"/>',phone:'<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M10 18h4"/>',health:'<path d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.6-7 10-7 10Z"/><path d="M12 7v6m-3-3h6"/>',scissors:'<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="m8.5 7.5 10 10M8.5 16.5l10-10"/>',home:'<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 21v-6h6v6"/>',service:'<path d="M5 3h14v18H5zM8 7h8M8 11h8M8 15h5"/>',transit:'<path d="M5 17h14l-1-9H6l-1 9Zm3 0v3m8-3v3M7 8l1-4h8l1 4M8 12h.01M16 12h.01"/>',car:'<path d="m4 16 2-7h12l2 7M4 16h16v4H4zM7 20v2m10-2v2M7 13h10"/>',family:'<circle cx="9" cy="8" r="3"/><circle cx="16" cy="9" r="2"/><path d="M3 21c0-4 2-6 6-6s6 2 6 6M14 15c3 0 5 2 5 6"/>',relax:'<circle cx="12" cy="12" r="9"/><path d="M8 14c1 2 7 2 8 0M9 9h.01M15 9h.01"/>',film:'<path d="M4 5h16v14H4zM8 5v14M16 5v14M4 9h4m8 0h4M4 15h4m8 0h4"/>',game:'<path d="M6 9h12l3 5v4a2 2 0 0 1-3.5 1.3L15 17H9l-2.5 2.3A2 2 0 0 1 3 18v-4l3-5Z"/><path d="M8 12v4m-2-2h4m6 0h.01m3 0h.01"/>',study:'<path d="m3 6 9-3 9 3-9 3-9-3Zm3 3v6c3 2 9 2 12 0V9M12 9v11"/>',fitness:'<path d="M6 9v6m12-6v6M3 11h3m12 0h3M8 8v8m8-8v8M8 12h8"/>',box:'<path d="m3 7 9-4 9 4-9 4-9-4Zm0 0v10l9 4 9-4V7M12 11v10"/>',subscribe:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 2v4m8-4v4M4 10h16"/>',clothes:'<path d="m8 4 4 3 4-3 5 4-3 4-2-2v11H8V10l-2 2-3-4 5-4Z"/>',toy:'<circle cx="12" cy="12" r="8"/><path d="M9 10h.01M15 10h.01M9 15c2 1 4 1 6 0"/>',device:'<rect x="4" y="3" width="16" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',travel:'<path d="m3 12 18-6-6 18-3-8-9-4Zm9 4 5-5"/>',ticket:'<path d="M4 6h16v12H4zM8 6v12m8-12v12"/><path d="M11 9h2m-2 3h2m-2 3h2"/>',bag:'<path d="M5 8h14l1 13H4L5 8Zm3 0V6a4 4 0 0 1 8 0v2"/>',gift:'<path d="M4 10h16v11H4zM3 7h18v3H3zM12 7v14M12 7H8a2 2 0 1 1 2-4c2 0 2 4 2 4Zm0 0h4a2 2 0 1 0-2-4c-2 0-2 4-2 4Z"/>',envelope:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',loss:'<path d="M5 5h14v14H5z"/><path d="m8 9 8 6m0-6-8 6"/>',lend:'<path d="M4 12h16M13 5l7 7-7 7M4 5v14"/>',work:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5h8v2M3 12h18"/>',star:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>',fund:'<path d="M4 20V10m5 10V4m6 16v-7m5 7V7"/>',gain:'<path d="M4 18 10 12l4 3 6-8M15 7h5v5"/>',refund:'<path d="M9 8H4l4-4M4 8a8 8 0 1 1 1 8"/>',more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'};
const groupColors={'生活支出':'#3978b8','出行用车':'#168a9a','家庭支出':'#5368b8','休闲娱乐':'#7657a8','学习健康':'#258b77','购物消费':'#3c6fae','旅行支出':'#168a9a','人情支出':'#8b5aa6','投资支出':'#526a88','往来损失':'#3b83ad','其他支出':'#697586','工作收入':'#d1742f','经营与处置':'#c18426','投资收入':'#c9563c','人情往来':'#b55270','退款':'#c96b46','其他收入':'#9d6b40'};
const categoryIcon=r=>`<svg class="f-category-icon" style="color:${groupColors[r.category_group]||'#697586'}" viewBox="0 0 24 24" focusable="false">${iconPaths[categoryIcons[r.category]||groupIcons[r.category_group]||'more']}</svg>`;
const legend=(directions=['收入','支出'])=>`<div class="f-legend" aria-label="图例">${directions.map(d=>`<span><i class="f-swatch ${directionClass(d)}" aria-hidden="true"></i>${d}</span>`).join('')}</div>`;
const sum=rs=>rs.reduce((a,r)=>a+r.amount_cents,0), total=(rs,d)=>sum(rs.filter(r=>r.direction===d));
function selection(){let prefix=selectedMonth.slice(0,period==='year'?4:7);return records.filter(r=>r.occurred_at.startsWith(prefix)&&(page==='invest'?r.nature==='投资':r.nature==='日常'));}
// Use the date as recorded, just as existing monthly summaries do. Do not parse
// naive ledger timestamps as UTC or apply an unconfirmed timezone conversion.
function calendarDays(rs){
  const days=new Map();
  for(const r of rs){
    const key=r.occurred_at.slice(0,10);
    if(!days.has(key))days.set(key,{income:0,expense:0,records:[]});
    const day=days.get(key);
    day[r.direction==='收入'?'income':'expense']+=r.amount_cents;
    day.records.push(r);
  }
  return days;
}
function calendarAmount(cents,compact=false){
  const yuan=cents/100;
  const unit=yuan>=1e8?[1e8,'亿']:yuan>=1e4?[1e4,'万']:compact&&yuan>=1e3?[1e3,'千']:null;
  if(unit&&(compact||yuan>=1e6))return (yuan/unit[0]).toFixed(2).replace(/\.00$/,'')+unit[1];
  return yuan.toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
}
function calendarDetail(day,entry,first,last){
  const rs=[...(entry?.records||[])].sort((a,b)=>b.occurred_at.localeCompare(a.occurred_at)||b.id-a.id);
  const income=entry?.income||0,expense=entry?.expense||0,net=income-expense;
  const [year,month,date]=day.split('-').map(Number);
  const weekday=['周日','周一','周二','周三','周四','周五','周六'][new Date(year,month-1,date).getDay()];
  const empty=!last?'账本暂无记录。':day>last?'此日期晚于最新账单，暂无记录。':day<first?'此日期早于首笔账单，暂无记录。':'当天暂无记录。';
  return `<div class="f-calendar-detailhead"><h2 id="calendar-detail-title">${month}月${date}日 <span>${weekday}</span></h2><span class="f-sub">${rs.length} 笔交易</span></div>
    ${rs.length?`<dl class="f-day-totals"><div><dt>收入</dt><dd class="f-income">${money(income)}</dd></div><div><dt>支出</dt><dd class="f-expense">${money(expense)}</dd></div><div><dt>差额</dt><dd class="${net>0?'f-income':net<0?'f-expense':''}">${money(net)}</dd></div></dl>
    <ul class="f-day-transactions">${rs.map(r=>`<li><span class="f-merchanticon" aria-hidden="true">${categoryIcon(r)}</span><div class="f-day-transaction"><div class="f-day-row"><strong>${esc(r.category)}</strong><span class="${directionClass(r.direction)}">${r.direction==='收入'?'+':'−'}${money(r.amount_cents)}</span></div><div class="f-sub">${esc(r.note||r.category_group)}</div><time class="f-sub" datetime="${esc(r.occurred_at.replace(' ','T'))}">${esc(r.occurred_at.slice(11,16))} · ${r.direction}</time></div></li>`).join('')}</ul>`:`<p class="f-calendar-empty">${empty}</p>`}`;
}
function renderCalendar(rs){
  const days=calendarDays(rs),dates=[...days.keys()].sort();
  const [year,month]=selectedMonth.split('-').map(Number);
  const count=new Date(year,month,0).getDate(),offset=(new Date(year,month-1,1).getDay()+6)%7;
  const allDates=records.map(r=>r.occurred_at.slice(0,10)).sort(),first=allDates[0],last=allDates[allDates.length-1];
  if(!selectedDay?.startsWith(selectedMonth))selectedDay=dates[dates.length-1]||`${selectedMonth}-01`;
  const now=new Date(),today=`${localMonth()}-${String(now.getDate()).padStart(2,'0')}`;
  const cells=Array.from({length:Math.ceil((offset+count)/7)*7},(_,i)=>{
    const date=i-offset+1;
    if(date<1||date>count)return '<div class="f-calendar-padding" aria-hidden="true"></div>';
    const day=`${selectedMonth}-${String(date).padStart(2,'0')}`,entry=days.get(day),isToday=day===today;
    const beyond=!last||day>last||day<first;
    const label=`${year}年${month}月${date}日${isToday?'，今天':''}，${entry?`收入 ${money(entry.income)}，支出 ${money(entry.expense)}，${entry.records.length} 笔交易`:beyond?'账单范围外，暂无记录':'暂无记录'}`;
    const amounts=[['income','收','+'],['expense','支','−']].map(([key,name,sign])=>entry?.[key]?`<span class="f-calendar-amount f-${key}"><span class="f-calendar-full">${name} ${sign}${calendarAmount(entry[key])}</span><span class="f-calendar-compact">${sign}${calendarAmount(entry[key],true)}</span></span>`:'<span class="f-calendar-amount"></span>').join('');
    return `<button type="button" class="f-calendar-day${beyond?' is-outside':''}" data-day="${day}" aria-label="${esc(label)}" aria-pressed="${day===selectedDay}" ${isToday?'aria-current="date"':''} tabindex="${day===selectedDay?0:-1}"><span class="f-calendar-number">${date}${isToday?'<span class="f-calendar-today">今</span>':''}</span><span class="f-calendar-amounts" aria-hidden="true">${amounts}</span></button>`;
  }).join('');
  const income=total(rs,'收入'),expense=total(rs,'支出'),net=income-expense;
  return `<dl class="f-calendar-summary">${[['本月收入',income,'f-income'],['本月支出',expense,'f-expense'],['收支差额',net,net>0?'f-income':net<0?'f-expense':'']].map(([name,value,color])=>`<div><dt>${name}</dt><dd class="${color}">${money(value)}</dd></div>`).join('')}</dl>
    <div class="f-calendar-layout"><section class="f-panel f-calendar-panel" aria-label="${year}年${month}月收支日历"><div class="f-panelhead"><h2>${month}月收支</h2>${legend()}</div><div class="f-calendar-week" aria-hidden="true">${['一','二','三','四','五','六','日'].map(d=>`<span>${d}</span>`).join('')}</div><div class="f-calendar-grid" role="group" aria-label="选择日期，方向键移动，回车查看明细">${cells}</div><div class="f-calendar-footnote">金额单位：元<span>${rs.length?`${dates.length} 天有记录`:'本月暂无日常收支记录'}</span></div></section>
    <section class="f-panel f-calendar-detail" aria-labelledby="calendar-detail-title">${calendarDetail(selectedDay,days.get(selectedDay),first,last)}</section></div>`;
}
function selectCalendarDay(day){
  selectedDay=day;
  $('#content').innerHTML=renderCalendar(selection());
  document.querySelector(`[data-day="${day}"]`)?.focus({preventScroll:true});
}
document.addEventListener('keydown',e=>{
  if(!e.target.matches('[data-day]'))return;
  const buttons=[...document.querySelectorAll('[data-day]')],i=buttons.indexOf(e.target);
  const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[e.key];
  let next=delta===undefined?null:Math.max(0,Math.min(buttons.length-1,i+delta));
  if(e.key==='Home')next=0;
  if(e.key==='End')next=buttons.length-1;
  if(next===null)return;
  e.preventDefault();
  buttons.forEach((b,j)=>b.tabIndex=j===next?0:-1);
  buttons[next].focus();
});
function table(rs){return rs.length?`<table class="f-table"><thead><tr><th>交易 / 分类</th><th>日期</th><th>金额 / 元</th></tr></thead><tbody>${rs.map(r=>`<tr><td><div class="f-merchant"><span class="f-merchanticon" aria-hidden="true">${categoryIcon(r)}</span><span>${esc(r.category)}<div class="f-sub">${esc(r.note||r.category_group)}</div></span></div></td><td>${esc(displayDate(r.occurred_at))}</td><td class="${directionClass(r.direction)}">${r.direction==='收入'?'+':'−'}${money(r.amount_cents)}</td></tr>`).join('')}</tbody></table>`:'<p class="f-sub">此范围暂无交易。</p>';}
function groups(rs,dir=direction){const m=new Map();rs.filter(r=>r.direction===dir).forEach(r=>{let x=m.get(r.category_id)||{id:r.category_id,name:r.category,value:0};x.value+=r.amount_cents;m.set(r.category_id,x)});return [...m.values()].sort((a,b)=>b.value-a.value);}
function ranks(rs,dir=direction){let g=groups(rs,dir),t=total(rs,dir);return g.length?(page==='overview'?g.slice(0,5):g).map(r=>`<div class="f-rank"><button data-category="${r.id}"><div class="f-rankline"><span>${esc(r.name)}</span><b>${money(r.value)} · ${(r.value/t*100).toFixed(1)+'%'}</b></div><div class="f-track"><div class="f-fill ${directionClass(dir)}" style="width:${r.value/t*100}%"></div></div></button></div>`).join(''):'<p class="f-sub">此范围暂无记录。</p>';}
function chartWrap(svg, points){
  return `<div class="f-chart-wrap" data-chart data-points='${esc(JSON.stringify(points))}'><div class="f-chart-tooltip" role="status" aria-live="polite" hidden></div>${svg}</div>`;
}
function trend(rs){
  const year=selectedMonth.slice(0,4), base=records.filter(r=>r.occurred_at.startsWith(year)&&(page==='invest'?r.nature==='投资':r.nature==='日常'));
  const vals=Array.from({length:12},(_,i)=>{const r=base.filter(r=>Number(r.occurred_at.slice(5,7))===i+1);return [total(r,'收入'),total(r,'支出')]});
  const max=Math.max(...vals.flat(),1), points=vals.map((v,i)=>({x:i*50+20,label:`${i+1}月`,income:v[0],expense:v[1]}));
  const marks=vals.map((v,i)=>`<rect class="chart-hit" data-index="${i}" x="${i*50}" y="0" width="50" height="220" fill="transparent"/>${v.map((n,j)=>`<rect class="chart-mark" data-index="${i}" x="${i*50+8+j*15}" y="${210-n/max*175}" width="12" height="${n/max*175}" rx="3" fill="${j?'url(#expense-stripes)':'var(--f-income)'}"><title>${i+1}月${j?'支出':'收入'} ${money(n)}</title></rect>`).join('')}<text x="${i*50+20}" y="235" text-anchor="middle">${i+1}月</text>`).join('');
  const svg=`<svg class="f-chart" viewBox="0 0 600 250" role="img" aria-label="${year}年月度收入支出，单位元"><defs><pattern id="expense-stripes" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="var(--f-expense)"/><path d="M-2 2L2-2M0 8L8 0M6 10L10 6" stroke="var(--f-panel)" stroke-width="1.5"/></pattern></defs><desc>${vals.map((v,i)=>`${i+1}月：收入${money(v[0])}，支出${money(v[1])}`).join('；')}</desc><text x="0" y="15">${money(max)}</text><line x1="0" y1="210" x2="600" y2="210" stroke="var(--f-line)"/>${marks}<line class="chart-guide" x1="20" y1="18" x2="20" y2="210" stroke="var(--f-blue)" stroke-dasharray="3 4"/></svg>`;
  return chartWrap(svg, points);
}
function balanceChart(rs){
  const year=selectedMonth.slice(0,4), base=records.filter(r=>r.occurred_at.startsWith(year)&&r.nature==='日常');
  const vals=Array.from({length:12},(_,i)=>{const r=base.filter(r=>Number(r.occurred_at.slice(5,7))===i+1);return total(r,'收入')-total(r,'支出')});
  const max=Math.max(...vals.map(Math.abs),1), zero=72, points=vals.map((v,i)=>({x:i*50+20,label:`${i+1}月`,value:v}));
  const svg=`<svg class="f-chart f-balance-chart" viewBox="0 0 600 130" role="img" aria-label="${year}年月度结余，单位元"><line x1="0" y1="${zero}" x2="600" y2="${zero}" stroke="var(--f-line)"/>${vals.map((v,i)=>{const h=Math.abs(v)/max*52;return `<rect class="chart-hit" data-index="${i}" x="${i*50}" y="0" width="50" height="120" fill="transparent"/><rect class="chart-mark" data-index="${i}" x="${i*50+13}" y="${v>=0?zero-h:zero}" width="14" height="${h}" rx="4" fill="${v>=0?'var(--f-income)':'var(--f-expense)'}"/>`}).join('')}</svg>`;
  return chartWrap(svg,points);
}
function investmentTrend(rs){
  const year=selectedMonth.slice(0,4), base=records.filter(r=>r.occurred_at.startsWith(year)&&r.nature==='投资');
  const vals=Array.from({length:12},(_,i)=>{const r=base.filter(r=>Number(r.occurred_at.slice(5,7))===i+1);return {net:total(r,'收入')-total(r,'支出')}});
  let running=0; const cumulative=vals.map(v=>(running+=v.net)), min=Math.min(...cumulative,0),max=Math.max(...cumulative,0),range=Math.max(max-min,1),y=v=>190-(v-min)/range*155;
  const points=cumulative.map((v,i)=>({x:i*50+20,label:`${i+1}月`,value:v,net:vals[i].net}));
  const path=points.map((p,i)=>{const prev=points[Math.max(0,i-1)],next=points[Math.min(points.length-1,i+1)];if(!i)return `M ${p.x} ${y(p.value)}`;const cx1=prev.x+(p.x-prev.x)/3,cx2=p.x-(next.x-p.x)/3;return `C ${cx1} ${y(prev.value)} ${cx2} ${y(p.value)} ${p.x} ${y(p.value)}`}).join(' ');
  const maxNet=Math.max(...vals.map(v=>Math.abs(v.net)),1),zero=190, svg=`<svg class="f-chart" viewBox="0 0 600 235" role="img" aria-label="${year}年投资累计收益与月度收支差额，单位元"><defs><linearGradient id="investment-line-shadow" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--f-blue)" stop-opacity=".20"/><stop offset="1" stop-color="var(--f-blue)" stop-opacity="0"/></linearGradient><pattern id="investment-bars" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="var(--f-expense)"/><path d="M-2 2L2-2M0 8L8 0M6 10L10 6" stroke="var(--f-panel)" stroke-width="1.5"/></pattern></defs><text x="0" y="15">${money(max)}</text><line x1="0" y1="${zero}" x2="600" y2="${zero}" stroke="var(--f-line)"/><path d="${path} L ${points[points.length-1].x} ${zero} L 20 ${zero} Z" fill="url(#investment-line-shadow)" opacity=".55"/><path class="investment-line" d="${path}" fill="none" stroke="var(--f-blue)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>${points.map((p,i)=>{const h=Math.abs(vals[i].net)/maxNet*60;return `<rect class="chart-hit" data-index="${i}" x="${i*50}" y="0" width="50" height="220" fill="transparent"/><rect class="chart-mark" data-index="${i}" x="${p.x-6}" y="${zero-h}" width="12" height="${h}" rx="3" fill="${p.net>0?'var(--f-income)':'url(#investment-bars)'}"/><circle class="chart-point" data-index="${i}" cx="${p.x}" cy="${y(p.value)}" r="4.5" fill="var(--f-blue)"/>`}).join('')}${points.map(p=>`<text x="${p.x}" y="220" text-anchor="middle">${p.label}</text>`).join('')}<line class="chart-guide" x1="20" y1="18" x2="20" y2="205" stroke="var(--f-blue)" stroke-dasharray="3 4"/></svg>`;
  return chartWrap(svg,points);
}
function render(){renderTime();const rs=selection(),inc=total(rs,'收入'),out=total(rs,'支出');const names={overview:'财务总览',analysis:'收支分析',invest:'投资记录',transactions:'全部交易',calendar:'收支日历'};$('#crumb').textContent=names[page];$('#title').textContent={overview:'让财务，清晰一点。',analysis:'每一笔，都有迹可循。',invest:'看清已记录的投资收支。',transactions:'每一笔，都在这里。',calendar:'收支，落在每一天。'}[page];$('#subtitle').textContent=`${selectedMonth.slice(0,period==='year'?4:7)} · ${page==='invest'?'投资':'日常'} · ${rs.length} 笔 · 账本截至 ${records[0]?.occurred_at.slice(0,10)||'暂无数据'}`;document.querySelectorAll('[data-page]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.page===page));document.querySelectorAll('[data-period]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.period===period));if(page==='calendar'){$('#content').innerHTML=renderCalendar(rs);return;}const stats=`<div class="f-stats">${[['收支差额',inc-out],['收入',inc],['支出',out]].map(([name,v])=>`<div class="f-stat"><div class="f-label">${name}${name==='收支差额'?`<span class="f-balance-state ${v>0?'f-income':v<0?'f-expense':''}">${rs.length?(v>0?'盈余':v<0?'超支':'收支平衡'):'暂无记录'}</span>`:''}</div><div class="f-num ${name==='收支差额'?(v>0?'f-income':v<0?'f-expense':''):directionClass(name)}">${money(v)}</div></div>`).join('')}</div>`;const structure=(dir=direction,showSwitcher=page==='overview')=>`<section class="f-panel"><div class="f-panelhead"><h2>${dir}构成</h2>${showSwitcher?`<div class="f-segment"><button data-direction="支出" aria-pressed="${dir==='支出'}">支出</button><button data-direction="收入" aria-pressed="${dir==='收入'}">收入</button></div>`:''}</div>${legend([dir])}${ranks(rs,dir)}</section>`;const details=category!==null?`<section class="f-panel f-bottom"><div class="f-panelhead"><h2>分类明细 · ${esc(rs.find(r=>r.category_id===category)?.category||'')}</h2><button data-close>收起</button></div>${table(rs.filter(r=>r.category_id===category&&r.direction===direction))}</section>`:'';$('#content').innerHTML=stats+(page==='transactions'?`<section class="f-panel">${table(rs)}</section>`:page==='overview'?`<div class="f-grid"><section class="f-panel"><div class="f-panelhead"><h2>${selectedMonth.slice(0,4)}年收支趋势</h2>${legend()}</div>${trend(rs)}${balanceChart(rs)}</section>${structure()}</div>${details}<section class="f-panel f-bottom"><div class="f-panelhead"><h2>最近收支</h2><button data-page="transactions">查看全部</button></div>${table(rs.slice(0,8))}</section>`:page==='analysis'?`<div class="f-grid f-analysis-grid">${structure('支出',false)}${structure('收入',false)}</div>${details}`:`<section class="f-panel"><div class="f-panelhead"><h2>${selectedMonth.slice(0,4)}年投资收支趋势</h2>${legend()}</div>${investmentTrend(rs)}</section><section class="f-panel f-bottom"><h2>投资交易记录</h2>${table(rs)}</section>`);}
document.addEventListener('click',e=>{let b=e.target instanceof Element?e.target.closest('button'):null;if(!b)return;if(b.dataset.day){selectCalendarDay(b.dataset.day);return;}if(b.dataset.page){closeDatePanel(false);if(b.dataset.page==='calendar')period='month';page=b.dataset.page;category=null;}else if(b.dataset.period){if(page==='calendar')return;closeDatePanel(false);period=b.dataset.period;category=null;}else if(b.dataset.direction){direction=b.dataset.direction;category=null;}else if(b.dataset.category){category=Number(b.dataset.category);}else if(b.hasAttribute('data-close'))category=null;else return;render();});

fetch('/api/ledger').then(r=>{if(!r.ok)throw Error();return r.json()}).then(rs=>{records=rs;updateDateBounds();selectedMonth=dateBounds?.max||localMonth();render()}).catch(()=>{$('#content').textContent='账本读取失败，请刷新重试。'});

function renderTime(){
  $('#time-picker .f-segment').hidden=page==='calendar';
  if(period==='month')selectedMonth=clampMonth(selectedMonth);
  const [year,month]=selectedMonth.split('-').map(Number);
  $('#date-trigger').disabled=!dateBounds;
  $('#date-trigger').textContent=period==='month'?`${year}年${month}月`:`${year}年`;
  $('#date-trigger').setAttribute('aria-label',`${$('#date-trigger').textContent}，点击选择${period==='month'?'月份':'年份'}`);
  document.querySelectorAll('[data-step]').forEach(b=>{
    const previous=Number(b.dataset.step)<0,value=selectedMonth.slice(0,period==='month'?7:4);
    b.setAttribute('aria-label',`${previous?'上一':'下一'}${period==='month'?'个月':'年'}`);
    b.disabled=!dateBounds||(previous?value<=dateBounds.min.slice(0,value.length):value>=dateBounds.max.slice(0,value.length));
    b.title=b.disabled?(dateBounds?(previous?'已到第一笔交易所在周期':'已到最新一笔交易所在周期'):'暂无交易'):'';
  });
}
function closeDatePanel(restore=true){
  $('#date-panel').hidden=true;
  $('#date-trigger').setAttribute('aria-expanded','false');
  if(restore)$('#date-trigger').focus();
}
function chooseDate(year,month){
  const candidate=`${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}`;
  if(!dateAllowed(candidate.slice(0,period==='month'?7:4)))return;
  selectedMonth=candidate;
  category=null;closeDatePanel();render();
}
function renderDatePanel(focusValue){
  const [year,month]=selectedMonth.split('-').map(Number),monthly=period==='month';
  const start=Math.min(9988,Math.max(1,Math.floor(browseYear/12)*12));
  const values=Array.from({length:12},(_,i)=>monthly?i+1:start+i);
  const minYear=Number(dateBounds?.min.slice(0,4)),maxYear=Number(dateBounds?.max.slice(0,4));
  const previousDisabled=!dateBounds||(monthly?browseYear:start)<=minYear;
  const nextDisabled=!dateBounds||(monthly?browseYear:start+11)>=maxYear;
  $('#date-panel').setAttribute('aria-label',monthly?'选择月份':'选择年份');
  $('#date-panel').innerHTML=`<div class="f-date-head"><strong>${monthly?`${browseYear}年`:`${start}–${start+11}年`}</strong><div><button class="f-time-arrow" data-browse="-1" ${previousDisabled?'disabled':''} aria-label="${monthly?'上一年':'前12年'}">‹</button><button class="f-time-arrow" data-browse="1" ${nextDisabled?'disabled':''} aria-label="${monthly?'下一年':'后12年'}">›</button></div></div><div class="f-date-grid">${values.map(v=>`<button data-date="${v}" ${dateAllowed(monthly?`${browseYear}-${String(v).padStart(2,'0')}`:String(v),monthly)?'':'disabled'} aria-pressed="${monthly?browseYear===year&&v===month:v===year}">${v}${monthly?'月':''}</button>`).join('')}</div><div class="f-date-footer"><button class="f-date-today" data-today ${dateAllowed(localMonth().slice(0,monthly?7:4),monthly)?'':'disabled title="当前周期不在账本日期范围内"'}>回到${monthly?'本月':'今年'}</button></div>`;
  if(focusValue!==undefined)($('#date-panel [data-date="'+focusValue+'"]:not(:disabled)')||$('#date-panel [aria-pressed=true]:not(:disabled)')||$('#date-panel [data-date]:not(:disabled)')).focus();
}
$('#date-trigger').addEventListener('click',()=>{
  if(!$('#date-panel').hidden){closeDatePanel();return;}
  browseYear=Number(selectedMonth.slice(0,4));$('#date-panel').hidden=false;
  $('#date-trigger').setAttribute('aria-expanded','true');renderDatePanel(null);
});
$('#time-picker').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b||b.disabled)return;
  const [year,month]=selectedMonth.split('-').map(Number);
  if(b.hasAttribute('data-step')){
    const step=Number(b.dataset.step),index=year*12+month-1+step;
    chooseDate(period==='year'?year+step:Math.floor(index/12),period==='year'?month:(index%12+12)%12+1);if(!b.disabled)b.focus();
  }else if(b.hasAttribute('data-browse')){
    browseYear=Math.max(1,Math.min(9999,browseYear+Number(b.dataset.browse)*(period==='month'?1:12)));
    const step=b.dataset.browse;renderDatePanel();
    const arrow=$('#date-panel [data-browse="'+step+'"]');
    (arrow.disabled?$('#date-panel [data-date]:not(:disabled)'):arrow).focus();
  }else if(b.hasAttribute('data-date')){
    chooseDate(period==='month'?browseYear:Number(b.dataset.date),period==='month'?Number(b.dataset.date):month);
  }else if(b.hasAttribute('data-today')){
    const [y,m]=localMonth().split('-').map(Number);chooseDate(y,period==='month'?m:month);
  }
});
document.addEventListener('click',e=>{if(!$('#date-panel').hidden&&!e.composedPath().includes($('#time-picker')))closeDatePanel(false)});
$('#time-picker').addEventListener('focusout',e=>{if(e.relatedTarget&&!$('#time-picker').contains(e.relatedTarget))closeDatePanel(false)});
$('#time-picker').addEventListener('keydown',e=>{
  if($('#date-panel').hidden)return;
  if(e.key==='Escape'){e.preventDefault();closeDatePanel();return;}
  if(!e.target.hasAttribute('data-date'))return;
  const buttons=[...document.querySelectorAll('[data-date]')],i=buttons.indexOf(e.target);
  const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-4,ArrowDown:4}[e.key];
  if(delta!==undefined){
    e.preventDefault();
    for(let n=1;n<=12;n++){const target=buttons[(i+delta*n+144)%12];if(!target.disabled){target.focus();break;}}
  }
  if(e.key==='Home'||e.key==='End'){e.preventDefault();const enabled=buttons.filter(b=>!b.disabled);enabled[e.key==='Home'?0:enabled.length-1]?.focus();}
});
document.addEventListener('pointermove',e=>{const target=e.target instanceof Element?e.target:null,wrap=target?.closest('[data-chart]');document.querySelectorAll('[data-chart]').forEach(w=>{if(w!==wrap){w.querySelector('.f-chart-tooltip')?.setAttribute('hidden','');w.querySelectorAll('.chart-point').forEach(p=>p.classList.remove('is-active'))}});if(!wrap)return;const mark=target.closest('.chart-hit,.chart-mark,.chart-point');if(!mark)return;const i=Number(mark.dataset.index),data=JSON.parse(wrap.dataset.points||'[]')[i];if(!data)return;wrap.querySelectorAll('.chart-point').forEach(p=>p.classList.toggle('is-active',Number(p.dataset.index)===i));const guide=wrap.querySelector('.chart-guide');if(guide)guide.setAttribute('x1',String(i*50+20)),guide.setAttribute('x2',String(i*50+20));const tip=wrap.querySelector('.f-chart-tooltip');const bits=data.income!==undefined?[data.label,`收入 ${money(data.income)}`,`支出 ${money(data.expense)}`]:[data.label,`${data.net!==undefined?'累计收益':'本月结余'} ${money(data.value)}`,...(data.net!==undefined?[`本月差额 ${money(data.net)}`]:[])];tip.innerHTML=bits.map((v,j)=>j?`<span>${esc(v)}</span>`:`<strong>${esc(v)}</strong>`).join('');tip.hidden=false;const rect=wrap.getBoundingClientRect(),svg=wrap.querySelector('svg').getBoundingClientRect();tip.style.left=`${((Number(mark.getAttribute('cx'))||Number(mark.getAttribute('x'))||0)/600*svg.width)-tip.offsetWidth/2+svg.left-rect.left}px`;tip.style.top='2px';});
document.addEventListener('pointerleave',e=>{const target=e.target instanceof Element?e.target:null,targetWrap=target?.closest('[data-chart]');targetWrap?.querySelector('.f-chart-tooltip')?.setAttribute('hidden','')},true);
renderTime();
