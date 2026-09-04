# Imkerverein Diepholz — Einseitige Visitenkarte

Dieses Repository enthält eine schlanke, statische Ein-Seiten-Website (Visitenkarte) für den Imkerverein Diepholz und Umgebend.

Inhalt:
- `index.html` – die Seite mit den Sektionen Über uns, Kontakt, Mitgliedschaft, Termine, Impressum
- `style.css` – Gestaltung, Hintergrundbild wird als `wabe.jpg` erwartet (oder es fällt auf ein Online-Bild zurück)
- `bees.js` – Canvas-Animation: 15 Bienen (Agentenmodell). Bei Scroll fliegen die Bienen weg; bei Mausnähe weichen sie langsam aus.

Configuration:
- Anzahl Bienen anpassen: In `bees.js` ist die Anzahl jetzt konfigurierbar über `window.BEE_CONFIG = { count: 20 }` oder `window.BEE_COUNT = 20` (setzen, bevor das Script geladen wird). Standard ist 15.

Schnell starten lokal:

```bash
# im Ordner öffnen
python3 -m http.server 8000
# Seite öffnen: http://localhost:8000
```

Deployment (GitHub Pages):
1. Neues Repo auf GitHub anlegen und die Dateien pushen.
2. In den Repository-Einstellungen GitHub Pages aktivieren (Branch `main` oder `gh-pages`).

Assets:
- Ziehe deine Bilddateien in den Ordner `assets/`. Die Seite erwartet `assets/honeycomb.jpg`, `assets/imkerverein_diepholz_logo.png`, `assets/bee1.png`, `assets/bee2.png`, `assets/bee3.png` und `assets/queen.png`.

Anpassungen / Hinweise:
- Die Seite ist bewusst minimal und in reinem HTML/CSS/Vanilla JS gehalten, um einfache Bereitstellung auf GitHub Pages zu ermöglichen.
- Impressum/Datenschutz sind Platzhalter – bitte durch echte Angaben ersetzen.
