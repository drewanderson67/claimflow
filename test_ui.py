import asyncio,json,sys
from playwright.async_api import async_playwright
URL='http://localhost:8765/'
async def main():
  async with async_playwright() as p:
    b=await p.chromium.connect_over_cdp('http://localhost:29229')
    errs=[]
    for name,vp in [('desk',{'width':1440,'height':900}),('mob',{'width':390,'height':844})]:
      ctx=await b.new_context(viewport=vp,device_scale_factor=1 if name=='desk' else 2)
      pg=await ctx.new_page();pg.on('pageerror',lambda e:errs.append(name+': '+str(e)));pg.on('console',lambda m:m.type=='error' and errs.append(name+' console: '+m.text))
      await pg.goto(URL);await pg.evaluate("localStorage.clear()");await pg.reload()
      await pg.select_option('#speed','20');await pg.wait_for_timeout(9000)
      st=await pg.evaluate("JSON.stringify({rcv:S.stats.rcv,fin:S.stats.fin,auto:S.stats.auto,rej:S.stats.rej,pend:pendList().length,carc:S.stats.carc,ap:S.appeals.length,stat:S.claims.reduce((o,c)=>(o[c.status]=(o[c.status]||0)+1,o),{}),sw:document.documentElement.scrollWidth})")
      print(name,st)
      await pg.screenshot(path=f'/home/ubuntu/shots/{name}-live.png',full_page=(name=='desk'))
      await pg.click('#pocTog+.sw') if name=='desk' else None
      await pg.wait_for_timeout(4000)
      for v in ['trends','queue','submit','appeals','integrity','rules','learn']:
        await pg.click(f'#tabs button[data-view={v}]');await pg.wait_for_timeout(400)
        sw=await pg.evaluate("document.documentElement.scrollWidth");print(name,v,'scrollWidth',sw)
        await pg.screenshot(path=f'/home/ubuntu/shots/{name}-{v}.png')
      # queue actions
      await pg.click('#tabs button[data-view=queue]')
      n=await pg.locator('.qcard [data-act=approve]').count();print('queue approve btns',n)
      if n: await pg.locator('.qcard [data-act=approve]').first.click();await pg.wait_for_timeout(300)
      if await pg.locator('#modal.on').count(): await pg.click('[data-act=cobok]')
      if await pg.locator('.qcard [data-act=deny]').count(): await pg.locator('.qcard [data-act=deny]').first.click()
      # submit presets
      await pg.click('#tabs button[data-view=submit]')
      for k in ['mri','bundle','termed','tka','oon','inpt','drgup','clean']:
        await pg.click(f'[data-act=preset][data-k={k}]');await pg.click('[data-act=precheck]');await pg.wait_for_timeout(150)
        print(k,(await pg.inner_text('#pre'))[:140].replace('\n',' | '))
      await pg.click('[data-act=preset][data-k=mri]');await pg.click('[data-act=precheck]');
      if await pg.locator('[data-act=fixauth]').count(): await pg.click('[data-act=fixauth]');print('after fix',(await pg.inner_text('#pre'))[:80].replace('\n',' | '))
      await pg.click('[data-act=submit]');await pg.wait_for_timeout(400)
      for t in ['trace','lines','eob','835','837','277','hist']:
        await pg.click(f'[data-act=dtab][data-k="{t}"]');await pg.wait_for_timeout(100)
        if t in('eob','835','trace'):await pg.screenshot(path=f'/home/ubuntu/shots/{name}-drawer-{t}.png')
      await pg.click('#dh [data-act=close]')
      await pg.click('[data-act=sample837]');await pg.click('[data-act=parse837]');await pg.wait_for_timeout(300)
      print('parsed',await pg.inner_text('#dh'))
      await pg.click('#dh [data-act=close]')
      await pg.click('#tabs button[data-view=appeals]')
      if await pg.locator('[data-act=appeal]').count():
        await pg.locator('[data-act=appeal]').first.click();await pg.click('[data-act=apok]');await pg.wait_for_timeout(200)
        await pg.locator('[data-act=overturn]').first.click();print('appeal',(await pg.inner_text('#v-appeals tbody tr'))[:200].replace('\n',' '))
      await pg.click('#tabs button[data-view=integrity]');await pg.click('[data-act=mine]');await pg.wait_for_timeout(200)
      print('recov rows',await pg.locator('[data-act=recover]').count())
      await pg.click('#tabs button[data-view=live]');await pg.wait_for_timeout(1500)
      await pg.screenshot(path=f'/home/ubuntu/shots/{name}-live2.png',full_page=(name=='desk'))
      print(name,await pg.evaluate("JSON.stringify({rcv:S.stats.rcv,poc:S.stats.poc,fixed:S.stats.pocFixed,blk:S.stats.pocBlocked,ai:S.stats.aiAuto,sw:document.documentElement.scrollWidth,ls:(localStorage.getItem(LS)||'').length})"))
      await ctx.close()
    print('ERRORS',errs[:10])
asyncio.run(main())
