import assert from 'node:assert/strict';
import { buildScene } from '../src/scene.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({args:['--disable-gpu']});
const page=await browser.newPage();
try {
  const fixtures=[
    {name:'extreme comparison values',rows:[{name:'один',value:1e30},{name:'два',value:2e30}],state:{mode:'bars',categoryKey:'name',valueKey:'value',title:'значения',summary:'total'},comparisonValues:true},
    ...['calendar','timeline'].map(mode=>({name:'maximal broad glyph '+mode,rows:Array.from({length:20},(_,i)=>({date:`2026-10-${String(i+1).padStart(2,'0')}`,value:i+1})),state:{mode,dateKey:'date',valueKey:'value',title:'W'.repeat(120),caption:'W'.repeat(300),summary:'total'}})),
    {name:'long text',rows:Array.from({length:20},(_,i)=>({name:'категория '+i,value:1000000+i})),state:{mode:'bars',categoryKey:'name',valueKey:'value',title:'слова о неделе '.repeat(8).slice(0,120),caption:'короткое объяснение результатов и их контекста '.repeat(8).slice(0,300),summary:'total'}},
    {name:'long labels',rows:Array.from({length:20},(_,i)=>({name:'очень длинная категория с подробностями и объяснением '+i,value:1000000+i})),state:{mode:'bars',categoryKey:'name',valueKey:'value',title:'итоги',summary:'total'}},
    {name:'sparse events',rows:Array.from({length:20},(_,i)=>({date:`${2025+Math.floor(i/12)}-${String(i%12+1).padStart(2,'0')}-01`,event:'встреча с редактором и обсуждение темы '+i})),state:{mode:'calendar',dateKey:'date',valueKey:'event',title:'даты',summary:'none'}},
    {name:'clustered timeline',rows:Array.from({length:7},(_,i)=>({date:i===6?'2027-10-01':`2026-10-0${i+1}`,value:10+i})),state:{mode:'timeline',dateKey:'date',valueKey:'value',title:'итоги',summary:'none'}, expectedValues:Array.from({length:7},(_,i)=>` · ${10+i}`)},
    {name:'duplicate timeline',rows:Array.from({length:20},(_,i)=>({date:'2026-10-01',value:i})),state:{mode:'timeline',dateKey:'date',valueKey:'value',title:'итоги',summary:'total'}},
  ];
  for(const fixture of fixtures) {
    await page.setContent(buildScene(fixture));
    await page.evaluate(()=>document.fonts.ready);
    if(fixture.expectedValues) { const visible=await page.locator('text').allTextContents(); for(const value of fixture.expectedValues) assert.ok(visible.some(t=>t.endsWith(value)),fixture.name+': missing visible '+value); }
    if(fixture.comparisonValues) { const collisions=await page.evaluate(()=>[...document.querySelectorAll('[data-row-key]')].filter(g=>{const mark=g.querySelector('[data-mark]'),label=g.querySelector('text.mono');return mark&&label&&label.getBBox().x<mark.getBBox().x+mark.getBBox().width+10;}).length); assert.equal(collisions,0,fixture.name+': values overlap marks'); }
    const geometry=await page.evaluate(()=>{
      const bounds=document.querySelector('svg').viewBox.baseVal;
      const footer=document.querySelector('[data-scene=footer]').getBBox();
      return [...document.querySelectorAll('text')].map(t=>({text:t.textContent,box:t.getBBox(),group:t.closest('[data-scene]')?.getAttribute('data-scene')})).filter(t=>t.box.width).map(t=>({text:t.text,x:t.box.x,y:t.box.y,right:t.box.x+t.box.width,bottom:t.box.y+t.box.height,group:t.group,footer:footer.y,width:bounds.width,height:bounds.height}));
    });
    const clipped=geometry.filter(t=>t.x<0||t.y<0||t.right>t.width||t.bottom>t.height||(t.group==='chart'&&t.bottom>t.footer));
    assert.equal(clipped.length,0,fixture.name+': '+JSON.stringify(clipped));
    console.log(fixture.name+' fits');
  }
}finally{await browser.close();}
