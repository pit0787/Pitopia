"""Sucht frei lizenzierte Applaus-/Jubel-Aufnahmen auf Wikimedia Commons, lädt sie und schneidet 2,3 s Ausschnitte.

Schreibt sfx/candidates.json (Titel, Lizenz, Urheber, Quelle) und sfx/applause-<n>.mp3.
"""
import json, os, re, subprocess, urllib.parse, urllib.request

API = "https://commons.wikimedia.org/w/api.php"
UA = {"User-Agent": "Pitopia-Rockstar/1.0 (sound effects for a guitar learning game)"}
FREE = ("cc0", "public domain", "pd", "cc by", "cc-by")

def get(params):
    url = API + "?" + urllib.parse.urlencode({**params, "format": "json"})
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
        return json.load(r)

def search(q):
    d = get({"action": "query", "generator": "search", "gsrsearch": f"{q} filetype:audio", "gsrnamespace": 6, "gsrlimit": 40,
             "prop": "imageinfo", "iiprop": "url|extmetadata|mediatype|size"})
    return list(d.get("query", {}).get("pages", {}).values())

def clean(h):
    return re.sub(r"<[^>]+>", "", h or "").strip()

def loudest(src, length=2.3):
    """Startzeit des lautesten Abschnitts (RMS in 0,1-s-Fenstern)."""
    out = subprocess.run(["ffmpeg", "-i", src, "-ac", "1", "-ar", "8000", "-f", "s16le", "-"], capture_output=True).stdout
    import array
    a = array.array("h", out); sr = 8000; win = sr // 10
    rms = [sum(x * x for x in a[i:i + win]) / win for i in range(0, max(0, len(a) - win), win)]
    n = int(length * 10)
    if len(rms) <= n: return 0.0
    best = max(range(len(rms) - n), key=lambda i: sum(rms[i:i + n]))
    return best / 10

def main():
    seen, cands = set(), []
    for q in ["applause cheering", "applause crowd cheer", "audience applause", "applause"]:
        for p in search(q):
            if p["title"] in seen or not p.get("imageinfo"): continue
            seen.add(p["title"]); ii = p["imageinfo"][0]; m = ii.get("extmetadata", {})
            lic = clean(m.get("LicenseShortName", {}).get("value"))
            if not lic.lower().startswith(FREE): continue
            cands.append({"title": p["title"], "license": lic, "artist": clean(m.get("Artist", {}).get("value")),
                          "url": ii["url"], "page": ii.get("descriptionurl"), "desc": clean(m.get("ImageDescription", {}).get("value"))[:200]})
    print(len(cands), "freie Kandidaten")
    os.makedirs("sfx", exist_ok=True)
    keep = []
    for c in cands[:12]:
        n = len(keep) + 1; raw = f"/tmp/raw{n}"
        try:
            with urllib.request.urlopen(urllib.request.Request(c["url"], headers=UA), timeout=60) as r, open(raw, "wb") as f:
                f.write(r.read())
            dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", raw], capture_output=True, text=True).stdout.strip() or 0)
            if dur < 2.3: continue
            t = loudest(raw)
            out = f"sfx/applause-{n}.mp3"
            subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-ss", str(t), "-t", "2.3", "-i", raw,
                            "-af", "afade=t=in:d=0.05,afade=t=out:st=1.8:d=0.5,loudnorm=I=-16:TP=-1.5",
                            "-ac", "1", "-ar", "44100", "-b:a", "64k", out], check=True)
            c.update({"file": out, "source_duration": round(dur, 1), "cut_at": t}); keep.append(c)
            print(n, c["title"], c["license"], round(dur, 1), "s, Schnitt ab", t)
        except Exception as e:
            print("Fehler", c["title"], e)
    json.dump(keep, open("sfx/candidates.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)

if __name__ == "__main__":
    main()
