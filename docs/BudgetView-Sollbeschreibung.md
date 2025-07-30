## 1. Gesamtaufbau

* Horizontale Timeline: pro Monat ein Datentechnisch zusammenhängender Block aus **Monats‑Header** (oben) + **Wertebereich** (darunter).
* Vertikale Struktur: links sticky **Typ** („Ausgaben“ oben / „Einnahmen“ unten) → djeweils darunter eingerückt sticky **Kategoriegruppe und darin befindliche Einzelkategorien** (Designtechnisch etwas voneinander abgehoben) → rechts die wiederholten Monatsblöcke.

## 2. Monatsanzahl steuern

* **6 Kalendersymbole** neben dem YearPaging‑Header definieren den benutzer­gesteuerten Max‑Wert.
* Klickt der User z. B. **Symbol 4**, werden **nie mehr als 4 Monatsspalten** gezeigt – selbst auf Ultra‑Wide‑Screens.
* Bei Verengung reduziert das System die Spalten weiter, sodass die Darstellung der Werte stets lesbar bleiben; umgekehrt expandiert es höchstens bis zum gewählten Max‑Wert.

## 3. Zeilen‑ und Spalten­logik + Muuri‑Sorting

| Ebene                | Inhalt                                                 | Muuri‑Verhalten                                                                                                                               |
| -------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Monatsgruppe**     | Monats-Header + Wertebereich                           | Nicht sortierbar; wird gemeinsam verschoben via Paging-Komponente                                                                             |
| **Typ**              | Ausgaben / Einnahmen (inkl. geplanter Typ‑Summenzeile) | Keine Typ‑übergreifende Sortierung                                                                                                            |
| **Kategorie­gruppe** | Lebensbereiche (Summen­zeile)                          | Drag & Drop innerhalb des Typs<br>`categoryGroup.sortOrder`                                                                                   |
| **Einzel­kategorie** | konkrete Budget­kategorie                              | Einheit aus linker Zelle + allen Monatswerten<br>Sortable innerhalb der Gruppe **und** gruppen­übergreifend (Typ‑fix)<br>`category.sortOrder` |

## 4. Muuri‑Pflichten

* **Reflow**: Nach jedem Drag & Drop passt Muuri Abstände zwischen Gruppenkopf und Kategorien dynamisch an.
* **Collapsing**:
  * Gruppen einzeln expandier-/collapsbar.
  * Alle Gruppenköpfe global ein-/ausblendbar.
  * Typenzeile nicht collapse/expandierbar
* **Sticky‑Logik**:
  * Horizontal:
    * linke Spalte mit Typ, Gruppe und Einzelkategorie bleibt stets erhalten.
    * Die Einzelkategoriezeile ist eine UI-Einheit bestehend aus linker Sticky-Zelle + korrespondierenden Monatswert-Zellen. Diese komplette Einheit ist Muuri-sortierbar.
  * Vertikal:
    * Typ bleibt immer sichtbar
    * Darunter bleiben die Gruppenköpfe immer sichtbar, solange Einzelkategorien des Typs im Bild sind.
    * Mit Gruppenwechsel (wenn Folgegruppe an Vorgruppe anschlägt), verschwindet der Gruppenkopf, dessen Kategorien weggescrollt sind.
    * Kommt der Eingabe Typ nach oben, verschwindet bei Anschlag auch der Ausgabetyp.

## 5. Synchronisation Monatsblöcke

* Monats‑Header und Wertebereich sind zwei Komponenten, werden aber **in der Vertikalen** zusammengehalten und nur gemeinsam horizontal verschoben bei Nutzung der YearPaging‑Header-Komponente.
* Reihenfolge und Sichtbarkeit folgen der YearPaging‑Header-Komponente und dem Kalendersymbol‑Limit.

## 6. Sticky‑Elemente

* **Typ‑, Gruppen-** und **Kategoriespalte** bleiben fix links anschlagend.
* Beim Collapse von Gruppen wird Platzverbrauch korrekt von Muuri neu berechnet.
* Nur der Monatsbereich scrollt/Paged horizontal.

## 7. Wichtige Constraints

1. Einzel­kategoriezeile ist unteilbar.
2. Typ‑Summenzeile (geplant) erbt Sticky‑ und Sortierlogik, bleibt typ‑fix.

## 8. Realisierungsrelevante Hinweise aus Muuri-Doku
#### 1. **Einzelkategorie = Muuri-Item**

* Jede **Einzelkategoriezeile (links + Monatswerte)** muss ein eigenständiges Muuri-Item sein.
* Diese Zeile darf **nicht** in DOM mehrere Container aufteilen (z. B. linke + rechte Tabelle getrennt), sonst funktioniert Drag & Drop nicht.
* Lösung: Linke Spalte und Monatswerte in **einem gemeinsamen Container rendern**, das als `.muuri-item` fungiert.

#### 2. **Kategoriegruppenzeilen = eigene Items (optional)**

* Wenn Gruppenzeilen mit verschoben werden sollen (z. B. per Drag & Drop), müssen auch diese Items im Grid sein.
* Alternative: **Visuelle Kopfzeile nicht als Muuri-Item**, aber Position neu berechnen per `layout()` nach Sort.

#### 3. **Sticky-Spalten ≠ Teil von Muuri**

* Sticky-Effekt für Typ / Gruppe / Kategorie **außerhalb von Muuri lösen** (CSS, evtl. JS-Scrollsync).
* Muuri ist rein für die vertikale Reihenfolge & Position zuständig – kein Grid/Sticky-Layout-Manager.

#### 4. **Layout-Reflow bei Collapse/Expand**

* Bei jedem Collapse/Expand einer Gruppe unbedingt `grid.refreshItems()` + `grid.layout()` ausführen.
* Sonst falsche Abstände oder Sprünge.

#### 5. **Virtuelles Paging = kompatibel**

* Du kannst Monate per `v-for` dynamisch reduzieren (je nach Paging/Viewport).
* Wichtig: Jedes sichtbare Monatsfeld muss **Teil des Muuri-Item-Containers** bleiben, sonst bricht die visuelle Einheit.

#### 6. **Multi-Grid (für Typen) nur mit Custom Logic**

* Willst Du Muuri-Grids für Einnahmen vs. Ausgaben trennen, musst Du `dragSort()` manuell definieren → Items dürfen nur im eigenen Grid bleiben.
* Default: Drag über Grid-Grenzen möglich.

#### 7. **Index-Tracking bei Sortierlogik**

* Nutze `sortData` oder `item.getElement().dataset.sortorder`, um den neuen `sortOrder` nach `move()` zu ermitteln und in Store zu schreiben.
* Optional: `grid.on('move', ...)` verwenden, um Sortierung zentral zu erfassen.

---

### 💡 Empfehlung zur Architektur

| Bereich                        | Empfehlung                                                                    |
| ------------------------------ | ----------------------------------------------------------------------------- |
| **Einzelkategoriezeile**       | 1 Muuri-Item mit kombinierter Struktur (Sticky-Teil + Wertebereich)           |
| **Gruppe (optional)**          | Wenn verschiebbar: eigenes Muuri-Item. Ansonsten außerhalb, aber mit layout() |
| **Typ-Ausprägung (Einnahmen)** | Getrenntes Muuri-Grid oder `dragSortPredicate` → nur innerhalb Typ erlauben   |
| **Collapse/Expand**            | Immer `refreshItems()` und `layout()` nach DOM-Manipulation                   |
| **Werte-Monatsbereich**        | Muss im gleichen Item-Container sein wie Sticky-Bereich                       |
