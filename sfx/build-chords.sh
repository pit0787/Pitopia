#!/bin/sh
# Hörbeispiele für den Vergleich Moll/Dur (Lektion 3.1): echte Akustikgitarren-Aufnahmen von Wikimedia Commons.
# E-Dur: "E-major.ogg" (WBOSITG, gemeinfrei), ein Anschlag, klingt aus.
# E-Moll: "G-Em.ogg" (XRyuichix, CC BY 3.0), der Em-Teil ab 1,3 s.
set -e
cd "$(dirname "$0")"
ffmpeg -loglevel error -y -ss 0 -t 3.0 -i chord-2.mp3 -af "afade=t=out:st=2.3:d=0.7,loudnorm=I=-16:TP=-1.5" -ac 1 -ar 44100 -b:a 96k edur.mp3
ffmpeg -loglevel error -y -ss 1.3 -t 1.6 -i chord-4.mp3 -af "afade=t=in:d=0.01,afade=t=out:st=1.2:d=0.4,loudnorm=I=-16:TP=-1.5" -ac 1 -ar 44100 -b:a 96k emoll.mp3
