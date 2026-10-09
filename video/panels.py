"""Side panels for the explainer videos: a terminal replay, an onchain proof
card and a code view. Each returns HTML for motion.render_all."""
import html as esc
import re

from motion import BASE, FONTS

PANEL = "left:860px; top:150px; width:980px; height:780px;"
MONO = "'Cascadia Mono','Consolas',monospace"


def _window(inner, title, dark=True):
    bg = "#0b1412" if dark else "#ffffff"
    bar = "#111d1a" if dark else "#f2efe8"
    tcol = "#8aa39a" if dark else "#56645e"
    dots = "".join(f'<i style="width:14px;height:14px;border-radius:9px;background:{c}"></i>' for c in ("#ff5f57", "#febc2e", "#28c840"))
    return (
        f'<div style="position:absolute; {PANEL} border-radius:26px; overflow:hidden; background:{bg};'
        f' box-shadow:0 40px 90px -30px rgba(15,31,26,.55), 0 0 0 1px rgba(15,31,26,.08);'
        f' animation: fade-up 800ms 250ms both cubic-bezier(.2,.8,.2,1);">'
        f'<div style="height:54px; background:{bar}; display:flex; align-items:center; gap:10px; padding:0 22px;">{dots}'
        f'<span style="margin-left:18px; font:600 20px Plus Jakarta Sans; color:{tcol}">{esc.escape(title)}</span></div>{inner}</div>'
    )


def terminal_html(lines, command, title="~/vesta/cre"):
    """lines: [{"t": seconds into the scene, "text": ...}]"""
    rows = [f'<div class="l" style="animation-delay:300ms"><span style="color:#46ecb8">$</span> {esc.escape(command)}</div>']
    for ln in lines:
        txt, color = ln["text"], "#cfe0d9"
        if "[USER LOG]" in txt:
            color, txt = "#c5f06b", "▸ " + txt.split("[USER LOG]", 1)[1].strip()
        elif "Written onchain" in txt or txt.startswith("✓") or "Result" in txt:
            color = "#46ecb8"
        elif "[SIMULATION]" in txt:
            color, txt = "#7f9a91", txt.split("Z ", 1)[-1]
        rows.append(f'<div class="l" style="animation-delay:{int(ln["t"] * 1000)}ms; color:{color}">{esc.escape(txt)}</div>')
    inner = f'<div style="padding:26px 30px; font:20px/1.55 {MONO}; color:#cfe0d9; white-space:pre-wrap; word-break:break-all;">{"".join(rows)}</div>'
    css = ".l { animation: line-in 220ms both ease-out; } @keyframes line-in { from { opacity:0; transform: translateY(6px); } to { opacity:1; transform:none; } }"
    return f"<html><head>{FONTS}<style>{BASE}{css}</style></head><body>{_window(inner, title)}</body></html>"


def _event_text(ev):
    a = ev["args"]
    n = ev["name"]
    if n == "RentShortfall":
        return f"House #{a['houseId']} · short by ${int(a['shortBy']) / 1e6:.2f}"
    if n == "RentCollected":
        return f"House #{a['houseId']} · ${int(a['amount']) / 1e6:.2f} paid to the landlord"
    if n == "SentHome":
        return f"${int(a['amount']) / 1e6:.2f} sent home"
    if n == "SettledHome":
        return f"Recipient paid out {int(a['amountOut']) / 1e18:.2f} in local currency"
    if n == "Transfer":
        token = ev["contract"].split(" ")[0]
        return f"{float(a['amount']):,.2f} {token} · {a['from']} → {a['to']}"
    if n == "Swap":
        return "AUSD swapped through Agora's pair"
    return ", ".join(f"{k}: {v}" for k, v in a.items())[:70]


def proof_html(p, explorer, highlight=None):
    evs = []
    for i, ev in enumerate(p["events"]):
        star = " star" if highlight and ev["name"] in highlight else ""
        evs.append(
            f'<div class="ev{star}" style="animation-delay:{900 + i * 260}ms"><div class="en">{esc.escape(ev["name"])}'
            f'<span>{esc.escape(ev["contract"])}</span></div><div class="ea">{esc.escape(_event_text(ev))}</div></div>'
        )
    rows = [
        ("Status", '<b style="color:#1f8a5b">✓ Success</b>'),
        ("Block", f"#{int(p['block']):,}"),
        ("Time", p["time"].replace("T", " ").replace(".000Z", " UTC")),
        ("From", esc.escape(p["from"])),
        ("To", esc.escape(p["to"])),
    ]
    kv = "".join(f'<div class="kv" style="animation-delay:{450 + i * 90}ms"><span>{k}</span><em>{v}</em></div>' for i, (k, v) in enumerate(rows))
    inner = (
        '<div style="padding:28px 38px;">'
        '<div class="h">Onchain proof <span>Monad testnet</span></div>'
        f'<div class="hash">{p["hash"]}</div>{kv}<div class="evt">Events emitted</div>{"".join(evs)}'
        f'<div class="link">{esc.escape(explorer)}</div></div>'
    )
    css = f"""
.h {{ font:800 34px Plus Jakarta Sans; letter-spacing:-.02em; display:flex; align-items:center; gap:16px; animation: fade-up 600ms 350ms both; }}
.h span {{ font:700 18px Plus Jakarta Sans; color:#0f4c3a; background:#e4efe9; padding:6px 14px; border-radius:999px; }}
.hash {{ margin-top:10px; font:17px {MONO}; color:#56645e; animation: fade 600ms 450ms both; }}
.kv {{ display:flex; justify-content:space-between; padding:9px 0; border-bottom:1px solid #eee9df; font-size:21px; animation: fade-up 500ms both cubic-bezier(.2,.8,.2,1); }}
.kv span {{ color:#56645e; }} .kv em {{ font-style:normal; font-weight:700; }}
.evt {{ margin-top:20px; font:800 17px Plus Jakarta Sans; letter-spacing:.12em; text-transform:uppercase; color:#e97f23; animation: fade 500ms 800ms both; }}
.ev {{ margin-top:10px; padding:14px 20px; border-radius:18px; background:#f6f4ef; animation: pop 600ms both cubic-bezier(.2,.8,.2,1); }}
.ev.star {{ background:#e9fbf3; box-shadow: inset 0 0 0 2px #46ecb8; }}
.en {{ font:800 23px Plus Jakarta Sans; display:flex; justify-content:space-between; }} .en span {{ font:600 17px Plus Jakarta Sans; color:#56645e; }}
.ea {{ margin-top:3px; font-size:20px; color:#0f1f1a; }}
.link {{ position:absolute; bottom:24px; left:38px; font:600 17px {MONO}; color:#0e9f86; animation: fade 600ms 1600ms both; }}
"""
    return f"<html><head>{FONTS}<style>{BASE}{css}</style></head><body>{_window(inner, 'Monad testnet · transaction', dark=False)}</body></html>"


def code_html(path, first, last, highlight, title=None):
    src = open(path, encoding="utf8").read().splitlines()[first - 1:last]

    def colour(s):
        s = esc.escape(s)
        s = re.sub(r"(//.*)$", r'<i style="color:#6f8a80">\1</i>', s)
        s = re.sub(r"\b(const|return|if|for|await|export|async|new|throw|continue|let)\b", r'<b style="color:#46ecb8;font-weight:600">\1</b>', s)
        s = re.sub(r"(&quot;[^&]*&quot;)", r'<span style="color:#fde3a7">\1</span>', s)
        return s

    rows = []
    for i, line in enumerate(src):
        n = first + i
        hl = " hl" if highlight[0] <= n <= highlight[1] else ""
        rows.append(f'<div class="r{hl}" style="animation-delay:{300 + i * 30}ms"><u>{n}</u>{colour(line) or " "}</div>')
    inner = f'<div style="padding:20px 0; font:18px/1.6 {MONO}; color:#cfe0d9; white-space:pre;">{"".join(rows)}</div>'
    css = """
.r { padding:0 26px; animation: fade 300ms both; }
.r u { text-decoration:none; display:inline-block; width:46px; color:#3f5a52; }
.hl { background: rgba(70,236,184,.13); box-shadow: inset 4px 0 0 #46ecb8; }
"""
    return f"<html><head>{FONTS}<style>{BASE}{css}</style></head><body>{_window(inner, title or path.split('/')[-1])}</body></html>"
