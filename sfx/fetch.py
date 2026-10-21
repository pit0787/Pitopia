"""Lädt ausgewählte frei lizenzierte Applaus-/Jubel-Aufnahmen von Wikimedia Commons (gemeinfrei/CC0/CC BY).

Schreibt sfx/src-<n>.mp3 (ganze Aufnahme, Mono 64 kbit/s) und sfx/sources.json (Titel, Lizenz, Urheber, Quelle).
Wartet zwischen den Downloads, damit Commons nicht drosselt (HTTP 429).
"""
import json, re, subprocess, time, urllib.parse, urllib.request

API = "https://commons.wikimedia.org/w/api.php"
UA = {"User-Agent": "Pitopia-Rockstar/1.0 (https://github.com/pit0787/Pitopia; sound effects for a guitar learning game)"}
TITLES = ["File:Sound Effects - Applause after a concert.ogg", "File:Festival concert people crowd.ogg",
          "File:Thomas Bresson - Applaudissements.mp3", "File:Audience participation at final show of Muppet*Vision 3D.ogg",
          "File:Fireworks end of act applause.ogg"]

def fetch(url, tries=6):
    for k in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 429 and k < tries - 1:
                time.sleep(10 * (k + 1)); continue
            raise

def clean(h):
    return re.sub(r"<[^>]+>", "", h or "").strip()

def main():
    q = urllib.parse.urlencode({"action": "query", "titles": "|".join(TITLES), "prop": "imageinfo", "iiprop": "url|extmetadata", "format": "json"})
    pages = json.loads(fetch(API + "?" + q))["query"]["pages"].values()
    out = []
    for n, p in enumerate(sorted(pages, key=lambda p: TITLES.index(p["title"]) if p["title"] in TITLES else 99), 1):
        if "imageinfo" not in p: print("fehlt", p.get("title")); continue
        ii = p["imageinfo"][0]; m = ii["extmetadata"]
        time.sleep(4)
        raw = f"/tmp/raw{n}"; open(raw, "wb").write(fetch(ii["url"]))
        dst = f"sfx/src-{n}.mp3"
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", raw, "-ac", "1", "-ar", "44100", "-b:a", "64k", dst], check=True)
        out.append({"file": dst, "title": p["title"], "license": clean(m.get("LicenseShortName", {}).get("value")),
                    "artist": clean(m.get("Artist", {}).get("value")), "page": ii.get("descriptionurl")})
        print(out[-1])
    json.dump(out, open("sfx/sources.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)

if __name__ == "__main__":
    main()
