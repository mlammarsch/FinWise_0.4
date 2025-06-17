// src/services/AccountService.ts
import { useAccountStore } from '@/stores/accountStore';
import { useTransactionStore } from '@/stores/transactionStore';
import { AccountType, type Account, type AccountGroup } from '@/types'; // AccountType und AccountGroup als Typ importiert
import { v4 as uuidv4 } from 'uuid';
import { debugLog, errorLog } from '@/utils/logger'; // errorLog importiert
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
        const newGroup = await this.addAccountGroup({ name: groupData.name, sortOrder: groupData.sortOrder });
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
        image: '',
      });
      debugLog('[AccountService]', 'initializeDefaultAccountsAndGroups', 'Initiales "Girokonto" erfolgreich zur Erstellung angestoßen.');
    } else {
      debugLog('[AccountService]', 'initializeDefaultAccountsAndGroups', 'Initiales "Girokonto" bereits im Store vorhanden.');
    }
    debugLog('[AccountService]', 'initializeDefaultAccountsAndGroups', 'Initialisierung abgeschlossen.');
  },
};
