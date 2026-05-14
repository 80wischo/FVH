# FVH App – Änderungen

## 14.05.2026

- **Dashboard:** "Auf einen Blick" durch "Diese Woche" ersetzt (aktuelle Woche, nur heute+zukunft)
- **Dashboard:** Team-Kennzahlen + Anwesenheit + Verhalten → eine Karte "📊 Übersicht"
  - 3 Spalten: Anwesenheit% | Verhalten% | Motivation%
  - Pro Spalte: Label (grün), % (groß), Spieler-Ranking mit Medaillen + Nummern
  - Farb-Skala: gold/silber/bronze (1-3), orange (<75%), rot (<55%)
  - ⚠️ nur bei <75%
- **Dashboard:** "Letzte Aktivitäten" zeigt nur noch Vergangenheit (keine Zukunfts-Termine)
- **Dashboard:** Leeres Dashboard zeigt jetzt "➕ Spieler hinzufügen"-Button

- **Spieler-Tab:** Rating-Info erweitert (Ampel-Label sichtbar, besuchte/gesamt Trainings)

- **Training:** Vergangene Einheiten klickbar → Detail-Ansicht mit Spieler-Statistik
- **Training:** 🗑️ Löschen-Button im Detail
- **Training:** Aus Kalender heraus klickbar (Anwesenheit nachtragen)

- **Spieltag:** Match-Liste zeigt ✅❓❌ statt nur "zugesagt"
- **Spieltag:** Neue "Aufstellung"-Funktion im Spiel-Detail
  - Formationen für 6+1: 2-3-1, 3-2-1, 2-2-2, 1-3-2
  - Spielfeld-Visualisierung (grün, Mittellinie, Strafraum)
  - Klick auf Position → Spieler aus zugesagten auswählen
  - Migration für alte Match-Daten (fehlendes `lineup`-Feld)

- **Kalender:** 3D-Effekte bei Markierungen entfernt (flaches Design)
- **Kalender:** Match-Tage schwarz statt gelb
- **Kalender:** Tag-Label größer (10px)
- **Kalender:** Trainingsplan zeigt nur noch Termine ab heute, klickbar

- **Verlauf:** Neuer Tab mit chronologischer Historie + Suchfilter

- **Einstellungen:** Trainingszeit von/bis (vorher nur eine Zeit)
- **Einstellungen:** "Ausgefallene Trainingstage" → "Kein Training"
- **Einstellungen:** 💾 Export / 📂 Import (JSON-Backup)

- **Wetter:** Koordinaten auf Haueneberstein korrigiert (48.806, 8.222)

- **Diverses:** Migration für alte localStorage-Daten
- **Bugfix:** Fehlender `DOMContentLoaded`-Listener (App startete nicht)
- **Bugfix:** Doppelte `FORMATIONS`-Konstante entfernt
