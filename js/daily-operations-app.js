(function(){
  'use strict';
  const M=window.DailyOperations,S=window.DailyOperationsSource,store=S.createStore();
  const $=id=>document.getElementById(id);
  let selected='',followLatest=true,customPeriod=false;
  const mealNames={BF:'Breakfast',LN:'Lunch',DN:'Dinner',Extra:'รายการเสริม'};
  const fmt=(v,digits=0)=>v===null||v===undefined?'—':new Intl.NumberFormat('th-TH',{maximumFractionDigits:digits,minimumFractionDigits:digits}).format(v);
  const money=v=>fmt(v,2);
  const percent=v=>v===null?'—':fmt(v,1)+'%';
  const dateLabel=d=>d?new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Bangkok'}).format(new Date(d+'T00:00:00+07:00')):'ยังไม่มีข้อมูล';
  function el(tag,text,className){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;}
  function metrics(id,cards){
    $(id).replaceChildren(...cards.map(c=>{
      const card=el('article',undefined,'metric-card glass');
      card.append(el('span',c.label,'metric-label'),el('strong',c.value,'metric-value'),el('span',c.note||'','metric-note'));
      if(c.delta)card.append(el('span',c.delta,'metric-delta'));
      return card;
    }));
  }
  function table(id,headers,rows,numeric=[],wrap=[]){
    if(!rows.length){
      const key=({bedTable:'summary',ipdTable:'ipd',feedTable:'feeding',manpowerTable:'manpower',feedbackTable:'feedback'})[id];
      const latest=key&&store.snapshot?[...new Set(store.snapshot[key].map(r=>r.date))].sort().at(-1):null;
      const message=selected?`ยังไม่มีข้อมูลวันที่ ${dateLabel(selected)}${latest?' · หมวดนี้มีข้อมูลล่าสุด '+dateLabel(latest):''}`:'ยังไม่มีข้อมูลของวันที่เลือก';
      $(id).replaceChildren(el('div',message,'table-empty'));return;
    }
    const scroll=el('div',undefined,'table-scroll'),t=el('table'),head=el('thead'),tr=el('tr');
    headers.forEach(h=>{const th=el('th',h);th.scope='col';tr.append(th);});head.append(tr);t.append(head);
    const body=el('tbody');
    for(const row of rows){const tr=el('tr');row.forEach((value,i)=>{
      const td=el('td',value===null||value===undefined||value===''?'—':String(value));
      if(numeric.includes(i))td.classList.add('num');if(wrap.includes(i))td.classList.add('wrap');tr.append(td);
    });body.append(tr);}
    t.append(body);scroll.append(t);$(id).replaceChildren(scroll);
  }
  function svgEl(tag,attrs={},text){const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));if(text!==undefined)n.textContent=text;return n;}
  function trend(id,s,key,unit,color){
    const count=+$('rangeSelect').value,dates=[];
    if(selected){let d=new Date(selected+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-count+1);for(let i=0;i<count;i++){dates.push(d.toISOString().slice(0,10));d.setUTCDate(d.getUTCDate()+1);}}
    const values=dates.map(d=>s.dates.includes(d)?M.day(s,d)[key]:null);
    const valid=values.filter(v=>v!==null);
    if(!valid.length){$(id).replaceChildren(el('div','ยังไม่มีข้อมูลในช่วงวันที่เลือก','chart-empty'));return;}
    const max=Math.max(...valid,1)*1.12,w=650,h=260,left=65,right=20,top=18,bottom=35;
    const x=i=>left+i*(w-left-right)/(count-1),y=v=>h-bottom-v/max*(h-top-bottom);
    const svg=svgEl('svg',{viewBox:`0 0 ${w} ${h}`,role:'img','aria-label':`${unit} ${count} วัน สิ้นสุด ${selected}`});
    svg.append(svgEl('title',{},`${unit} ตามข้อมูลที่กรอก ช่องว่างหมายถึงไม่มีข้อมูล`));
    for(let i=0;i<4;i++){const value=max*i/3,yy=y(value);svg.append(svgEl('line',{x1:left,x2:w-right,y1:yy,y2:yy,stroke:'#10294f13','stroke-dasharray':'3 4'}),svgEl('text',{x:left-10,y:yy+4,'text-anchor':'end'},fmt(value)));}
    let segment=[];
    const flush=()=>{if(segment.length>1)svg.append(svgEl('polyline',{points:segment.join(' '),fill:'none',stroke:color,'stroke-width':3,'stroke-linecap':'round','stroke-linejoin':'round'}));segment=[];};
    values.forEach((v,i)=>{if(v===null){flush();return;}segment.push(`${x(i)},${y(v)}`);});flush();
    values.forEach((v,i)=>{if(v===null)return;const c=svgEl('circle',{cx:x(i),cy:y(v),r:4,fill:color,stroke:'#fff','stroke-width':2,tabindex:0,'aria-label':`${dates[i]}: ${fmt(v,1)} ${unit}`});c.append(svgEl('title',{},`${dateLabel(dates[i])}: ${fmt(v,1)} ${unit}`));svg.append(c);});
    const step=count<=7?1:Math.ceil(count/5);
    dates.forEach((d,i)=>{if(i%step!==0&&i!==count-1)return;if(i===count-1&&(count-1)%step<2&&i%step!==0)return;svg.append(svgEl('text',{x:x(i),y:h-9,'text-anchor':'middle'},d.slice(8)+'/'+d.slice(5,7)));});
    $(id).replaceChildren(svg);
  }
  function bars(id,entries){
    const max=Math.max(...entries.map(e=>e.value??0),1);
    if(entries.every(e=>e.value===null)){$(id).replaceChildren(el('div','ยังไม่มีจำนวนอาหารของวันที่เลือก','table-empty'));return;}
    $(id).replaceChildren(...entries.map(e=>{
      const row=el('div',undefined,'bar-row'),track=el('div',undefined,'bar-track'),fill=el('div',undefined,'bar-fill');
      fill.style.width=((e.value??0)/max*100)+'%';track.append(fill);row.append(el('span',e.label),track,el('strong',fmt(e.value)));return row;
    }));
  }
  const hiddenSeries=new Map();
  const chartColors=['#0b3474','#b38a3e','#b4232f','#15806a','#7c53a5','#ce6a19','#486578','#4285b4','#8c564b','#ae4b7a'];
  function multiTrend(id,config){
    const {dates,series,unit}=config,count=dates.length;
    if(!hiddenSeries.has(id))hiddenSeries.set(id,new Set());
    const hidden=hiddenSeries.get(id),host=$(id),legend=el('div',undefined,'chart-legend');
    series.forEach((s,i)=>{
      const button=el('button',undefined,'legend-button'),swatch=el('span',undefined,'legend-swatch');
      button.type='button';button.setAttribute('aria-pressed',String(!hidden.has(s.label)));swatch.style.background=chartColors[i%chartColors.length];
      button.append(swatch,el('span',s.label));button.addEventListener('click',()=>{if(hidden.has(s.label))hidden.delete(s.label);else hidden.add(s.label);multiTrend(id,config);});legend.append(button);
    });
    const active=series.map((s,i)=>({...s,color:chartColors[i%chartColors.length]})).filter(s=>!hidden.has(s.label));
    const values=active.flatMap(s=>s.values).filter(v=>v!==null);
    const plot=el('div',undefined,'chart-scroll');
    if(values.length){
      const raw=Math.max(...values,1),base=10**Math.floor(Math.log10(raw/4)),step=([1,2,5,10].find(v=>v*base>=raw/4)||10)*base;
      const max=unit==='%'&&raw<=100?100:Math.ceil(raw/step)*step;
      const w=1100,h=330,left=76,right=22,top=22,bottom=count>14?65:42;
      const x=i=>left+i*(w-left-right)/Math.max(count-1,1),y=v=>h-bottom-v/max*(h-top-bottom);
      const svg=svgEl('svg',{viewBox:`0 0 ${w} ${h}`,role:'img','data-days':count,'aria-label':`${unit} เปรียบเทียบรายวัน ${count} วัน สิ้นสุด ${selected}`});
      svg.append(svgEl('title',{},`เปรียบเทียบ ${series.map(s=>s.label).join(', ')} · ${unit} · วันที่ไม่กรอกเว้นว่าง`));
      for(let i=0;i<=4;i++){const v=max*i/4,yy=y(v);svg.append(svgEl('line',{x1:left,x2:w-right,y1:yy,y2:yy,stroke:'#10294f16','stroke-dasharray':'3 4'}),svgEl('text',{x:left-12,y:yy+4,'text-anchor':'end'},fmt(v,unit==='%'?0:(max<4?1:0))));}
      svg.append(svgEl('text',{x:12,y:12},unit));
      active.forEach(s=>{
        let points=[];
        const flush=()=>{if(points.length>1)svg.append(svgEl('polyline',{points:points.join(' '),fill:'none',stroke:s.color,'stroke-width':2.5,'stroke-linecap':'round','stroke-linejoin':'round'}));points=[];};
        s.values.forEach((v,i)=>{if(v===null){flush();return;}points.push(`${x(i)},${y(v)}`);});flush();
        s.values.forEach((v,i)=>{if(v===null)return;const label=`${dateLabel(dates[i])} · ${s.label}: ${fmt(v,unit==='บาท'?2:unit==='%'?1:0)} ${unit}`;
          const point=svgEl('circle',{cx:x(i),cy:y(v),r:count>14?3.8:5,fill:s.color,stroke:'#fff','stroke-width':1.5,tabindex:0,'aria-label':label});point.append(svgEl('title',{},label));svg.append(point);
        });
      });
      dates.forEach((d,i)=>{const xx=x(i),yy=h-bottom+20;svg.append(svgEl('text',{x:xx,y:yy,'text-anchor':count>14?'end':'middle',...(count>14?{transform:`rotate(-50 ${xx} ${yy})`}:{})},`${d.slice(8)}/${d.slice(5,7)}`));});
      plot.append(svg);
    }else plot.append(el('div',series.some(s=>s.values.some(v=>v!==null))?'เลือกประเภทจากปุ่มด้านบนเพื่อแสดงกราฟ':'ยังไม่มีข้อมูลในช่วงวันที่เลือก','chart-empty'));
    const actualDays=dates.filter((_,i)=>series.some(s=>s.values[i]!==null)).length;
    const note=el('p',`มีข้อมูล ${actualDays} / ${count||+$('rangeSelect').value} วัน · วันที่ไม่กรอกเว้นว่าง · คลิกชื่อเพื่อเปิด/ปิดเส้นกราฟ`,'chart-footnote');
    const detail=el('details',undefined,'chart-data'),summary=el('summary','ดูตัวเลขรายวัน');detail.append(summary);
    const scroll=el('div',undefined,'table-scroll'),t=el('table'),head=el('thead'),hr=el('tr');
    ['วันที่',...series.map(s=>s.label+' ('+unit+')')].forEach(label=>{const th=el('th',label);th.scope='col';hr.append(th);});head.append(hr);t.append(head);
    const body=el('tbody');dates.forEach((d,i)=>{const row=el('tr');row.append(el('td',dateLabel(d)));series.forEach(s=>row.append(el('td',fmt(s.values[i],unit==='บาท'?2:unit==='%'?1:0),'num')));body.append(row);});t.append(body);scroll.append(t);detail.append(scroll);
    host.replaceChildren(legend,plot,note,detail);
  }
  function renderOverviewCharts(s){
    const count=+$('rangeSelect').value;
    const chart=(id,kind,metric='qty',section='all')=>multiTrend(id,M.chartData(s,selected,count,kind,metric,section));
    chart('occupancyOverview','occupancy');chart('ipdOverview','ipd');
    chart('feedingOverview','feeding',$('feedingChartMetric').value);chart('trayTrend','trays',$('trayChartMetric').value);
    chart('sectionRevenueOverview','sectionRevenue','qty',$('chartSection').value);chart('peopleOverview','people','qty',$('chartSection').value);
    const dates=M.chartData(s,selected,count,'occupancy').dates;
    $('chartRangeCaption').textContent=selected?`${count} วัน · ${dateLabel(dates[0])} – ${dateLabel(selected)} · ช่วงเดียวกันทั้ง 5 หมวด`:'เลือกช่วง 7 / 14 / 30 วัน · รอข้อมูลวันแรก';
  }
  function renderPeriod(s){
    if(!customPeriod){
      $('totalStart').value=selected?selected.slice(0,7)+'-01':'';
      $('totalEnd').value=selected;
    }
    const start=$('totalStart').value,end=$('totalEnd').value;
    const period=M.summarizePeriod(s,start,end);
    $('totalPeriodStatus').textContent=!period
      ? start&&end?'วันเริ่มต้นต้องไม่อยู่หลังวันสิ้นสุด':'เลือกวันเริ่มต้นและวันสิ้นสุด'
      : `ช่วง ${dateLabel(start)} ถึง ${dateLabel(end)} · รายได้มีทั้งสองฝั่ง ${period.revenueDays}/${period.days} วัน · มีจำนวนคน ${period.staffDays}/${period.days} วัน`;
    if(!period){
      $('totalPeriodMetrics').replaceChildren();$('totalPeriodTable').replaceChildren();return;
    }
    metrics('totalPeriodMetrics',[
      {label:'รายได้รวมตามช่วง',value:money(period.revenue),note:'บาท · นับเฉพาะวันที่มีรายได้ทั้งสองฝั่ง'},
      {label:'กำลังคนสะสม',value:fmt(period.staff),note:'คน-วัน · รวมจำนวนคนรายวัน ไม่ใช่จำนวนคนไม่ซ้ำ'}
    ]);
    table('totalPeriodTable',['วันที่','BD & Milk (บาท)','Manpower (บาท)','Total (บาท)','จำนวนคน'],
      period.rows.map(r=>[dateLabel(r.date),money(r.feeding),money(r.manpower),money(r.total),fmt(r.staff)]),[1,2,3,4]);
  }
  function render(){
    const s=store.snapshot||M.snapshot({});
    if(!s.dates.length)selected='';
    else selected=M.chooseDate(s,selected,followLatest);
    const select=$('reportDateSelect');
    const dates=[...s.dates].reverse();if(selected&&!dates.includes(selected))dates.unshift(selected);
    select.replaceChildren(...(dates.length?dates:['']).map(d=>{const o=el('option',d?dateLabel(d):'ยังไม่มีข้อมูล');o.value=d;return o;}));
    select.disabled=!s.dates.length;select.value=selected;
    $('reportDate').textContent=dateLabel(selected);
    const d=M.day(s,selected);
    $('menuDay').textContent=d.bed.menu_day?`Menu: ${d.bed.menu_day}`:selected?'ข้อมูลของวันที่เลือก':'รอรายงานวันแรก';
    $('emptyNotice').hidden=!store.snapshot||s.dates.length>0;
    $('dataWarnings').hidden=s.warnings.length===0;
    $('warningTitle').textContent=`ตรวจสอบข้อมูลในชีต ${s.warnings.length} รายการ`;
    $('warningList').replaceChildren(...s.warnings.slice(0,100).map(w=>el('li',w)));
    if(s.warnings.length>100)$('warningList').append(el('li',`และอีก ${s.warnings.length-100} รายการ`));
    $('completeness').textContent=!selected?'รอข้อมูล':d.partial?'ข้อมูลบางส่วน · ยอดตามที่กรอก':'มีข้อมูลทุกหมวด';
    const delta=(key)=>{const v=selected?M.comparison(s,selected,key):null;return v===null?'ไม่มีข้อมูลเทียบวันก่อน':`${v>0?'+':''}${fmt(v,1)}% เทียบวันก่อน · ตามที่กรอก`;};
    metrics('overviewMetrics',[
      {label:'จำนวนถาดอาหาร',value:fmt(d.trays),note:'BF + LN + DN · ไม่รวมเสริม',delta:delta('trays')},
      {label:'IPD Service',value:fmt(d.ipdTotal),note:'ถาด · รวมประเภทอาหารที่กรอก'},
      {label:'Occupied',value:fmt(d.bed.occupied),note:'เตียงที่มีผู้ป่วย'},
      {label:'Occupancy Rate',value:percent(d.occupancy),note:'Occupied ÷ Functional'},
      {label:'Manpower',value:fmt(d.manpower),note:'คน · รวมหน่วยงานที่กรอก'},
      {label:'Non-Thai',value:fmt(d.bed.non_thai),note:`สัดส่วน ${percent(d.nonThaiShare)} ของ Occupied`}
    ]);
    renderOverviewCharts(s);trend('bedTrend',s,'occupancy','%','#0b3474');
    bars('mealBars',['BF','LN','DN'].map(meal=>({label:mealNames[meal],value:M.sum(d.trayRows.filter(r=>r.meal===meal).map(r=>r.qty))})));
    const prev=selected&&s.dates.includes(M.priorDay(selected))?M.day(s,M.priorDay(selected)):null;
    table('comparison',['ตัวชี้วัด','วันที่เลือก','วันก่อนหน้า'],[['ถาดอาหาร',fmt(d.trays),fmt(prev?.trays)],['IPD Service',fmt(d.ipdTotal),fmt(prev?.ipdTotal)],['Occupied',fmt(d.bed.occupied),fmt(prev?.bed.occupied)]],[1,2]);
    metrics('bedMetrics',[
      {label:'Structure',value:fmt(d.bed.structure),note:'จำนวนเตียงโครงสร้าง'},{label:'Functional',value:fmt(d.bed.functional),note:'จำนวนเตียงที่เปิดใช้งาน'},
      {label:'Occupied',value:fmt(d.bed.occupied),note:'จำนวนเตียงที่มีผู้ป่วย'},{label:'Occupancy Rate',value:percent(d.occupancy),note:'Occupied ÷ Functional'},
      {label:'Available Beds',value:fmt(d.available),note:'Functional − Occupied'},{label:'Non-Thai',value:fmt(d.bed.non_thai),note:`Non-Thai Share ${percent(d.nonThaiShare)}`}
    ]);
    table('bedTable',['Structure','Functional','Occupied','Occupancy','Non-Thai','Non-Thai Share'],d.summary.length?[[fmt(d.bed.structure),fmt(d.bed.functional),fmt(d.bed.occupied),percent(d.occupancy),fmt(d.bed.non_thai),percent(d.nonThaiShare)]]:[],[0,1,2,3,4,5]);
    metrics('ipdMetrics',['BF','LN','DN'].map(meal=>({label:mealNames[meal],value:fmt(M.sum(d.ipd.filter(r=>r.meal===meal).map(r=>r.qty))),note:'ยอดจาก IPD Service · ถาด'})));
    const cuisines=M.IPD_TYPES;
    table('ipdTable',['ประเภท','Breakfast','Lunch','Dinner','รวมตามที่กรอก'],d.ipd.length?cuisines.map(c=>{const vals=['BF','LN','DN'].map(m=>M.sum(d.ipd.filter(r=>r.cuisine===c&&r.meal===m).map(r=>r.qty)));return [c,...vals.map(v=>fmt(v)),fmt(M.sum(vals))];}):[],[1,2,3,4]);
    metrics('trayMetrics',[{label:'QTY รวม',value:fmt(d.trayQtyTotal),note:'รวมทุกรายการและรายการเสริม'},{label:'Price รวม',value:money(d.trayPriceTotal),note:'บาท · รวมยอดเงินที่กรอกเอง'},{label:'รายการที่บันทึก',value:selected?fmt(d.trayRows.length):'—',note:`จากทั้งหมด ${M.TRAY_ITEMS.length} รายการ`}]);
    $('trayItemCount').textContent=`${M.TRAY_ITEMS.length} รายการ`;
    table('trayTable',['Item','QTY','Price'],[...M.trayReport(d).map(r=>[r.item,fmt(r.qty),money(r.price)]),['Total',fmt(d.trayQtyTotal),money(d.trayPriceTotal)]],[1,2]);
    $('trayTable').classList.add('tray-report');
    $('trayDateBadge').textContent=dateLabel(selected);
    $('trayTable').querySelectorAll('tbody tr').forEach((row,i)=>{
      if(i<M.TRAY_ITEMS.length&&(i===0||M.TRAY_ITEMS[i].category!==M.TRAY_ITEMS[i-1].category))row.classList.add('tray-group-start');
      if(i===M.TRAY_ITEMS.length)row.classList.add('tray-total');
    });
    multiTrend('trayQuantityDetail',M.chartData(s,selected,+$('rangeSelect').value,'trays','qty'));
    multiTrend('trayAmountDetail',M.chartData(s,selected,+$('rangeSelect').value,'trays','amount'));
    metrics('feedMetrics',[...['BD','Milk Feeding'].map(item=>({label:item,value:fmt(M.sum(d.feeding.filter(r=>r.item===item).map(r=>r.qty))),note:'จำนวนตามที่กรอก'})),{label:'รายการที่บันทึก',value:selected?fmt(d.feeding.length):'—',note:'จำนวนแถวของวันที่เลือก'}]);
    table('feedTable',['รายการ','จำนวน','ยอดเงินที่กรอก (บาท)'],d.feeding.map(r=>[r.item,fmt(r.qty),money(r.unit_price)]),[1,2]);
    metrics('manpowerMetrics',[{label:'บุคลากร',value:fmt(d.manpower),note:'คน · รวมหน่วยงานที่กรอก'},{label:'รายได้หน่วยงาน',value:money(d.sectionRevenue),note:'บาท · แสดงแยก ไม่บวกซ้ำรายได้อาหาร'},{label:'รายได้ต่อคน',value:money(d.sectionRevenue!==null&&d.manpower>0?d.sectionRevenue/d.manpower:null),note:'บาท/คน · จากข้อมูลหน่วยงานที่กรอก'}]);
    table('manpowerTable',['หน่วยงาน','BF (บาท)','LN (บาท)','DN (บาท)','Other (บาท)','รวมตามที่กรอก','บุคลากร'],d.manpowerRows.map(r=>[r.section,money(r.bf_revenue),money(r.ln_revenue),money(r.dn_revenue),money(r.other),money(r.total_revenue),fmt(r.manpower)]),[1,2,3,4,5,6]);
    const revenue=M.combinedRevenue(d);
    metrics('totalMetrics',[
      {label:'BD & Milk',value:money(revenue.feeding),note:'บาท · รวม BD และ Milk Feeding'},
      {label:'รายได้ต่อวัน',value:money(revenue.manpower),note:'บาท · รายได้รวมทุกหน่วยงาน'},
      {label:'BD+Milk + รายได้ต่อวัน',value:money(revenue.total),note:revenue.total===null?'รอยอดเงินจากทั้งสองหมวด':'บาท · รวมยอดเงินจากทั้งสองหมวด'},
      {label:'จำนวนคนของวัน',value:fmt(d.manpower),note:'คน · จาก Manpower คอลัมน์ G'}
    ]);
    renderPeriod(s);
    multiTrend('totalRevenueTrend',M.chartData(s,selected,+$('rangeSelect').value,'combinedRevenue'));
    metrics('feedbackMetrics',[{label:'บันทึกทั้งหมด',value:selected?fmt(d.feedback.length):'—',note:'รายการที่บันทึกในวันที่เลือก'},{label:'รอดำเนินการ / ติดตาม',value:selected?fmt(d.feedback.filter(r=>r.status!=='Resolved').length):'—',note:'รายการที่ยังไม่ระบุ Resolved'},{label:'Resolved',value:selected?fmt(d.feedback.filter(r=>r.status==='Resolved').length):'—',note:'รายการที่ระบุว่าแก้ไขแล้ว'}]);
    table('feedbackTable',['หน่วยงาน','รายละเอียด','สถานะ'],d.feedback.map(r=>[r.section,r.feedback,r.status]),[],[1]);
  }
  async function refresh(){
    $('refreshButton').disabled=true;$('refreshButton').textContent='กำลังโหลด…';$('reportBody').setAttribute('aria-busy','true');
    try{
      await store.refresh();render();
      $('loadError').hidden=!store.error;
      if(store.error){
        $('errorTitle').textContent=store.snapshot?'แสดงข้อมูลเดิม — อัปเดตล่าสุดไม่สำเร็จ':'ยังเชื่อมต่อชีตไม่ได้';
        $('errorMessage').textContent=store.error+' · ตรวจสอบอินเทอร์เน็ตและสิทธิ์อ่านชีต แล้วกดรีเฟรชอีกครั้ง';
      }
      $('syncStatus').classList.toggle('stale',!!store.error);
      $('syncStatus').textContent=store.updatedAt?`${store.error?'ข้อมูลเดิม · ':''}ดึงข้อมูลสำเร็จล่าสุด ${new Intl.DateTimeFormat('th-TH',{dateStyle:'short',timeStyle:'medium',timeZone:'Asia/Bangkok'}).format(store.updatedAt)}`:'ยังไม่ได้รับข้อมูลจาก Google Sheets';
    }finally{$('refreshButton').disabled=false;$('refreshButton').textContent='รีเฟรชข้อมูล';$('reportBody').setAttribute('aria-busy','false');}
  }
  function activate(view){
    document.querySelectorAll('[data-view]').forEach(button=>{const on=button.dataset.view===view;button.setAttribute('aria-selected',String(on));button.tabIndex=on?0:-1;$('view-'+button.dataset.view).hidden=!on;});
  }
  const buttons=[...document.querySelectorAll('[data-view]')];
  buttons.forEach((b,i)=>{
    b.addEventListener('click',()=>activate(b.dataset.view));
    b.addEventListener('keydown',e=>{
      let next;if(e.key==='ArrowRight')next=(i+1)%buttons.length;else if(e.key==='ArrowLeft')next=(i-1+buttons.length)%buttons.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=buttons.length-1;else return;
      e.preventDefault();activate(buttons[next].dataset.view);buttons[next].focus();
    });
  });
  $('reportDateSelect').addEventListener('change',e=>{selected=e.target.value;followLatest=false;render();});
  $('rangeSelect').addEventListener('change',render);
  ['feedingChartMetric','trayChartMetric','chartSection'].forEach(id=>$(id).addEventListener('change',render));
  $('latestButton').addEventListener('click',()=>{followLatest=true;render();});
  $('refreshButton').addEventListener('click',refresh);
  $('printButton').addEventListener('click',()=>window.print());
  ['totalStart','totalEnd'].forEach(id=>$(id).addEventListener('change',()=>{customPeriod=true;renderPeriod(store.snapshot||M.snapshot({}));}));
  $('totalReset').addEventListener('click',()=>{customPeriod=false;renderPeriod(store.snapshot||M.snapshot({}));});
  render();refresh();
  setInterval(()=>{if(!document.hidden)refresh();},30000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
})();
