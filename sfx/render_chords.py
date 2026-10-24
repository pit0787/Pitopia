"""Rendert E-Moll und E-Dur als je einen ausklingenden Abschlag aus echten Einzelton-Aufnahmen einer Konzertgitarre
(tonejs-instruments „guitar-nylon“, CC BY 3.0, dieselben Aufnahmen wie im Spiel). Beide Akkorde entstehen identisch,
nur die G-Saite unterscheidet sich: G (Moll) gegen Gis (Dur).

Aufruf: python3 sfx/render_chords.py <samples.json>
"""
import base64, json, subprocess, sys, tempfile, os
import numpy as np

SR = 44100
CHORDS = {"emoll": [40, 47, 52, 55, 59, 64], "edur": [40, 47, 52, 56, 59, 64]}  # E H e G/Gis h e'
# Lautstärke der Terz: Gis entsteht aus einer leiseren Aufnahme, deshalb gleichen wir an (gemessen per Chroma-Analyse)
THIRD = {"emoll": 1.8, "edur": 3.0}

def decode(b64):
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
        f.write(base64.b64decode(b64)); name = f.name
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", name, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout
    os.unlink(name); return np.frombuffer(raw, np.float32).copy()

def note(bank, m):
    base = min((int(k) for k in bank), key=lambda k: abs(k - m))
    x = decode(bank[str(base)]); r = 2 ** ((m - base) / 12)
    if r != 1:  # Tonhöhe anpassen wie im Spiel (playbackRate)
        x = np.interp(np.arange(0, len(x) - 1, r), np.arange(len(x)), x).astype(np.float32)
    i = np.argmax(np.abs(x) > 0.02)  # Stille am Anfang weg
    return x[max(0, i - 40):]

def main():
    bank = json.load(open(sys.argv[1]))["k"]
    for name, notes in CHORDS.items():
        out = np.zeros(int(3.0 * SR), np.float32)
        for k, m in enumerate(notes):
            x = note(bank, m) * (1.0 - 0.06 * k) * (THIRD[name] if k == 3 else 1.0); at = int(k * 0.022 * SR)  # Terz (G-Saite) etwas lauter, damit Moll/Dur klar hörbar ist
            n = min(len(x), len(out) - at); out[at:at + n] += x[:n]
        t = np.arange(len(out)) / SR; out *= np.clip((3.0 - t) / 0.7, 0, 1)  # sanft ausblenden
        tmp = f"/tmp/{name}.wav"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", tmp], input=(out / np.abs(out).max() * .9).tobytes(), check=True)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tmp, "-af", "loudnorm=I=-16:TP=-1.5", "-ar", str(SR), "-b:a", "96k", f"sfx/{name}.mp3"], check=True)
        print(name, "fertig")

if __name__ == "__main__":
    main()
