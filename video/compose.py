"""Cuts the raw phone recordings into a narrated 1080p video.

    PYTHONIOENCODING=utf-8 python video/compose.py video/demo.json video/out/vesta-demo.mp4

Each scene gets a voice-over (edge-tts), a caption panel on the left and one
or two phones on the right. Phone footage is sped up (never slowed) to fit
the narration, and holds its last frame if it runs short.
"""
import asyncio
import json
import os
import re
import subprocess
import sys

import edge_tts
import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFilter, ImageFont

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
W, H = 1920, 1080
PH_H = 940
PH_W = round(PH_H * 390 / 844)  # 434
RADIUS = 54
BG = (246, 244, 239)
INK = (15, 31, 26)
INK2 = (86, 100, 94)
HEARTH = (15, 76, 58)
EMBER = (233, 127, 35)
LIME = (197, 240, 107)
FONTS = "C:/Windows/Fonts/"
WORK = "video/out/work"


def font(name, size):
    return ImageFont.truetype(FONTS + name, size)


def run(args):
    r = subprocess.run([FFMPEG, "-y", "-loglevel", "error", *args], capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(r.stderr[-2000:])


def duration(path):
    r = subprocess.run([FFMPEG, "-i", path], capture_output=True, text=True)
    h, m, s = re.search(r"Duration: (\d+):(\d+):([\d.]+)", r.stderr).groups()
    return int(h) * 3600 + int(m) * 60 + float(s)


def wrap(draw, text, f, width):
    words, lines, line = text.split(), [], ""
    for w in words:
        test = (line + " " + w).strip()
        if draw.textlength(test, font=f) <= width:
            line = test
        else:
            lines.append(line)
            line = w
    lines.append(line)
    return lines


def phone_slots(n):
    y = (H - PH_H) // 2
    if n == 1:
        return [(1330 - PH_W // 2, y)]
    return [(1120 - PH_W // 2, y), (1640 - PH_W // 2, y)]


def background(path, title, sub, step, total, phones, labels):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    # brand
    d.rounded_rectangle((120, 110, 168, 158), 14, fill=HEARTH)
    d.text((144, 134), "V", font=font("georgiab.ttf", 30), fill=(255, 255, 255), anchor="mm")
    d.text((184, 134), "Vesta", font=font("georgiab.ttf", 34), fill=HEARTH, anchor="lm")
    if step:
        d.text((120, 330), f"{step:02d} / {total:02d}", font=font("seguisb.ttf", 26), fill=EMBER)
    tf = font("georgiab.ttf", 70)
    y = 380
    for line in wrap(d, title, tf, 720):
        d.text((120, y), line, font=tf, fill=INK)
        y += 86
    # lime underline under the title
    d.rectangle((120, y + 14, 220, y + 22), fill=LIME)
    sf = font("segoeui.ttf", 34)
    y += 60
    for line in wrap(d, sub, sf, 700):
        d.text((120, y), line, font=sf, fill=INK2)
        y += 48
    # phone shadows and name tags
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    for x, yy in phone_slots(phones):
        sd.rounded_rectangle((x, yy + 24, x + PH_W, yy + PH_H + 24), RADIUS, fill=(15, 31, 26, 70))
    shadow = shadow.filter(ImageFilter.GaussianBlur(28))
    img = Image.alpha_composite(img.convert("RGBA"), shadow)
    d = ImageDraw.Draw(img)
    for (x, yy), label in zip(phone_slots(phones), labels):
        if phones > 1:
            tag = font("seguisb.ttf", 24)
            tw = d.textlength(label, font=tag)
            d.rounded_rectangle((x + PH_W / 2 - tw / 2 - 18, yy - 52, x + PH_W / 2 + tw / 2 + 18, yy - 12), 20, fill=HEARTH)
            d.text((x + PH_W / 2, yy - 32), label, font=tag, fill=(255, 255, 255), anchor="mm")
    img.convert("RGB").save(path)


def outro_background(path, title, sub):
    img = Image.new("RGB", (W, H), HEARTH)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((W / 2 - 60, 330, W / 2 + 60, 450), 34, fill=LIME)
    d.text((W / 2, 392), "V", font=font("georgiab.ttf", 70), fill=HEARTH, anchor="mm")
    d.text((W / 2, 560), title, font=font("georgiab.ttf", 110), fill=(255, 255, 255), anchor="mm")
    d.text((W / 2, 670), sub, font=font("segoeui.ttf", 44), fill=(220, 235, 228), anchor="mm")
    d.text((W / 2, 860), "vesta-pi-neon.vercel.app", font=font("seguisb.ttf", 30), fill=LIME, anchor="mm")
    img.save(path)


def mask(path):
    m = Image.new("L", (PH_W, PH_H), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, PH_W - 1, PH_H - 1), RADIUS, fill=255)
    m.save(path)


async def tts(text, voice, rate, path):
    # The voice service occasionally drops a request; try again before failing.
    for attempt in range(5):
        try:
            await edge_tts.Communicate(text, voice, rate=rate).save(path)
            return
        except Exception:
            if attempt == 4:
                raise
            await asyncio.sleep(2 + attempt * 2)


def main(spec_path, out_path):
    spec = json.load(open(spec_path, encoding="utf8"))
    rec = json.load(open("video/out/raw/marks.json"))
    os.makedirs(WORK, exist_ok=True)
    mask(f"{WORK}/mask.png")

    times = {}
    for m in rec["marks"]:
        times.setdefault((m["phone"], m["scene"]), m["t"])

    parts = []
    scenes = spec["scenes"]
    for i, sc in enumerate(scenes, 1):
        audio = f"{WORK}/s{i}.mp3"
        asyncio.run(tts(sc["say"], spec["voice"], spec["rate"], audio))
        L = duration(audio) + 0.9
        bg = f"{WORK}/s{i}.png"
        n = len(sc["phones"])
        background(bg, sc["title"], sc["sub"], i, len(scenes), n, [p["who"].title() for p in sc["phones"]])

        inputs = ["-loop", "1", "-t", f"{L:.2f}", "-i", bg, "-i", f"{WORK}/mask.png"]
        filters, last = [], "0:v"
        for k, ph in enumerate(sc["phones"]):
            start, end = times[(ph["who"], ph["from"])] + ph.get("skip", 0), times[(ph["who"], ph["to"])]
            clip = max(0.5, end - start)
            speed = min(max(1.0, clip / L), 4.0)
            take = min(clip, L * speed)
            inputs += ["-ss", f"{start:.2f}", "-t", f"{take:.2f}", "-i", rec[ph["who"]]]
            src = k + 2
            x, y = phone_slots(n)[k]
            filters.append(
                f"[{src}:v]crop=iw/2:ih/2:0:0,setpts=(PTS-STARTPTS)/{speed:.3f},fps=30,scale={PH_W}:{PH_H}:flags=lanczos,"
                f"tpad=stop_mode=clone:stop_duration={L:.2f},trim=duration={L:.2f},format=rgba[c{k}];"
                f"[1:v]format=gray[m{k}];[c{k}][m{k}]alphamerge[p{k}];"
                f"[{last}][p{k}]overlay={x}:{y}[o{k}]"
            )
            last = f"o{k}"
        inputs += ["-i", audio]
        part = f"{WORK}/s{i}.mp4"
        run([
            *inputs,
            "-filter_complex", ";".join(filters),
            "-map", f"[{last}]", "-map", f"{len(sc['phones']) + 2}:a",
            "-af", "apad", "-t", f"{L:.2f}",
            "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-r", "30",
            "-c:a", "aac", "-b:a", "192k", "-ar", "48000", part,
        ])
        print(f"scene {i}: {L:.1f}s  {sc['title']}", flush=True)
        parts.append(part)

    o = spec["outro"]
    audio = f"{WORK}/outro.mp3"
    asyncio.run(tts(o["say"], spec["voice"], spec["rate"], audio))
    L = duration(audio) + 2.0
    outro_background(f"{WORK}/outro.png", o["title"], o["sub"])
    run([
        "-loop", "1", "-t", f"{L:.2f}", "-i", f"{WORK}/outro.png", "-i", audio,
        "-af", "apad", "-t", f"{L:.2f}", "-vf", "fade=in:0:15",
        "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-r", "30",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000", f"{WORK}/outro.mp4",
    ])
    parts.append(f"{WORK}/outro.mp4")

    with open(f"{WORK}/list.txt", "w") as f:
        for p_ in parts:
            f.write(f"file '{os.path.abspath(p_)}'\n")
    run(["-f", "concat", "-safe", "0", "-i", f"{WORK}/list.txt", "-c", "copy", "-movflags", "+faststart", out_path])
    print(f"done: {out_path} ({duration(out_path):.1f}s)")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
