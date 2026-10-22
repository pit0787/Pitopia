# Kite Kart 🪁

Ein Kitesurf-Rennspiel im Stil von Mario Kart – auf dem offenen Meer, für Handy und Browser.

## Spielen

**Jetzt spielen:** https://pit0787.github.io/Pitopia/

Die GitHub-Pages-Seite wird aus dem Branch `gh-pages` ausgeliefert (Inhalt = dieser Ordner).

Das Spiel ist eine reine Web-App (HTML + JavaScript + three.js, keine Installation nötig).
Es muss über einen Webserver geöffnet werden, z. B.:

```bash
cd kitesurf
npx http-server -p 8080     # oder: python3 -m http.server 8080
```

Dann im Browser `http://localhost:8080` öffnen – auf dem Handy die IP-Adresse des Rechners im
gleichen WLAN verwenden. Alternativ den Ordner per GitHub Pages veröffentlichen.
Am besten das Handy **quer** halten.

## Steuerung

| Handy | Tastatur | Funktion |
|---|---|---|
| Linke Bildschirmhälfte ziehen | ← / → | Lenken |
| **Sprung** (rechts) | Leertaste | Springen (10 Kraft). In der Luft nochmal = Trick |
| **Kante** (rechts, halten) | Shift / ↑ | Brett ankanten: schneller, kostet Kraft |
| Item-Knopf über „Sprung“ | E | Item benutzen |
| Pause-Knopf | P / Esc | Pause |
| Handy neigen (Neigungssteuerung im Startmenü einschalten) | – | Lenken wie mit einem Lenkrad |
| Im Sprung lenken/neigen | ← / → | Um die eigene Achse drehen (volle Drehung = Trick) |

## Vollbild

Sobald das Handy quer gehalten wird, wechselt das Spiel in den Vollbildmodus (Android/Chrome:
direkt beim Drehen oder spätestens beim nächsten Antippen – Browser erlauben Vollbild nur nach
einer Berührung). Auf dem iPhone gibt es im Browser kein Vollbild für Webseiten: Dort über
Teilen → „Zum Home-Bildschirm“ hinzufügen und Kite Kart vom Home-Bildschirm starten – dann läuft
es ohne Browserleisten.

## Neigungssteuerung

Im Startmenü „Neigungssteuerung“ einschalten (iPhone fragt nach Erlaubnis). Das Handy dann wie ein
Lenkrad nach links oder rechts drehen. Die Haltung während des Countdowns gilt als geradeaus; im
Pause-Menü kann neu kalibriert werden. Kleine Bewegungen bis 7° werden ignoriert, voller Einschlag
erst bei etwa 32°. Hinweis: In der eingebetteten Claude-Artefakt-Ansicht liefert der Browser keine
Sensordaten – dafür das Spiel direkt im Handy-Browser öffnen (z. B. über GitHub Pages).

## Regeln

- **Kraft 0–100:** Ankanten verbraucht Kraft, ohne Ankanten lädt sie sich langsam wieder auf (7/s).
  Bei 0 ist man erschöpft und kann erst ab 12 wieder ankanten. Der Kokos-Drink gibt sofort +60.
- **Kites verheddern:** Kommen sich zwei Kites zu nahe, stürzen beide und starten vom letzten
  Checkpoint aus dem Stand neu. Über einen Kite drüberspringen geht!
- **Tricks:** Im Sprung erneut „Sprung“ drücken. Ist der Trick vor der Landung fertig → Turbo.
  Sonst: Bauchklatscher.
- **Strecke:** Kein Rundkurs – jede Strecke führt einmal vom Start zum Ziel über abwechslungsreiche
  Geraden und Kurven. Die Strecken sind breit genug für Überholmanöver nebeneinander.
- **Zeitlimit:** Jedes Rennen dauert maximal 3:00 Minuten (je nach Strecke ca. 2:10–2:40).
- **Wind:** Der Wind kommt pro Strecke aus einer festen Richtung (leicht zufällig gedreht, Pfeil oben im Bild).
  Halbwind ist am schnellsten, direkt gegen den Wind bist du langsamer. Die Kites fliegen auf der Lee-Seite
  und neigen sich mit dem Wind.

## Spielelemente

- **Start-Turbo:** „Kante“ kurz vor „Los!“ (nach der 1) drücken und halten. Zu früh gedrückt = Fehlstart.
- **Windschatten:** Dicht hinter einem anderen Fahrer lädt sich eine Leiste – voll = Turbo.
  Zu nah dran verheddern sich aber die Kites.
- **Wellen:** Wer über eine Welle fährt, springt gratis und extra hoch – ideal für Tricks.
- **Bojen-Tore (Boardercross):** Durch die orangen Tore fahren gibt Turbo und +8 Kraft.
- **Felsen:** bremsen stark ab – drüberspringen ist erlaubt.
- **Böen-Felder:** helle, gestreifte Flecken auf dem Wasser: Turbo und +12 Kraft.
  Der Wind dreht außerdem während des Rennens langsam um bis zu 25°.
- **Abkürzungen:** In engen Kurven führt eine Rinne mit grünen Bojen quer hindurch.
  Offen nur ab Platz 4 – für die Führenden ist es eine bremsende Sandbank.
- **Items nach Abstand:** Wer führt, bekommt Verteidigungs-Items, dicht dahinter einfache Items,
  wer weit (über 200 m) zurückliegt, die starken Aufhol-Items.
- **Handicap nach Platz:** Wer hinten liegt, fährt schneller – +1,5 % Tempo für jeden Platz hinter dem
  Führenden (Platz 2 = +1,5 %, Platz 8 = +10,5 %). Gilt für alle Fahrer, auch für dich; die Anzeige steht unter deinem Platz.
- **K.-o.-Cup:** Drei Rennen auf allen drei Strecken. Nach Vorrunde (8 Fahrer) und Halbfinale (6)
  scheiden jeweils die letzten zwei aus, im Finale fahren die besten vier um den Cup.

## Strecken

| Strecke | Länge (Start → Ziel) | Charakter |
|---|---|---|
| Sonnen-Küste (kurz) | ca. 4,6 km | lange Geraden, sanfte Kurven, 56 m breit |
| Korallen-Riff (mittel) | ca. 5,1 km | viele Richtungswechsel, 52 m breit |
| Sturm-Kap (lang) | ca. 6,0 km | lange Geraden und zwei Haarnadelkurven, 48 m breit |

## Charaktere (Werte 1–5)

| Name | Typ | Schnell | Wendig | Geschick | Sprung | Trick |
|---|---|---|---|---|---|---|
| Kiko | Pinguin | 3 | 3 | 3 | 3 | 3 |
| Rosa | Robbe | 5 | 2 | 3 | 2 | 3 |
| Karl | Krabbe | 2 | 5 | 4 | 2 | 2 |
| Okto | Oktopus | 2 | 3 | 5 | 1 | 4 |
| Delfina | Delfin | 3 | 2 | 1 | 5 | 4 |
| Taro | Schildkröte | 4 | 2 | 4 | 2 | 3 |
| Mika | Möwe | 3 | 4 | 2 | 4 | 2 |
| Fritzi | Frosch | 2 | 3 | 1 | 4 | 5 |

- **Schnelligkeit:** Höchstgeschwindigkeit
- **Wendigkeit:** Kurvenradius
- **Geschicklichkeit:** Beschleunigung, weniger Kraftverbrauch beim Ankanten, weniger Tempoverlust neben der Strecke, schneller wieder auf dem Brett
- **Sprunghöhe:** Höhe und Dauer der Sprünge
- **Trick-Level:** Schnellere Tricks (mehr pro Sprung) und stärkerer Turbo bei der Landung

## Items

| Item | Wirkung |
|---|---|
| 💨 Wind-Böe | Kurzer Turbo |
| 🌪️ 3x Böe | Drei Turbos |
| 🥥 Kokos-Drink | +60 Kraft |
| 💣 Wasserbombe | Fliegt geradeaus, Treffer = Sturz |
| 🐡 Kugelfisch | Verfolgt den Fahrer direkt vor dir |
| 🌿 Seetang | Falle nach hinten, bringt zum Schleudern |
| 🫧 Schutzblase | Schützt vor einem Treffer oder Kite-Crash |
| 🌫️ Flaute | Alle vor dir verlieren Kraft und Tempo |

Wer weiter hinten liegt, bekommt stärkere Items.
