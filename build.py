#!/usr/bin/env python3
"""Inline src/ into dist/index.html (single self-contained file) + PWA assets."""
import pathlib,shutil,re
R=pathlib.Path(__file__).parent;S=R/'src';D=R/'dist';D.mkdir(exist_ok=True)
html=(S/'index.html').read_text()
js='\n'.join((S/f).read_text() for f in ['data.js','engine.js','engine2.js','ui.js'])
html=html.replace('/*CSS*/',(S/'style.css').read_text()).replace('/*JS*/',js.replace('</script','<\\/script'))
(D/'index.html').write_text(html)
for f in ['sw.js','manifest.webmanifest','icon-192.png','icon-512.png']:
    if (S/f).exists(): shutil.copy(S/f,D/f)
ver=re.search(r"VERSION='([^']+)'",js).group(1)
sw=D/'sw.js'
if sw.exists(): sw.write_text(sw.read_text().replace('__VER__',ver))
print('built',ver,len(html)//1024,'KB')
