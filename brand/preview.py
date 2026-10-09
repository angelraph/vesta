"""Renders the SVG mark next to the original logo so the two can be compared."""
import asyncio
import base64

from playwright.async_api import async_playwright

svg = open("brand/vesta-mark.svg", encoding="utf8").read()
orig = base64.b64encode(open("brand/vesta-logo-original.png", "rb").read()).decode()
html = f"""<html><body style="margin:0;display:flex;gap:30px;background:#02050a;padding:30px;align-items:center">
<div style="width:300px;height:300px;overflow:hidden;position:relative">
  <img src="data:image/png;base64,{orig}" style="position:absolute;left:-170px;top:-425px;width:1254px">
</div>
<div style="width:300px;height:300px">{svg.replace('<svg ', '<svg width="300" height="300" ')}</div>
<div style="width:300px;height:300px;background:#f6f4ef;display:flex;align-items:center;justify-content:center">{svg.replace('<svg ', '<svg width="200" height="200" ')}</div>
<div style="background:#f6f4ef;padding:10px">{svg.replace('<svg ', '<svg width="32" height="32" ')}</div>
</body></html>"""


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1100, "height": 360})
        await pg.set_content(html)
        await pg.screenshot(path="video/out/mark-compare.png")
        await b.close()


asyncio.run(main())
