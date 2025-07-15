# Tasks für Empfänger-Handling Refactoring

## Relevant Files

### Backend Files
- `../FinWise_0.4_BE/app/models/financial_models.py` - Transaction SQLAlchemy-Modell um recipientId erweitern
- `../FinWise_0.4_BE/app/models/schemas.py` - Pydantic-Schemas für Transaction-API erweitern
- `../FinWise_0.4_BE/app/crud/crud_transaction.py` - CRUD-Operationen für recipientId-Handling anpassen
- `../FinWise_0.4_BE/app/websocket/schemas.py` - WebSocket-Schemas für Transaction-Updates erweitern
- `../FinWise_0.4_BE/app/services/sync_service.py` - Sync-Service für recipientId-Synchronisation anpassen

### Frontend Files
- `src/types/index.ts` - Transaction-Interface um recipientId erweitern
- `src/stores/transactionStore.ts` - Transaction-Store für recipientId-Handling refactoren
- `src/stores/ruleStore.ts` - Regel-Store von payee auf recipientId umstellen
- `src/services/TransactionService.ts` - Transaction-Service für recipientId-First-Ansatz anpassen
- `src/services/CSVImportService.ts` - CSV-Import für recipientId-Zuordnung erweitern
- `src/services/TenantDbService.ts` - IndexedDB-Operationen für recipientId erweitern
- `src/services/WebSocketService.ts` - WebSocket-Service für Transaction-Sync anpassen
- `src/components/transaction/TransactionForm.vue` - Transaction-Formulare für recipientId anpassen
- `src/components/rules/RuleEditor.vue` - Regel-Editor für recipientId-Bedingungen

## Tasks

- [x] 1.0 Backend-Vorbereitung: Datenmodell und API-Schema erweitern
  - [x] 1.1 Transaction SQLAlchemy-Modell um recipientId-Feld erweitern (Optional, Foreign Key zu Recipients)
  - [x] 1.2 Pydantic-Schemas für Transaction-Payloads um recipientId erweitern
  - [x] 1.3 WebSocket-Schemas für bidirektionale Transaction-Synchronisation anpassen
  - [x] 1.4 Transaction-CRUD-Operationen für recipientId-Handling erweitern
  - [x] 1.5 Automatische payee-Ableitung aus recipientId implementieren (Recipient.name lookup)
- [x] 2.0 Frontend-Refactoring: Stores und Services für recipientId umstellen
  - [x] 2.1 Transaction-Interface in types/index.ts um recipientId erweitern
  - [x] 2.2 TransactionStore für konsistente recipientId-Verwendung refactoren
  - [x] 2.3 RuleStore-Logik von payee auf recipientId umstellen
  - [x] 2.4 TransactionService für recipientId-First-Ansatz anpassen
  - [x] 2.5 TenantDbService IndexedDB-Operationen für recipientId erweitern
- [x] 3.0 Synchronisation und WebSocket-Integration anpassen
  - [x] 3.1 WebSocketService für Transaction-Updates mit recipientId erweitern
  - [x] 3.2 Bidirektionale Synchronisation für recipientId-Feld implementieren
  - [x] 3.3 Last-Write-Wins-Konfliktlösung für Empfänger-Referenzen testen
  - [x] 3.4 Sync-Service im Backend für recipientId-Synchronisation anpassen
- [x] 4.0 CSV-Import und Regel-Engine für recipientId erweitern
  - [x] 4.1 CSVImportService für korrekte recipientId-Zuordnung erweitern
  - [x] 4.2 Payee-Text zu Recipient-Matching-Logik implementieren
  - [x] 4.3 Regel-Editor UI für recipientId-basierte Bedingungen anpassen
  - [x] 4.4 Transaction-Formulare für recipientId-basierte Eingabe anpassen
  - [x] 4.5 Empfänger-Auflösung für Anzeigezwecke implementieren (recipientId → Recipient.name)
