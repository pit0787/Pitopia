"""Sucht frei lizenzierte Gitarren-Aufnahmen von E-Moll und E-Dur auf Wikimedia Commons und lädt sie (mit Pausen gegen Drosselung).

Schreibt sfx/chord-<n>.mp3 und sfx/chords.json (Titel, Lizenz, Urheber, Quelle).
"""
import json, re, subprocess, time, urllib.parse, urllib.request

API = "https://commons.wikimedia.org/w/api.php"
UA = {"User-Agent": "Pitopia-Rockstar/1.0 (https://github.com/pit0787/Pitopia; chord examples for a guitar learning game)"}
FREE = ("cc0", "public domain", "pd", "cc by")
QUERIES = ["E minor chord guitar", "E major chord guitar", "Em chord guitar", "E chord guitar", "guitar chord E", "guitar chord Em",
           "E-Moll Gitarre", "E-Dur Gitarre", "Mi menor guitarra", "Mi mayor guitarra", "E minor guitar", "E major guitar", "open E chord"]

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

TITLES = ["File:E-minor.ogg", "File:A-minor.ogg", "File:D-minor.ogg", "File:E minor.ogg", "File:Em.ogg", "File:E-moll.ogg", "File:E minor chord.ogg", "File:Em chord.ogg"]

def main():
    q = urllib.parse.urlencode({"action": "query", "titles": "|".join(TITLES), "prop": "imageinfo", "iiprop": "url|extmetadata", "format": "json"})
    out = []
    for n, p in enumerate(json.loads(fetch(API + "?" + q))["query"]["pages"].values(), 1):
        if "imageinfo" not in p: print("fehlt", p.get("title")); continue
        ii = p["imageinfo"][0]; m = ii["extmetadata"]; time.sleep(4)
        raw = f"/tmp/c{n}"; open(raw, "wb").write(fetch(ii["url"]))
        dst = f"sfx/chord-{n}.mp3"
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", raw, "-ac", "1", "-ar", "44100", "-b:a", "96k", dst], check=True)
        out.append({"file": dst, "title": p["title"], "license": clean(m.get("LicenseShortName", {}).get("value")), "artist": clean(m.get("Artist", {}).get("value")),
                    "page": ii.get("descriptionurl"), "desc": clean(m.get("ImageDescription", {}).get("value"))[:300]})
        print(out[-1])
    json.dump(out, open("sfx/chords.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)

if __name__ == "__main__":
    main()
