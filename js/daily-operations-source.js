(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./daily-operations-model.js'):root.DailyOperations);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.DailyOperationsSource=api;
})(typeof window==='undefined'?globalThis:window,function(M){
  'use strict';
  const sheetId='1E5QG7wP24MdiQuWP_lNtWjCkHpD6blt17ebDPV9zqmU';
  const sheetUrl=`https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
  function url(tab){
    const params=new URLSearchParams({tqx:'out:csv',gid:String(tab.gid),headers:'1',range:`A:${String.fromCharCode(64+tab.headers.length)}`,_ts:String(Date.now())});
    return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?${params}`;
  }
  function tableRows(data){
    if(data?.status==='error'||!Array.isArray(data?.table?.cols)||!Array.isArray(data?.table?.rows))throw Error(data?.errors?.map(e=>e.message||e.detailed_message).join('; ')||'รูปแบบข้อมูล Google Sheets ไม่ถูกต้อง');
    const headers=data.table.cols.map(c=>String(c.label||'').trim().toLowerCase());
    return data.table.rows.map(row=>Object.fromEntries(headers.map((h,i)=>{
      const cell=row.c?.[i],value=cell?.v;
      if(value===null||value===undefined)return [h,''];
      if(h==='date'){
        if(cell.f)return [h,cell.f];
        if(value instanceof Date)return [h,`${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`];
        const m=String(value).match(/^Date\((\d+),(\d+),(\d+)(?:,.*)?\)$/);
        if(m)return [h,`${m[1]}-${String(+m[2]+1).padStart(2,'0')}-${m[3].padStart(2,'0')}`];
      }
      return [h,value];
    }))).filter(r=>Object.values(r).some(v=>String(v).trim()!==''));
  }
  let callbackId=0;
  function loadJsonp(tab){
    return new Promise((resolve,reject)=>{
      const name=`__ghcc_daily_${Date.now()}_${++callbackId}`,script=document.createElement('script');
      script.dataset.dailySource=tab.key;
      const cleanup=()=>{clearTimeout(timer);script.remove();delete globalThis[name];};
      const timer=setTimeout(()=>{cleanup();reject(Error('เชื่อมต่อเกิน 15 วินาที'));},15000);
      globalThis[name]=data=>{
        try{const rows=tableRows(data),headers=data.table.cols.map(c=>String(c.label||'').trim().toLowerCase());cleanup();resolve({headers,rows});}
        catch(e){cleanup();reject(e);}
      };
      script.onerror=()=>{cleanup();reject(Error('โหลดข้อมูลจาก Google ไม่สำเร็จ ตรวจสอบเครือข่ายและสิทธิ์อ่านชีต'));};
      const target=new URL(url(tab));target.searchParams.set('tqx',`out:json;responseHandler:${name}`);
      script.src=target.href;document.head.append(script);
    });
  }
  async function load(fetcher){
    // Google CSV has no Access-Control-Allow-Origin. Use its supported JSONP
    // transport in browsers, while retaining CSV for Node and injected callers.
    const browserJsonp=fetcher===undefined&&typeof document!=='undefined';
    const fetchCsv=fetcher||globalThis.fetch;
    const parts=await Promise.all(M.tabs.map(async tab=>{
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
      try{
        let headers,rows;
        if(browserJsonp){({headers,rows}=await loadJsonp(tab));}
        else{
        const r=await fetchCsv(url(tab),{cache:'no-store',credentials:'omit',signal:controller.signal});
        if(!r.ok)throw Error(`HTTP ${r.status}`);
        const text=await r.text();rows=M.csv(text);
        headers=text.replace(/^\uFEFF/,'').split(/\r?\n/,1)[0].split(',').map(v=>v.trim().replace(/^"|"$/g,'').toLowerCase());
        }
        const legacyIPD=tab.key==='ipd'&&['date','meal','cuisine','qty'].every(h=>headers.includes(h));
        const required=tab.headers.filter(h=>!(tab.key==='ipd'&&h==='child')&&!(tab.key==='manpower'&&h==='other'));
        if(!legacyIPD&&required.some(h=>!headers.includes(h)))throw Error(`หัวคอลัมน์ไม่ครบ ต้องมี ${required.join(', ')}`);
        return [tab.key,rows];
      }catch(e){throw Error(`${tab.name}: ${e.name==='AbortError'?'เชื่อมต่อเกิน 15 วินาที':e.message}`);}
      finally{clearTimeout(timer);}
    }));
    return M.snapshot(Object.fromEntries(parts));
  }
  function createStore(fetcher){
    let pending=null;
    const store={snapshot:null,error:null,updatedAt:null,refresh(){
      if(pending)return pending;
      pending=load(fetcher).then(data=>{store.snapshot=data;store.error=null;store.updatedAt=new Date();}).catch(e=>{store.error=e.message;}).finally(()=>{pending=null;});
      return pending;
    }};return store;
  }
  return {sheetId,sheetUrl,url,tableRows,load,createStore};
});
