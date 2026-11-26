(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DailyOperations = api;
})(typeof window === 'undefined' ? globalThis : window, function() {
  'use strict';
  const IPD_TYPES=['TH','Child','West','Halal','JAP'];
  const TRAY_ITEMS=[
    ...[['Regular',''],['VIP',' VIP'],['TCH',' TCH'],['VIP (Suite)',' VIP (Suite)'],['Elite',' Elite(BIH) + Elite(Maternity)'],['Special Dinner',''],['Morgue',' อาหารเคารพศพ']].flatMap(([category,suffix])=>(category==='Special Dinner'?[['DN','Special Dinner']]:[['BF','Breakfast'],['LN','Lunch'],['DN','Dinner']]).map(([meal,name])=>({label:name+suffix,meal,category}))),
    {label:'White Egg',meal:'Extra',category:'White Egg'},
    {label:'อาหารฝึกกลืน Soft Meal',meal:'Extra',category:'Soft Meal'},
    {label:'อาหารฝึกกลืน',meal:'Extra',category:'Dysphagia Diet'}
  ];
  const tabs = [
    {key:'summary',name:'Daily Summary',gid:0,headers:['date','menu_day','structure','functional','occupied','non_thai']},
    {key:'ipd',name:'IPD Service',gid:101,headers:['date','meal','th','child','west','halal','jap']},
    {key:'trays',name:'Tray & Revenue',gid:102,headers:['date','item','qty','price']},
    {key:'feeding',name:'BD & Milk',gid:103,headers:['date','item','qty','unit_price']},
    {key:'manpower',name:'Manpower',gid:104,headers:['date','section','bf_revenue','ln_revenue','dn_revenue','other','manpower','total_revenue']},
    {key:'feedback',name:'Feedback',gid:105,headers:['date','section','feedback','status']}
  ];
  const keys={summary:['date'],ipd:['date','meal','cuisine'],trays:['date','item'],feeding:['date','item'],manpower:['date','section'],feedback:[]};
  const numeric={summary:['structure','functional','occupied','non_thai'],ipd:['qty'],trays:['qty','price'],feeding:['qty','unit_price'],manpower:['bf_revenue','ln_revenue','dn_revenue','other','manpower'],feedback:[]};
  function trayInput(raw){
    const match=TRAY_ITEMS.find(t=>t.label===raw.item)||TRAY_ITEMS.find(t=>t.category===raw.item&&t.meal===raw.meal);
    return {...raw,item:match?.label||raw.item,meal:match?.meal||raw.meal,price:Object.hasOwn(raw,'price')?raw.price:raw.unit_price};
  }
  function trayReport(d){return TRAY_ITEMS.map(t=>{const row=d.trayRows.find(r=>r.item===t.label);return {item:t.label,qty:row?.qty??null,price:row?.price??null};});}
  function number(value) {
    if(value===null || value===undefined || String(value).trim()==='') return null;
    const v=Number(String(value).trim().replace(/,/g,''));
    return Number.isFinite(v)?v:null;
  }
  function date(value) {
    const text=String(value??'').trim();
    let y,m,d,match;
    if((match=text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) [,y,m,d]=match.map(Number);
    else if((match=text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) {d=+match[1];m=+match[2];y=+match[3];}
    else return null;
    if(y>=2400) y-=543;
    if(y<1900 || y>2200) return null;
    const dt=new Date(Date.UTC(y,m-1,d));
    return dt.getUTCFullYear()===y && dt.getUTCMonth()===m-1 && dt.getUTCDate()===d ? dt.toISOString().slice(0,10):null;
  }
  function csv(input) {
    const text=String(input).replace(/^\uFEFF/,'');
    if(/^\s*</.test(text)) throw Error('ไม่ใช่ CSV หรือชีตต้องเข้าสู่ระบบ');
    const rows=[]; let row=[],cell='',quoted=false;
    for(let i=0;i<text.length;i++) {
      const c=text[i];
      if(c==='"') {if(quoted && text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
      else if(c===',' && !quoted){row.push(cell);cell='';}
      else if((c==='\n'||c==='\r')&&!quoted){row.push(cell);rows.push(row);row=[];cell='';if(c==='\r'&&text[i+1]==='\n')i++;}
      else cell+=c;
    }
    if(quoted) throw Error('CSV มีเครื่องหมายคำพูดไม่ครบ');
    if(cell || row.length){row.push(cell);rows.push(row);}
    if(!rows.length)return [];
    const headers=rows.shift().map(h=>h.trim().toLowerCase());
    if(!headers.includes('date')) throw Error('CSV ไม่มีหัวคอลัมน์ date');
    return rows.filter(r=>r.some(v=>v.trim()!=='')).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??''])));
  }
  function sum(values){const valid=values.filter(v=>v!==null && v!==undefined);return valid.length?valid.reduce((a,b)=>a+b,0):null;}
  function ipdRows(rows){
    return rows.flatMap((raw,index)=>{
      if(!IPD_TYPES.some(k=>Object.hasOwn(raw,k.toLowerCase())))return [raw];
      if(!Object.values(raw).some(v=>String(v??'').trim()!==''))return [];
      return IPD_TYPES.map(cuisine=>({date:raw.date,meal:raw.meal,cuisine,qty:raw[cuisine.toLowerCase()]??'',_sourceRow:index+2}));
    });
  }
  function snapshot(input) {
    const result={warnings:[],dates:[]}; const allDates=new Set();
    for(const tab of tabs){
      const seen=new Map(), duplicates=new Set();
      const rows=[];
      const source=tab.key==='ipd'?ipdRows(input.ipd||[]):tab.key==='trays'?(input.trays||[]).map(trayInput):input[tab.key]||[];
      for(const [index,raw] of source.entries()){
        if(!Object.values(raw).some(v=>String(v??'').trim()!==''))continue;
        const d=date(raw.date), label=`${tab.name} แถว ${raw._sourceRow||index+2}${tab.key==='ipd'?' ('+raw.cuisine+')':''}`;
        if(!d){result.warnings.push(`${label}: วันที่ไม่ถูกต้องหรือยังไม่ได้กรอก`);continue;}
        allDates.add(d);
        const r={...raw,date:d};
        if(keys[tab.key].some(k=>!String(raw[k]??'').trim())){result.warnings.push(`${label}: ระบุมื้อ/ประเภท/หน่วยงานให้ครบ`);continue;}
        if(tab.key==='feedback' && !String(raw.feedback??'').trim())continue;
        let invalid=false;
        for(const k of numeric[tab.key]){
          r[k]=number(raw[k]);
          if((r[k]===null && String(raw[k]??'').trim()!=='')||r[k]<0 || (['qty','manpower','structure','functional','occupied','non_thai'].includes(k) && r[k]!==null && !Number.isInteger(r[k]))){invalid=true;result.warnings.push(`${label}: ${k} ต้องเป็นตัวเลขไม่ติดลบ${k==='qty'?'จำนวนเต็ม':''}`);}
        }
        if(invalid)continue;
        if(['ipd','trays'].includes(tab.key) && !['BF','LN','DN',...(tab.key==='trays'?['Extra']:[])].includes(r.meal)){result.warnings.push(`${label}: มื้ออาหารไม่ถูกต้อง`);continue;}
        if(tab.key==='ipd'&&!IPD_TYPES.includes(r.cuisine)){result.warnings.push(`${label}: ประเภทอาหารไม่ถูกต้อง`);continue;}
        if(tab.key==='feeding'&&!['BD','Milk Feeding'].includes(r.item)){result.warnings.push(`${label}: ประเภท BD/Milk ไม่ถูกต้อง`);continue;}
        if(tab.key==='summary' && ((r.occupied!==null && r.functional!==null && r.occupied>r.functional)||(r.non_thai!==null && r.occupied!==null && r.non_thai>r.occupied))) result.warnings.push(`${label}: ตรวจสอบจำนวน Occupied / Functional / Non-Thai`);
        delete r.revenue;
        if(tab.key==='manpower')r.total_revenue=sum([r.bf_revenue,r.ln_revenue,r.dn_revenue,r.other]);
        const key=JSON.stringify(keys[tab.key].map(k=>String(r[k]).trim()));
        if(keys[tab.key].length && seen.has(key)){duplicates.add(key);result.warnings.push(`${label}: พบรายการซ้ำวันที่/ประเภทเดียวกัน กรุณารวมเป็นแถวเดียว`);}
        seen.set(key,true); rows.push({...r,_key:key});
      }
      result[tab.key]=rows.filter(r=>!keys[tab.key].length||!duplicates.has(r._key));
    }
    result.dates=[...allDates].sort();return result;
  }
  function day(s,d){
    const records=Object.fromEntries(tabs.map(t=>[t.key,s[t.key].filter(r=>r.date===d)]));
    const bed=records.summary[0]||{};
    const ratio=(a,b)=>a!==undefined&&a!==null&&b>0?a/b*100:null;
    const trays=records.trays.filter(r=>r.meal!=='Extra');
    const partial=tabs.some(t=>!records[t.key].length && t.key!=='feedback') || tabs.some(t=>records[t.key].some(r=>numeric[t.key].some(k=>r[k]===null))) || s.warnings.length>0;
    return {...records,bed,partial,trayRows:records.trays,trayQtyTotal:sum(records.trays.map(r=>r.qty)),trayPriceTotal:sum(records.trays.map(r=>r.price)),manpowerRows:records.manpower,trays:sum(trays.map(r=>r.qty)),supplements:sum(records.trays.filter(r=>r.meal==='Extra').map(r=>r.qty)),occupancy:ratio(bed.occupied,bed.functional),nonThaiShare:ratio(bed.non_thai,bed.occupied),available:bed.functional!=null&&bed.occupied!=null?Math.max(0,bed.functional-bed.occupied):null,ipdTotal:sum(records.ipd.map(r=>r.qty)),manpower:sum(records.manpower.map(r=>r.manpower)),sectionRevenue:sum(records.manpower.map(r=>r.total_revenue))};
  }
  function priorDay(d){const dt=new Date(d+'T00:00:00Z');dt.setUTCDate(dt.getUTCDate()-1);return dt.toISOString().slice(0,10);}
  function comparison(s,d,key){const p=priorDay(d);if(!s.dates.includes(p))return null;const a=day(s,d)[key],b=day(s,p)[key];return a!==null&&b>0?(a-b)/b*100:null;}
  function windowDates(s,d,n){const start=new Date(d+'T00:00:00Z');start.setUTCDate(start.getUTCDate()-n+1);const lower=start.toISOString().slice(0,10);return s.dates.filter(v=>v>=lower&&v<=d);}
  function chooseDate(s,selected,followLatest){return followLatest||!selected?s.dates.at(-1)||'':selected;}
  function combinedRevenue(d){
    const feeding=sum(d.feeding.map(r=>r.unit_price)),manpower=d.sectionRevenue;
    return {feeding,manpower,total:feeding===null||manpower===null?null:feeding+manpower};
  }
  function summarizePeriod(s,start,end){
    start=date(start);end=date(end);
    if(!start||!end||start>end)return null;
    const rowsByDate=new Map();
    function add(records,source){
      for(const r of records){
        if(r.date<start||r.date>end)continue;
        if(!rowsByDate.has(r.date))rowsByDate.set(r.date,{feeding:[],manpower:[]});
        rowsByDate.get(r.date)[source].push(r);
      }
    }
    add(s.feeding,'feeding');add(s.manpower,'manpower');
    const rows=[...rowsByDate.keys()].sort().map(date=>{
      const {feeding,manpower}=rowsByDate.get(date);
      const revenue=combinedRevenue({feeding,sectionRevenue:sum(manpower.map(r=>r.total_revenue))});
      return {date,...revenue,staff:sum(manpower.map(r=>r.manpower))};
    });
    const revenue=rows.filter(r=>r.total!==null),staff=rows.filter(r=>r.staff!==null);
    const days=(Date.parse(end)-Date.parse(start))/86400000+1;
    return {rows,days,revenueDays:revenue.length,staffDays:staff.length,revenue:sum(revenue.map(r=>r.total)),staff:sum(staff.map(r=>r.staff))};
  }
  function chartData(s,end,count,kind,metric='qty',section='all'){
    const dates=[];
    if(end){const dt=new Date(end+'T00:00:00Z');dt.setUTCDate(dt.getUTCDate()-count+1);for(let i=0;i<count;i++){dates.push(dt.toISOString().slice(0,10));dt.setUTCDate(dt.getUTCDate()+1);}}
    const days=dates.map(d=>day(s,d));
    const line=(label,get)=>({label,values:days.map(get)});
    if(kind==='occupancy')return {dates,unit:'%',series:[line('Occupancy Rate',d=>d.occupancy)]};
    if(kind==='ipd')return {dates,unit:'ถาด',series:IPD_TYPES.map(c=>line(c,d=>sum(d.ipd.filter(r=>r.cuisine===c).map(r=>r.qty))))};
    if(kind==='feeding')return {dates,unit:metric==='amount'?'บาท':'ชุด / ถุง',series:['BD','Milk Feeding'].map(item=>line(item,d=>sum(d.feeding.filter(r=>r.item===item).map(r=>metric==='amount'?r.unit_price:r.qty))))};
    if(kind==='trays')return {dates,unit:metric==='amount'?'บาท':'ชุด',series:[...new Set(TRAY_ITEMS.map(t=>t.category))].map(category=>line(({Morgue:'อาหารเคารพศพ','Soft Meal':'อาหารฝึกกลืน Soft Meal','Dysphagia Diet':'อาหารฝึกกลืน'})[category]||category,d=>sum(d.trayRows.filter(r=>TRAY_ITEMS.find(t=>t.label===r.item)?.category===category).map(r=>metric==='amount'?r.price:r.qty))))};
    if(kind==='sectionRevenue'||kind==='people')return {dates,unit:kind==='people'?'คน':'บาท',series:[line(kind==='people'?'Manpower':'Revenue',d=>sum(d.manpowerRows.filter(r=>section==='all'||r.section===section).map(r=>kind==='people'?r.manpower:r.total_revenue)))]};
    if(kind==='combinedRevenue')return {dates,unit:'บาท',series:[line('BD & Milk',d=>combinedRevenue(d).feeding),line('Manpower',d=>combinedRevenue(d).manpower),line('Total',d=>combinedRevenue(d).total)]};
    return {dates,unit:'',series:[]};
  }
  return {IPD_TYPES,TRAY_ITEMS,trayInput,trayReport,tabs,number,date,csv,sum,snapshot,day,priorDay,comparison,windowDates,chooseDate,chartData,combinedRevenue,summarizePeriod};
});
