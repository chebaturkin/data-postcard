import { parseDate, parseNumber } from './data.js';
import { THEMES } from './themes.js';
import { FONT_METRICS, EMBEDDED_FONT_CSS } from './scene-fonts.js';

const esc = value => String(value ?? '').replace(/[<>&"']/g, char => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[char]));
const clean = value => String(value ?? '').trim();
const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
const num = parseNumber;
const nf = new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1});
const scientific = new Intl.NumberFormat('ru-RU',{notation:'scientific',maximumFractionDigits:3});
// Avoid a forty-character value column or a non-zero value labelled as zero.
// Exact source values remain in each mark's title and the accessible description.
const fmt = value => value === null ? '—' : (Math.abs(value)>=1e12 || (value!==0 && Math.abs(value)<.05) ? scientific.format(value).replace('E','e') : nf.format(value));
const date = value => { const d=parseDate(value); return d ? new Date(d instanceof Date ? d : `${d}T00:00:00Z`) : null; };
const iso = d => d.toISOString().slice(0,10);
const shortDate = d => new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'short',timeZone:'UTC'}).format(d).replace('.','');
const monthDate = d => new Intl.DateTimeFormat('ru-RU',{month:'long',year:'numeric',timeZone:'UTC'}).format(d).toLowerCase().replace('.','');
const plural = n => n%100>=11&&n%100<=14 ? 'строк' : n%10===1 ? 'строка' : n%10>=2&&n%10<=4 ? 'строки' : 'строк';
const attrs = obj => Object.entries(obj).map(([k,v])=>`${k}="${esc(v)}"`).join(' ');
const text = (x,y,value,obj={}) => `<text x="${x}" y="${y}" ${attrs(obj)}>${esc(value)}</text>`;
const line = (x1,y1,x2,y2,color,extra='') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" ${extra}/>`;
const style = (theme,size=28,extra={}) => ({class:'golos',fill:theme.ink,'font-size':size,...extra});
const widthOf = (value,size=28,font='golos-text') => [...String(value)].reduce((sum,c)=>sum+(FONT_METRICS[font][c] ?? 1.1),0)*size*1.04;

// Metrics come from the exact local fonts embedded below, including Cyrillic.
function wrap(value,width,size,font='golos-text') {
  const words=clean(value).split(/\s+/).filter(Boolean), result=[]; let current='';
  for(const word of words) {
    if(widthOf(current ? current+' '+word : word,size,font)<=width) { current=current ? current+' '+word : word; continue; }
    if(current) { result.push(current); current=''; }
    for(const char of word) {
      if(current && widthOf(current+char,size,font)>width) { result.push(current); current=''; }
      current+=char;
    }
  }
  if(current) result.push(current);
  return result;
}
function lines(x,y,values,obj,gap) {
  return `<text x="${x}" y="${y}" ${attrs(obj)}>${values.map((v,i)=>`<tspan x="${x}" dy="${i ? gap : 0}">${esc(v)}</tspan>`).join('')}</text>`;
}
function context(options={}) {
  const {dataset={},state={},themeName='paper'}=options;
  const rows=Array.isArray(options.rows) ? options.rows.slice(0,20) : [];
  const columns=dataset.columns || [],headers=dataset.headers || [];
  const categoryKey=state.categoryKey || columns.find(c=>c.type==='category')?.key || headers[0] || '';
  const valueKey=state.valueKey || columns.find(c=>c.type==='number')?.key || headers[1] || '';
  const dateKey=state.dateKey ?? columns.find(c=>c.type==='date')?.key ?? '';
  const stories=state.size==='stories', width=stories ? 1080 : 1200,height=stories ? 1920 : 900,margin=stories ? 80 : 82;
  return {state,dataset,rows,categoryKey,valueKey,dateKey,stories,width,height,margin,theme:THEMES[themeName]||THEMES.paper,mode:state.mode||'bars',unit:clean(state.unit)};
}
function headerLayout(c) {
  const room=c.width-c.margin*2;
  let titleSize=c.stories ? 62 : 56;
  let titleLines=wrap(c.state.title,room,titleSize,'literata');
  while(titleLines.length>2&&titleSize>44) {titleSize-=2;titleLines=wrap(c.state.title,room,titleSize,'literata');}
  const captionSize=c.stories ? 34 : 27;
  const captionLines=wrap(c.state.caption,room,captionSize);
  const titleY=c.margin+titleSize;
  const titleBottom=titleLines.length ? titleY+(titleLines.length-1)*titleSize*1.18 : c.margin;
  const captionY=titleBottom+(titleLines.length ? 38 : captionSize);
  const bottom=captionLines.length ? captionY+(captionLines.length-1)*captionSize*1.36 : titleBottom;
  return {titleSize,titleLines,captionSize,captionLines,titleY,captionY,chartTop:bottom+44};
}
export function sceneDiagnostics(options={}) {
  const c=context(options),warnings=[];
  let message='';
  if(!c.rows.length) message='нет строк для отображения';
  else if(['timeline','calendar'].includes(c.mode) && !c.dateKey) message='нужна колонка с датой';
  else if(['timeline','calendar'].includes(c.mode) && !c.rows.some(r=>date(r[c.dateKey]))) message='нет корректных дат';
  else if(c.mode!=='calendar' && !c.rows.some(r=>num(r[c.valueKey])!==null && (c.mode!=='timeline'||date(r[c.dateKey])))) message='нет числовых значений';
  const h=headerLayout(c),available=c.height-(c.stories?170:130)-h.chartTop;
  const minimumSpace=c.mode==='timeline' ? Math.max(220,Math.ceil(c.rows.length/3)*32+170) : c.mode==='calendar' ? Math.max(160,Math.ceil(c.rows.length/3)*32+80) : Math.max(120,c.rows.length*22);
  if(!message && available<minimumSpace) message='сократите текст или выберите сторис';
  if(c.rows.length>12&&!c.stories) warnings.push('много строк для горизонтальной открытки: откройте крупный просмотр или выберите сторис.');
  if(h.titleLines.length>2 || h.captionLines.length>4) warnings.push('длинный текст занимает большую часть открытки; проверьте крупный просмотр или сократите подпись.');
  if(['bars','dots'].includes(c.mode)) {
    const rowSpace=available/c.rows.length;
    if(c.rows.some(r=>widthOf(r[c.categoryKey]??'',28)>320) || c.rows.some(r=>widthOf(fmt(num(r[c.valueKey])),28)>210)) warnings.push('длинные подписи перенесены; проверьте их в крупном просмотре.');
    if(rowSpace<32) warnings.push('текст плотный: для чтения на телефоне лучше выбрать сторис или уменьшить число строк.');
  }
  if(['calendar','timeline'].includes(c.mode) && c.rows.some(r=>!date(r[c.dateKey]))) warnings.push('строки без корректной даты перечислены отдельно.');
  return {exportable:!message,message,warnings:[...new Set(warnings)]};
}
function renderHeader(c,h) {
  let out='';
  if(h.titleLines.length) out+=lines(c.margin,h.titleY,h.titleLines,style(c.theme,h.titleSize,{class:'literata','font-weight':500}),h.titleSize*1.18);
  if(h.captionLines.length) out+=lines(c.margin,h.captionY,h.captionLines,style(c.theme,h.captionSize,{fill:c.theme.muted}),h.captionSize*1.36);
  return out+line(c.margin,h.chartTop-20,c.width-c.margin,h.chartTop-20,c.theme.line);
}
function rowKeys(c) {
  const occurrences=new Map(),keys=new Map();
  for(const row of [...new Set([...(c.dataset.rows||[]),...c.rows])]) {
    const category=String(row[c.categoryKey]??''),n=occurrences.get(category)||0;
    occurrences.set(category,n+1);keys.set(row,JSON.stringify([category,n]));
  }
  return keys;
}
function ticks(min,max) {
  if(min===max) return [min];
  const raw=(max-min)/4, magnitude=10**Math.floor(Math.log10(raw));
  const step=[1,2,5,10].find(n=>n*magnitude>=raw)*magnitude;
  const result=[min];
  for(let n=Math.ceil(min/step)*step;n<max;n+=step) if(n>min+step*.05) result.push(n);
  result.push(max);return result;
}
function horizontalAxis(c,min,max,left,right,y,fontSize=22) {
  let out='',last=-Infinity;const values=ticks(min,max),span=max-min||1;
  values.forEach((n,i)=>{
    const x=left+(n-min)/span*(right-left),label=fmt(n),w=widthOf(label,fontSize);
    const start=i===0 ? x : i===values.length-1 ? x-w : x-w/2;
    if(start<last+14&&i!==values.length-1) return;
    if(i===values.length-1&&start<last+14) return;
    last=start+w;out+=text(x,y,label,style(c.theme,fontSize,{fill:c.theme.muted,'text-anchor':i===0?'start':i===values.length-1?'end':'middle'}));
  });return out;
}
function renderComparison(c,h,bottom) {
  const values=c.rows.map(r=>num(r[c.valueKey])),valid=values.filter(v=>v!==null),min=Math.min(...valid,0),max=Math.max(...valid,0),span=max-min||1;
  const keys=rowKeys(c),room=c.width-c.margin*2;
  let size=c.stories ? 38 : 29;
  let labelWidth=Math.min(room*.38,Math.max(190,...c.rows.map(r=>widthOf(r[c.categoryKey]??'',size)+22)));
  const valueWidth=Math.min(room*.31,Math.max(110,...values.map(v=>widthOf(fmt(v),size)+22)));
  let labels=c.rows.map((r,i)=>wrap(clean(r[c.categoryKey])||`строка ${i+1}`,labelWidth-20,size));
  const top=h.chartTop+44,available=bottom-top;
  let slots=labels.reduce((n,v)=>n+Math.max(1,v.length),0);
  while(slots*size*1.22>available&&size>18) {size--;labels=c.rows.map((r,i)=>wrap(clean(r[c.categoryKey])||`строка ${i+1}`,labelWidth-20,size));slots=labels.reduce((n,v)=>n+Math.max(1,v.length),0);}
  const left=c.margin+labelWidth,right=c.width-c.margin-valueWidth,plotWidth=Math.max(70,right-left),zero=left+(0-min)/span*plotWidth;
  const rowUnit=available/slots;
  let out=horizontalAxis(c,min,max,left,right,h.chartTop+23,22);
  if(c.unit) out+=text(c.width-c.margin,h.chartTop+23,c.unit,style(c.theme,22,{fill:c.theme.muted,'text-anchor':'end'}));
  out+=line(zero,top,zero,bottom,c.theme.line);
  let offset=0;
  c.rows.forEach((row,i)=>{
    const value=values[i],n=Math.max(1,labels[i].length),rh=n*rowUnit,y=top+offset+rh/2,barHeight=clamp(rowUnit*.42,8,c.stories?36:26);
    out+=`<g data-row-key="${esc(keys.get(row))}"><title>${esc(`${clean(row[c.categoryKey])}: ${clean(row[c.valueKey])||'нет значения'}`)}</title>`;
    out+=lines(c.margin,y-(n-1)*size*.61+size*.32,labels[i],style(c.theme,size),size*1.22);
    out+=line(left,y,right,y,c.theme.line,'opacity=".65"');
    if(value===null) out+=`<rect x="${zero-10}" y="${y-barHeight/2}" width="20" height="${barHeight}" fill="url(#missing-hatch)"/>`;
    else if(c.mode==='dots') out+=`<circle data-mark="dot" cx="${left+(value-min)/span*plotWidth}" cy="${y}" r="${clamp(rowUnit*.15,4,9)}" fill="${c.theme.accent}" stroke="${c.theme.paper}" stroke-width="2"/>`;
    else out+=`<rect data-mark="bar" x="${value<0?zero-Math.abs(value)/span*plotWidth:zero}" y="${y-barHeight/2}" width="${Math.max(1.5,Math.abs(value)/span*plotWidth)}" height="${barHeight}" rx="${barHeight/2}" fill="${c.theme.accent}"/>`;
    out+=text(c.width-c.margin,y+size*.32,fmt(value),style(c.theme,size,{'text-anchor':'end',class:'mono'}))+'</g>';
    offset+=rh;
  });return out;
}
function datedRows(c) {return c.rows.map((row,index)=>({row,index,date:date(row[c.dateKey]),value:num(row[c.valueKey])})).sort((a,b)=>(a.date?.valueOf()??Infinity)-(b.date?.valueOf()??Infinity)||a.index-b.index);}
function renderRegister(c,entries,top,bottom,attribute='data-calendar-layout="register"') {
  const cols=c.stories?1:(bottom-top<360 && entries.length>12 && entries.every(e=>e.value!==null) ? 3 : 2),count=Math.ceil(entries.length/cols),gap=38,block=(c.width-c.margin*2-gap*(cols-1))/cols;
  let size=c.stories?36:27;
  const rowLabels=()=>entries.map(e=>`${e.date?iso(e.date):'без даты'} · ${e.value===null ? clean(e.row[c.valueKey])||'—' : fmt(e.value)}`);
  let wrapped=rowLabels().map(v=>wrap(v,block,size));
  const needed=()=>Array.from({length:cols},(_,col)=>wrapped.slice(col*count,(col+1)*count).reduce((n,l)=>n+Math.max(1,l.length),0));
  while(Math.max(...needed())*size*1.3+count*8>bottom-top&&size>18) {size--;wrapped=rowLabels().map(v=>wrap(v,block,size));}
  let out=`<g ${attribute}>`;
  for(let col=0;col<cols;col++) {
    let y=top+size;const x=c.margin+col*(block+gap);
    for(let j=0;j<count;j++) {
      const index=col*count+j;if(index>=entries.length) break;
      out+=lines(x,y,wrapped[index],style(c.theme,size),size*1.3);
      y+=Math.max(1,wrapped[index].length)*size*1.3+8;
    }
  }
  return out+'</g>';
}
function renderCalendar(c,h,bottom) {
  const entries=datedRows(c),dated=entries.filter(e=>e.date),undated=entries.filter(e=>!e.date),first=dated[0].date,last=dated.at(-1).date;
  const seen=new Set(),duplicates=dated.some(e=>{const key=iso(e.date);if(seen.has(key))return true;seen.add(key);return false;});
  const day=86400000,span=Math.round((last-first)/day);
  const occupiedWeeks=Math.ceil((span+(first.getUTCDay()+6)%7+1)/7);
  const register=span>34||duplicates||dated.some(e=>e.value===null&&clean(e.row[c.valueKey]))||undated.length||(bottom-h.chartTop-78)/occupiedWeeks<100;
  let out=text(c.margin,h.chartTop+25,first.getUTCMonth()===last.getUTCMonth()&&first.getUTCFullYear()===last.getUTCFullYear()?monthDate(first):`${iso(first)} — ${iso(last)}`,style(c.theme,c.stories?34:28,{class:'literata'}));
  if(c.unit) out+=text(c.width-c.margin,h.chartTop+25,c.unit,style(c.theme,24,{'text-anchor':'end',fill:c.theme.muted}));
  if(register) {
    if(undated.length) out+=text(c.margin,bottom-2,`без корректной даты · ${undated.length} ${plural(undated.length)}`,style(c.theme,22,{fill:c.theme.muted}));
    return out+renderRegister(c,entries,h.chartTop+48,bottom-(undated.length?35:0));
  }
  const start=new Date(first);start.setUTCDate(start.getUTCDate()-(start.getUTCDay()+6)%7);
  const end=new Date(last);end.setUTCDate(end.getUTCDate()+(6-(end.getUTCDay()+6)%7));
  const weeks=Math.round((end-start)/day+1)/7,cellWidth=(c.width-c.margin*2)/7,top=h.chartTop+78,cellHeight=(bottom-top)/weeks;
  const lookup=new Map(dated.map(e=>[iso(e.date),e]));
  ['п','в','с','ч','п','с','в'].forEach((v,i)=>{out+=text(c.margin+i*cellWidth+12,top-20,v,style(c.theme,24,{fill:c.theme.muted}));});
  out+='<g data-calendar-layout="weeks">';
  for(let n=0;n<weeks*7;n++) {
    const d=new Date(start.valueOf()+n*day),e=lookup.get(iso(d)),x=c.margin+n%7*cellWidth,y=top+Math.floor(n/7)*cellHeight;
    out+=`<g><title>${esc(`${iso(d)}: ${e ? clean(e.row[c.valueKey])||'нет значения' : 'нет записи'}`)}</title><rect x="${x}" y="${y}" width="${cellWidth}" height="${cellHeight}" fill="none" stroke="${c.theme.line}"/>`;
    out+=text(x+12,y+32,`${String(d.getUTCDate()).padStart(2,'0')}.${String(d.getUTCMonth()+1).padStart(2,'0')}`,style(c.theme,24,{fill:c.theme.muted}));
    if(e) {out+=text(x+12,y+Math.min(cellHeight-22,78),fmt(e.value),style(c.theme,c.stories?34:28));if(e.value===null)out+=`<rect x="${x+12}" y="${y+cellHeight-15}" width="${cellWidth-24}" height="5" fill="url(#missing-hatch)"/>`;}
    out+='</g>';
  }
  return out+'</g>';
}
function renderTimeline(c,h,bottom) {
  const entries=datedRows(c),points=entries.filter(e=>e.date),undated=entries.filter(e=>!e.date),values=points.map(e=>e.value).filter(v=>v!==null);
  const min=Math.min(...values,0),max=Math.max(...values,0),span=max-min||1;
  const duplicates=points.some((e,i)=>i&&iso(e.date)===iso(points[i-1].date));
  const tickWidth=Math.max(...ticks(min,max).map(v=>widthOf(fmt(v),22)))+24;
  const left=c.margin+tickWidth,right=c.width-c.margin-36,top=h.chartTop+40;
  const first=points[0].date.valueOf(),last=points.at(-1).date.valueOf(),ds=last-first||1;
  const x=e=> first===last ? (left+right)/2 : left+(e.date.valueOf()-first)/ds*(right-left);
  // A short series can still cluster on one end of a long time range. Test the
  // actual label boxes before deciding whether the values need a register.
  const directBottom=Math.max(top+100,bottom-55),size=c.stories?32:27;
  const candidates=points.map(e=>{
    const py=e.value===null?directBottom:directBottom-(e.value-min)/span*(directBottom-top),w=widthOf(fmt(e.value),size);
    return {x:clamp(x(e)-w/2,left,right-w),y:py<top+44?py+38:py-18,w};
  });
  const collide=candidates.some((a,i)=>candidates.slice(i+1).some(b=>Math.abs(a.y-b.y)<size+8&&a.x<b.x+b.w+10&&a.x+a.w+10>b.x));
  const ledger=duplicates||points.length>10||undated.length||collide;
  const ledgerHeight=ledger ? Math.min((c.stories?entries.length:Math.ceil(entries.length/2))*(c.stories?44:35)+35,(bottom-h.chartTop)*.62) : 0;
  const plotBottom=Math.max(top+100,bottom-ledgerHeight-55);
  const y=v=>plotBottom-(v-min)/span*(plotBottom-top);
  let out='';
  ticks(min,max).forEach(v=>{out+=line(left,y(v),right,y(v),c.theme.line);out+=text(left-20,y(v)+7,fmt(v),style(c.theme,22,{fill:c.theme.muted,'text-anchor':'end'}));});
  if(c.unit) out+=text(c.width-c.margin,h.chartTop+20,c.unit,style(c.theme,24,{fill:c.theme.muted,'text-anchor':'end'}));
  let segment=[];
  const flush=()=>{if(segment.length)out+=`<path data-route="" d="${segment.map((e,i)=>`${i?'L':'M'} ${x(e)} ${y(e.value)}`).join(' ')}" fill="none" stroke="${c.theme.accent}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;segment=[];};
  points.forEach(e=>{if(e.value===null)flush();else segment.push(e);});flush();
  points.forEach(e=>{
    const px=x(e),py=e.value===null?plotBottom:y(e.value),label=fmt(e.value),size=c.stories?32:27;
    out+=`<g><title>${esc(`${iso(e.date)}: ${clean(e.row[c.valueKey])||'нет значения'}`)}</title>`;
    if(e.value===null)out+=line(px-6,py-6,px+6,py+6,c.theme.accent,'stroke-width="3"');
    else out+=`<circle cx="${px}" cy="${py}" r="6" fill="${c.theme.paper}" stroke="${c.theme.accent}" stroke-width="3"/>`;
    if(!ledger) {
      const w=widthOf(label,size),lx=clamp(px-w/2,left,right-w),ly=py<top+44?py+38:py-18;
      out+=text(lx,ly,label,style(c.theme,size));
    }
    out+='</g>';
  });
  const tickDates=first===last?[points[0].date]:[points[0].date,new Date(first+(last-first)/2),points.at(-1).date];
  tickDates.forEach((d,i)=>{const px=first===last?(left+right)/2:left+(d-first)/ds*(right-left);out+=text(px,plotBottom+38,shortDate(d),style(c.theme,24,{fill:c.theme.muted,'text-anchor':i===0?'start':i===tickDates.length-1?'end':'middle'}));});
  if(ledger)out+=renderRegister(c,entries,plotBottom+60,bottom-(undated.length?28:0),'data-timeline-ledger=""');
  if(undated.length)out+=text(c.margin,bottom,`без корректной даты · ${undated.length} ${plural(undated.length)}`,style(c.theme,22,{fill:c.theme.muted}));
  return out;
}
function renderFooter(c) {
  const y=c.height-(c.stories?88:66),numbers=c.rows.map(r=>num(r[c.valueKey])).filter(v=>v!==null),summary=c.state.summary==='none'?null:numbers.length ? (c.state.summary==='average'?numbers.reduce((a,b)=>a+b,0)/numbers.length:numbers.reduce((a,b)=>a+b,0)) : null;
  let out=line(c.margin,y-30,c.width-c.margin,y-30,c.theme.line);
  if(c.rows.some(r=>!clean(r[c.valueKey])))out+=`<rect x="${c.margin}" y="${y-10}" width="20" height="12" fill="url(#missing-hatch)"/>`+text(c.margin+32,y+3,'нет значения',style(c.theme,22,{fill:c.theme.muted}));
  if(summary!==null) { const label=`${c.state.summary==='average'?'в среднем':'всего'} · ${fmt(summary)}${c.unit?' '+c.unit:''}`; const free=c.width-c.margin*2-(c.rows.some(r=>!clean(r[c.valueKey]))?220:0); const size=Math.min(c.stories?36:32,free/widthOf(label,1)); out+=text(c.width-c.margin,y+8,label,style(c.theme,size,{'text-anchor':'end',fill:c.theme.accent})); }
  return out;
}
function describe(c) {
  const modes={bars:'столбики',dots:'точки',calendar:'календарь',timeline:'линия по датам'},values=c.rows.map(r=>num(r[c.valueKey])).filter(v=>v!==null),dates=c.rows.map(r=>date(r[c.dateKey])).filter(Boolean).sort((a,b)=>a-b);
  const aggregate=c.state.summary==='none'||!values.length?'':`${c.state.summary==='average'?'в среднем':'всего'} ${fmt(c.state.summary==='average'?values.reduce((a,b)=>a+b,0)/values.length:values.reduce((a,b)=>a+b,0))} ${c.unit}. `;
  return `${clean(c.state.caption)} ${modes[c.mode]}. ${c.rows.length} ${plural(c.rows.length)}. ${dates.length?`даты от ${iso(dates[0])} до ${iso(dates.at(-1))}. `:''}${aggregate}${c.rows.map((r,i)=>`${clean(r[c.categoryKey])||'строка '+(i+1)}${c.dateKey?' · '+(clean(r[c.dateKey])||'без даты'):''}: ${clean(r[c.valueKey])||'нет значения'}`).join('; ')}.`.trim();
}
export function buildScene(options={}) {
  const c=context(options),diagnostics=sceneDiagnostics(options),bottom=c.height-(c.stories?170:130);
  const cramped=diagnostics.message==='сократите текст или выберите сторис';
  const h=headerLayout(cramped ? {...c,state:{...c.state,title:'',caption:''}} : c);
  let chart='';
  if(!diagnostics.exportable) {
    const detail=cramped?'для графика не осталось достаточно места.':!c.rows.length?'добавьте строки данных, чтобы собрать открытку.':diagnostics.message.includes('дат')?'выберите колонку с датой и проверьте её значения.':'выберите числовую колонку или добавьте значения.';
    chart=text(c.width/2,(h.chartTop+bottom)/2,diagnostics.message,style(c.theme,32,{'text-anchor':'middle',class:'literata'}))+text(c.width/2,(h.chartTop+bottom)/2+42,detail,style(c.theme,24,{'text-anchor':'middle',fill:c.theme.muted}));
  } else if(c.mode==='calendar')chart=renderCalendar(c,h,bottom);
  else if(c.mode==='timeline')chart=renderTimeline(c,h,bottom);
  else chart=renderComparison(c,h,bottom);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${c.width}" height="${c.height}" viewBox="0 0 ${c.width} ${c.height}" role="img" aria-labelledby="scene-title scene-desc"><title id="scene-title">${esc(clean(c.state.title)||'открытка с данными')}</title><desc id="scene-desc">${esc(describe(c))}</desc><defs><pattern id="missing-hatch" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M-2 2L2 -2M0 10L10 0M8 12L12 8" stroke="${c.theme.accent}" stroke-width="1" opacity=".6"/></pattern></defs><style>${EMBEDDED_FONT_CSS}.literata{font-family:'Literata',Georgia,serif}.golos,.mono{font-family:'Golos Text',Arial,sans-serif}.mono{font-variant-numeric:tabular-nums}</style><rect width="${c.width}" height="${c.height}" fill="${c.theme.paper}"/><g data-scene="header">${renderHeader(c,h)}</g><g data-scene="chart" aria-label="${esc(c.mode)}">${chart}</g><g data-scene="footer">${renderFooter(c)}</g></svg>`;
}
