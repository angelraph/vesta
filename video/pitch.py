"""Builds the 2-minute pitch video: the team, the problem, the product and real traction.

    PYTHONIOENCODING=utf-8 python video/pitch.py video/out/vesta-pitch.mp4

Slides are animated HTML rendered frame by frame (motion.py), narrated with the
same voice as the demo, and stitched with compose2's transitions. Every screen
is a real screenshot from media/screens; every number and quote comes from real
testers (numbers read from the Envio indexer on 12 Oct 2026).
"""
import base64
import html as esc
import io
import os
import shutil
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import compose2  # noqa: E402
import motion  # noqa: E402
from motion import BASE, FONTS, MARK  # noqa: E402

SPEC = {"voice": "en-NG-EzinneNeural", "rate": "+4%"}
DARK = "background: radial-gradient(1200px 800px at 30% 40%, #0a1a1c 0%, #02050a 60%); color:#f6f1e7;"
LIGHT = "background: #f6f4ef;"


def shot(name, width=420):
    im = Image.open(f"media/screens/{name}.png").convert("RGB")
    im = im.resize((width * 2, round(im.height * width * 2 / im.width)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=88)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def page(body_css, css, body):
    return f"""<html><head>{FONTS}<style>{BASE}
body {{ {body_css} }}
.k {{ position:absolute; left:140px; top:120px; font-size:30px; font-weight:800; letter-spacing:.16em; text-transform:uppercase; color:#e8833a; animation: fade 600ms 100ms both; }}
.h {{ position:absolute; left:140px; top:180px; width:1640px; font-weight:800; font-size:92px; line-height:1.04; letter-spacing:-.04em; animation: fade-up 800ms 250ms both cubic-bezier(.2,.8,.2,1); }}
{css}
</style></head><body>{body}</body></html>"""


def team():
    return page(DARK, """
.who { position:absolute; left:140px; top:470px; display:flex; align-items:center; gap:40px; animation: fade-up 800ms 700ms both cubic-bezier(.2,.8,.2,1); }
.av { width:150px; height:150px; border-radius:50%; background:#e8833a; display:flex; align-items:center; justify-content:center; font-size:80px; font-weight:800; color:#fff; }
.n { font-size:64px; font-weight:800; } .r { font-size:38px; color:#d9d3c7; margin-top:8px; }
.line { position:absolute; left:140px; top:720px; width:1500px; font-size:44px; line-height:1.35; color:#d9d3c7; animation: fade-up 800ms 1200ms both cubic-bezier(.2,.8,.2,1); }
.line b { color:#fff; }
""", """<div class="k">The team</div><div class="h">Built by one person who lives this.</div>
<div class="who"><div class="av">A</div><div><div class="n">angelraph</div><div class="r">Solo builder: product, design and engineering</div></div></div>
<div class="line">Building Vesta for <b>Monad Metropolis</b>, for the diaspora housemates I know: shared rent here, family back home.</div>""")


def problem():
    items = [("Banking app", "to pay rent"), ("Group chat", "to chase who owes what"), ("Head maths", "to split every bill"), ("Remittance app", "a fee, a cut on the rate, days to land")]
    cards = "".join(
        f'<div class="c" style="animation-delay:{700 + i * 220}ms"><div class="t">{esc.escape(a)}</div><div class="s">{esc.escape(b)}</div></div>'
        for i, (a, b) in enumerate(items)
    )
    return page(LIGHT, """
.row { position:absolute; left:140px; top:520px; display:flex; gap:28px; }
.c { width:395px; height:260px; border-radius:36px; background:#fff; box-shadow:0 0 0 2px #e6e1d6; padding:40px; animation: pop 700ms both cubic-bezier(.2,.8,.2,1); }
.t { font-size:44px; font-weight:800; letter-spacing:-.02em; } .s { margin-top:14px; font-size:32px; color:#5b6661; line-height:1.3; }
""", f"""<div class="k">The problem</div><div class="h">One house. Four apps.<br>Somebody always chasing.</div><div class="row">{cards}</div>""")


def product():
    phones = [("05-home-new", "One passkey account"), ("08-home-rent", "A rent pot that pays itself"), ("14-send-done", "Money home in seconds")]
    ph = "".join(
        f'<div class="p" style="animation-delay:{500 + i * 300}ms"><img src="{shot(n)}"><div class="l">{esc.escape(l)}</div></div>'
        for i, (n, l) in enumerate(phones)
    )
    return page(LIGHT, """
.k { left:120px; top:90px; } .h { left:120px; top:140px; font-size:70px; width:700px; }
.sub { position:absolute; left:120px; top:470px; width:640px; font-size:38px; line-height:1.4; color:#5b6661; animation: fade-up 800ms 400ms both cubic-bezier(.2,.8,.2,1); }
.row { position:absolute; right:90px; top:70px; display:flex; gap:34px; }
.p { width:330px; animation: pop 800ms both cubic-bezier(.2,.8,.2,1); text-align:center; }
.p img { width:330px; border-radius:44px; box-shadow:0 30px 60px -20px rgba(15,31,26,.35), 0 0 0 8px #0f1f1a; }
.l { margin-top:26px; font-size:30px; font-weight:700; }
""", f"""<div class="k">Vesta</div><div class="h">The bank account for a household.</div>
<div class="sub">Rent, splits and money home in one shared account. Sponsored fees, dollars and names on every screen.</div><div class="row">{ph}</div>""")


def stack():
    rows = [("Monad", "every payment settles in about a second"), ("Mera", "one passkey is the account, no seed phrase"), ("Agora", "money home settles instantly, cash out back to dollars"),
            ("Chainlink CRE", "rent day runs itself: flags shortfalls, pays the landlord"), ("Envio", "the household ledger and the steward's memory of it")]
    r = "".join(
        f'<div class="r" style="animation-delay:{600 + i * 200}ms"><span class="b">{esc.escape(a)}</span><span class="d">{esc.escape(b)}</span></div>' for i, (a, b) in enumerate(rows)
    )
    return page(DARK, """
.list { position:absolute; left:140px; top:430px; display:flex; flex-direction:column; gap:26px; }
.r { display:flex; align-items:center; gap:34px; animation: slide-l 700ms both cubic-bezier(.2,.8,.2,1); }
.b { display:inline-block; min-width:330px; padding:14px 30px; border-radius:999px; background:#c5f06b; color:#0f4c3a; font-weight:800; font-size:36px; text-align:center; }
.d { font-size:40px; color:#e7e2d8; }
""", f"""<div class="k">Why now</div><div class="h">Fast, cheap rails finally make<br>a shared account possible.</div><div class="list">{r}</div>""")


def traction():
    stats = [("8", "people in one real house"), ("7", "joined by invite link"), ("8 / 8", "paid their rent share"), ("7", "sends home, by 6 people")]
    st = "".join(
        f'<div class="s" style="animation-delay:{600 + i * 200}ms"><div class="n">{esc.escape(a)}</div><div class="d">{esc.escape(b)}</div></div>' for i, (a, b) in enumerate(stats)
    )
    quotes = [("Sign in is sharp, sharp, and smooth. Paid my rent, all is dope so far.", "Tester"), ("Smooth and fast at the same time.", "Ken"), ("App looks solid, man.", "MrNetwork")]
    q = "".join(
        f'<div class="q" style="animation-delay:{1500 + i * 300}ms">“{esc.escape(a)}”<span>{esc.escape(b)}</span></div>' for i, (a, b) in enumerate(quotes)
    )
    return page(LIGHT, """
.stats { position:absolute; left:140px; top:330px; display:flex; gap:28px; }
.s { width:395px; padding:34px 38px; border-radius:36px; background:#0f4c3a; color:#fff; animation: pop 700ms both cubic-bezier(.2,.8,.2,1); }
.n { font-size:84px; font-weight:800; letter-spacing:-.03em; color:#c5f06b; } .d { font-size:30px; margin-top:6px; color:#e7efe9; }
.qs { position:absolute; left:140px; top:640px; display:flex; flex-direction:column; gap:22px; }
.q { font-size:40px; font-weight:600; animation: fade-up 700ms both cubic-bezier(.2,.8,.2,1); }
.q span { margin-left:22px; font-size:30px; font-weight:700; color:#e8833a; }
""", f"""<div class="k">Real people, real testnet money</div><div class="h">Tested by friends this week.</div><div class="stats">{st}</div><div class="qs">{q}</div>""")


SLIDES = [
    ("team", team, 4.0,
     "Hi, this is the Vesta pitch. Vesta is built by angelraph, a solo builder doing product, design and engineering, for people I know: housemates in the UK who pay rent together and support family back home."),
    ("problem", problem, 4.5,
     "Today one house runs on four apps. A banking app for rent. A group chat to chase who owes what. Mental maths for every bill. And a remittance app that charges a fee, takes a cut on the rate, and still takes days. Someone always ends up chasing."),
    ("product", product, 4.5,
     "Vesta is the bank account for a household. You open it with your phone lock, no password and no seed phrase. Everyone pays rent into one pot, bills split with a tap, and money home lands in seconds with a receipt your family can open. The blockchain stays invisible."),
    ("stack", stack, 4.5,
     "This is only possible now. Monad settles every payment in about a second. Mera makes one passkey the whole account. Agora settles money home instantly, and lets family convert it back. Chainlink runs rent day on its own, and Envio keeps the household ledger."),
    ("traction", traction, 5.0,
     "And people are using it. This week, eight friends moved into one real house on Vesta, seven of them through an invite link. All eight paid their rent share, and six of them sent money home. One tester said: sign in is sharp, sharp, and smooth."),
]
OUTRO_SAY = "Houses grow by invitation, so every sign-up brings the housemates with it. Vesta: money for the people you live with. Try it now on your phone."


def main(out_path):
    compose2.WORK = "video/out/work-vesta-pitch"
    shutil.rmtree(compose2.WORK, ignore_errors=True)
    os.makedirs(compose2.WORK, exist_ok=True)
    parts = [compose2.card_part("intro", motion.intro_html(), 3.6, None, SPEC)]
    for name, build, secs, say in SLIDES:
        parts.append(compose2.card_part(name, build(), secs, say, SPEC))
        print(f"{name}: {parts[-1][1]:.1f}s", flush=True)
    parts.append(compose2.card_part("outro", motion.outro_html("Vesta", "Money for the people you live with.", "vesta-pi-neon.vercel.app"), 4.0, OUTRO_SAY, SPEC))
    compose2.stitch(parts, out_path)
    print("done:", out_path, f"{compose2.duration(out_path):.1f}s", flush=True)


if __name__ == "__main__":
    assert MARK
    main(sys.argv[1])
