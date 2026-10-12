"""Puts angelraph's own recorded pitch under the pitch slides.

    PYTHONIOENCODING=utf-8 python video/pitch_voice.py <recording> video/out/vesta-pitch.mp4

The recording is cleaned (rumble, noise, loudness), two filler words and the
dead air at the start are cut, and it is sped up 10% to fit the 2-minute limit.
Each slide starts on the phrase it illustrates; the boundaries were found with
word timestamps from a local transcription of the recording.
"""
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(__file__))
import compose2  # noqa: E402
import motion  # noqa: E402
import pitch  # noqa: E402
from compose import FFMPEG, duration, run  # noqa: E402

WORK = "video/out/work-vesta-pitch-voice"
SPEED = 1.1
START, END = 1.2, 132.3
CUTS = [(32.95, 33.62), (116.1, 117.15)]  # "Okay, today," and "Okay,"
# Raw recording time where each slide begins.
SLIDES = [
    ("team", pitch.team, 0.0),
    ("problem", pitch.problem, 23.2),
    ("product", pitch.product, 46.5),
    ("stack", pitch.stack, 71.4),
    ("traction", pitch.traction, 94.7),
    ("outro", lambda: motion.outro_html("Vesta", "Money for the people you live with.", "vesta-pi-neon.vercel.app"), 116.0),
]


def to_out(t):
    """Raw recording time to finished-video time."""
    t = max(t, START)
    removed = sum(min(b, t) - a for a, b in CUTS if t > a)
    return (t - START - removed) / SPEED


def voice(src, out):
    keep, t = [], START
    for a, b in CUTS:
        keep.append((t, a))
        t = b
    keep.append((t, END))
    trims = "".join(f"[0:a]atrim={a}:{b},asetpts=PTS-STARTPTS[k{i}];" for i, (a, b) in enumerate(keep))
    joined = "".join(f"[k{i}]" for i in range(len(keep)))
    run(["-i", src, "-filter_complex",
         f"{trims}{joined}concat=n={len(keep)}:v=0:a=1,highpass=f=80,afftdn=nf=-25,atempo={SPEED},loudnorm=I=-16:TP=-1.5:LRA=11[a]",
         "-map", "[a]", "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", out])


def slide(name, html, seconds):
    d = f"{WORK}/{name}"
    motion.render_all([(html, f"{d}/f", 4.5, True)])
    run(["-framerate", "30", "-i", f"{d}/f/%04d.png", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
         "-filter_complex", f"[0:v]tpad=stop_mode=clone:stop_duration={seconds:.2f},trim=duration={seconds:.2f}[v]",
         "-map", "[v]", "-map", "1:a", "-t", f"{seconds:.2f}",
         "-c:v", "libx264", "-crf", "17", "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-ar", "48000", f"{d}.mp4"])
    return f"{d}.mp4", seconds


def main(src, out_path):
    shutil.rmtree(WORK, ignore_errors=True)
    os.makedirs(WORK, exist_ok=True)
    audio = f"{WORK}/voice.wav"
    voice(src, audio)
    total = duration(audio) + 1.2
    starts = [to_out(t) for _, _, t in SLIDES] + [total]
    parts = []
    for i, (name, build, _) in enumerate(SLIDES):
        # Every crossfade overlaps the next slide by XF, so pad all but the last.
        seconds = starts[i + 1] - starts[i] + (compose2.XF if i < len(SLIDES) - 1 else 0)
        parts.append(slide(name, build(), seconds))
        print(f"{name}: starts {starts[i]:.1f}s, {seconds:.1f}s", flush=True)
    silent = f"{WORK}/slides.mp4"
    compose2.stitch(parts, silent)
    # A fixed length, not -shortest: with apad in a filter, -shortest never ends.
    run(["-i", silent, "-i", audio, "-filter_complex", "[1:a]adelay=200|200,apad[a]", "-map", "0:v", "-map", "[a]",
         "-t", f"{duration(silent):.2f}", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out_path])
    print("done:", out_path, f"{duration(out_path):.1f}s", flush=True)


if __name__ == "__main__":
    assert os.path.exists(FFMPEG)
    main(sys.argv[1], sys.argv[2])
