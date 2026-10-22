# Kite Kart 🪁

Ein Kitesurf-Rennspiel im Stil von Mario Kart – auf dem offenen Meer, für Handy und Browser.

## Spielen

**Direkt online spielen:** https://claude.ai/artifact/8GhpE7JXUCKtoArx7p7puc

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

## Regeln

- **Kraft 0–100:** Ankanten verbraucht Kraft, ohne Ankanten lädt sie sich langsam wieder auf (7/s).
  Bei 0 ist man erschöpft und kann erst ab 12 wieder ankanten. Der Kokos-Drink gibt sofort +60.
- **Kites verheddern:** Kommen sich zwei Kites zu nahe, stürzen beide und starten vom letzten
  Checkpoint aus dem Stand neu. Über einen Kite drüberspringen geht!
- **Tricks:** Im Sprung erneut „Sprung“ drücken. Ist der Trick vor der Landung fertig → Turbo.
  Sonst: Bauchklatscher.
- **Zeitlimit:** Jedes Rennen dauert maximal 3:00 Minuten. Die Rundenzahl ist pro Strecke so gewählt,
  dass ein Rennen ca. 2:20–2:45 dauert.
- **Wind:** Der Wind kommt pro Strecke aus einer festen Richtung (leicht zufällig gedreht, Pfeil oben im Bild).
  Halbwind ist am schnellsten, direkt gegen den Wind bist du langsamer. Die Kites fliegen auf der Lee-Seite
  und neigen sich mit dem Wind.

## Strecken

| Strecke | Länge pro Runde | Runden |
|---|---|---|
| Sonnen-Lagune (kurz) | 1050 m | 5 |
| Korallen-Riff (mittel) | 1750 m | 3 |
| Sturm-Kap (lang) | 2700 m | 2 |

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
