"""Renders crisp motion-graphics layers (transparent PNG frames) from HTML.

Each layer is an HTML page whose CSS animations are paused and stepped frame
by frame with the Web Animations API, then screenshotted at 1920x1080.
"""
import asyncio
import html as esc
import os

from playwright.async_api import async_playwright

FPS = 30
MARK = open("brand/vesta-mark.svg", encoding="utf8").read()

FONTS = """<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=block" rel="stylesheet">"""

BASE = """
* { box-sizing: border-box; margin: 0; }
html, body { width: 1920px; height: 1080px; background: transparent; overflow: hidden; }
body { font-family: 'Plus Jakarta Sans', sans-serif; color: #0f1f1a; }
.ease { animation-timing-function: cubic-bezier(.2,.8,.2,1); animation-fill-mode: both; }
@keyframes up { from { transform: translateY(110%); } to { transform: none; } }
@keyframes fade-up { from { opacity: 0; transform: translateY(26px); } to { opacity: 1; transform: none; } }
@keyframes fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes pop { 0% { opacity: 0; transform: scale(.6) translateY(20px); } 60% { opacity: 1; transform: scale(1.06); } 100% { transform: none; } }
@keyframes slide-l { from { opacity: 0; transform: translateX(-60px); } to { opacity: 1; transform: none; } }
@keyframes draw { from { stroke-dashoffset: 80; } to { stroke-dashoffset: 0; } }
@keyframes rise-scale { from { opacity: 0; transform: translateY(30px) scale(.8); } to { opacity: 1; transform: none; } }
"""


def caption_html(title, sub, step, total):
    words = "".join(
        f'<span class="w"><span class="ease" style="display:inline-block;animation:up 700ms {200 + i * 70}ms both cubic-bezier(.2,.8,.2,1)">{esc.escape(w)}</span></span> '
        for i, w in enumerate(title.split())
    )
    return f"""<html><head>{FONTS}<style>{BASE}
.brand {{ position:absolute; left:120px; top:104px; display:flex; align-items:center; gap:14px; animation: slide-l 700ms both cubic-bezier(.2,.8,.2,1); }}
.brand span {{ font-weight:800; font-size:36px; letter-spacing:-.03em; }}
.step {{ position:absolute; left:120px; top:322px; font-weight:700; font-size:26px; color:#e97f23; letter-spacing:.08em; animation: fade 500ms 100ms both; }}
.title {{ position:absolute; left:120px; top:368px; width:760px; font-family:'Fraunces',serif; font-weight:700; font-size:76px; line-height:1.08; letter-spacing:-.02em; }}
.w {{ display:inline-block; overflow:hidden; vertical-align:bottom; padding-bottom:6px; }}
.bar {{ height:10px; width:120px; border-radius:6px; background:linear-gradient(90deg,#46ecb8,#0e9f86); transform-origin:left; animation: grow 700ms 700ms both cubic-bezier(.2,.8,.2,1); margin-top:26px; }}
.sub {{ margin-top:30px; width:700px; font-size:34px; line-height:1.4; color:#56645e; animation: fade-up 700ms 850ms both cubic-bezier(.2,.8,.2,1); font-family:'Plus Jakarta Sans'; font-weight:500; letter-spacing:-.01em; }}
</style></head><body>
<div class="brand">{MARK.replace('<svg ', '<svg width="54" height="54" ')}<span>Vesta</span></div>
<div class="step">{step:02d} / {total:02d}</div>
<div class="title">{words}<div class="bar"></div><div class="sub">{esc.escape(sub)}</div></div>
</body></html>"""


def badge_html(text, kind, x, y):
    color = {"tx": "#0f4c3a", "agora": "#0f4c3a", "chain": "#375bd2", "ai": "#7b5cd6", "mera": "#0e9f86"}.get(kind, "#0f4c3a")
    return f"""<html><head>{FONTS}<style>{BASE}
.b {{ position:absolute; left:{x}px; top:{y}px; display:flex; align-items:center; gap:14px; padding:18px 26px 18px 18px; border-radius:24px;
      background:#fff; box-shadow:0 24px 60px -18px rgba(15,31,26,.35), 0 0 0 1px rgba(15,31,26,.06); animation: pop 650ms both cubic-bezier(.2,.8,.2,1); }}
.dot {{ width:46px; height:46px; border-radius:16px; background:{color}; display:flex; align-items:center; justify-content:center; color:#c5f06b; font-size:24px; font-weight:800; }}
.t {{ font-size:27px; font-weight:700; letter-spacing:-.01em; white-space:nowrap; }}
</style></head><body><div class="b"><div class="dot">✓</div><div class="t">{esc.escape(text)}</div></div></body></html>"""


def intro_html():
    return f"""<html><head>{FONTS}<style>{BASE}
body {{ background: radial-gradient(1200px 800px at 30% 40%, #0a1a1c 0%, #02050a 60%); }}
.wrap {{ position:absolute; left:50%; top:50%; transform:translate(-50%,-55%); display:flex; align-items:center; gap:46px; }}
.mark {{ animation: rise-scale 900ms 150ms both cubic-bezier(.2,.8,.2,1); }}
.mark path:first-of-type {{ stroke-dasharray:80; animation: draw 1100ms 300ms both cubic-bezier(.2,.8,.2,1); }}
.word {{ overflow:hidden; }}
.word span {{ display:inline-block; font-weight:800; font-size:190px; letter-spacing:-.045em; color:#f6f1e7; animation: up 900ms 650ms both cubic-bezier(.2,.8,.2,1); }}
.tag {{ position:absolute; left:0; width:100%; top:64%; text-align:center; font-size:40px; letter-spacing:.14em; color:#d9d3c7; white-space:nowrap; animation: fade-up 900ms 1300ms both cubic-bezier(.2,.8,.2,1); }}
.tag b {{ color:#fff; font-weight:700; }}
</style></head><body>
<div class="wrap"><div class="mark">{MARK.replace('<svg ', '<svg width="230" height="230" ').replace('fill="#f3ecdf"', 'fill="#f3ecdf"')}</div><div class="word"><span>Vesta</span></div></div>
<div class="tag">The <b>bank account</b> for a household, not just a person.</div>
</body></html>"""


def outro_html(title, sub, url):
    return f"""<html><head>{FONTS}<style>{BASE}
body {{ background: radial-gradient(1200px 800px at 50% 40%, #0a1a1c 0%, #02050a 65%); }}
.mark {{ position:absolute; left:50%; top:200px; margin-left:-95px; animation: rise-scale 900ms 100ms both cubic-bezier(.2,.8,.2,1); }}
.mark path:first-of-type {{ stroke-dasharray:80; animation: draw 1100ms 250ms both cubic-bezier(.2,.8,.2,1); }}
.t {{ position:absolute; width:100%; top:450px; text-align:center; font-weight:800; font-size:130px; letter-spacing:-.045em; color:#f6f1e7; animation: fade-up 800ms 500ms both cubic-bezier(.2,.8,.2,1); }}
.s {{ position:absolute; width:100%; top:640px; text-align:center; font-size:46px; color:#d9d3c7; animation: fade-up 800ms 800ms both cubic-bezier(.2,.8,.2,1); }}
.u {{ position:absolute; width:100%; top:800px; text-align:center; animation: fade-up 800ms 1100ms both cubic-bezier(.2,.8,.2,1); }}
.u span {{ display:inline-block; padding:16px 34px; border-radius:999px; background:#c5f06b; color:#0f4c3a; font-weight:800; font-size:34px; }}
</style></head><body>
<div class="mark">{MARK.replace('<svg ', '<svg width="190" height="190" ')}</div>
<div class="t">{esc.escape(title)}</div><div class="s">{esc.escape(sub)}</div><div class="u"><span>{esc.escape(url)}</span></div>
</body></html>"""


async def render(jobs):
    """jobs: list of (html, out_dir, seconds, opaque)."""
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1920, "height": 1080})
        for html, out_dir, seconds, opaque in jobs:
            os.makedirs(out_dir, exist_ok=True)
            await pg.set_content(html, wait_until="networkidle")
            await pg.evaluate("document.fonts.ready")
            await pg.evaluate("document.getAnimations().forEach(a => a.pause())")
            for f in range(int(seconds * FPS)):
                ms = f * 1000 / FPS
                await pg.evaluate(f"document.getAnimations().forEach(a => a.currentTime = {ms})")
                await pg.screenshot(path=f"{out_dir}/{f:04d}.png", omit_background=not opaque)
        await b.close()


def render_all(jobs):
    asyncio.run(render(jobs))
