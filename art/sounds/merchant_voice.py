"""Synthesizes Puul the merchant's voice: a quick, bright chatter, looped while his text types out.

A mid-pitched square-ish blip per syllable, rising and falling like a sales pitch, with short gaps.
Quicker and higher than the butcher's grunts, softer than a Shroomie's squeak. Run with Python 3
and numpy; it writes assets/sounds/merchant.wav (22.05 kHz, 16-bit mono).
"""
import os
import wave

import numpy as np

RATE = 22050

# (seconds, start Hz, end Hz, pause after): "ba-de-da, ba-di", a lilting patter.
SYLLABLES = [
    (0.07, 260, 300, 0.035),
    (0.06, 300, 280, 0.03),
    (0.09, 320, 250, 0.08),
    (0.06, 270, 310, 0.03),
    (0.08, 300, 240, 0.12),
]


def syllable(dur, f0, f1):
    n = int(dur * RATE)
    t = np.arange(n) / RATE
    u = t / dur
    pitch = f0 + (f1 - f0) * u
    phase = 2 * np.pi * np.cumsum(pitch) / RATE
    square = np.sign(np.sin(phase))
    tone = 0.45 * square + 0.55 * np.sin(phase)
    env = np.minimum(1, t / 0.008) * np.minimum(1, (dur - t) / 0.025)
    return tone * env


def main():
    parts = []
    for dur, f0, f1, pause in SYLLABLES:
        parts.append(syllable(dur, f0, f1))
        parts.append(np.zeros(int(pause * RATE)))
    sig = np.concatenate(parts)
    sig = np.convolve(sig, np.ones(5) / 5, mode="same")
    sig = np.round(sig * 24) / 24
    sig = (sig / np.max(np.abs(sig)) * 0.5 * 32767).astype(np.int16)
    out = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "sounds", "merchant.wav")
    with wave.open(out, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(sig.tobytes())
    print("wrote", os.path.normpath(out), f"{len(sig) / RATE:.2f}s")


if __name__ == "__main__":
    main()
