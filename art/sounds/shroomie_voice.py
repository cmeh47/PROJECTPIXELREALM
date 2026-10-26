"""Synthesizes the Shroomie's voice: "...WeeeeeiiiieWeWeWeeeiiiiii..."

A squeaky, DS-style chirp: a soft pulse wave with vibrato, one pitch glide per syllable.
Run with Python 3 and numpy; it writes assets/sounds/shroomie.wav (22.05 kHz, 16-bit mono).
"""
import os
import wave

import numpy as np

RATE = 22050

# (seconds, start Hz, peak Hz, end Hz): "Weeeeeiiiie", "We", "We", "Weeeiiiiii"
SYLLABLES = [
    (0.50, 520, 1050, 1250),
    (0.11, 560, 980, 900),
    (0.11, 560, 1020, 940),
    (0.62, 540, 1100, 1350),
]
GAP = 0.035


def syllable(dur, f0, f1, f2):
    n = int(dur * RATE)
    t = np.arange(n) / RATE
    u = t / dur
    # "W": a quick scoop up from f0, then "eee" holds near f1 and drifts to f2 for the "iii".
    scoop = np.clip(u / 0.18, 0, 1)
    pitch = f0 + (f1 - f0) * (1 - (1 - scoop) ** 3) + (f2 - f1) * np.clip((u - 0.45) / 0.55, 0, 1)
    pitch *= 1 + 0.025 * np.sin(2 * np.pi * 11 * t)  # a little wobble, like a tiny voice
    phase = 2 * np.cumsum(pitch) / RATE * np.pi
    pulse = np.where((phase / (2 * np.pi)) % 1 < 0.3, 1.0, -1.0)
    tone = 0.45 * pulse + 0.55 * np.sin(phase)
    env = np.minimum(1, t / 0.015) * np.minimum(1, (dur - t) / 0.05)
    return tone * env


def main():
    parts = []
    for s in SYLLABLES:
        parts.append(syllable(*s))
        parts.append(np.zeros(int(GAP * RATE)))
    sig = np.concatenate(parts)
    # Soften the square edges with a short moving average, then quantize like an old handheld.
    sig = np.convolve(sig, np.ones(4) / 4, mode="same")
    sig = np.round(sig * 24) / 24
    sig = (sig / np.max(np.abs(sig)) * 0.6 * 32767).astype(np.int16)
    out = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "sounds", "shroomie.wav")
    with wave.open(out, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(sig.tobytes())
    print("wrote", os.path.normpath(out), f"{len(sig) / RATE:.2f}s")


if __name__ == "__main__":
    main()
