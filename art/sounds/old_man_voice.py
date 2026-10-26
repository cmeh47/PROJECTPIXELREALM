"""Synthesizes the old butcher's grunts: "hrm... mm... hrrh...", looped while his text types out.

A low, buzzy DS-style grunt: a sawtooth softened with a short filter and a rough growl in the
pitch. Each grunt is followed by a pause, so the loop sounds like an old man muttering, not talking. Run with Python 3 and numpy; it writes
assets/sounds/oldman.wav (22.05 kHz, 16-bit mono).
"""
import os
import wave

import numpy as np

RATE = 22050

# (seconds, start Hz, end Hz, pause after): "hrm", "mm", "hrrh", each falling a little.
SYLLABLES = [
    (0.16, 150, 128, 0.22),
    (0.11, 138, 126, 0.18),
    (0.20, 158, 116, 0.30),
]


def syllable(dur, f0, f1):
    n = int(dur * RATE)
    t = np.arange(n) / RATE
    u = t / dur
    pitch = f0 + (f1 - f0) * u
    pitch *= 1 + 0.06 * np.sin(2 * np.pi * 23 * t)  # the growl: a fast, rough wobble
    phase = 2 * np.pi * np.cumsum(pitch) / RATE
    saw = 2 * ((phase / (2 * np.pi)) % 1) - 1
    tone = 0.6 * saw + 0.4 * np.sin(phase)
    # A vowel-ish bump: louder in the middle, a soft "m" at the edges.
    env = np.minimum(1, t / 0.025) * np.minimum(1, (dur - t) / 0.06) * (0.65 + 0.35 * np.sin(np.pi * u))
    return tone * env


def main():
    parts = []
    for dur, f0, f1, pause in SYLLABLES:
        parts.append(syllable(dur, f0, f1))
        parts.append(np.zeros(int(pause * RATE)))
    sig = np.concatenate(parts)
    # Muffle the buzz (he talks into his mustache), then quantize like an old handheld.
    sig = np.convolve(sig, np.ones(9) / 9, mode="same")
    sig = np.round(sig * 24) / 24
    sig = (sig / np.max(np.abs(sig)) * 0.6 * 32767).astype(np.int16)
    out = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "sounds", "oldman.wav")
    with wave.open(out, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(sig.tobytes())
    print("wrote", os.path.normpath(out), f"{len(sig) / RATE:.2f}s")


if __name__ == "__main__":
    main()
