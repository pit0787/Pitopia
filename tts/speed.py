"""Beschleunigt alle vorhandenen Aufnahmen (tts/out/voices-*.json) ohne Tonhöhenänderung (ffmpeg atempo).

Aufruf: python3 tts/speed.py 1.5
"""
import base64, concurrent.futures as cf, json, subprocess, sys, tempfile, os

def stretch(b64, tempo):
    with tempfile.TemporaryDirectory() as d:
        src, dst = os.path.join(d, "a.mp3"), os.path.join(d, "b.mp3")
        open(src, "wb").write(base64.b64decode(b64))
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", src, "-filter:a", f"atempo={tempo}",
                        "-ac", "1", "-b:a", "32k", dst], check=True)
        return base64.b64encode(open(dst, "rb").read()).decode()

def main():
    tempo = float(sys.argv[1])
    for g in "KJES":
        path = f"tts/out/voices-{g}.json"
        d = json.load(open(path, encoding="utf-8"))
        with cf.ThreadPoolExecutor(max_workers=8) as pool:
            futs = {pool.submit(stretch, v, tempo): k for k, v in d.items()}
            for f in cf.as_completed(futs):
                d[futs[f]] = f.result()
        json.dump(d, open(path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        print(g, len(d), os.path.getsize(path) // 1024, "KB", flush=True)

if __name__ == "__main__":
    main()
