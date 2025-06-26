**Zusammenfassung der Aufgaben und Prioritäten:**

1. **Stabile Verbindung (Prio 1):**
   - Sicherstellen, dass die Verbindung zwischen Frontend und Backend stabil ist.
   - Vermeiden, dass das Backend periodisch die Verbindung abbricht.
   - Implementierung eines stabilen Websockets, um eine durchgehend zuverlässige Kommunikation zu gewährleisten, und Reconnects vermeiden.

2. **Bildverarbeitung (Prio 2):**
   - Der physische Upload eines Bildes über die API funktioniert bereits. Wenn ein Bild aus einem Konto oder einer Kontogruppe entfernt wird, muss es im Backend ebenfalls gelöscht werden.
   - Sicherstellen, dass das Bild korrekt im Unterordner der aktuellen Tenant-ID gespeichert wird. Derzeit wird fälschlicherweise ein Test-Tenant-Ordner genutzt.
   - Der Pfad zum Bild muss im Backend unter `logo_path` gespeichert werden. Der Feldname unterscheidet sich derzeit zwischen Frontend (indexed DB nutzt nur `image`) und Backend.
   - Der Image-Link muss korrekt in der Datenbank gespeichert werden. Es gibt eine Diskrepanz zwischen "Image" und "Logo URL"; diese sollte beseitigt werden.
   - Implementierung einer Speicherroutine, um das Bild im Local Storage zu cachen und es beim Login zu aktualisieren, damit es auch bei Backend-Ausfällen verfügbar ist.
   - Bilder sollen in den Form-Komponenten (`accountform`, `accountcard`, `accountgroupform`, `accoundgroupcard`) korrekt angezeigt werden.
   - Nur JPG- und PNG-Bilder sollen für den Upload zugelassen werden, diese sollen auf eine Größe von 128px konvertiert werden. Eine unbegrenzte Dateigröße ist erlaubt.
   - Bereinigen der Bildpfadstruktur, um Verwechslungen zwischen `image` oder `logo_path` zu vermeiden.
   - Entfernen nicht benötigter Felder aus dem Schema und der Konfiguration.

**Weitere Schritte:**
- Erstelle ein PRD gemäß Vorgabe `@/tasks/create-prd.md` und lass den Architekten die notwendigen Maßnahmen prüfen, um die Aufgaben in kleinere Teilaufgaben zu unterteilen.
- Überarbeitet die Datei `@/_BE/app/api/deps.py`, um sicherzustellen, dass Bilder dynamisch in einen Unterordner der aktiven `tenantId` verschoben werden. Diese Information kann über `@/src/stores/sessionStore.ts` abgerufen werden.
- Implementieren eines Mechanismus, um beim Login das Bild stets neu aus dem Backend zu beziehen und im `localstorage` zu persistieren.
