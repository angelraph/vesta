"""Builds the README images from real screenshots in media/screens.

    python media/build_media.py

banner.png, tour-*.png and demo-thumbnail.png, rendered from HTML at 2x.
"""
import asyncio
import base64
import os

from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
MARK = open(os.path.join(HERE, "..", "brand", "vesta-mark.svg"), encoding="utf8").read()
FONTS = '<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=block" rel="stylesheet">'


def img(name):
    data = base64.b64encode(open(os.path.join(HERE, "screens", f"{name}.png"), "rb").read()).decode()
    return f"data:image/png;base64,{data}"


def phone(name, w=300, rot=0, y=0, z=1):
    return (
        f'<div class="ph" style="width:{w}px; transform: translateY({y}px) rotate({rot}deg); z-index:{z}">'
        f'<img src="{img(name)}"></div>'
    )


BASE = """
* { margin:0; box-sizing:border-box; }
body { font-family:'Plus Jakarta Sans',sans-serif; color:#0f1f1a; }
.ph { border-radius:42px; padding:9px; background:#0b1412; box-shadow:0 40px 80px -30px rgba(15,31,26,.55), 0 0 0 1px rgba(255,255,255,.06) inset; flex-shrink:0; }
.ph img { display:block; width:100%; border-radius:34px; }
"""


def banner():
    phones = phone("01-landing", 250, -7, 40, 1) + phone("08-home-rent", 270, 0, 0, 2) + phone("15-receipt", 250, 7, 40, 1)
    return f"""<html><head>{FONTS}<style>{BASE}
body {{ width:1800px; height:760px; overflow:hidden; background: radial-gradient(900px 600px at 78% 30%, #10332c 0%, #04080d 62%); color:#f6f1e7; }}
.left {{ position:absolute; left:110px; top:150px; width:760px; }}
.brand {{ display:flex; align-items:center; gap:26px; }}
.brand b {{ font-size:118px; font-weight:800; letter-spacing:-.045em; }}
.tag {{ margin-top:26px; font-size:40px; line-height:1.3; color:#d9d3c7; }}
.tag em {{ font-style:normal; color:#fff; font-weight:700; }}
.chips {{ margin-top:44px; display:flex; flex-wrap:wrap; gap:12px; }}
.chips span {{ padding:10px 20px; border-radius:999px; background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.12); font-size:21px; font-weight:600; color:#e8e2d6; }}
.chips span b {{ color:#c5f06b; }}
.phones {{ position:absolute; right:70px; top:90px; display:flex; gap:22px; align-items:flex-start; }}
.glow {{ position:absolute; right:300px; top:120px; width:600px; height:600px; border-radius:50%; background:#46ecb8; opacity:.12; filter:blur(120px); }}
</style></head><body><div class="glow"></div>
<div class="left"><div class="brand">{MARK.replace('<svg ', '<svg width="128" height="128" ')}<b>Vesta</b></div>
<div class="tag">The <em>bank account</em> for a household,<br>not just a person.</div>
<div class="chips"><span><b>●</b> Live on Monad testnet</span><span>Mera passkeys</span><span>Agora settlement</span><span>Chainlink CRE</span><span>Envio</span></div></div>
<div class="phones">{phones}</div></body></html>"""


def tour(kicker, title, sub, names):
    phones = "".join(phone(n, 330, 0, (24 if i == 1 else 0), 1) for i, n in enumerate(names))
    return f"""<html><head>{FONTS}<style>{BASE}
body {{ width:1800px; height:1110px; overflow:hidden; background:#f6f4ef; }}
.blob {{ position:absolute; border-radius:50%; filter:blur(130px); }}
.top {{ position:absolute; left:110px; top:84px; width:1580px; display:flex; justify-content:space-between; align-items:flex-end; }}
.k {{ font-size:22px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; color:#e97f23; }}
h1 {{ margin-top:10px; font-family:'Fraunces',serif; font-size:66px; letter-spacing:-.02em; line-height:1.05; }}
p {{ margin-top:14px; width:860px; font-size:28px; line-height:1.45; color:#56645e; }}
.mk {{ display:flex; align-items:center; gap:12px; font-weight:800; font-size:30px; letter-spacing:-.03em; }}
.row {{ position:absolute; left:0; right:0; top:350px; display:flex; justify-content:center; gap:56px; }}
</style></head><body>
<div class="blob" style="left:900px; top:-200px; width:800px; height:600px; background:#46ecb8; opacity:.22"></div>
<div class="blob" style="left:-200px; top:600px; width:700px; height:600px; background:#fde3a7; opacity:.5"></div>
<div class="top"><div><div class="k">{kicker}</div><h1>{title}</h1><p>{sub}</p></div>
<div class="mk">{MARK.replace('<svg ', '<svg width="44" height="44" ')}Vesta</div></div>
<div class="row">{phones}</div></body></html>"""


def thumbnail(title, length):
    return f"""<html><head>{FONTS}<style>{BASE}
body {{ width:1600px; height:900px; overflow:hidden; background: radial-gradient(900px 700px at 70% 40%, #10332c 0%, #04080d 65%); color:#f6f1e7; }}
.left {{ position:absolute; left:100px; top:250px; width:720px; }}
.brand {{ display:flex; align-items:center; gap:18px; font-weight:800; font-size:56px; letter-spacing:-.04em; }}
h1 {{ margin-top:36px; font-family:'Fraunces',serif; font-size:74px; line-height:1.05; letter-spacing:-.02em; }}
.len {{ margin-top:28px; display:inline-block; padding:10px 22px; border-radius:999px; background:#c5f06b; color:#0f4c3a; font-weight:800; font-size:26px; }}
.phones {{ position:absolute; right:80px; top:90px; display:flex; gap:24px; }}
.play {{ position:absolute; left:50%; top:50%; width:170px; height:170px; margin:-85px 0 0 -85px; border-radius:50%; background:rgba(255,255,255,.95);
  box-shadow:0 30px 80px rgba(0,0,0,.5); display:flex; align-items:center; justify-content:center; z-index:9; }}
.play i {{ width:0; height:0; border-left:56px solid #0f4c3a; border-top:34px solid transparent; border-bottom:34px solid transparent; margin-left:14px; }}
</style></head><body>
<div class="left"><div class="brand">{MARK.replace('<svg ', '<svg width="70" height="70" ')}Vesta</div><h1>{title}</h1><div class="len">▶ Watch the demo · {length}</div></div>
<div class="phones">{phone("05-home-new", 270, -5, 30) + phone("16-steward", 270, 5, 60)}</div>
<div class="play"><i></i></div></body></html>"""


JOBS = [
    ("banner.png", banner(), 1800, 760),
    ("tour-onboarding.png", tour("01 · Get in", "One passkey, no password", "Sign up with your face or fingerprint. The phone is the account: no seed phrase, no extension, nothing to write down. Every new account starts with test money.", ["01-landing", "04-signup", "05-home-new"]), 1800, 1110),
    ("tour-rent.png", tour("02 · The house", "A rent pot that fills itself", "Set up the house, invite housemates with a private link, and everyone pays their share into one pot. Chainlink pays the landlord on rent day.", ["06-house-new", "07-invite", "08-home-rent"]), 1800, 1110),
    ("tour-split.png", tour("03 · Shared costs", "Splits without the chasing", "Add the dinner once, everyone settles with a tap. The house page keeps members and encrypted notes like the Wi-Fi password.", ["10-split-add", "11-split-settle", "09-house"]), 1800, 1110),
    ("tour-send.png", tour("04 · Money home", "Home in seconds, with no fee", "Pick Mama, enter an amount, see the live rate. Agora settles it instantly on Monad, and Mama gets a receipt she can open on any phone.", ["12-send-amount", "13-send-review", "15-receipt"]), 1800, 1110),
    ("tour-steward.png", tour("05 · The steward", "A steward that keeps the books", "Ask who still owes rent and get a straight answer from the ledger, with a reminder ready to send. It can suggest, but only your passkey can pay.", ["16-steward", "17-home-activity", "02-landing-pot"]), 1800, 1110),
    ("demo-thumbnail.png", thumbnail("The household account, live on Monad", "1:53"), 1600, 900),
]


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for name, html, w, h in JOBS:
            pg = await b.new_page(viewport={"width": w, "height": h}, device_scale_factor=1)
            await pg.set_content(html, wait_until="networkidle")
            await pg.evaluate("document.fonts.ready")
            await pg.screenshot(path=os.path.join(HERE, name))
            await pg.close()
            print("built", name)
        await b.close()


asyncio.run(main())
