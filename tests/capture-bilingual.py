"""Capture the real editor and download every sample in both languages."""
import os,json,csv,io
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
URL=os.environ.get('APP_URL','http://127.0.0.1:4422/')
with sync_playwright() as p:
 browser=p.chromium.launch()
 for language in ['ru','en']:
  out=ROOT/'docs/images'/('en' if language=='en' else '');out.mkdir(parents=True,exist_ok=True)
  examples=ROOT/'examples'/('en' if language=='en' else '');examples.mkdir(parents=True,exist_ok=True)
  context=browser.new_context(locale=language,viewport={'width':1440,'height':1100},accept_downloads=True,reduced_motion='reduce')
  page=context.new_page();page.goto(URL.rstrip('/')+'/?lang='+language);page.wait_for_function('window.DataPostcard?.state?.svg');page.evaluate('document.fonts.ready');page.screenshot(path=str(out/'editor.png'),full_page=True,animations='disabled')
  for sample in ['reading','expenses','content','weather','sport']:
   page.locator('#sample-select').select_option(sample)
   with page.expect_download() as event:page.locator('#export-svg').click()
   event.value.save_as(examples/(sample+'-result.svg'))
   if sample in ['reading','expenses','content']:
    with page.expect_download() as event:page.locator('#export-png').click()
    event.value.save_as(out/(sample+'.png'))
   data=page.evaluate('(name)=>window.DataPostcard.samples[name]',sample)
   if sample=='weather':(examples/'weather.json').write_text(json.dumps([dict(zip(data['headers'],row)) for row in data['rows']],ensure_ascii=False,indent=2)+'\n')
   else:
    buffer=io.StringIO();writer=csv.writer(buffer,lineterminator='\n');writer.writerow(data['headers']);writer.writerows(data['rows']);(examples/(sample+'.csv')).write_text(buffer.getvalue())
  context.close()
  context=browser.new_context(locale=language,viewport={'width':390,'height':900},is_mobile=True,has_touch=True,reduced_motion='reduce')
  page=context.new_page();page.goto(URL.rstrip('/')+'/?lang='+language);page.wait_for_function('window.DataPostcard?.state?.svg');page.evaluate('document.fonts.ready');page.screenshot(path=str(out/'mobile.png'),full_page=True,animations='disabled');context.close()
 browser.close()
print('both languages: editor, mobile, 3 downloaded PNGs, 5 SVG results and 5 input datasets captured')
