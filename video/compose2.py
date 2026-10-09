"""Builds a narrated, motion-designed 1080p video from the raw phone footage.

    PYTHONIOENCODING=utf-8 python video/compose2.py video/demo.json video/out/vesta-demo.mp4

Logo intro, animated captions, phones that glide in, pop-up callouts, smooth
transitions between scenes with the voice cross-fading, and a logo end card.
"""
import asyncio
import json
import os
import shutil
import sys

from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(__file__))
from compose import FFMPEG, H, PH_H, PH_W, RADIUS, W, duration, mask, phone_slots, run, tts  # noqa: E402
import motion  # noqa: E402
import panels  # noqa: E402

WORK = "video/out/work2"
XF = 0.6  # transition length
BG = (246, 244, 239)


def background(path, phones, labels):
    img = Image.new("RGB", (W, H), BG).convert("RGBA")
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    g = ImageDraw.Draw(glow)
    g.ellipse((1050, -260, 1900, 520), fill=(70, 236, 184, 60))
    g.ellipse((1400, 560, 2150, 1320), fill=(253, 227, 167, 90))
    g.ellipse((-300, 700, 500, 1400), fill=(70, 236, 184, 28))
    glow = glow.filter(ImageFilter.GaussianBlur(140))
    img = Image.alpha_composite(img, glow)
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    for x, y in phone_slots(phones):
        sd.rounded_rectangle((x, y + 26, x + PH_W, y + PH_H + 26), RADIUS, fill=(15, 31, 26, 80))
    img = Image.alpha_composite(img, shadow.filter(ImageFilter.GaussianBlur(30)))
    d = ImageDraw.Draw(img)
    if phones > 1:
        from compose import font

        for (x, y), label in zip(phone_slots(phones), labels):
            f = font("seguisb.ttf", 24)
            tw = d.textlength(label, font=f)
            d.rounded_rectangle((x + PH_W / 2 - tw / 2 - 18, y - 52, x + PH_W / 2 + tw / 2 + 18, y - 12), 20, fill=(15, 76, 58))
            d.text((x + PH_W / 2, y - 32), label, font=f, fill=(255, 255, 255), anchor="mm")
    img.convert("RGB").save(path)


NOISE = ("Update available", "cre update", "cre account access", "Simulation complete", "HTTP: req=", "╭", "╰", "│  ", "Loading settings", "Skipping WorkflowEngine")


def terminal_lines(run, L):
    raw = [l for l in json.load(open(f"video/out/cre/{run}.json", encoding="utf8")) if not any(n in l["text"] for n in NOISE)]
    out, t, prev = [], 1.0, None
    for l in raw:
        gap = 0.25 if prev is None else min(max(l["t"] - prev, 0.08), 0.75)
        t += gap
        prev = l["t"]
        out.append({"t": t, "text": l["text"]})
    room = max(2.0, L - 2.5)
    if out and out[-1]["t"] > room:
        k = room / out[-1]["t"]
        for o in out:
            o["t"] *= k
    return out


def panel_html(panel, L):
    kind = panel["type"]
    if kind == "terminal":
        return panels.terminal_html(terminal_lines(panel["run"], L), panel["command"])
    if kind == "proof":
        proofs = {p["hash"]: p for p in json.load(open("video/out/proofs.json", encoding="utf8"))}
        proof = dict(proofs[panel["hash"]])
        if "pick" in panel:
            proof["events"] = [proof["events"][i] for i in panel["pick"]]
        return panels.proof_html(proof, panel["explorer"], panel.get("highlight"))
    if kind == "code":
        return panels.code_html(panel["path"], panel["first"], panel["last"], panel["hl"], panel.get("title"))
    raise ValueError(kind)


def badge_pos(n):
    if n == 0:
        return 1180, 955
    if n == 1:
        x, y = phone_slots(1)[0]
        return x - 250, y + PH_H - 190
    return 860, 960


def scene_part(i, sc, spec, rec, times, total):
    d = f"{WORK}/s{i}"
    os.makedirs(d, exist_ok=True)
    audio = f"{d}/voice.mp3"
    asyncio.run(tts(sc["say"], spec["voice"], spec["rate"], audio))
    L = duration(audio) + 1.3
    n = len(sc.get("phones", []))
    bg = f"{d}/bg.png"
    background(bg, n, [p["who"].title() for p in sc.get("phones", [])])

    jobs = [(motion.caption_html(sc["title"], sc["sub"], i, total), f"{d}/cap", 1.8, False)]
    panel = sc.get("panel")
    if panel:
        jobs.append((panel_html(panel, L), f"{d}/panel", L, False))
    badge = sc.get("badge")
    if badge:
        bx, by = badge_pos(n)
        jobs.append((motion.badge_html(badge["text"], badge.get("kind", "tx"), bx, by), f"{d}/badge", 0.9, False))
    motion.render_all(jobs)

    inputs = ["-loop", "1", "-t", f"{L:.2f}", "-i", bg, "-i", f"{WORK}/mask.png",
              "-framerate", "30", "-i", f"{d}/cap/%04d.png"]
    k_in = 3
    filters = [f"[2:v]tpad=stop_mode=clone:stop_duration={L:.2f}[cap]", "[0:v][cap]overlay=0:0:shortest=1[base0]"]
    last = "base0"
    if panel:
        inputs += ["-framerate", "30", "-i", f"{d}/panel/%04d.png"]
        filters.append(f"[{k_in}:v]tpad=stop_mode=clone:stop_duration={L:.2f}[pan]")
        filters.append(f"[{last}][pan]overlay=0:0:eof_action=repeat[bp]")
        last = "bp"
        k_in += 1
    for k, ph in enumerate(sc.get("phones", [])):
        start = times[(ph["who"], ph["from"])] + ph.get("skip", 0)
        end = times[(ph["who"], ph["to"])]
        clip = max(0.5, end - start)
        speed = min(max(1.0, clip / L), 4.0)
        take = min(clip, L * speed)
        inputs += ["-ss", f"{start:.2f}", "-t", f"{take:.2f}", "-i", rec[ph["who"]]]
        x, y = phone_slots(n)[k]
        delay = 0.25 + k * 0.18
        filters.append(
            f"[{k_in}:v]crop=iw/2:ih/2:0:0,setpts=(PTS-STARTPTS)/{speed:.3f},fps=30,scale={PH_W}:{PH_H}:flags=lanczos,"
            f"tpad=stop_mode=clone:stop_duration={L:.2f},trim=duration={L:.2f},format=rgba[c{k}];"
            f"[1:v]format=gray[m{k}];[c{k}][m{k}]alphamerge,fade=in:st={delay:.2f}:d=0.6:alpha=1[p{k}];"
            f"[{last}][p{k}]overlay=x={x}:y='{y}+110*pow(max(0,1-max(0,t-{delay:.2f})/0.8),3)':eval=frame[o{k}]"
        )
        last = f"o{k}"
        k_in += 1
    if badge:
        at = L * badge.get("at", 0.5)
        inputs += ["-framerate", "30", "-i", f"{d}/badge/%04d.png"]
        filters.append(f"[{k_in}:v]setpts=PTS-STARTPTS+{at:.2f}/TB,tpad=stop_mode=clone:stop_duration={L:.2f}[bd]")
        filters.append(f"[{last}][bd]overlay=0:0:eof_action=repeat[ob]")
        last = "ob"
        k_in += 1
    inputs += ["-i", audio]
    part = f"{d}.mp4"
    run([
        *inputs, "-filter_complex", ";".join(filters),
        "-map", f"[{last}]", "-map", f"{k_in}:a", "-af", "apad", "-t", f"{L:.2f}",
        "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", "-r", "30",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000", part,
    ])
    return part, L


def card_part(name, html, seconds, say, spec):
    d = f"{WORK}/{name}"
    motion.render_all([(html, f"{d}/f", seconds, True)])
    inputs = ["-framerate", "30", "-i", f"{d}/f/%04d.png"]
    if say:
        audio = f"{d}/voice.mp3"
        asyncio.run(tts(say, spec["voice"], spec["rate"], audio))
        seconds = max(seconds, duration(audio) + 1.8)
        inputs += ["-i", audio]
        amap = ["-map", "1:a", "-af", "adelay=500|500,apad"]
    else:
        inputs += ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"]
        amap = ["-map", "1:a"]
    run([
        *inputs, "-filter_complex", f"[0:v]tpad=stop_mode=clone:stop_duration={seconds:.2f},trim=duration={seconds:.2f}[v]",
        "-map", "[v]", *amap, "-t", f"{seconds:.2f}",
        "-c:v", "libx264", "-crf", "17", "-pix_fmt", "yuv420p", "-r", "30",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000", f"{d}.mp4",
    ])
    return f"{d}.mp4", seconds


def stitch(parts, out_path):
    """Chains the parts with xfade (video) and acrossfade (audio)."""
    kinds = ["fade"] + ["smoothleft"] * (len(parts) - 3) + ["fadeblack"]
    inputs, vf, af = [], [], []
    for p, _ in parts:
        inputs += ["-i", p]
    v, a, t = "0:v", "0:a", parts[0][1]
    for i in range(1, len(parts)):
        off = t - XF
        vf.append(f"[{v}][{i}:v]xfade=transition={kinds[i - 1]}:duration={XF}:offset={off:.3f}[v{i}]")
        af.append(f"[{a}][{i}:a]acrossfade=d={XF}:c1=tri:c2=tri[a{i}]")
        v, a = f"v{i}", f"a{i}"
        t = off + parts[i][1]
    run([*inputs, "-filter_complex", ";".join(vf + af), "-map", f"[{v}]", "-map", f"[{a}]",
         "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out_path])


def main(spec_path, out_path):
    global WORK
    WORK = f"video/out/work-{os.path.splitext(os.path.basename(out_path))[0]}"
    spec = json.load(open(spec_path, encoding="utf8"))
    rec = json.load(open(spec.get("raw", "video/out/raw/marks.json")))
    shutil.rmtree(WORK, ignore_errors=True)
    os.makedirs(WORK, exist_ok=True)
    mask(f"{WORK}/mask.png")
    times = {}
    for m in rec["marks"]:
        times.setdefault((m["phone"], m["scene"]), m["t"])

    parts = [card_part("intro", motion.intro_html(), 3.6, None, spec)]
    scenes = spec["scenes"]
    for i, sc in enumerate(scenes, 1):
        parts.append(scene_part(i, sc, spec, rec, times, len(scenes)))
        print(f"scene {i}: {parts[-1][1]:.1f}s  {sc['title']}", flush=True)
    o = spec["outro"]
    parts.append(card_part("outro", motion.outro_html(o["title"], o["sub"], o.get("url", "vesta-pi-neon.vercel.app")), 4.0, o["say"], spec))
    stitch(parts, out_path)
    print(f"done: {out_path} ({duration(out_path):.1f}s)")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
