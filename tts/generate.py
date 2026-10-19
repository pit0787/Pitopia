"""Vertont alle Sätze von Rocko mit OpenAI-TTS.

Liest tts/catalog.json ({Gruppe: [Sätze]}), erzeugt pro Satz eine MP3-Datei,
verkleinert sie mit ffmpeg (Mono, 32 kbit/s) und schreibt pro Stimmgruppe
tts/out/voices-<Gruppe>.json ({Satz: MP3 als Base64}).
"""
import base64, concurrent.futures as cf, json, os, subprocess, sys, tempfile, time, urllib.request, urllib.error

KEY = os.environ["KEY"]
VOICES = {
    "K": ("coral", "Sprich Deutsch wie ein fröhliches, aufgewecktes Kind von etwa sieben Jahren: hell, verspielt, langsam und deutlich."),
    "J": ("verse", "Sprich Deutsch wie ein lockerer, motivierter Jugendlicher von etwa vierzehn Jahren, frech und gut gelaunt."),
    "E": ("ash", "Sprich Deutsch wie ein lässiger, freundlicher Rockmusiker um die dreißig, mit etwas Energie."),
    "S": ("sage", "Sprich Deutsch ruhig, warm und langsam, sehr deutlich für ältere Zuhörer."),
}

def tts(text, voice, instructions):
    body = json.dumps({"model": "gpt-4o-mini-tts", "voice": voice, "instructions": instructions,
                       "input": text, "response_format": "mp3"}).encode()
    for attempt in range(6):
        req = urllib.request.Request("https://api.openai.com/v1/audio/speech", data=body,
                                     headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503) and attempt < 5:
                time.sleep(2 ** attempt)
                continue
            raise RuntimeError(f"HTTP {e.code}: {e.read()[:300]!r}")

def shrink(mp3):
    with tempfile.TemporaryDirectory() as d:
        src, dst = os.path.join(d, "a.mp3"), os.path.join(d, "b.mp3")
        open(src, "wb").write(mp3)
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", src, "-ac", "1", "-b:a", "32k", dst], check=True)
        return open(dst, "rb").read()

def main():
    catalog = json.load(open("tts/catalog.json", encoding="utf-8"))
    os.makedirs("tts/out", exist_ok=True)
    for group, texts in catalog.items():
        voice, instructions = VOICES[group]
        out = {}
        with cf.ThreadPoolExecutor(max_workers=4) as pool:
            futures = {pool.submit(lambda t: shrink(tts(t, voice, instructions)), t): t for t in texts}
            for f in cf.as_completed(futures):
                out[futures[f]] = base64.b64encode(f.result()).decode()
        json.dump(out, open(f"tts/out/voices-{group}.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        print(group, len(out), "Sätze", os.path.getsize(f"tts/out/voices-{group}.json") // 1024, "KB", flush=True)

if __name__ == "__main__":
    sys.exit(main())
