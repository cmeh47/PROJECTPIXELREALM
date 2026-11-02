"""Synthesizes the voices inside the bar, looped while each line types out.

- bartender.wav: Barley, a deep, warm, round "hrm-ba-dum" with a little gravel.
- patron_low.wav: the gruffer regulars (Hob, Bram, Fen), a mid-low burble.
- patron_high.wav: Marigold and Tilly, a bright chatter, a bit lower and quicker than Mira's.
- patron_old.wav: Old Wendel, slow, wavering and a touch reedy.

Same recipe as the other voices: short pitched blips with a bit of square for pixel bite, softened
and crushed to 24 levels. Run with Python 3 and numpy; it writes the files to assets/sounds/
(22.05 kHz, 16-bit mono).
"""
import os
import wave

import numpy as np

RATE = 22050

# name: (syllables as (seconds, start Hz, end Hz, pause after), square mix, vibrato Hz, vibrato depth, gravel)
VOICES = {
    "bartender": (
        [(0.09, 150, 135, 0.04), (0.07, 140, 160, 0.03), (0.11, 165, 130, 0.08), (0.08, 145, 150, 0.12)],
        0.35, 0, 0, 0.12,
    ),
    "patron_low": (
        [(0.07, 210, 190, 0.03), (0.06, 200, 230, 0.03), (0.09, 225, 180, 0.07), (0.06, 190, 210, 0.1)],
        0.3, 0, 0, 0.05,
    ),
    "patron_high": (
        [(0.05, 430, 480, 0.025), (0.06, 470, 420, 0.03), (0.05, 440, 520, 0.03), (0.07, 500, 430, 0.1)],
        0.25, 0, 0, 0,
    ),
    "patron_old": (
        [(0.12, 250, 225, 0.06), (0.1, 235, 250, 0.05), (0.14, 245, 205, 0.14)],
        0.15, 6.5, 0.04, 0.03,
    ),
}


def syllable(dur, f0, f1, square, vib, depth, gravel, rng):
    n = int(dur * RATE)
    t = np.arange(n) / RATE
    u = t / dur
    pitch = (f0 + (f1 - f0) * u) * (1 + depth * np.sin(2 * np.pi * vib * t))
    phase = 2 * np.pi * np.cumsum(pitch) / RATE
    tone = square * np.sign(np.sin(phase)) + (1 - square) * np.sin(phase)
    tone += 0.2 * np.sin(2 * phase)
    if gravel:
        tone += gravel * rng.uniform(-1, 1, n) * np.abs(np.sin(phase))
    env = np.minimum(1, t / 0.008) * np.minimum(1, (dur - t) / 0.035)
    return tone * env


def main():
    rng = np.random.default_rng(7)
    here = os.path.dirname(__file__)
    for name, (sylls, square, vib, depth, gravel) in VOICES.items():
        parts = []
        for dur, f0, f1, pause in sylls:
            parts.append(syllable(dur, f0, f1, square, vib, depth, gravel, rng))
            parts.append(np.zeros(int(pause * RATE)))
        sig = np.concatenate(parts)
        sig = np.convolve(sig, np.ones(3) / 3, mode="same")
        sig = np.round(sig * 24) / 24
        sig = (sig / np.max(np.abs(sig)) * 0.45 * 32767).astype(np.int16)
        out = os.path.join(here, "..", "..", "assets", "sounds", f"{name}.wav")
        with wave.open(out, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(RATE)
            w.writeframes(sig.tobytes())
        print("wrote", os.path.normpath(out), f"{len(sig) / RATE:.2f}s")


if __name__ == "__main__":
    main()
