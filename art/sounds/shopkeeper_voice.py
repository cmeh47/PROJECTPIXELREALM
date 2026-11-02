"""Synthesizes Mira's voice (the critter store owner): a light, sing-song chirp, looped while her
text types out.

Soft, mostly-sine blips pitched well above Puul's, each one lilting up at the end like a friendly
question, with a touch of square for pixel bite. Run with Python 3 and numpy; it writes
assets/sounds/shopkeeper.wav (22.05 kHz, 16-bit mono).
"""
import os
import wave

import numpy as np

RATE = 22050

# (seconds, start Hz, end Hz, pause after): "la-li, la-lu-li", bright and bouncy.
SYLLABLES = [
    (0.06, 520, 600, 0.03),
    (0.07, 600, 560, 0.04),
    (0.05, 560, 660, 0.03),
    (0.08, 640, 540, 0.07),
    (0.06, 580, 680, 0.12),
]


def syllable(dur, f0, f1):
    n = int(dur * RATE)
    t = np.arange(n) / RATE
    u = t / dur
    pitch = f0 + (f1 - f0) * u * u
    phase = 2 * np.pi * np.cumsum(pitch) / RATE
    tone = 0.2 * np.sign(np.sin(phase)) + 0.8 * np.sin(phase)
    # A little vibrato-free sparkle an octave up.
    tone += 0.15 * np.sin(2 * phase)
    env = np.minimum(1, t / 0.006) * np.minimum(1, (dur - t) / 0.03)
    return tone * env


def main():
    parts = []
    for dur, f0, f1, pause in SYLLABLES:
        parts.append(syllable(dur, f0, f1))
        parts.append(np.zeros(int(pause * RATE)))
    sig = np.concatenate(parts)
    sig = np.convolve(sig, np.ones(3) / 3, mode="same")
    sig = np.round(sig * 24) / 24
    sig = (sig / np.max(np.abs(sig)) * 0.45 * 32767).astype(np.int16)
    out = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "sounds", "shopkeeper.wav")
    with wave.open(out, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(sig.tobytes())
    print("wrote", os.path.normpath(out), f"{len(sig) / RATE:.2f}s")


if __name__ == "__main__":
    main()
