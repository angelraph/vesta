"""Renders the PNG app icons from public/icon.svg."""
import asyncio
from playwright.async_api import async_playwright

svg = open("apps/web/public/icon.svg", encoding="utf8").read()


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for size in (192, 512, 180):
            pg = await b.new_page(viewport={"width": size, "height": size})
            await pg.set_content(f'<html><body style="margin:0;background:transparent">{svg.replace("<svg ", f"<svg width=\"{size}\" height=\"{size}\" ")}</body></html>')
            name = "apple-icon" if size == 180 else f"icon-{size}"
            await pg.screenshot(path=f"apps/web/public/{name}.png", omit_background=True)
        await b.close()


asyncio.run(main())
