// src/services/AccountService.ts
import { useAccountStore } from '@/stores/accountStore';
import { useTransactionStore } from '@/stores/transactionStore';
import { AccountType, type Account, type AccountGroup } from '@/types'; // AccountType und AccountGroup als Typ importiert
import { v4 as uuidv4 } from 'uuid';
import { debugLog, errorLog, infoLog, warnLog } from '@/utils/logger'; // Erweiterte Logger-Importe
import { BalanceService } from './BalanceService';

interface AccountInfo {
  id: string;
  name: string;
  balance: number;
}

export const AccountService = {
  // ------------------------------------------------------------------ CRUD

  getAllAccounts(): Account[] {
    return useAccountStore().accounts;
  },

  async getAccountById(id: string): Promise<Account | null> {
    const acc = await useAccountStore().getAccountById(id);
    if (!acc) debugLog('[AccountService] Account not found', id);
    return acc || null;
  },

  async addAccount(accountData: Omit<Account, 'id' | 'uuid' | 'balance'>): Promise<Account | null> {
    const accountStore = useAccountStore();
    const newId = uuidv4(); // Generate a single UUID
    const newAccount: Account = {
      ...accountData,
      id: newId, // Use the generated UUID for id
      balance: 0, // Set initial balance to 0
    };
    // Annahme: addAccount im Store gibt das erstellte Konto oder null zurück
    return await accountStore.addAccount(newAccount);
  },

  async updateAccount(id: string, updates: Partial<Omit<Account, 'id'>>): Promise<boolean> {
    debugLog('[AccountService]', 'updateAccount', 'Updating account with id and updates', { id, updates });
    const accountStore = useAccountStore();
    const existingAccount = await accountStore.getAccountById(id);
    if (!existingAccount) {
      debugLog('[AccountService]', 'Account not found for update', { id });
      return false;
    }
    const updatedAccount = { ...existingAccount, ...updates };
    try {
      await accountStore.updateAccount(updatedAccount);
      return true;
    } catch (error) {
      debugLog('[AccountService]', 'Error updating account', { id, error });
      return false;
    }
  },

  async deleteAccount(id: string): Promise<boolean> {
    const txStore = useTransactionStore();
    if (txStore.transactions.some(tx => tx.accountId === id)) {
      debugLog('[AccountService]', 'Account has transactions, cannot delete', { accountId: id });
      return false;
    }
    try {
      await useAccountStore().deleteAccount(id);
      return true;
    } catch (error) {
      debugLog('[AccountService]', 'Error deleting account', { accountId: id, error });
      return false;
    }
  },

  // -------------------------------------------------------- Zentrale Salden

  /**
   * Liefert den Saldo eines Kontos zum Stichtag (default = heute).
   * Berücksichtigt nur Transaktionen bis zum angegebenen Datum.
   */
  getCurrentBalance(accountId: string, asOf: Date = new Date()): number {
    return BalanceService.getTodayBalance('account', accountId, asOf);
  },

  /**
   * Liefert den projizierten Saldo eines Kontos zum Stichtag (default = heute).
   * Berücksichtigt auch zukünftige geplante Transaktionen.
   */
  getProjectedBalance(accountId: string, asOf: Date = new Date()): number {
    return BalanceService.getProjectedBalance('account', accountId, asOf);
  },

  /**
   * Gesamtsaldo aller aktiven Konten zum Stichtag.
   */
  getTotalBalance(asOf: Date = new Date()): number {
    return BalanceService.getTotalBalance(asOf, false);
  },

  /**
   * Salden je Kontogruppe; liefert Objekt { groupId: balance }.
   */
  getGroupBalances(asOf: Date = new Date()): Record<string, number> {
    const accStore = useAccountStore();
    const result: Record<string, number> = {};
    for (const g of accStore.accountGroups) {
      result[g.id] = BalanceService.getAccountGroupBalance(g.id, asOf, false);
    }
    return result;
  },

  // --------------------------------------------------------- Convenience —

  async getAccountInfo(accountId: string): Promise<AccountInfo | null> {
    const acc = await this.getAccountById(accountId);
    if (!acc) return null;
    return {
      id: acc.id,
      name: acc.name,
      balance: this.getCurrentBalance(acc.id), // Annahme: getCurrentBalance bleibt synchron oder wird separat behandelt
    };
  },

  async getAccountName(id: string | null): Promise<string> {
    if (!id) return 'Kein Konto';
    const account = await this.getAccountById(id);
    return account?.name || 'Unbekanntes Konto';
  },

  getAccountNameSync(id: string | null): string {
    if (!id) return 'Kein Konto';
    const accountStore = useAccountStore();
    const account = accountStore.getAccountById(id);
    return account?.name || 'Unbekanntes Konto';
  },

  // ---------------------------------------------------- Account‑Groups CRUD

  getAllAccountGroups(): AccountGroup[] {
    return useAccountStore().accountGroups;
  },

  async getAccountGroupById(id: string): Promise<AccountGroup | null> {
    const group = await useAccountStore().getAccountGroupById(id);
    return group || null;
  },

  async addAccountGroup(groupData: Omit<AccountGroup, 'id'>): Promise<AccountGroup | null> {
    const newGroup: AccountGroup = { ...groupData, id: uuidv4() }; // Generate UUID here
    // Annahme: addAccountGroup im Store gibt die erstellte Gruppe oder null zurück
    return await useAccountStore().addAccountGroup(newGroup);
  },

  async updateAccountGroup(id: string, updates: Partial<Omit<AccountGroup, 'id'>>): Promise<boolean> {
    const accountStore = useAccountStore();
    const existingGroup = await accountStore.getAccountGroupById(id);
    if (!existingGroup) {
      debugLog('[AccountService]', 'Account group not found for update', { id });
      return false;
    }
    const updatedGroup = { ...existingGroup, ...updates };
    try {
      await accountStore.updateAccountGroup(updatedGroup);
      return true;
    } catch (error) {
      debugLog('[AccountService]', 'Error updating account group', { id, error });
      return false;
    }
  },

  async deleteAccountGroup(id: string): Promise<boolean> {
    const accStore = useAccountStore();
    // Annahme: accStore.accounts ist bereits geladen und synchron verfügbar
    if (accStore.accounts.some(acc => acc.accountGroupId === id)) {
      debugLog('[AccountService]', 'Account group has accounts, cannot delete', { accountGroupId: id });
      return false;
    }
    try {
      await accStore.deleteAccountGroup(id);
      return true;
    } catch (error) {
      debugLog('[AccountService]', 'Error deleting account group', { accountGroupId: id, error });
      return false;
    }
  },

  // ---------------------------------------------------- Account Group Sortierung

  async updateAccountGroupOrder(orderUpdates: { id: string, sortOrder: number }[]): Promise<void> {
    const accountStore = useAccountStore();
    infoLog('AccountService', `Batch-Update der AccountGroup-Sortierreihenfolge gestartet für ${orderUpdates.length} Gruppen.`);

    for (const update of orderUpdates) {
      // Finde die entsprechende AccountGroup im Store-State
      const existingGroup = accountStore.accountGroups.find(g => g.id === update.id);

      if (existingGroup) {
        // Prüfe, ob sich die sortOrder tatsächlich geändert hat
        if (existingGroup.sortOrder !== update.sortOrder) {
          // Rufe die bestehende updateAccountGroup-Methode auf
          const updatedGroup: AccountGroup = {
            ...existingGroup,
            sortOrder: update.sortOrder,
            updated_at: new Date().toISOString(),
          };

          await accountStore.updateAccountGroup(updatedGroup);
          debugLog('AccountService', `AccountGroup "${existingGroup.name}" (ID: ${update.id}) sortOrder von ${existingGroup.sortOrder} auf ${update.sortOrder} aktualisiert.`);
        } else {
          debugLog('AccountService', `AccountGroup "${existingGroup.name}" (ID: ${update.id}) sortOrder unverändert (${update.sortOrder}).`);
        }
      } else {
        warnLog('AccountService', `AccountGroup mit ID ${update.id} nicht im Store gefunden. Update übersprungen.`);
      }
    }

    infoLog('AccountService', `Batch-Update der AccountGroup-Sortierreihenfolge abgeschlossen.`);
  },

  // ---------------------------------------------------- Account Sortierung

  async updateAccountOrder(groupId: string, accountIds: string[]): Promise<void> {
    const accountStore = useAccountStore();
    const updates: { account: Account; newSortOrder: number }[] = [];

    infoLog('AccountService', `Account-Sortierung für Gruppe ${groupId} gestartet mit ${accountIds.length} Konten.`);

    // Iteriere über das accountIds-Array
    for (let index = 0; index < accountIds.length; index++) {
      const accountId = accountIds[index];

      // Finde das entsprechende Konto im accountStore
      const existingAccount = accountStore.accounts.find(acc => acc.id === accountId);

      if (existingAccount) {
        // Prüfe, ob die sortOrder sich geändert hat
        if (existingAccount.sortOrder !== index) {
          updates.push({
            account: existingAccount,
            newSortOrder: index
          });
        }
      } else {
        warnLog('AccountService', `Konto mit ID ${accountId} nicht im Store gefunden. Update übersprungen.`);
      }
    }

    // Wenn es zu aktualisierende Konten gibt, führe das Update aus
    if (updates.length > 0) {
      for (const update of updates) {
        const updatedAccount: Account = {
          ...update.account,
          sortOrder: update.newSortOrder,
          updated_at: new Date().toISOString()
        };
        await accountStore.updateAccount(updatedAccount);
      }
      infoLog('AccountService', `${updates.length} Konten in Gruppe ${groupId} erfolgreich neu sortiert.`);
    } else {
      infoLog('AccountService', `Keine Sortierungsänderungen für Gruppe ${groupId} erforderlich.`);
    }
  },

  async moveAccountToGroup(accountId: string, newGroupId: string, newIndex: number): Promise<void> {
    const accountStore = useAccountStore();

    infoLog('AccountService', `Verschiebe Konto ${accountId} zu Gruppe ${newGroupId} an Position ${newIndex}.`);

    // Finde das zu verschiebende Konto
    const accountToMove = accountStore.accounts.find(acc => acc.id === accountId);
    if (!accountToMove) {
      warnLog('AccountService', `Konto mit ID ${accountId} nicht gefunden. Verschiebung abgebrochen.`);
      return;
    }

    const originalGroupId = accountToMove.accountGroupId;
    infoLog('AccountService', `Konto "${accountToMove.name}" wird von Gruppe ${originalGroupId} zu Gruppe ${newGroupId} verschoben.`);

    // Wenn die Gruppen identisch sind, ist dies nur eine Neusortierung
    if (originalGroupId === newGroupId) {
      infoLog('AccountService', `Konto bleibt in derselben Gruppe ${newGroupId}. Neusortierung wird von updateAccountOrder behandelt.`);
      return;
    }

    // Aktualisiere das Konto mit der neuen Gruppe und Position
    const updatedAccount: Account = {
      ...accountToMove,
      accountGroupId: newGroupId,
      sortOrder: newIndex,
      updated_at: new Date().toISOString()
    };

    await accountStore.updateAccount(updatedAccount);
    infoLog('AccountService', `Konto "${accountToMove.name}" erfolgreich zu Gruppe ${newGroupId} verschoben.`);

    // Hole die aktualisierten Listen der Konten für beide Gruppen
    const sourceGroupAccounts = accountStore.accounts
      .filter(acc => acc.accountGroupId === originalGroupId)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const targetGroupAccounts = accountStore.accounts
      .filter(acc => acc.accountGroupId === newGroupId)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    // Berechne neue sortOrder für die Quellgruppe (ohne das verschobene Konto)
    for (let i = 0; i < sourceGroupAccounts.length; i++) {
      const account = sourceGroupAccounts[i];
      if (account.sortOrder !== i) {
        const updatedSourceAccount: Account = {
          ...account,
          sortOrder: i,
          updated_at: new Date().toISOString()
        };
        await accountStore.updateAccount(updatedSourceAccount);
      }
    }
    if (sourceGroupAccounts.length > 0) {
      infoLog('AccountService', `Konten in Quellgruppe ${originalGroupId} neu sortiert.`);
    }

    // Berechne neue sortOrder für die Zielgruppe (einschließlich des verschobenen Kontos)
    for (let i = 0; i < targetGroupAccounts.length; i++) {
      const account = targetGroupAccounts[i];
      if (account.sortOrder !== i) {
        const updatedTargetAccount: Account = {
          ...account,
          sortOrder: i,
          updated_at: new Date().toISOString()
        };
        await accountStore.updateAccount(updatedTargetAccount);
      }
    }
    if (targetGroupAccounts.length > 0) {
      infoLog('AccountService', `Konten in Zielgruppe ${newGroupId} neu sortiert.`);
    }

    // Hinweis: Salden werden automatisch durch BalanceService bei Bedarf neu berechnet
    infoLog('AccountService', `Verschiebung von Konto "${accountToMove.name}" erfolgreich abgeschlossen.`);
  },

  // ---------------------------------------------------- Initialisierung Standardkonten/-gruppen
  async initializeDefaultAccountsAndGroups(): Promise<void> {
    const accountStore = useAccountStore();
    debugLog('[AccountService]', 'initializeDefaultAccountsAndGroups', 'Starte Initialisierung der Standardkonten und -gruppen');

    const defaultGroupsData = [
      { name: 'Girokonten', sortOrder: 0 },
      { name: 'Sparkonten', sortOrder: 1 },
    ];

    let giroGroupId: string | undefined;

    for (const groupData of defaultGroupsData) {
      let group = accountStore.accountGroups.find(g => g.name === groupData.name);
      if (!group) {
        debugLog('[AccountService]', 'initializeDefaultAccountsAndGroups', `Kontogruppe "${groupData.name}" nicht im Store gefunden, versuche Erstellung.`);
        const newGroup = await this.addAccountGroup({
          name: groupData.name,
          sortOrder: groupData.sortOrder,
          logo_path: null
        });
        if (newGroup) {
          debugLog('[AccountService]', 'initializeDefaultAccountsAndGroups', `Kontogruppe "${newGroup.name}" erfolgreich erstellt.`);
          group = newGroup;
        } else {
          errorLog('[AccountService]', 'initializeDefaultAccountsAndGroups', `Fehler beim Erstellen der Kontogruppe "${groupData.name}".`);
          // Fahre fort, vielleicht existiert sie doch schon oder ein anderer Fehler ist aufgetreten
        }
      } else {
        debugLog('[AccountService]', 'initializeDefaultAccountsAndGroups', `Kontogruppe "${groupData.name}" bereits im Store vorhanden.`);
      }
      if (group && groupData.name === 'Girokonten') {
        giroGroupId = group.id;
      }
    }

    if (!giroGroupId) {
      // Versuch, die Girokonten-Gruppe erneut aus dem Store zu laden, falls sie gerade erst hinzugefügt wurde
      // und der Store noch nicht synchron war.
      const potentiallyCreatedGiroGroup = accountStore.accountGroups.find(g => g.name === 'Girokonten');
      if (potentiallyCreatedGiroGroup) {
        giroGroupId = potentiallyCreatedGiroGroup.id;
        debugLog('[AccountService]', 'initializeDefaultAccountsAndGroups', 'Girokonten-Gruppe nach erneutem Check im Store gefunden.');
      } else {
        errorLog('[AccountService]', 'initializeDefaultAccountsAndGroups', 'Basis-Kontengruppe "Girokonten" konnte nicht gefunden oder erstellt werden. Initiales Girokonto wird nicht angelegt.');
        return; // Ohne Girokonten-Gruppe kann kein Girokonto angelegt werden.
      }
    }

    const existingGiroAccount = accountStore.accounts.find(a => a.name === 'Girokonto' && a.accountGroupId === giroGroupId);
    if (!existingGiroAccount) {
      debugLog('[AccountService]', 'initializeDefaultAccountsAndGroups', 'Initiales "Girokonto" nicht im Store gefunden, versuche Erstellung.');
      await this.addAccount({
        name: 'Girokonto',
        description: 'Initiales Girokonto',
        note: '',
        accountType: AccountType.CHECKING,
        isActive: true,
        isOfflineBudget: false,
        accountGroupId: giroGroupId, // Hier die ID der zuvor gefundenen/erstellten Gruppe verwenden
        sortOrder: 0,
        iban: '',
        creditLimit: 0,
        offset: 0,
        logo_path: null,
      });
      debugLog('[AccountService]', 'initializeDefaultAccountsAndGroups', 'Initiales "Girokonto" erfolgreich zur Erstellung angestoßen.');
    } else {
      debugLog('[AccountService]', 'initializeDefaultAccountsAndGroups', 'Initiales "Girokonto" bereits im Store vorhanden.');
    }
    debugLog('[AccountService]', 'initializeDefaultAccountsAndGroups', 'Initialisierung abgeschlossen.');
  },
};
