#!/bin/sh
# Baut den 2,3-s-Applaus: Klatschen (src-1, CC0) plus Jubel der Menge (src-4, CC BY 3.0) leiser darunter.
set -e
cd "$(dirname "$0")"
ffmpeg -loglevel error -y -ss 0.1 -t 2.3 -i src-1.mp3 -ss 57.5 -t 2.3 -i src-4.mp3 -filter_complex \
 "[0:a]volume=1.0[a];[1:a]volume=0.55,highpass=f=150[b];[a][b]amix=inputs=2:normalize=0,afade=t=in:d=0.03,afade=t=out:st=1.8:d=0.5,loudnorm=I=-15:TP=-1.5,atrim=0:2.3" \
 -ac 1 -ar 44100 -b:a 64k applause.mp3
