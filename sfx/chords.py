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

def main():
    seen, cands = set(), []
    for q in QUERIES:
        p = urllib.parse.urlencode({"action": "query", "generator": "search", "gsrsearch": f"{q} filetype:audio", "gsrnamespace": 6,
                                    "gsrlimit": 30, "prop": "imageinfo", "iiprop": "url|extmetadata", "format": "json"})
        for pg in json.loads(fetch(API + "?" + p)).get("query", {}).get("pages", {}).values():
            t = pg["title"]
            if t in seen or "imageinfo" not in pg: continue
            seen.add(t); ii = pg["imageinfo"][0]; m = ii["extmetadata"]; lic = clean(m.get("LicenseShortName", {}).get("value"))
            print("  gefunden:", t, "|", lic)
            low = t.lower()
            if not lic.lower().startswith(FREE) or not re.search(r"chord|akkord|acorde|accord", low): continue
            if not re.search(r"\be\b|\bem\b|e[ -_]?(minor|major|moll|dur)|mi[ _](menor|mayor|mineur|majeur)", low.replace("file:", " ")): continue
            cands.append({"title": t, "license": lic, "artist": clean(m.get("Artist", {}).get("value")), "url": ii["url"], "page": ii.get("descriptionurl"),
                          "desc": clean(m.get("ImageDescription", {}).get("value"))[:200]})
        time.sleep(1)
    print(len(cands), "Kandidaten")
    out = []
    for n, c in enumerate(cands[:16], 1):
        time.sleep(4)
        try:
            raw = f"/tmp/c{n}"; open(raw, "wb").write(fetch(c["url"]))
            dst = f"sfx/chord-{n}.mp3"
            subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", raw, "-ac", "1", "-ar", "44100", "-b:a", "96k", dst], check=True)
            c["file"] = dst; out.append(c); print(n, c["title"], c["license"])
        except Exception as e:
            print("Fehler", c["title"], e)
    json.dump(out, open("sfx/chords.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)

if __name__ == "__main__":
    main()
